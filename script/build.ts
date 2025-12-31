#!/usr/bin/env bun

import solidPlugin from "../node_modules/@opentui/solid/scripts/solid-plugin"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

import pkg from "../package.json" with { type: "json" }
import corePkg from "../node_modules/@opentui/core/package.json" with { type: "json" }

const singleFlag = process.argv.includes("--single")
const skipInstall = process.argv.includes("--skip-install")

const allTargets: {
  os: string
  arch: "arm64" | "x64"
}[] = [
  { os: "linux", arch: "arm64" },
  { os: "linux", arch: "x64" },
  { os: "darwin", arch: "arm64" },
  { os: "darwin", arch: "x64" },
  { os: "win32", arch: "x64" },
]

const targets = singleFlag
  ? allTargets.filter((item) => item.os === process.platform && item.arch === process.arch)
  : allTargets

await Bun.$`rm -rf dist`
await Bun.$`mkdir -p dist`

// Install platform-specific native modules for cross-compilation
if (!skipInstall && !singleFlag) {
  const coreVersion = corePkg.version
  console.log(`Installing @opentui/core platform modules (v${coreVersion})...\n`)
  await Bun.$`bun install --os="*" --cpu="*" @opentui/core@${coreVersion}`
  console.log("")
}

for (const item of targets) {
  const name = [
    "lazyreview",
    item.os === "win32" ? "windows" : item.os,
    item.arch,
  ].join("-")

  console.log(`Building ${name}...`)

  const ext = item.os === "win32" ? ".exe" : ""
  const target = `bun-${item.os}-${item.arch}` as any

  await Bun.build({
    conditions: ["browser"],
    tsconfig: "./tsconfig.json",
    plugins: [solidPlugin],
    sourcemap: "none",
    compile: {
      target,
      outfile: `dist/${name}${ext}`,
      autoloadBunfig: false,
    },
    entrypoints: ["./index.ts"],
    define: {
      LAZYREVIEW_VERSION: `'${pkg.version}'`,
    },
  })

  console.log(`Built dist/${name}${ext}`)
}

console.log("\nDone!")
