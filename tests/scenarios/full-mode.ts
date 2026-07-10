import type { Harness, SnapshotResult } from "../harness"

export interface ScenarioResult {
  snapshots: SnapshotResult[]
}

export async function runScenario(harness: Harness): Promise<ScenarioResult> {
  const snapshots: SnapshotResult[] = []

  // This scenario uses the default settings:
  //   diffViewMode: "diff"   (will be toggled to "full" below)
  //   showLineBg: true
  //   fileListViewMode: "flat"
  // Future scenarios should cover other combinations of these settings.

  // The app loads git changes asynchronously on mount; wait until the file
  // list appears before taking the first snapshot. Syntax highlighting runs
  // in a background worker, so give the first file time to finish.
  await harness.waitForFrame((frame) => frame.includes("To Review"))
  await harness.sleep(800)

  // Switch to full-file view immediately, before any snapshot is captured.
  await harness.send(["f"])
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("initial-full"))

  // Navigate through each change type in full view.
  // The expected order from the golden fixture is:
  // 0: renamed (app.config.ts), 1: added (counter.tsx), 2: modified (index.ts),
  // 3: deleted (legacy.ts), 4: modified (utils.ts), 5: untracked (guide.md)
  const navigationNames = [
    "navigate-added",
    "navigate-modified",
    "navigate-deleted",
    "navigate-modified-2",
    "navigate-untracked",
  ]

  for (const name of navigationNames) {
    await harness.send(["j"])
    // Syntax highlighting runs in a background worker; give it time to finish
    // before capturing the stable full view.
    await harness.sleep(400)
    snapshots.push(await harness.snapshot(name))
  }

  return { snapshots }
}
