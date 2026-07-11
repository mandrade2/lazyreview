import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildCommitReviewFixture } from "../fixtures"
import { runScenario } from "./commit-review"
import { lineText } from "../assertions"

test("commit review mode loads files and diffs", async () => {
  const configDir = join(tmpdir(), `lazyreview-test-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildCommitReviewFixture()
  const harness = await createHarness({ fixture: fixture.path, width: 80, height: 24 })

  try {
    const { snapshots } = await runScenario(harness)

    const findSnapshot = (name: string) => {
      const snapshot = snapshots.find((s) => s.name === name)
      expect(snapshot).toBeDefined()
      return snapshot!
    }

    const snapshotText = (snapshot: ReturnType<typeof findSnapshot>) =>
      snapshot.spans.lines.map(lineText).join("\n")

    const newestCommitFiles = findSnapshot("newest-commit-files")
    const newestFilesText = snapshotText(newestCommitFiles)
    expect(newestFilesText).toContain("src/index.ts")

    const newestCommitDiff = findSnapshot("newest-commit-diff")
    const newestDiffText = snapshotText(newestCommitDiff)
    expect(newestDiffText).not.toContain("Loading file...")
    expect(newestDiffText).toContain("farewell")

    const initialCommitFiles = findSnapshot("initial-commit-files")
    const initialFilesText = snapshotText(initialCommitFiles)
    expect(initialFilesText).toContain("README.md")
    expect(initialFilesText).toContain("src/index.ts")

    const initialCommitDiff = findSnapshot("initial-commit-diff")
    const initialDiffText = snapshotText(initialCommitDiff)
    expect(initialDiffText).not.toContain("Loading file...")
    expect(initialDiffText).toContain("export function greet")
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
}, { timeout: 15000 })
