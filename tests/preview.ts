import { mkdir } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "./harness"
import { buildGoldenFixture } from "./fixtures"

const scenarioName = Bun.argv[2] ?? "golden"
const width = parseInt(Bun.argv[3] ?? "80", 10)
const height = parseInt(Bun.argv[4] ?? "24", 10)

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

await harness.destroy()
await fixture.cleanup()

console.log(`Wrote preview to ${outDir}/${scenarioName}.ansi and ${scenarioName}.replay.json`)
