#!/usr/bin/env bun

import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import pkg from "../package.json" with { type: "json" }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")
process.chdir(rootDir)

const runs = 10
const sizes = [10, 100, 500, 1000, 5000]
const langs = ["ts", "tsx", "md"]
const modes = ["cold", "warm-worker", "cached"] as const

const perfDir = path.join(rootDir, "perf")
const baselinePath = path.join(perfDir, "baseline.json")

interface HyperfineResult {
  command: string
  mean: number
  stddev: number
  min: number
  max: number
  median: number
  times: number[]
}

interface BaselineCase {
  command: string
  mean: number
  stddev: number
  min: number
  max: number
  median: number
  unit: "s"
}

interface Baseline {
  version: string
  timestamp: string
  sha: string
  results: Record<string, BaselineCase>
}

function caseName(size: number, lang: string, mode: string): string {
  return `${mode}-${lang}-${size}`
}

async function ensurePerfDir(): Promise<void> {
  await Bun.$`mkdir -p ${perfDir}`
}

async function getSha(): Promise<string> {
  return (await Bun.$`git rev-parse --short HEAD`.text()).trim()
}

async function checkHyperfine(): Promise<void> {
  try {
    await Bun.$`hyperfine --version`.quiet()
  } catch {
    console.error("Error: hyperfine is not installed. Install it with `brew install hyperfine`.")
    process.exit(1)
  }
}

async function runBenchmarkCase(size: number, lang: string, mode: string): Promise<BaselineCase> {
  const name = caseName(size, lang, mode)
  const tmpFile = path.join(os.tmpdir(), `lazyreview-benchmark-${name}-${Date.now()}.json`)

  console.log(`  Benchmarking ${name}...`)

  const command = `bun script/benchmark-highlight.ts ${size} ${lang} ${mode}`
  await Bun.$`hyperfine --runs ${runs} --warmup 1 --style basic --export-json ${tmpFile} ${command}`.quiet()

  const file = Bun.file(tmpFile)
  const output = await file.json() as { results: HyperfineResult[] }
  const result = output.results[0]

  try {
    await Bun.$`rm -f ${tmpFile}`.quiet()
  } catch {
  }

  return {
    command: result.command,
    mean: result.mean,
    stddev: result.stddev,
    min: result.min,
    max: result.max,
    median: result.median,
    unit: "s",
  }
}

async function main(): Promise<void> {
  await checkHyperfine()
  await ensurePerfDir()

  const results: Record<string, BaselineCase> = {}

  for (const mode of modes) {
    console.log(`\nMode: ${mode}`)
    for (const lang of langs) {
      for (const size of sizes) {
        const data = await runBenchmarkCase(size, lang, mode)
        results[caseName(size, lang, mode)] = data
      }
    }
  }

  const baseline: Baseline = {
    version: pkg.version,
    timestamp: new Date().toISOString(),
    sha: await getSha(),
    results,
  }

  await Bun.write(baselinePath, JSON.stringify(baseline, null, 2) + "\n")
  console.log(`\nBaseline written to ${baselinePath}`)
}

await main().catch((err) => {
  console.error(err)
  process.exit(1)
})
