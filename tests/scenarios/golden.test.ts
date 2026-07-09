import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildGoldenFixture } from "../fixtures"
import { runScenario } from "./golden"

test("golden scenario snapshots", async () => {
  const configDir = join(tmpdir(), `lazyreview-test-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildGoldenFixture()
  const harness = await createHarness({ fixture: fixture.path, width: 80, height: 24 })

  try {
    const { snapshots } = await runScenario(harness)

    for (const snapshot of snapshots) {
      expect(snapshot.spans).toMatchSnapshot(`${snapshot.name}-spans`)
      expect(snapshot.ansi).toMatchSnapshot(`${snapshot.name}-ansi`)
    }
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
})
