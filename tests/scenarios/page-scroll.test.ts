import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildPageScrollFixture } from "../fixtures"

const PAGE_UP = "\x1b[5~"
const PAGE_DOWN = "\x1b[6~"

const lineInfoPattern = (line: number): RegExp =>
  new RegExp(`\\| Line\\s+${line}\\/\\d+`)

test("pageup and pagedown scroll the diff from any panel", async () => {
  const configDir = join(tmpdir(), `lazyreview-test-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildPageScrollFixture()
  const harness = await createHarness({ fixture: fixture.path, width: 80, height: 24 })

  try {
    await harness.waitForFrame((frame) => frame.includes("To Review"))
    await harness.waitForIdle()

    await harness.send([PAGE_DOWN])
    await harness.waitForIdle()
    expect(harness.ansi()).toMatch(lineInfoPattern(20))

    await harness.send([PAGE_UP])
    await harness.waitForIdle()
    expect(harness.ansi()).toMatch(lineInfoPattern(1))

    // Move focus to the diff panel and verify page keys still scroll.
    await harness.send(["l"])
    await harness.waitForIdle()
    await harness.send([PAGE_DOWN])
    await harness.waitForIdle()
    expect(harness.ansi()).toMatch(lineInfoPattern(20))

    await harness.send([PAGE_UP])
    await harness.waitForIdle()
    expect(harness.ansi()).toMatch(lineInfoPattern(1))
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
})
