import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildTagReviewFixture } from "../fixtures"
import { runScenario } from "./tag-review"
import { lineText } from "../assertions"

test("tag review mode lists tags and loads diffs", async () => {
  const configDir = join(tmpdir(), `lazyreview-test-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildTagReviewFixture()
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

    const tagList = findSnapshot("tag-list")
    expect(snapshotText(tagList)).toContain("v1.0.0")

    const tagFiles = findSnapshot("tag-files")
    const tagFilesText = snapshotText(tagFiles)
    expect(tagFilesText).toContain("src/index.ts")
    // The header should state the comparison against the preceding tag.
    expect(tagFilesText).toContain("v1.0.0 vs v1.1.0")

    const tagDiff = findSnapshot("tag-diff")
    const tagDiffText = snapshotText(tagDiff)
    expect(tagDiffText).not.toContain("Loading file...")
    expect(tagDiffText).toContain("farewell")
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
}, { timeout: 15000 })
