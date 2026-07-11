import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildBranchReviewFixture } from "../fixtures"
import { runScenario } from "./branch-review"
import { lineText } from "../assertions"

test("branch review mode loads files and diffs", async () => {
  const configDir = join(tmpdir(), `lazyreview-test-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildBranchReviewFixture()
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

    const branchFiles = findSnapshot("branch-files")
    const branchFilesText = snapshotText(branchFiles)
    expect(branchFilesText).toContain("src/index.ts")

    const branchDiff = findSnapshot("branch-diff")
    const branchDiffText = snapshotText(branchDiff)
    expect(branchDiffText).not.toContain("Loading file...")
    expect(branchDiffText).toContain("farewell")

    const backToBranchList = findSnapshot("back-to-branch-list")
    const backText = snapshotText(backToBranchList)
    expect(backText).toContain("BRANCHES")
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
}, { timeout: 15000 })
