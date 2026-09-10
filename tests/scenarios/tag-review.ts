import type { Harness, SnapshotResult } from "../harness"
import { waitForFrameText } from "./helpers"

export interface ScenarioResult {
  snapshots: SnapshotResult[]
}

const ENTER = "\r"

export async function runScenario(harness: Harness): Promise<ScenarioResult> {
  const snapshots: SnapshotResult[] = []

  // Start in dirty mode; wait for the empty file list.
  await waitForFrameText(harness, "No changes detected")
  await harness.sleep(400)

  // Cycle modes: dirty -> commit -> branch -> tag, then wait for the tag list.
  await harness.send(["m"])
  await waitForFrameText(harness, "COMMITS")
  await harness.send(["m"])
  await waitForFrameText(harness, "BRANCHES")
  await harness.send(["m"])
  await waitForFrameText(harness, "TAGS")
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("tag-list"))

  // Select v1.1.0 (the newest tag). It should be compared against the tag that
  // precedes it, v1.0.0, showing the farewell change introduced by that release.
  await harness.send([ENTER])
  await waitForFrameText(harness, "FILES (1)")
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("tag-files"))

  await waitForFrameText(harness, "farewell")
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("tag-diff"))

  return { snapshots }
}
