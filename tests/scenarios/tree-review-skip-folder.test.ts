import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildGoldenFixture } from "../fixtures"
import { runScenario } from "./tree-review-skip-folder"
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

test("tree review skips folders and moves to the new last file", async () => {
  const configDir = join(tmpdir(), `lazyreview-tree-skip-folder-config-${Date.now()}`)
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
    const navigateLastSnapshot = snapshots[4]!
    const markLastSnapshot = snapshots[5]!

    expect(getSelectedFilePath(navigateSnapshot.spans)).toBe("guide.md")
    expect(getSelectedFilePath(markSnapshot.spans)).toBe("counter.tsx")

    expect(getSelectedFilePath(navigateLastSnapshot.spans)).toBe("utils.ts")
    expect(getSelectedFilePath(markLastSnapshot.spans)).toBe("spinner.ts")
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
})
