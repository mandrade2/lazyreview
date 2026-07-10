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

  // Navigate through each file type so we can verify their rendering.
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
    // before capturing the stable diff view.
    await harness.sleep(400)
    snapshots.push(await harness.snapshot(name))
  }

  // Return to the renamed file to verify its content is visible.
  await harness.send(["g"])
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("renamed-selected"))

  await harness.send(["l"])
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("renamed-diff-focused"))

  return { snapshots }
}
