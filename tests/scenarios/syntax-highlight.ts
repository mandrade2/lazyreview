import { getSpanForeground } from "../assertions"
import type { Harness, SnapshotResult } from "../harness"

export interface ScenarioResult {
  snapshots: SnapshotResult[]
}

// GitHub Dark keyword color produced by Shiki for JS/TS keywords such as
// `import`, `export` and `function`. Its presence proves syntax highlighting
// ran; the plain-text fallback only ever emits the default foreground.
export const shikiKeywordColor = "#f97583"

async function waitForHighlight(harness: Harness, timeoutMs = 10000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const frame = harness.spans()
    for (const line of frame.lines) {
      for (const span of line.spans) {
        if (getSpanForeground(span) === shikiKeywordColor) {
          return
        }
      }
    }
    await harness.sleep(100)
  }
  throw new Error("Timed out waiting for syntax highlighting")
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

  // The diff panel follows the file list selection, so staying on the files
  // panel and pressing j walks through every file. Highlighting runs in a
  // background worker; wait for it to finish before each snapshot.
  const names = ["highlight-file-1", "highlight-file-2", "highlight-file-3", "highlight-file-4"]
  for (const name of names) {
    await waitForHighlight(harness)
    snapshots.push(await harness.snapshot(name))
    await harness.send(["j"])
  }

  return { snapshots }
}
