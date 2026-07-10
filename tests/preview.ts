import { mkdir, readdir } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "./harness"
import { buildGoldenFixture } from "./fixtures"

const scenarioName = Bun.argv[2]
const width = parseInt(Bun.argv[3] ?? "120", 10)
const height = parseInt(Bun.argv[4] ?? "50", 10)

const scenariosDir = join(import.meta.dir, "scenarios")

async function listScenarios(): Promise<string[]> {
  const entries = await readdir(scenariosDir)
  return entries
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => name.replace(/\.ts$/, ""))
    .sort()
}

if (!scenarioName) {
  const scenarios = await listScenarios()
  console.log("Available scenarios:")
  for (const name of scenarios) {
    console.log(`  ${name}`)
  }
  console.log("\nUsage: bun run replay <scenario> [width] [height]")
  process.exit(0)
}

const configDir = join(tmpdir(), `lazyreview-preview-config-${Date.now()}`)
process.env.XDG_CONFIG_HOME = configDir

const scenario = await import(`./scenarios/${scenarioName}.ts`)
const fixture = await buildGoldenFixture()
const harness = await createHarness({ fixture: fixture.path, width, height })

const { snapshots } = await scenario.runScenario(harness)

const outDir = join(process.cwd(), "preview")
await mkdir(outDir, { recursive: true })

const ansiContent = snapshots
  .map((s: { name: string; ansi: string }) => `=== ${s.name} ===\n${s.ansi}`)
  .join("\n\n")

await Bun.write(join(outDir, `${scenarioName}.ansi`), ansiContent)

const replay = snapshots.map((s: { name: string; ansi: string }) => ({
  name: s.name,
  ansi: s.ansi,
}))

await Bun.write(join(outDir, `${scenarioName}.replay.json`), JSON.stringify(replay, null, 2))

console.log(ansiContent)
console.log(`\nWrote preview to ${outDir}/${scenarioName}.ansi and ${scenarioName}.replay.json`)

await harness.destroy()
await fixture.cleanup()
