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

  // Switch to commit mode and wait for the commit list.
  await harness.send(["m"])
  await waitForFrameText(harness, "COMMITS")
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("commit-list"))

  // Select the newest commit (index 0, "add farewell"). It has one file.
  await harness.send([ENTER])
  await waitForFrameText(harness, "FILES (1)")
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("newest-commit-files"))

  await waitForFrameText(harness, "farewell")
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("newest-commit-diff"))

  // Go back to the commit list.
  await harness.send([ESCAPE])
  await waitForFrameText(harness, "COMMITS")
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("back-to-commit-list"))

  // Move to the oldest commit (index 1, "initial commit") and select it.
  await harness.send(["j"])
  await harness.sleep(100)
  await harness.send([ENTER])
  await waitForFrameText(harness, "FILES (2)")
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("initial-commit-files"))

  // The first file is selected by default (README.md). Move to src/index.ts.
  await harness.send(["j"])
  await harness.sleep(100)
  await waitForFrameText(harness, "export function greet")
  await harness.sleep(400)
  snapshots.push(await harness.snapshot("initial-commit-diff"))

  return { snapshots }
}
