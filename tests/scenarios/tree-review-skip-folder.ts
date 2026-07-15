import type { Harness, SnapshotResult } from "../harness"

export interface ScenarioResult {
  snapshots: SnapshotResult[]
}

export async function runScenario(harness: Harness): Promise<ScenarioResult> {
  const snapshots: SnapshotResult[] = []

  // Wait for the initial flat file list, then switch to tree view.
  snapshots.push(
    await harness.snapshot("initial", {
      waitFor: (frame) => frame.includes("To Review"),
    }),
  )

  await harness.send(["t"])
  snapshots.push(
    await harness.snapshot("tree-view", {
      waitFor: (frame) => frame.includes("- src"),
    }),
  )

  // Navigate to docs/guide.md. The rows after it are folders (src,
  // src/components), so marking it should skip forward to the next file
  // (src/components/counter.tsx) instead of landing on a folder.
  await harness.send(["g", "j"])
  snapshots.push(await harness.snapshot("navigate-to-guide"))

  await harness.send([" " as string])
  snapshots.push(await harness.snapshot("mark-guide-reviewed"))

  // Navigate to the last file in the to-review tree (src/utils.ts) and mark
  // it. The selection should move to the new last file (src/spinner.ts).
  await harness.send(["j", "j", "j", "j", "j"])
  snapshots.push(await harness.snapshot("navigate-to-last"))

  await harness.send([" " as string])
  snapshots.push(await harness.snapshot("mark-last-reviewed"))

  return { snapshots }
}
