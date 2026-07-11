import type { Harness, SnapshotResult } from "../harness"

const ESCAPE = "\x1b"

export interface ScenarioResult {
  snapshots: SnapshotResult[]
}

export async function runScenario(harness: Harness): Promise<ScenarioResult> {
  const snapshots: SnapshotResult[] = []

  // Wait for the initial file list to load.
  snapshots.push(
    await harness.snapshot("initial", {
      waitFor: (frame) => frame.includes("To Review"),
    }),
  )

  // Open the help dialog and confirm it is visible.
  await harness.send(["?"])
  snapshots.push(await harness.snapshot("help-open"))

  // Press q while help is shown. The help dialog should close, not exit.
  await harness.send(["q"])
  snapshots.push(await harness.snapshot("help-closed"))

  // Open the opencode dialog. Requires a selected file, which is true on mount.
  await harness.send(["o"])
  snapshots.push(await harness.snapshot("opencode-dialog-open"))

  // Press q while the opencode dialog is open. It should be blocked and the
  // dialog should remain visible.
  await harness.send(["q"])
  snapshots.push(await harness.snapshot("opencode-dialog-q-blocked"))

  // Close the opencode dialog with escape.
  await harness.send([ESCAPE])
  await harness.waitForFrame((frame) => !frame.includes("OpenCode prompt"))
  snapshots.push(await harness.snapshot("opencode-dialog-closed"))

  // Enter diff search mode.
  await harness.send(["/"])
  snapshots.push(await harness.snapshot("search-mode"))

  // Press q while searching. It should be blocked and search mode should stay
  // active.
  await harness.send(["q"])
  snapshots.push(await harness.snapshot("search-mode-q-blocked"))

  // Cancel search with escape.
  await harness.send([ESCAPE])
  await harness.waitForFrame((frame) => !frame.includes("enter:search esc:cancel"))
  snapshots.push(await harness.snapshot("search-cancelled"))

  // Move focus to the diff panel and confirm q still exits from there.
  await harness.send(["l"])
  snapshots.push(await harness.snapshot("diff-focused"))

  // Finally, quit from the normal view. The renderer should be destroyed.
  await harness.send(["q"])

  return { snapshots }
}
