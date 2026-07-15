import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildGoldenFixture } from "../fixtures"
import { runScenario } from "./tree-review-folder-collapse"
import type { CapturedFrame } from "../harness"

function getSelectedFilePath(frame: CapturedFrame): string | null {
  // Selected row background in the focused file list (blue highlight).
  const isSelectedBg = (buffer: readonly number[]): boolean =>
    buffer[0] === 28 && buffer[1] === 58 && buffer[2] === 101 && buffer[3] === 255

  const leftPanelWidth = 35

  for (const line of frame.lines) {
    const hasSelectedBg = line.spans.some((span) => isSelectedBg(span.bg.toInts()))
    if (!hasSelectedBg) continue

    let leftText = ""
    let width = 0
    for (const span of line.spans) {
      if (width >= leftPanelWidth) break
      const remaining = Math.max(0, leftPanelWidth - width)
      leftText += span.text.slice(0, remaining)
      width += span.width
    }

    const match = leftText.match(/^\s*[AMDTR?]\s+(\S+)/)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

test("tree review moves to the next file when folder rows collapse away", async () => {
  const configDir = join(tmpdir(), `lazyreview-tree-folder-collapse-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildGoldenFixture()
  const harness = await createHarness({
    fixture: fixture.path,
    width: 80,
    height: 24,
  })

  try {
    const { snapshots } = await runScenario(harness)

    const navigateSnapshot = snapshots[2]!
    const markSnapshot = snapshots[3]!

    expect(getSelectedFilePath(navigateSnapshot.spans)).toBe("counter.tsx")
    expect(getSelectedFilePath(markSnapshot.spans)).toBe("app.config.ts")
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
})
