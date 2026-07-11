import type { Harness, SnapshotResult } from "../harness"
import { waitForFrameText } from "./helpers"

export interface ScenarioResult {
  snapshots: SnapshotResult[]
}

const ENTER = "\r"
const ESCAPE = "\x1b"

export async function runScenario(harness: Harness): Promise<ScenarioResult> {
  const snapshots: SnapshotResult[] = []

  // Start in dirty mode; wait for the empty file list.
  await waitForFrameText(harness, "No changes detected")
  await harness.sleep(400)

  // Switch to branch mode.
  await harness.send(["m"])
  await waitForFrameText(harness, "COMMITS")
  await harness.sleep(200)
  await harness.send(["m"])
  await waitForFrameText(harness, "BRANCHES")
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("branch-list"))

  // Select the main branch (identical to the checked-out feature branch).
  await harness.send([ENTER])
  await waitForFrameText(harness, "No differences between branches")
  await harness.sleep(100)
  snapshots.push(await harness.snapshot("identical-branch-loading"))
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("identical-branch-files"))

  // Go back to the branch list.
  await harness.send([ESCAPE])
  await waitForFrameText(harness, "BRANCHES")
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("back-to-branch-list"))

  return { snapshots }
}
