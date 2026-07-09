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

  // Navigate to a middle file in the tree (src/index.ts).
  await harness.send(["j"])
  snapshots.push(await harness.snapshot("navigate-to-middle"))

  // Mark it as reviewed. The selection should move to the next logical entry
  // in the tree (src/legacy.ts), not jump back to the first file.
  await harness.send([" " as string])
  snapshots.push(await harness.snapshot("mark-reviewed"))

  return { snapshots }
}
