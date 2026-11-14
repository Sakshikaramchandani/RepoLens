// Import the 'light' build directly: only the languages registered below get bundled.
import PrismLight from "react-syntax-highlighter/dist/esm/prism-light";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import dart from "react-syntax-highlighter/dist/esm/languages/prism/dart";
import docker from "react-syntax-highlighter/dist/esm/languages/prism/docker";
import elixir from "react-syntax-highlighter/dist/esm/languages/prism/elixir";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import graphql from "react-syntax-highlighter/dist/esm/languages/prism/graphql";
import groovy from "react-syntax-highlighter/dist/esm/languages/prism/groovy";
import hcl from "react-syntax-highlighter/dist/esm/languages/prism/hcl";
import ini from "react-syntax-highlighter/dist/esm/languages/prism/ini";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import kotlin from "react-syntax-highlighter/dist/esm/languages/prism/kotlin";
import less from "react-syntax-highlighter/dist/esm/languages/prism/less";
import lua from "react-syntax-highlighter/dist/esm/languages/prism/lua";
import makefile from "react-syntax-highlighter/dist/esm/languages/prism/makefile";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import objectivec from "react-syntax-highlighter/dist/esm/languages/prism/objectivec";
import php from "react-syntax-highlighter/dist/esm/languages/prism/php";
import powershell from "react-syntax-highlighter/dist/esm/languages/prism/powershell";
import properties from "react-syntax-highlighter/dist/esm/languages/prism/properties";
import protobuf from "react-syntax-highlighter/dist/esm/languages/prism/protobuf";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import r from "react-syntax-highlighter/dist/esm/languages/prism/r";
import ruby from "react-syntax-highlighter/dist/esm/languages/prism/ruby";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import sass from "react-syntax-highlighter/dist/esm/languages/prism/sass";
import scala from "react-syntax-highlighter/dist/esm/languages/prism/scala";
import scss from "react-syntax-highlighter/dist/esm/languages/prism/scss";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import swift from "react-syntax-highlighter/dist/esm/languages/prism/swift";
import toml from "react-syntax-highlighter/dist/esm/languages/prism/toml";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";

/**
 * PrismLight only ships the languages registered here (the explorer chunk loads lazily, so the
 * first screen stays small). Keep in sync with the backend's language registry (language/Language.java).
 */
const LANGUAGES = {
  bash,
  c,
  cpp,
  csharp,
  css,
  dart,
  docker,
  elixir,
  go,
  graphql,
  groovy,
  hcl,
  ini,
  java,
  javascript,
  json,
  jsx,
  kotlin,
  less,
  lua,
  makefile,
  markdown,
  markup,
  objectivec,
  php,
  powershell,
  properties,
  protobuf,
  python,
  r,
  ruby,
  rust,
  sass,
  scala,
  scss,
  sql,
  swift,
  toml,
  tsx,
  typescript,
  yaml,
} as const;

for (const [name, grammar] of Object.entries(LANGUAGES)) {
  PrismLight.registerLanguage(name, grammar);
}

export type LanguageName = keyof typeof LANGUAGES;

export function isLanguageName(name: string): name is LanguageName {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, name);
}

const BY_EXTENSION: Record<string, LanguageName> = {
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  sc: "scala",
  gradle: "groovy",
  groovy: "groovy",
  cs: "csharp",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  hxx: "cpp",
  ino: "cpp",
  m: "objectivec",
  mm: "objectivec",
  go: "go",
  mod: "go",
  rs: "rust",
  swift: "swift",
  dart: "dart",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  vue: "markup",
  svelte: "markup",
  php: "php",
  py: "python",
  pyi: "python",
  rb: "ruby",
  rake: "ruby",
  gemspec: "ruby",
  ex: "elixir",
  exs: "elixir",
  r: "r",
  lua: "lua",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  psm1: "powershell",
  sql: "sql",
  html: "markup",
  htm: "markup",
  xml: "markup",
  svg: "markup",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  yml: "yaml",
  yaml: "yaml",
  json: "json",
  toml: "toml",
  properties: "properties",
  ini: "ini",
  cfg: "ini",
  tf: "hcl",
  tfvars: "hcl",
  hcl: "hcl",
  proto: "protobuf",
  graphql: "graphql",
  gql: "graphql",
  mk: "makefile",
  md: "markdown",
  mdx: "markdown",
};

const BY_FILE_NAME: Record<string, LanguageName> = {
  dockerfile: "docker",
  containerfile: "docker",
  makefile: "makefile",
  gnumakefile: "makefile",
  gemfile: "ruby",
  rakefile: "ruby",
  jenkinsfile: "groovy",
};

/** Prism language for a file, or null for plain text. */
export function languageFor(extension: string, path: string): LanguageName | null {
  const fileName = path.split("/").pop()?.toLowerCase() ?? "";
  if (BY_FILE_NAME[fileName]) return BY_FILE_NAME[fileName];
  if (fileName.startsWith("dockerfile.") || fileName.endsWith(".dockerfile")) return "docker";
  return BY_EXTENSION[extension.toLowerCase()] ?? null;
}

const LABELS: Partial<Record<LanguageName, string>> = {
  markup: "XML / HTML",
  yaml: "YAML",
  json: "JSON",
  sql: "SQL",
  css: "CSS",
  scss: "SCSS",
  jsx: "JSX",
  tsx: "TSX",
  typescript: "TypeScript",
  javascript: "JavaScript",
  csharp: "C#",
  cpp: "C++",
  c: "C",
  objectivec: "Objective-C",
  php: "PHP",
  toml: "TOML",
  hcl: "Terraform",
  graphql: "GraphQL",
  protobuf: "Protocol Buffers",
  powershell: "PowerShell",
  docker: "Dockerfile",
  ini: "INI",
  r: "R",
};

/** Short label shown in the viewer header, e.g. "Java", "YAML". */
export function languageLabel(language: LanguageName | null): string | null {
  if (!language) return null;
  return LABELS[language] ?? language.charAt(0).toUpperCase() + language.slice(1);
}

export { PrismLight as SyntaxHighlighter };
