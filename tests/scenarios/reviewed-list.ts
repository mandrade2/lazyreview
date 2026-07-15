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

  // Mark two files so the reviewed section has multiple items.
  await harness.send([" " as string, " " as string])
  snapshots.push(await harness.snapshot("after-marking"))

  // Navigate down to the reviewed section.
  await harness.send(["j", "j", "j", "j", "j"])
  snapshots.push(await harness.snapshot("in-reviewed-section"))

  // Unmark the first reviewed file. The selection should move to the next
  // item in the reviewed section.
  await harness.send([" " as string])
  snapshots.push(await harness.snapshot("after-unmark"))

  return { snapshots }
}
