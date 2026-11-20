# Deploying RepoLens (beginner guide)

```
  Browser ──► Vercel (frontend, free)
     │
     └──► https://<your-ip>.sslip.io ──► AWS EC2 machine
                                            ├─ Caddy  (HTTPS, free certificate)
                                            ├─ Spring Boot backend (port 8080, private)
                                            ├─ Ollama (AI models, private)
                                            └─ /opt/repolens/storage (imported repo files)
                                     │
                                     └──► Supabase (PostgreSQL + pgvector database, free tier)
```

Do the parts **in this order** — each one gives you an address the next one needs.

| Part | What you get | Time |
| --- | --- | --- |
| 1. Supabase | database connection details | 10 min |
| 2. AWS | the backend's public address | 45 min |
| 3. Vercel | the website's address | 10 min |
| 4. Finish the backend | backend running | 15 min |
| 5. Sign-in apps | GitHub / Google login working | 15 min |

## Before you start: what it costs

- **Vercel** (Hobby) and **Supabase** (Free) cost nothing. Supabase pauses a free project after about a week with no activity — open the dashboard and press *Restore* if that happens.
- **AWS is not free for this app.** RepoLens runs its AI model (Ollama) on the server, which needs memory:

| EC2 type | RAM | Chat model | Rough price (Mumbai, on 24/7) |
| --- | --- | --- | --- |
| `t3.large` (**recommended**) | 8 GB | `qwen2.5-coder:7b` (same as your laptop) | ≈ US$65 / month |
| `t3.medium` (budget) | 4 GB | `qwen2.5-coder:1.5b` (faster, weaker answers) | ≈ US$33 / month |

Plus ≈ US$3/month for the disk and ≈ US$4/month for the public IP. Answers on a CPU-only server are slower than on your laptop (a long answer can take a minute). **Stopping the instance when you are not using it stops the hourly cost** (disk and IP still cost a little).

Set up a budget alarm first: AWS console → search **Billing and Cost Management** → **Budgets** → *Create budget* → *Monthly cost budget* → e.g. US$40 → your email.

---

## Part 1 — Supabase (database)

1. Sign up at <https://supabase.com> (log in with GitHub is easiest).
2. **New project** → name `repolens`, **generate a strong database password and save it** (password manager or a note — you need it later), region **Mumbai (ap-south-1)** (same region as the AWS server = faster).
3. Wait until the project is ready (≈ 2 min).
4. Click **Connect** (top of the project page) → tab **Connection string** → choose **Type: JDBC**, **Method: Session pooler**. You see something like
   `jdbc:postgresql://aws-0-ap-south-1.pooler.supabase.com:5432/postgres?user=postgres.abcdefgh&password=[YOUR-PASSWORD]`
5. Write down three values:
   - `DB_URL` = `jdbc:postgresql://aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require`
   - `DB_USERNAME` = `postgres.abcdefgh` (the part after `user=`)
   - `DB_PASSWORD` = the password from step 2

You don't need to create tables — the backend creates them on first start (Flyway), including the `vector` extension.

> Use the **Session pooler**, not "Direct connection": the direct one only works over IPv6, which a default AWS machine doesn't have.

---

## Part 2 — AWS (backend server)

### 2.1 Account and region
1. Create an account at <https://aws.amazon.com> (needs a card). Turn on MFA for the root user when it suggests it.
2. Top right of the console, pick the region **Asia Pacific (Mumbai) ap-south-1**.

### 2.2 Launch the machine
Console → search **EC2** → **Launch instance**:

| Field | Value |
| --- | --- |
| Name | `repolens-backend` |
| Image (AMI) | **Ubuntu Server 24.04 LTS**, 64-bit (x86) |
| Instance type | `t3.large` (or `t3.medium`, see costs) |
| Key pair | *Create new key pair* → name `repolens-key`, type RSA, format **.pem** → it downloads `repolens-key.pem`. **Keep it safe; it is the only way in.** |
| Network settings → Edit | Allow **SSH** from **My IP**; tick **Allow HTTPS traffic from the internet** and **Allow HTTP traffic from the internet** |
| Storage | **30 GiB**, gp3 |

Click **Launch instance**.

### 2.3 Give it a fixed address
EC2 → **Elastic IPs** (left menu) → *Allocate Elastic IP address* → *Allocate* → select it → *Actions* → *Associate* → choose `repolens-backend` → *Associate*.

Note the IP, e.g. `13.201.45.6`. Your backend address is that IP with **dashes** + `.sslip.io`:

```
API_DOMAIN = 13-201-45-6.sslip.io        →  https://13-201-45-6.sslip.io
```

([sslip.io](https://sslip.io) is a free service that turns that name into your IP, so you get HTTPS without buying a domain. If you own a domain, create an `A` record such as `api.yourdomain.com → 13.201.45.6` and use that instead.)

### 2.4 Connect from your laptop (PowerShell)
Move `repolens-key.pem` to `C:\Users\user\.ssh\`, then fix its permissions once (SSH refuses keys others can read):

```powershell
$key = "$env:USERPROFILE\.ssh\repolens-key.pem"
icacls $key /inheritance:r
icacls $key /grant:r "$($env:USERNAME):(R)"
ssh -i $key ubuntu@13.201.45.6        # type "yes" the first time
```

You are now on the server (prompt `ubuntu@ip-...`). Type `exit` to leave.

### 2.5 Install everything on the server
From **your laptop** (PowerShell, in the project folder), copy the setup files up:

```powershell
cd C:\Projects\RepoLens-private
scp -i $key -r deploy/aws ubuntu@13.201.45.6:~/deploy
```

Then on the **server**:

```bash
ssh -i $key ubuntu@13.201.45.6
bash ~/deploy/setup-server.sh 13-201-45-6.sslip.io                       # t3.large
# or: bash ~/deploy/setup-server.sh 13-201-45-6.sslip.io qwen2.5-coder:1.5b   # t3.medium
```

It installs Java 21, Ollama + the AI models, Caddy (HTTPS) and the `repolens` service. It takes 10–20 minutes (the model download is ~5 GB). It ends with "Done."

### 2.6 Build the backend on your laptop and upload it

```powershell
cd C:\Projects\RepoLens-private\Backend\backend
.\mvnw.cmd -DskipTests package
scp -i $key target\backend-0.0.1-SNAPSHOT.jar ubuntu@13.201.45.6:~/app.jar
ssh -i $key ubuntu@13.201.45.6 "sudo mv ~/app.jar /opt/repolens/app.jar && sudo chown repolens:repolens /opt/repolens/app.jar"
```

Don't start it yet — it needs the website address from Part 3.

---

## Part 3 — Vercel (frontend)

1. Sign up at <https://vercel.com> **with your GitHub account**.
2. **Add New… → Project** → *Import* your repository `RepoLens_Final` (if it isn't listed: *Adjust GitHub App Permissions* and give Vercel access to it).
3. Configure:
   - **Root Directory**: `frontend` (click *Edit*)
   - Framework Preset: **Vite** (detected automatically); build command and output (`dist`) stay default
   - **Environment Variables**:
     - `VITE_API_BASE_URL` = `https://13-201-45-6.sslip.io` (your API_DOMAIN, no trailing slash)
     - `VITE_USE_MOCKS` = `false`
4. **Deploy**. When it finishes you get the address, e.g. `https://repolens-final.vercel.app`. Note it — this is `FRONTEND_URL`.

`frontend/vercel.json` already tells Vercel to send every page (like `/auth/google/callback`) to the app. Every push to `main` on GitHub now redeploys the frontend automatically.

> `VITE_*` values are baked in at build time. If you change one later, go to *Deployments* → latest → *Redeploy*.

---

## Part 4 — Finish the backend

### 4.1 Create the production sign-in apps (keep your local ones for development)
- **GitHub**: <https://github.com/settings/developers> → *OAuth Apps* → *New OAuth App*
  - Name `RepoLens`, Homepage `https://repolens-final.vercel.app`
  - Authorization callback URL `https://repolens-final.vercel.app/integrations/github/callback`
  - *Register* → copy the **Client ID**, *Generate a new client secret* → copy it.
- **Google**: <https://console.cloud.google.com> → your project → *APIs & Services* → *Credentials* → your OAuth client (or *Create credentials → OAuth client ID → Web application*):
  - **Authorized JavaScript origins**: add `https://repolens-final.vercel.app`
  - **Authorized redirect URIs**: add `https://13-201-45-6.sslip.io/login/oauth2/code/google`
  - *Save*. Then *OAuth consent screen* → **Publish app** (otherwise only listed test users can sign in).

### 4.2 Fill in the server's settings
On the server: `sudo nano /opt/repolens/.env` (arrow keys to move, `Ctrl+O` Enter to save, `Ctrl+X` to quit). Fill in:

| Setting | Value |
| --- | --- |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | from Part 1 |
| `JWT_SECRET` | run `openssl rand -base64 48` on the server, paste the output |
| `GITHUB_TOKEN_KEY` | run `openssl rand -base64 32`, paste |
| `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` | `https://repolens-final.vercel.app` |
| `GITHUB_CLIENT_ID` / `_SECRET` | the **production** GitHub OAuth App |
| `GOOGLE_CLIENT_ID` / `_SECRET` | your Google OAuth client |
| `GOOGLE_REDIRECT_URI` | already set to `https://<API_DOMAIN>/login/oauth2/code/google` — check it |

Use **new** secrets here; never reuse the ones from your laptop's `.env`.

### 4.3 Start it

```bash
sudo systemctl restart repolens
journalctl -u repolens -f          # live log; wait for "Started BackendApplication", then Ctrl+C
curl https://13-201-45-6.sslip.io/api/auth/providers
# → {"github":true,"google":true}
```

---

## Part 5 — Check everything

Open `https://repolens-final.vercel.app` and:

1. Register with email + password → you land on the dashboard.
2. Sign out, then *Continue with GitHub* and *Continue with Google*.
3. Import a small public repo → **Index project** → wait until done.
4. Ask a question in **Chat** (the answer streams in), run a **Review**, open **Risk**.

---

## Everyday tasks

**Update the frontend:** push to GitHub → Vercel redeploys by itself.

**Update the backend:** repeat 2.6 (build, upload, move), then `sudo systemctl restart repolens`. Database changes (new Flyway migrations) apply automatically on start.

**See logs:** `journalctl -u repolens -n 200` (backend), `journalctl -u caddy -n 50` (HTTPS), `journalctl -u ollama -n 50` (AI).

**Save money:** EC2 → select the instance → *Instance state* → **Stop** (start it again later; the Elastic IP stays the same, everything restarts by itself).

## When something goes wrong

| Symptom | Fix |
| --- | --- |
| Website shows "Network error" / nothing loads | `VITE_API_BASE_URL` in Vercel wrong or backend down: `curl https://<API_DOMAIN>/api/auth/providers` from your laptop; check `systemctl status repolens` |
| Browser console: *blocked by CORS policy* | `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` must be exactly the Vercel URL (https, no trailing slash); restart the backend |
| `curl` to the API fails with a certificate error | Caddy couldn't get a certificate: ports 80 and 443 must be open in the security group; `journalctl -u caddy -n 50` |
| Backend log: `Could not resolve placeholder 'JWT_SECRET'` | that setting is empty in `/opt/repolens/.env` |
| Backend log: `function uuid_generate_v4() does not exist` | add `&currentSchema=public,extensions` to the end of `DB_URL` |
| Backend log: connection refused / timeout to Supabase | wrong `DB_URL` (must be the **Session pooler**, port 5432, `sslmode=require`) or the Supabase project is paused |
| GitHub: *redirect_uri is not associated with this application* | the production OAuth App's callback must be `https://<vercel-url>/integrations/github/callback` |
| Google: *redirect_uri_mismatch* | add `https://<API_DOMAIN>/login/oauth2/code/google` exactly in Google Cloud Console |
| Chat says the AI model is busy / very slow | the machine is too small for the model: use `t3.large`, or set `OLLAMA_CHAT_MODEL=qwen2.5-coder:1.5b` (run `ollama pull qwen2.5-coder:1.5b` first) |

## Notes

- **Your local data doesn't move.** Accounts and projects on your laptop stay there; the cloud starts empty.
- **Imported repo files live on the EC2 disk** (`/opt/repolens/storage`), not in Supabase Storage — the backend reads them from disk. Moving them to Supabase Storage would need code changes.
- Keep `DEV_TOOLS_ENABLED=false` in production (it hides Swagger and the debug endpoints).
