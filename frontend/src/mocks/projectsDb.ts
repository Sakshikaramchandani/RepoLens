import type { FileContent, FileNode } from "../api/files";
import type { Project, SourceType } from "../api/projects";

/**
 * Fake "projects" + "repo_files" tables for MSW. DEVELOPMENT ONLY.
 * Saved in localStorage (key below) so data survives a reload.
 */
interface MockProject extends Project {
  ownerEmail: string;
}

interface MockFile {
  id: number;
  projectId: number;
  path: string;
  content: string;
}

interface Store {
  projects: MockProject[];
  files: MockFile[];
  nextProjectId: number;
  nextFileId: number;
}

export interface SampleFile {
  path: string;
  content: string;
}

const STORAGE_KEY = "repolens.mock.projects";

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* ignore */
  }
  return { projects: [], files: [], nextProjectId: 1, nextFileId: 1 };
}

function save(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function toPublic(p: MockProject): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    sourceType: p.sourceType,
    createdAt: p.createdAt,
  };
}

function extensionOf(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Folders first, then A–Z, at every level. */
function sortTree(nodes: FileNode[]): FileNode[] {
  nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "DIR" ? -1 : 1));
  nodes.forEach((node) => {
    if (node.children) sortTree(node.children);
  });
  return nodes;
}

/** Flat paths ("src/main/App.java") → nested FileNode tree. Apoorv's backend does the same. */
function buildTree(files: MockFile[]): FileNode[] {
  const root: FileNode[] = [];
  for (const file of files) {
    const parts = file.path.split("/");
    let level = root;
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const path = parts.slice(0, index + 1).join("/");
      let node = level.find((n) => n.path === path);
      if (!node) {
        node = isFile
          ? { name: part, path, type: "FILE", fileId: file.id, children: null }
          : { name: part, path, type: "DIR", fileId: null, children: [] };
        level.push(node);
      }
      if (!isFile) level = node.children ?? (node.children = []);
    });
  }
  return sortTree(root);
}

export const mockProjects = {
  list(email: string): Project[] {
    return load()
      .projects.filter((p) => p.ownerEmail === email)
      .map(toPublic);
  },

  find(email: string, id: number): Project | undefined {
    const project = load().projects.find((p) => p.id === id && p.ownerEmail === email);
    return project ? toPublic(project) : undefined;
  },

  create(email: string, name: string, description: string | null): Project {
    const store = load();
    const project: MockProject = {
      id: store.nextProjectId++,
      name,
      description,
      sourceType: "NONE",
      createdAt: new Date().toISOString(),
      ownerEmail: email,
    };
    store.projects.push(project);
    save(store);
    return toPublic(project);
  },

  remove(email: string, id: number): boolean {
    const store = load();
    const exists = store.projects.some((p) => p.id === id && p.ownerEmail === email);
    if (!exists) return false;
    store.projects = store.projects.filter((p) => p.id !== id);
    store.files = store.files.filter((f) => f.projectId !== id);
    save(store);
    return true;
  },

  /** Same rule as the real RepoFileService: a new import replaces the old files. */
  replaceFiles(projectId: number, sourceType: SourceType, files: SampleFile[]): number {
    const store = load();
    store.files = store.files.filter((f) => f.projectId !== projectId);
    for (const f of files) {
      store.files.push({
        id: store.nextFileId++,
        projectId,
        path: f.path,
        content: f.content,
      });
    }
    const project = store.projects.find((p) => p.id === projectId);
    if (project) project.sourceType = sourceType;
    save(store);
    return files.length;
  },

  /** Files of a project the user owns (null = no such project for this user). */
  files(email: string, projectId: number): Array<{ id: number; path: string; content: string }> | null {
    const store = load();
    if (!store.projects.some((p) => p.id === projectId && p.ownerEmail === email)) return null;
    return store.files
      .filter((f) => f.projectId === projectId)
      .map((f) => ({ id: f.id, path: f.path, content: f.content }));
  },

  tree(projectId: number): FileNode[] {
    return buildTree(load().files.filter((f) => f.projectId === projectId));
  },

  fileContent(email: string, fileId: number): FileContent | null {
    const store = load();
    const file = store.files.find((f) => f.id === fileId);
    if (!file) return null;
    const ownsProject = store.projects.some((p) => p.id === file.projectId && p.ownerEmail === email);
    if (!ownsProject) return null;
    return {
      fileId: file.id,
      path: file.path,
      extension: extensionOf(file.path),
      content: file.content,
    };
  },
};

/** A small fake multi-language repo (Spring Boot API, Python script, TypeScript client) for mock mode. */
export function sampleRepository(projectName: string): SampleFile[] {
  const pkg = "src/main/java/com/example/demo";
  return [
    {
      path: "README.md",
      content: `# ${projectName}\n\nSample repository created by the RepoLens mock API.\nIt looks like a small Spring Boot app so the explorer has something to show.\n`,
    },
    {
      path: "pom.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0">\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>com.example</groupId>\n  <artifactId>demo</artifactId>\n  <version>0.0.1-SNAPSHOT</version>\n</project>\n`,
    },
    {
      path: "src/main/resources/application.yml",
      content: `server:\n  port: 8080\nspring:\n  application:\n    name: demo\n`,
    },
    {
      path: `${pkg}/DemoApplication.java`,
      content: `package com.example.demo;\n\nimport org.springframework.boot.SpringApplication;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n\n@SpringBootApplication\npublic class DemoApplication {\n\n    public static void main(String[] args) {\n        SpringApplication.run(DemoApplication.class, args);\n    }\n}\n`,
    },
    {
      path: `${pkg}/controller/AuthController.java`,
      content: `package com.example.demo.controller;\n\nimport com.example.demo.service.AuthService;\nimport org.springframework.web.bind.annotation.*;\n\n@RestController\n@RequestMapping("/api/auth")\npublic class AuthController {\n\n    private final AuthService authService;\n\n    public AuthController(AuthService authService) {\n        this.authService = authService;\n    }\n\n    @PostMapping("/login")\n    public String login(@RequestParam String email, @RequestParam String password) {\n        return authService.login(email, password);\n    }\n}\n`,
    },
    {
      path: `${pkg}/service/AuthService.java`,
      content: `package com.example.demo.service;\n\nimport org.springframework.stereotype.Service;\n\n@Service\npublic class AuthService {\n\n    public String login(String email, String password) {\n        if (email == null || password == null || password.length() < 8) {\n            throw new IllegalArgumentException("Invalid credentials");\n        }\n        // TODO: check the password with BCrypt and return a JWT\n        return "token-for-" + email;\n    }\n}\n`,
    },
    {
      path: `${pkg}/model/User.java`,
      content: `package com.example.demo.model;\n\npublic record User(Long id, String email, String role) {}\n`,
    },
    {
      path: "scripts/seed_users.py",
      content: `"""Seed demo users into the database (run once after a fresh install)."""\nimport os\nimport psycopg\n\n\ndef seed(conn, emails):\n    for email in emails:\n        if not email or "@" not in email:\n            continue\n        try:\n            conn.execute("INSERT INTO users (email) VALUES (%s)", (email,))\n        except Exception:\n            pass\n    print("seeded", len(emails))\n\n\nif __name__ == "__main__":\n    with psycopg.connect(os.environ["DB_URL"]) as conn:\n        seed(conn, ["demo@repolens.dev", "admin@repolens.dev"])\n`,
    },
    {
      path: "web/src/api/auth.ts",
      content: `// Browser client for the login API\nexport interface LoginResult {\n  token: string;\n}\n\nexport async function login(email: string, password: string): Promise<LoginResult> {\n  const res = await fetch("/api/auth/login", {\n    method: "POST",\n    headers: { "Content-Type": "application/json" },\n    body: JSON.stringify({ email, password }),\n  });\n  if (!res.ok) {\n    console.log("login failed", res.status);\n    throw new Error("Login failed");\n  }\n  return res.json();\n}\n`,
    },
    {
      path: "src/test/java/com/example/demo/AuthServiceTest.java",
      content: `package com.example.demo;\n\nimport static org.junit.jupiter.api.Assertions.assertThrows;\n\nimport com.example.demo.service.AuthService;\nimport org.junit.jupiter.api.Test;\n\nclass AuthServiceTest {\n\n    @Test\n    void rejectsShortPasswords() {\n        assertThrows(IllegalArgumentException.class, () -> new AuthService().login("a@b.co", "123"));\n    }\n}\n`,
    },
    {
      path: "web/src/api.ts",
      content: `export async function login(email: string, password: string): Promise<string> {\n  const response = await fetch('/api/auth/login', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify({ email, password }),\n  });\n  if (!response.ok) throw new Error('Login failed');\n  return response.text();\n}\n`,
    },
  ];
}
