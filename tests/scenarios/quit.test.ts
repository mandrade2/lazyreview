import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildGoldenFixture } from "../fixtures"
import { runScenario } from "./quit"
import { lineText } from "../assertions"

test("q key quits the app and is blocked by dialogs", async () => {
  const configDir = join(tmpdir(), `lazyreview-test-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildGoldenFixture()
  const harness = await createHarness({
    fixture: fixture.path,
    width: 120,
    height: 50,
  })

  try {
    const { snapshots } = await runScenario(harness)

    const getSnapshotText = (name: string) => {
      const snapshot = snapshots.find((s) => s.name === name)
      expect(snapshot).toBeDefined()
      return snapshot!.spans.lines.map(lineText).join("\n")
    }

    const initialText = getSnapshotText("initial")
    expect(initialText).toContain("To Review")

    const helpOpenText = getSnapshotText("help-open")
    expect(helpOpenText).toContain("Actions")
    expect(helpOpenText).toContain("Send file or folder to list 1 / back")

    const helpClosedText = getSnapshotText("help-closed")
    expect(helpClosedText).not.toContain("Send file or folder to list 1 / back")
    expect(helpClosedText).toContain("To Review")

    const opencodeOpenText = getSnapshotText("opencode-dialog-open")
    expect(opencodeOpenText).toContain("OpenCode prompt")
    expect(opencodeOpenText).toContain("Enter: send · Esc: cancel")

    const opencodeBlockedText = getSnapshotText("opencode-dialog-q-blocked")
    expect(opencodeBlockedText).toContain("OpenCode prompt")
    expect(opencodeBlockedText).toContain("Enter: send · Esc: cancel")

    const searchModeText = getSnapshotText("search-mode")
    expect(searchModeText).toContain("enter:search esc:cancel")

    const searchBlockedText = getSnapshotText("search-mode-q-blocked")
    expect(searchBlockedText).toContain("enter:search esc:cancel")

    const diffFocusedText = getSnapshotText("diff-focused")
    expect(diffFocusedText).toContain("Files [Diff]")

    // After the final q the app should have destroyed the renderer.
    expect(harness.isDestroyed()).toBe(true)
  } finally {
    if (!harness.isDestroyed()) {
      await harness.destroy()
    }
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
}, { timeout: 15000 })
