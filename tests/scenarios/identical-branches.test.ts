import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildIdenticalBranchesFixture } from "../fixtures"
import { runScenario } from "./identical-branches"
import { lineText } from "../assertions"

test("identical branches show no diff and do not stay loading", async () => {
  const configDir = join(tmpdir(), `lazyreview-test-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildIdenticalBranchesFixture()
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

    const identicalBranchLoading = findSnapshot("identical-branch-loading")
    const loadingText = snapshotText(identicalBranchLoading)
    expect(loadingText).toContain("No changes")
    expect(loadingText).not.toContain("Loading...")

    const identicalBranchFiles = findSnapshot("identical-branch-files")
    const identicalFilesText = snapshotText(identicalBranchFiles)
    expect(identicalFilesText).toContain("No differences between branches")
    expect(identicalFilesText).toContain("No changes")
    expect(identicalFilesText).not.toContain("Loading...")

    const backToBranchList = findSnapshot("back-to-branch-list")
    const backText = snapshotText(backToBranchList)
    expect(backText).toContain("BRANCHES")
    expect(backText).not.toContain("Loading...")
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
}, { timeout: 15000 })
