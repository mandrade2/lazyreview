import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki"

export interface HighlightedToken {
  content: string
  color: string
}

export type HighlightedLine = HighlightedToken[]

// Default text color matching the app theme
const DEFAULT_COLOR = "#e6edf3"

let highlighterPromise: Promise<Highlighter> | null = null

// Get or create the singleton highlighter
async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: [], // Languages loaded on demand
    })
  }
  return highlighterPromise
}

// Map file extensions to shiki language IDs
const extensionToLang: Record<string, string> = {
  // JavaScript/TypeScript
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",

  // Web
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",

  // Data/Config
  json: "json",
  json5: "json5",
  jsonc: "jsonc",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  ini: "ini",
  env: "dotenv",

  // Shell
  sh: "bash",
  bash: "bash",
  zsh: "zsh",
  fish: "fish",
  ps1: "powershell",
  psm1: "powershell",
  bat: "batch",
  cmd: "batch",

  // Systems
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  rs: "rust",
  go: "go",
  zig: "zig",

  // JVM
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  groovy: "groovy",
  gradle: "groovy",

  // .NET
  cs: "csharp",
  fs: "fsharp",
  vb: "vb",

  // Scripting
  py: "python",
  pyw: "python",
  pyi: "python",
  rb: "ruby",
  rake: "ruby",
  gemspec: "ruby",
  php: "php",
  pl: "perl",
  pm: "perl",
  lua: "lua",
  r: "r",
  R: "r",
  jl: "julia",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hrl: "erlang",
  clj: "clojure",
  cljs: "clojure",
  cljc: "clojure",
  hs: "haskell",
  lhs: "haskell",
  ml: "ocaml",
  mli: "ocaml",
  nim: "nim",
  v: "v",
  awk: "awk",

  // Mobile
  swift: "swift",
  m: "objective-c",
  mm: "objective-cpp",
  dart: "dart",

  // Databases
  sql: "sql",
  mysql: "sql",
  pgsql: "sql",
  prisma: "prisma",
  graphql: "graphql",
  gql: "graphql",

  // Markup/Docs
  md: "markdown",
  mdx: "mdx",
  tex: "latex",
  latex: "latex",
  rst: "rst",
  adoc: "asciidoc",

  // DevOps/Config
  dockerfile: "dockerfile",
  docker: "dockerfile",
  tf: "terraform",
  hcl: "hcl",
  nix: "nix",
  cmake: "cmake",
  makefile: "makefile",
  mk: "makefile",

  // Other
  diff: "diff",
  patch: "diff",
  log: "log",
  txt: "text",
  gitignore: "gitignore",
  gitattributes: "gitattributes",
  editorconfig: "editorconfig",
}

// Special filenames that map to languages
const filenameToLang: Record<string, string> = {
  Dockerfile: "dockerfile",
  Makefile: "makefile",
  Rakefile: "ruby",
  Gemfile: "ruby",
  Podfile: "ruby",
  Vagrantfile: "ruby",
  Brewfile: "ruby",
  CMakeLists: "cmake",
  ".gitignore": "gitignore",
  ".gitattributes": "gitattributes",
  ".editorconfig": "editorconfig",
  ".env": "dotenv",
  ".env.local": "dotenv",
  ".env.development": "dotenv",
  ".env.production": "dotenv",
  ".bashrc": "bash",
  ".zshrc": "zsh",
  ".profile": "bash",
  "tsconfig.json": "jsonc",
  "jsconfig.json": "jsonc",
  ".prettierrc": "json",
  ".eslintrc": "json",
  "package.json": "json",
  "composer.json": "json",
  "Cargo.toml": "toml",
  "go.mod": "go",
  "go.sum": "go",
}

/**
 * Detect the language from a file path
 */
export function detectLanguage(filePath: string): string {
  // Check full filename first
  const filename = filePath.split("/").pop() ?? ""
  if (filenameToLang[filename]) {
    return filenameToLang[filename]
  }

  // Check extension
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  if (extensionToLang[ext]) {
    return extensionToLang[ext]
  }

  // Default to plain text
  return "text"
}

/**
 * Convert plain text content to unhighlighted lines (fallback)
 */
function plainTextLines(content: string): HighlightedLine[] {
  return content.split("\n").map((line) => [{ content: line, color: DEFAULT_COLOR }])
}

/**
 * Highlight code and return an array of lines, each containing tokens with colors
 */
export async function highlightCode(
  content: string,
  filePath: string
): Promise<HighlightedLine[]> {
  if (!content) {
    return []
  }

  const lang = detectLanguage(filePath)

  // Plain text doesn't need highlighting
  if (lang === "text") {
    return plainTextLines(content)
  }

  try {
    const highlighter = await getHighlighter()

    // Load language if not already loaded
    const loadedLangs = highlighter.getLoadedLanguages()
    if (!loadedLangs.includes(lang)) {
      try {
        await highlighter.loadLanguage(lang as Parameters<typeof highlighter.loadLanguage>[0])
      } catch {
        // Language not supported, fall back to plain text
        return plainTextLines(content)
      }
    }

    const { tokens } = highlighter.codeToTokens(content, {
      lang: lang as BundledLanguage,
      theme: "github-dark",
    })

    // Transform shiki tokens to our format
    return tokens.map((lineTokens) =>
      lineTokens.map((token) => ({
        content: token.content,
        color: token.color ?? DEFAULT_COLOR,
      }))
    )
  } catch {
    // Any error, fall back to plain text
    return plainTextLines(content)
  }
}
