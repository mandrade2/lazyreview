import type { Harness, SnapshotResult } from "../harness"

export interface ScenarioResult {
  snapshots: SnapshotResult[]
}

export async function runScenario(harness: Harness): Promise<ScenarioResult> {
  const snapshots: SnapshotResult[] = []

  snapshots.push(
    await harness.snapshot("initial", {
      waitFor: (frame) => frame.includes("To Review"),
    }),
  )

  // Flat order: src/app.config.ts, src/components/counter.tsx, src/index.ts, ...
  // Navigate to src/index.ts.
  await harness.send(["j", "j"])
  snapshots.push(await harness.snapshot("navigate-to-middle"))

  // Mark as reviewed. The selection should move to the next flat-list item.
  await harness.send([" " as string])
  snapshots.push(await harness.snapshot("mark-reviewed"))

  return { snapshots }
}
