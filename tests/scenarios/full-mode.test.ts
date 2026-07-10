import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildGoldenFixture } from "../fixtures"
import { runScenario } from "./full-mode"
import { lineText, lineTextFrom, findLineNumbersWithContent } from "../assertions"
import { getGitChanges, setTargetDir } from "../../src/utils/git"

const SIDEBAR_WIDTH = 35

// This test runs with the default settings:
//   diffViewMode: "diff"   (toggled to "full" by the scenario)
//   showLineBg: true
//   fileListViewMode: "flat"
// Other settings combinations should be covered by additional scenarios.

test("full mode renders removed changes inline with default settings", async () => {
  const configDir = join(tmpdir(), `lazyreview-test-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildGoldenFixture()
  setTargetDir(fixture.path)
  const changes = await getGitChanges()

  const harness = await createHarness({
    fixture: fixture.path,
    width: 80,
    height: 24,
  })

  try {
    const { snapshots } = await runScenario(harness)

    // Every snapshot should be in full-file view.
    for (const snapshot of snapshots) {
      const text = snapshot.spans.lines
        .map((line) => lineTextFrom(line, SIDEBAR_WIDTH))
        .join("\n")
      expect(text).toContain("Full")
    }

    // The modified index.ts should show the removed top-level main() call
    // inline alongside the new startup() call. The previous test only checked
    // that the text appeared somewhere, which is why the line-number bug slipped
    // through. We now assert the exact rendered line numbers and indicators.
    const modifiedSnapshot = snapshots.find((s) => s.name === "navigate-modified")
    expect(modifiedSnapshot).toBeDefined()

    const mainMatches = findLineNumbersWithContent(
      modifiedSnapshot!.spans,
      "main()",
      SIDEBAR_WIDTH,
    )
    const removedMain = mainMatches.find((m) => m.indicator === "-")
    expect(removedMain).toEqual({ lineNumber: 9, indicator: "-" })
    expect(mainMatches).toContainEqual({ lineNumber: 11, indicator: " " })

    const startupMatches = findLineNumbersWithContent(
      modifiedSnapshot!.spans,
      "startup()",
      SIDEBAR_WIDTH,
    )
    // The new startup() function definition at line 10 and the top-level call at
    // line 14.
    expect(startupMatches).toContainEqual({ lineNumber: 10, indicator: " " })
    expect(startupMatches).toContainEqual({ lineNumber: 14, indicator: " " })

    // Stats in the file list should still match the underlying git data even
    // while the diff panel is in full mode.
    const snapshotNames = [
      "initial-full",
      "navigate-added",
      "navigate-modified",
      "navigate-deleted",
      "navigate-modified-2",
      "navigate-untracked",
    ]
    expect(snapshots.length).toBe(snapshotNames.length)

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i]!
      const snapshotName = snapshotNames[i]!
      const snapshot = snapshots.find((s) => s.name === snapshotName)
      expect(snapshot).toBeDefined()
      const frameText = snapshot!.spans.lines
        .map((line) => lineText(line))
        .join("\n")
      expect(frameText).toContain(change.path.split("/").pop()!)
    }
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
}, { timeout: 15000 })
