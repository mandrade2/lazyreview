import { highlightFile, resetHighlighter, clearHighlightCache } from "../src/utils/dataloading"

const size = parseInt(Bun.argv[2] ?? "100", 10)
const lang = Bun.argv[3] ?? "ts"
const mode = Bun.argv[4] ?? "cold" // "cold", "warm-worker", or "cached"

const fileName = `bench.${lang}`

function generateTsContent(lines: number): string {
  const parts: string[] = []
  let remaining = lines
  let index = 1
  while (remaining >= 4) {
    parts.push(`export function helper${index}(): string {`)
    parts.push(`  return "value${index}"`)
    parts.push(`}`)
    parts.push(``)
    remaining -= 4
    index++
  }
  while (remaining > 0) {
    parts.push(`// filler ${index}`)
    remaining--
    index++
  }
  return parts.join("\n")
}

function generateTsxContent(lines: number): string {
  const parts: string[] = [
    'import { createSignal } from "solid-js"',
    '',
  ]
  let remaining = lines - 2
  let index = 1
  while (remaining >= 6) {
    parts.push(`export function Component${index}() {`)
    parts.push(`  const [count, setCount] = createSignal(${index})`)
    parts.push(`  return (`)
    parts.push(`    <button onClick={() => setCount((c) => c + 1)}>`)
    parts.push(`      Count: {count()}`)
    parts.push(`    </button>`)
    parts.push(`  )`)
    parts.push(`}`)
    parts.push(``)
    remaining -= 9
    index++
  }
  while (remaining > 0) {
    parts.push(`// filler ${index}`)
    remaining--
    index++
  }
  return parts.join("\n")
}

function generateMarkdownContent(lines: number): string {
  const parts: string[] = ["# Benchmark Document", ""]
  let remaining = lines - 2
  let index = 1
  while (remaining >= 3) {
    parts.push(`## Section ${index}`)
    parts.push(``)
    parts.push(`- item ${index}-a`)
    parts.push(`- item ${index}-b`)
    parts.push(``)
    remaining -= 5
    index++
  }
  while (remaining > 0) {
    parts.push(`filler line ${index}`)
    remaining--
    index++
  }
  return parts.join("\n")
}

function generateContent(lines: number, language: string): string {
  switch (language) {
    case "tsx":
      return generateTsxContent(lines)
    case "md":
      return generateMarkdownContent(lines)
    case "ts":
    default:
      return generateTsContent(lines)
  }
}

const content = generateContent(size, lang)

async function main() {
  if (mode === "cold") {
    resetHighlighter()
    const start = performance.now()
    await highlightFile(content, fileName)
    const end = performance.now()
    console.log((end - start).toFixed(2))
  } else if (mode === "warm-worker") {
    // First file warms the worker and loads the grammar.
    const otherContent = content + "\n// unique marker\n"
    await highlightFile(otherContent, `${fileName}.warm`)
    clearHighlightCache()
    // Second file uses the warm worker but an empty cache.
    const start = performance.now()
    await highlightFile(content, fileName)
    const end = performance.now()
    console.log((end - start).toFixed(2))
  } else if (mode === "cached") {
    // Populate cache and worker, then measure the cached lookup.
    await highlightFile(content, fileName)
    const start = performance.now()
    await highlightFile(content, fileName)
    const end = performance.now()
    console.log((end - start).toFixed(2))
  }
}

await main().catch((err) => {
  console.error(err)
  process.exit(1)
})
