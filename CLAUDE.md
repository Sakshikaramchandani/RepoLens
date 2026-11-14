# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RepoLens is an AI code-intelligence platform for repositories in any language (30+ supported; Java gets a real parser): users import a GitHub repo (OAuth or URL) or a ZIP, index it into pgvector, then chat with it (RAG with file:line citations), run an AI code review, and view a static risk map. Two independent apps:

- `Backend/backend/` — Spring Boot 3.5, Java 21, Maven, Spring AI 1.1 (Ollama only — chat, review and embeddings), PostgreSQL + pgvector, Flyway
- `frontend/` — Vite 7, React 19, TypeScript (strict), Tailwind 4, React Router 7, GSAP, Sonner, MSW 2, Vitest 3

Backend code comments are partly Hinglish. Secrets live in `Backend/backend/.env` (gitignored, imported via `spring.config.import`); `.env.example` lists every variable.

## Commands

### Infrastructure

```bash
docker compose up -d                 # repo root: pgvector/pg16 on :5432, db/user/password = repolens
ollama serve                         # or: brew services start ollama
ollama pull nomic-embed-text         # embeddings (always Ollama)
ollama pull qwen2.5-coder:7b         # chat + review model
```

### Backend (`cd Backend/backend`; JDK 21 — on this Mac: `export JAVA_HOME=/opt/homebrew/opt/openjdk@21`)

```bash
./mvnw spring-boot:run                                    # :8080, Swagger at /swagger-ui.html (DEV_TOOLS_ENABLED=true)
./mvnw test                                               # all tests (BackendApplicationTests needs Postgres)
./mvnw test -Dtest=LlmRouterTest                          # one class
./mvnw test -Dtest=LlmRouterTest#completeReturnsWholeAnswer   # one method
./mvnw spotless:apply                                     # format (palantir-java-format, 120 cols); `verify` runs spotless:check
```

### Frontend (`cd frontend`)

```bash
npm run dev                 # :5173 against the real backend (.env.development)
npm run dev:mock            # :5173 with MSW mock API, no backend (.env.mock) — chat, review, risk, profile all mocked
npm run check               # typecheck + eslint + prettier --check + vitest
npm test                    # vitest run
npx vitest run src/test/chatActions.test.tsx   # one file
npx vitest run -t "regenerate"                 # by test name
npm run lint / npm run format / npm run build
```

Restart the dev server after editing any `.env*` file. Tests pass on Node 20–26: `src/test/setup.ts` installs an in-memory Web Storage (Node ≥25 shadows jsdom's `localStorage`) and wraps `fetch` so jsdom `AbortSignal`s work with Node's fetch.

## Backend architecture

Package-by-feature under `com.repolens`: `ai`, `auth`, `user`, `project`, `file`, `github`, `history`, `storage`, `language`, `indexing`, `chunking`, `retrieval`, `chat`, `review`, `risk`.

**Languages (`language/`)** — `Language` enum is the single registry (extensions, special file names, `Kind` CODE/QUERY/MARKUP/CONFIG/DOCS, comment `Syntax`). `Languages.detect(path)`; `CodeText.strip` blanks comments/strings keeping newlines; `Definitions.find` locates functions/types/sections per language by regex (brace or indentation spans, params, nesting, parent type). It drives `RepoFileService.isAllowed` (import), `IndexableFiles` (indexing: skips tests in every language, generated `*.gen.ts`/`*_pb2.py`…, lock files, minified, JSON data), `StructureChunker` (all non-Java chunking) and `GenericRiskAnalyzer`. Adding a language = enum constant + optional rules in `Definitions` + the frontend map in `components/explorer/languages.ts`.

**Cross-cutting conventions**
- Stateless JWT (`JwtAuthFilter`); controllers take `@AuthenticationPrincipal User`. Every project-scoped service method first calls `projectService.getOwnedProject(projectId, userId)` — that is the authorization check. Conversations use `ConversationService.requireOwned`.
- Throw `ApiException(HttpStatus, message)`; `GlobalExceptionHandler` returns `{ "message", "errors"? }`.
- Flyway owns the schema (V1–V10, `ddl-auto: validate`): entity changes need a new `V{n}__*.sql`. `vector_store` is Flyway-created too.
- Files live at `${app.storage.root}/{userId}/{projectId}`; read them via `file.ProjectFileReader` / `StorageService.resolveSafely` (zip-slip guard).
- Public endpoints are listed in `SecurityConfig` (auth, GitHub sign-in/callback forwarders, Swagger).
- **Auth security:** `JWT_SECRET` and `GITHUB_TOKEN_KEY` are required (no defaults). `AuthRateLimiter` throttles login (per IP + failed logins per email), register and OAuth callbacks (in memory, 429). JWTs issued before `users.tokens_valid_after` are rejected (`JwtService.issuedAfterRevocation`); `POST /api/auth/logout` revokes all of a user's tokens. GitHub/Google sign-in goes through `OAuthAccounts.findOrCreate`: an existing account with `email_verified = false` (email + password sign-up) is *claimed* — password replaced, old tokens revoked — so nobody can pre-register someone else's email. The frontend binds each OAuth round trip to its tab (`lib/oauthState.ts`: state stored before redirect, required on the callback page).
- `DEV_TOOLS_ENABLED` (default false) turns on Swagger/OpenAPI and `AiDiagnosticsController` (`/api/ai/test-*`).

**AI layer (`ai/`)** — everything that needs a chat model goes through `LlmRouter` (`stream` / `complete`), which wraps the single `LlmClient` bean and tags each chunk/result with `provider` + `model`. There is no remote provider and no fallback.
- `OllamaClient` wraps Spring AI's auto-configured Ollama `ChatModel` (`spring.ai.model.chat: ollama`, model `OLLAMA_CHAT_MODEL`, default `qwen2.5-coder:7b`, `num-ctx` 16384). There is no OpenAI starter.
- **Embedding dimension is load-bearing:** always Ollama `nomic-embed-text` (768) = `VECTOR(768)` in V4. Changing it needs a migration and full re-index.

**Indexing** (`POST /api/projects/{id}/index`, poll `.../index/status`; never-indexed returns 200 `{status:"NOT_INDEXED", jobId:null}`)
`IndexingService.start` is intentionally non-transactional; `IndexWorker.run` is `@Async("indexingExecutor")` in its own bean. Re-index deletes the project's chunks, filters with `chunking.IndexableFiles`, chunks with `AstCodeChunker` (`@Primary`; `FallbackLineChunker` on failure), and `ChunkStore.addBatch` embeds + stores with metadata (`projectId`, `filePath`, `startLine`, `endLine`, `type`, `className`, `methodName`).

**Chat** (`POST /api/chat`, SSE): `ChatRequest{projectId, conversationId, message, regenerate}`. Validation errors are SSE `error` events (no `@Valid`). Stream contract: `token`* → `sources` → `done{conversationId, model}`, or `error` → `done`. Regenerate = `ConversationService.rewindToLastQuestion` (deletes answers after the last question). History is read before the new question is saved; short follow-ups borrow the previous question for retrieval (`ChatService.retrievalQuery`). The answer is saved once (complete/error/cancel); empty answers are not saved. Conversations: list + `?q=` search (title or message text), `PATCH`/`DELETE /api/conversations/{id}`. SSE runs on the `mvcAsyncExecutor` pool (`AsyncConfig`).
`HybridRetriever` = pgvector similarity + Postgres full-text on `content_tsv` → `RrfFusion` → `ContextExpander.diversify` (max 3 chunks/file; broad questions: `broad-top-k`, max 2/file) → outlines of files the picked chunks reference (`ContextExpander.referencedFiles`, one hop, via `ProjectIndex.outlines`); tunables `app.chat.*`. The prompt also carries a folder-grouped map of every indexed path (`PromptBuilder.fileMap`, `ProjectIndex.files`). `PromptBuilder.SYSTEM_PROMPT` enforces CONTEXT-only claims, `[File.java:42-60]` citations, injection guard; empty retrieval short-circuits with `NOT_FOUND_ANSWER`.

**Review** (`POST /api/projects/{id}/review`): ≤5 files sent with line numbers; the model must return JSON; `ReviewParser` tolerates fences/extra text, normalises severity/category, drops issues for unknown files, clamps lines, sorts by severity.

**Risk** (`GET /api/projects/{id}/risk`): every CODE-kind file; Java → `JavaRiskAnalyzer` (JavaParser), others → `GenericRiskAnalyzer` — complexity, LOC, nesting, params, smells → score 0–100. No AI. With history (`projects.history_commits > 0`) `scoreWithHistory` adds churn and bug-fix commits.

**History (`history/`)** — `GitCloner.cloneWithHistory` clones `app.github.history-depth` (300) commits; `GitHistoryAnalyzer` walks them (skips merges/root/shallow edge, bug fix = message regex) → `file_history` rows (V8) via `FileHistoryService` at import time. ZIP uploads read a bundled `.git` folder the same way.

**Profile (`user/`)** — `users.username` (unique case-insensitive, V9 backfilled), `avatar_url` + `avatar_source` (null/GITHUB/GOOGLE/UPLOAD/NONE), `google_avatar_url`; uploads live in `user_avatars` (bytes) served publicly at `/api/avatars/{token}`. `ProfileService.applyProviderPicture` runs on GitHub/Google sign-in and GitHub connect and only replaces pictures the user didn't choose. `/api/users/me` GET/PATCH, `/api/users/me/avatar` PUT/DELETE, `/avatar/source` PUT. Users never see provider names: `LlmException.userMessage()` is what reaches chat/review; details go to logs.

**GitHub** — `GithubOAuthService` handles both flows with one callback URL: connect (signed in, state subject `u<id>`) and "Continue with GitHub" sign-in (`GithubLoginService`, state subject `login`, scope adds `user:email`; account = previously connected login → verified email match → new user). The authorize URL deliberately omits `redirect_uri` (GitHub uses the app's registered callback); `GithubCallbackForwarder` (backend) and `AppRoutes` (frontend) forward any stray `?code&state` to `/integrations/github/callback`. Tokens are AES-GCM encrypted (`TokenEncryptor`); `GithubImportService` falls back to the connected account's token for private repos.

## Frontend architecture

- **Shell:** `AppLayout` (sidebar with sliding active pill + recent projects — collapsible to a rail, or hidden entirely with the top-bar button / ⌘B·Ctrl+B; project pages are wide with a compact header; chat history, the Code tab's file tree and review picker follow the same show/hide-or-pin idea, floating content panel that scrolls on desktop, glass top bar with `Breadcrumbs`) wraps signed-in routes and provides `ProjectsProvider` (one shared project list; consume with `useProjects` from `projects/projectsContext`). `AuthLayout` = form + animated product preview.
- **Project workspace:** `/projects/:id[/chat|/review|/risk]` → `pages/project/ProjectLayout` loads project, file tree and indexing state once into `ProjectContext` (`useProject()`); tabs are lazy routes. Index state comes from the single `useIndexing` in the layout.
- **API:** `api/contract.ts` (endpoints, public endpoints, auth scheme) + typed modules per feature. One Axios instance (`api/client.ts`) adds the JWT and maps errors to `ApiError`; 401 on a protected call logs out. Chat streaming (`api/chat.ts`) uses `fetch` + `ReadableStream` (EventSource can't send headers). When a backend shape changes, update the API module and the MSW handler in `src/mocks/`.
- **Design system:** tokens in `src/styles/index.css` (`--rl-*` per `[data-theme]` → Tailwind utilities `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`…). Near-monochrome with one ember accent; Geist / Geist Mono. Shared primitives in `components/ui` (Button/IconButton with `rl-press`, Card, Badge, Alert, Modal, TextField `inputSize`, SegmentedControl, ProgressBar, Skeleton, EmptyState). Use them instead of ad-hoc styles.
- **Motion:** GSAP via `motion/gsap.ts` (registers `useGSAP`, `SplitText`). Route entrance = `PageEnter` (keyed per section in `AppLayout`): mark the title block `data-enter="lead"` and following blocks `data-enter="support"`. CSS handles micro-interactions (`rl-press`, `rl-enter`, `rl-typing`, `rl-caret`, `rl-check`). Respect `prefersReducedMotion()`; never animate high-frequency/keyboard actions.
- **Profile:** `/profile` (`ProfilePage`) — username + picture; `lib/cropImage.ts` crops to 256px WebP/JPEG before upload; `components/ui/Avatar` resolves `/api/avatars/…` against the API base and falls back to initials; `useAuth().updateUser` refreshes the sidebar after edits. The UI shows AI models by role + model name only (no provider names).
- **i18n:** English only (`i18n/locales/en.ts`); keep all UI copy in it and use `t()` — adding a language later means a new dictionary typed as `Dictionary`.
- **Tests:** MSW node server with `onUnhandledRequest: 'error'` — every request a test triggers needs a handler (`server.use(...)` per test). Single-use OAuth codes are de-duplicated module-wide in `GithubCallbackPage`, so tests use distinct codes.
