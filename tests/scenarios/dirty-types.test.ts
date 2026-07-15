import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import type { SnapshotResult } from "../harness"
import { buildGoldenFixture } from "../fixtures"
import { runScenario } from "./dirty-types"
import {
  extractDiffHeaderStats,
  extractFileListStats,
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

test("dirty mode renders all change types with matching stats", async () => {
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

      // Snapshot names map to the file selected in each frame.
      const snapshotNames = [
        "initial",
        "navigate-added",
        "navigate-modified",
        "navigate-deleted",
        "navigate-modified-pure-deletion",
        "navigate-modified-2",
        "navigate-untracked",
        "renamed-selected",
        "renamed-diff-focused",
      ]

    // Verify every status icon appears in the initial file list.
    const initial = getSelectedSnapshot(snapshots, "initial").spans
    const initialText = initial.lines.map(lineText).join("\n")
    expect(initialText).toContain("R src/app.config.ts")
    expect(initialText).toContain("A src/components/counter.tsx")
    expect(initialText).toContain("M src/index.ts")
    expect(initialText).toContain("D src/legacy.ts")
    expect(initialText).toContain("M src/spinner.ts")
    expect(initialText).toContain("M src/utils.ts")
    expect(initialText).toContain("? docs/guide.md")

    // Verify each file's file-list stats match the diff-header stats and the
    // underlying git data.
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i]!
      const snapshotName = snapshotNames[i]!
      const snapshot = getSelectedSnapshot(snapshots, snapshotName).spans

      const fileListStats = extractFileListStats(
        snapshot,
        change.path.split("/").pop()!,
        SIDEBAR_WIDTH,
      )
      expect(fileListStats).not.toBeNull()
      expect(fileListStats!.status).toBe(
        change.status === "untracked"
          ? "?"
          : change.status === "renamed"
            ? "R"
            : change.status === "added"
              ? "A"
              : change.status === "deleted"
                ? "D"
                : "M",
      )
      expect(fileListStats!.additions).toBe(change.additions)
      expect(fileListStats!.deletions).toBe(change.deletions)

      const diffHeaderStats = extractDiffHeaderStats(
        snapshot,
        SIDEBAR_WIDTH,
      )
      expect(diffHeaderStats).not.toBeNull()
      expect(diffHeaderStats!.additions).toBe(change.additions)
      expect(diffHeaderStats!.deletions).toBe(change.deletions)
    }

    // Verify the renamed file content is visible, not a "No diff available" message.
    const renamedDiffFocused = getSelectedSnapshot(
      snapshots,
      "renamed-diff-focused",
    ).spans
    const diffPanelText = renamedDiffFocused.lines
      .map((line) => lineTextFrom(line, SIDEBAR_WIDTH))
      .join("\n")
    expect(diffPanelText).toContain("export const config")
    expect(diffPanelText).not.toContain("No diff available for this file")
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
}, { timeout: 15000 })
