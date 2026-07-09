import type { Harness, SnapshotResult } from "../harness"

export interface ScenarioResult {
  snapshots: SnapshotResult[]
}

export async function runScenario(harness: Harness): Promise<ScenarioResult> {
  const snapshots: SnapshotResult[] = []

  // The app loads git changes asynchronously on mount; wait until the file
  // list appears before taking the first snapshot.
  snapshots.push(
    await harness.snapshot("initial", {
      waitFor: (frame) => frame.includes("To Review"),
    }),
  )

  await harness.send(["j"])
  snapshots.push(await harness.snapshot("navigate-down"))

  await harness.send(["l"])
  snapshots.push(await harness.snapshot("focus-diff-before-highlight"))

  // Syntax highlighting is done by a background worker; give it time to
  // finish before capturing the stable diff view.
  await harness.sleep(1000)
  snapshots.push(await harness.snapshot("focus-diff-after-highlight"))

  await harness.send([" " as string])
  snapshots.push(await harness.snapshot("mark-reviewed"))

  await harness.send(["j"])
  snapshots.push(await harness.snapshot("navigate-next"))

  return { snapshots }
}
