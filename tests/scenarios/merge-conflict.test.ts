import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import type { SnapshotResult } from "../harness"
import { buildMergeConflictFixture } from "../fixtures"
import { runScenario } from "./merge-conflict"
import {
  extractFileListStats,
  findLine,
  getRowBackgroundFrom,
  lineText,
  lineTextFrom,
} from "../assertions"
import { getGitChanges, setTargetDir } from "../../src/utils/git"

const SIDEBAR_WIDTH = 35

function getSelectedSnapshot(snapshots: SnapshotResult[], name: string) {
  const snapshot = snapshots.find((s) => s.name === name)
  expect(snapshot).toBeDefined()
  return snapshot!
}

test("merge conflicts are listed, labeled, and highlighted", async () => {
  const configDir = join(tmpdir(), `lazyreview-test-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildMergeConflictFixture()
  setTargetDir(fixture.path)
  const changes = await getGitChanges()

  const harness = await createHarness({
    fixture: fixture.path,
    width: 80,
    height: 24,
  })

  try {
    // Git data: index.ts is conflicted, utils.ts merged cleanly as modified.
    const conflicted = changes.find((c) => c.path === "src/index.ts")
    const merged = changes.find((c) => c.path === "src/utils.ts")
    expect(conflicted?.status).toBe("conflicted")
    expect(merged?.status).toBe("modified")
    expect(conflicted!.content).toContain("<<<<<<< HEAD")
    expect(conflicted!.content).toContain(">>>>>>> feature")

    const { snapshots } = await runScenario(harness)

    // File list shows the conflict icon and the modified icon.
    const initial = getSelectedSnapshot(snapshots, "initial").spans
    const initialText = initial.lines.map(lineText).join("\n")
    expect(initialText).toContain("C src/index.ts")
    expect(initialText).toContain("M src/utils.ts")

    const fileListStats = extractFileListStats(initial, "index.ts", SIDEBAR_WIDTH)
    expect(fileListStats).not.toBeNull()
    expect(fileListStats!.status).toBe("C")

    // Diff header labels the file as conflicted.
    const focused = getSelectedSnapshot(snapshots, "conflict-diff-focused").spans
    const focusedText = focused.lines
      .map((line) => lineTextFrom(line, SIDEBAR_WIDTH))
      .join("\n")
    expect(focusedText).toContain("[Conflicted]")
    expect(focusedText).toContain("<<<<<<< HEAD")
    expect(focusedText).toContain("=======")
    expect(focusedText).toContain(">>>>>>> feature")

    // Conflict marker lines get the purple marker background.
    const markerLine = findLine(focused, (text) => text.includes("<<<<<<< HEAD"))
    expect(markerLine).not.toBeNull()
    expect(getRowBackgroundFrom(markerLine!, SIDEBAR_WIDTH)).toBe("#3b2d5c")

    // Ours/theirs sides get distinct tinted backgrounds.
    const oursLine = findLine(focused, (text) => text.includes("Hola,"))
    expect(oursLine).not.toBeNull()
    expect(getRowBackgroundFrom(oursLine!, SIDEBAR_WIDTH)).toBe("#12261c")

    const theirsLine = findLine(focused, (text) => text.includes("Bonjour,"))
    expect(theirsLine).not.toBeNull()
    expect(getRowBackgroundFrom(theirsLine!, SIDEBAR_WIDTH)).toBe("#2a1a3f")

    // Full-file view highlights the markers too.
    const fullView = getSelectedSnapshot(snapshots, "conflict-full-view").spans
    const fullViewText = fullView.lines
      .map((line) => lineTextFrom(line, SIDEBAR_WIDTH))
      .join("\n")
    expect(fullViewText).toContain("<<<<<<< HEAD")
    const fullMarkerLine = findLine(fullView, (text) => text.includes(">>>>>>> feature"))
    expect(fullMarkerLine).not.toBeNull()
    expect(getRowBackgroundFrom(fullMarkerLine!, SIDEBAR_WIDTH)).toBe("#3b2d5c")

    // The auto-merged file renders as a normal modification.
    const mergedSnapshot = getSelectedSnapshot(snapshots, "navigate-merged-file").spans
    const mergedText = mergedSnapshot.lines
      .map((line) => lineTextFrom(line, SIDEBAR_WIDTH))
      .join("\n")
    expect(mergedText).toContain("[Modified]")
    expect(mergedText).toContain("subtract")
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
}, { timeout: 15000 })
