import { test, expect, describe } from "bun:test"
import { detectLanguage } from "./shiki"

describe("detectLanguage", () => {
  test("detects TypeScript files", () => {
    expect(detectLanguage("src/app.tsx")).toBe("tsx")
    expect(detectLanguage("src/utils/git.ts")).toBe("typescript")
    expect(detectLanguage("lib/types.d.ts")).toBe("typescript")
  })

  test("detects JavaScript files", () => {
    expect(detectLanguage("index.js")).toBe("javascript")
    expect(detectLanguage("server.mjs")).toBe("javascript")
    expect(detectLanguage("config.cjs")).toBe("javascript")
    expect(detectLanguage("component.jsx")).toBe("jsx")
  })

  test("detects Python files", () => {
    expect(detectLanguage("main.py")).toBe("python")
    expect(detectLanguage("utils.pyi")).toBe("python")
  })

  test("detects Rust files", () => {
    expect(detectLanguage("src/lib.rs")).toBe("rust")
  })

  test("detects Go files", () => {
    expect(detectLanguage("main.go")).toBe("go")
  })

  test("detects markdown files", () => {
    expect(detectLanguage("README.md")).toBe("markdown")
    expect(detectLanguage("docs.mdx")).toBe("mdx")
  })

  test("detects JSON files", () => {
    expect(detectLanguage("package.json")).toBe("json")
    expect(detectLanguage("config.json")).toBe("json")
  })

  test("detects YAML files", () => {
    expect(detectLanguage("docker-compose.yml")).toBe("yaml")
    expect(detectLanguage("config.yaml")).toBe("yaml")
  })

  test("detects special filenames", () => {
    expect(detectLanguage("Dockerfile")).toBe("dockerfile")
    expect(detectLanguage("Makefile")).toBe("makefile")
    expect(detectLanguage("Rakefile")).toBe("ruby")
    expect(detectLanguage("Gemfile")).toBe("ruby")
    expect(detectLanguage("Cargo.toml")).toBe("toml")
    expect(detectLanguage("go.mod")).toBe("go")
  })

  test("detects dotfiles by full name", () => {
    expect(detectLanguage(".gitignore")).toBe("gitignore")
    expect(detectLanguage(".editorconfig")).toBe("editorconfig")
    expect(detectLanguage(".bashrc")).toBe("bash")
    expect(detectLanguage(".zshrc")).toBe("zsh")
    expect(detectLanguage(".env")).toBe("dotenv")
    expect(detectLanguage(".env.local")).toBe("dotenv")
  })

  test("defaults to text for unknown extensions", () => {
    expect(detectLanguage("notes.xyz")).toBe("text")
    expect(detectLanguage("data.unknown")).toBe("text")
  })

  test("handles files with no extension", () => {
    expect(detectLanguage("README")).toBe("text")
    expect(detectLanguage("LICENSE")).toBe("text")
  })

  test("is case-insensitive for extensions", () => {
    expect(detectLanguage("main.TS")).toBe("typescript")
    expect(detectLanguage("file.JS")).toBe("javascript")
    expect(detectLanguage("lib.RS")).toBe("rust")
  })

  test("prioritizes full filename over extension", () => {
    // Dockerfile has no extension, detected by full name
    expect(detectLanguage("Dockerfile")).toBe("dockerfile")
    // .gitignore has an extension but is detected by full name
    expect(detectLanguage(".gitignore")).toBe("gitignore")
  })
})
