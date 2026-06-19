import type { HighlightedLine } from "./syntax-types"
import { highlightCode as highlightDirect } from "./syntax-core"

export type { HighlightedLine, HighlightedToken } from "./syntax-types"
export { detectLanguage } from "./syntax-core"

interface HighlightRequest {
  id: number
  content: string
  filePath: string
}

interface HighlightResponse {
  id: number
  result: HighlightedLine[]
}

// Compiled binaries bundle everything into a single executable and cannot spawn
// the worker from its source path, so fall back to highlighting on the main thread.
function isCompiledBinary(): boolean {
  const url = import.meta.url
  return url.includes("/$bunfs/") || url.startsWith("bun://")
}

let worker: Worker | null = null
let nextId = 0
const pending = new Map<
  number,
  { resolve: (result: HighlightedLine[]) => void; reject: (error: Error) => void }
>()

function cleanupWorker() {
  worker?.terminate()
  worker = null
  for (const { reject } of pending.values()) {
    reject(new Error("Highlighter worker stopped"))
  }
  pending.clear()
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/syntax-highlighter.ts", import.meta.url))
    worker.unref()

    worker.onmessage = (event: MessageEvent<HighlightResponse>) => {
      const { id, result } = event.data
      const job = pending.get(id)
      if (job) {
        job.resolve(result)
        pending.delete(id)
      }
    }

    worker.onmessageerror = (event) => {
      console.error("Syntax highlighter worker message error:", event)
      cleanupWorker()
    }

    worker.onerror = (event) => {
      console.error("Syntax highlighter worker error:", event)
      cleanupWorker()
    }
  }
  return worker
}

/**
 * Highlight code in a background worker so the UI thread stays responsive.
 * Falls back to plain text if the worker fails or content is empty.
 */
export async function highlightCode(
  content: string,
  filePath: string
): Promise<HighlightedLine[]> {
  if (!content) {
    return []
  }

  if (isCompiledBinary()) {
    return highlightDirect(content, filePath)
  }

  try {
    return await new Promise<HighlightedLine[]>((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })

      try {
        getWorker().postMessage({ id, content, filePath } satisfies HighlightRequest)
      } catch (error) {
        pending.delete(id)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  } catch (error) {
    console.error("Failed to highlight in worker, falling back to main thread:", error)
    return highlightDirect(content, filePath)
  }
}
