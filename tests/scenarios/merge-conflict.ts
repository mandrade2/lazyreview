import type { Harness, SnapshotResult } from "../harness"

export interface ScenarioResult {
  snapshots: SnapshotResult[]
}

export async function runScenario(harness: Harness): Promise<ScenarioResult> {
  const snapshots: SnapshotResult[] = []

  // The app loads git changes asynchronously on mount; wait until the file
  // list appears before taking the first snapshot. Syntax highlighting runs
  // in a background worker, so give the first file time to finish.
  await harness.waitForFrame((frame) => frame.includes("To Review"))
  await harness.sleep(800)
  snapshots.push(await harness.snapshot("initial"))

  // Focus the diff panel to inspect the conflicted file's markers.
  await harness.send(["l"])
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("conflict-diff-focused"))

  // Switch to full-file view to see the conflict in context.
  await harness.send(["f"])
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("conflict-full-view"))

  // Navigate to the cleanly auto-merged file to verify mixed states.
  await harness.send(["h", "j"])
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("navigate-merged-file"))

  return { snapshots }
}
