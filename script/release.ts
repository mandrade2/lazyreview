#!/usr/bin/env bun

import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

import pkg from "../package.json" with { type: "json" }

const version = pkg.version
const tag = `v${version}`

console.log(`\nPreparing release ${tag}...\n`)

// Check for uncommitted changes
const status = await Bun.$`git status --porcelain`.text()
if (status.trim()) {
  console.error("Error: You have uncommitted changes. Please commit or stash them first.")
  process.exit(1)
}

// Check if tag already exists
const existingTags = await Bun.$`git tag -l ${tag}`.text()
if (existingTags.trim()) {
  console.error(`Error: Tag ${tag} already exists. Update the version in package.json first.`)
  process.exit(1)
}

// Build all platforms
console.log("Building binaries for all platforms...\n")
await Bun.$`bun run script/build.ts`

// Create zip files for each binary
console.log("\nCreating release archives...")
const distFiles = await Bun.$`ls dist/`.text()
const binaries = distFiles.trim().split("\n").filter(f => !f.endsWith(".zip"))

for (const binary of binaries) {
  const zipName = `${binary}.zip`
  console.log(`  Zipping ${binary}...`)
  await Bun.$`zip -j dist/${zipName} dist/${binary}`.quiet()
}

// Create and push git tag
console.log(`\nCreating git tag ${tag}...`)
await Bun.$`git tag -a ${tag} -m "Release ${tag}"`
await Bun.$`git push origin ${tag}`

// Create GitHub release with assets
console.log(`\nCreating GitHub release...`)
const zipFiles = binaries.map(b => `dist/${b}.zip`)

await Bun.$`gh release create ${tag} ${zipFiles} --title ${tag} --generate-notes`

console.log(`\nRelease ${tag} published successfully!`)
console.log(`View at: https://github.com/mandrade2/lazyreview/releases/tag/${tag}`)
