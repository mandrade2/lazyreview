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

  // The tree view preserves the selection of src/app.config.ts, so `k` lands
  // on src/components/counter.tsx - the only file in src/components.
  await harness.send(["k"])
  snapshots.push(await harness.snapshot("navigate-to-counter"))

  // Marking it removes the src/components folder row as well, shifting the
  // list by two rows. The selection should still move to the next logical
  // file (src/app.config.ts), not skip past it to src/index.ts.
  await harness.send([" " as string])
  snapshots.push(await harness.snapshot("mark-counter-reviewed"))

  return { snapshots }
}
