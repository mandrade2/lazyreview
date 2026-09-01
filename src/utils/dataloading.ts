import type { HighlightedLine, HighlightedToken } from "./shiki"
import { highlightCode as highlightDirect } from "./shiki"
import { th } from "./theme"

export type { HighlightedLine, HighlightedToken } from "./shiki"
export { detectLanguage } from "./shiki"

/**
 * Estimate how many display rows a raw line consumes when wrapped to the given
 * width. This mirrors the row count produced by `wrapTokens` for plain content.
 */export function estimateWrappedRows(lineLength: number, width: number): number {
  if (width <= 0 || lineLength <= 0) return 1
  return Math.ceil(lineLength / width)
}

/**
 * Compute the maximum logical-line scroll offset for a set of lines that may
 * wrap. Returns the earliest line index such that the remaining content fits
 * within the visible viewport.
 */
export function computeWrappedMaxScroll(
  lines: Array<{ content: string } | string>,
  contentWidth: number,
  visibleHeight: number,
): number {
  if (lines.length === 0 || visibleHeight <= 0) return 0

  const width = Math.max(1, contentWidth)
  const rowCounts = lines.map((line) => {
    const length = typeof line === "string" ? line.length : line.content.length
    return estimateWrappedRows(length, width)
  })

  let totalRows = 0
  for (let i = lines.length - 1; i >= 0; i--) {
    totalRows += rowCounts[i]!
    if (totalRows > visibleHeight) {
      return Math.min(i + 1, lines.length - 1)
    }
  }

  return 0
}

/**
 * Split a highlighted line into multiple rows so that no rendered row exceeds
 * the given column width. Token styles are preserved across row boundaries.
 */
export function wrapTokens(tokens: HighlightedLine, width: number): HighlightedLine[] {
  if (width <= 0) {
    return [tokens]
  }

  const rows: HighlightedLine[] = []
  let current: HighlightedToken[] = []
  let currentLength = 0

  for (const token of tokens) {
    let remaining = token.content
    while (remaining.length > 0) {
      const space = width - currentLength
      if (space <= 0) {
        rows.push(current)
        current = []
        currentLength = 0
        continue
      }

      const take = Math.min(space, remaining.length)
      current.push({ ...token, content: remaining.slice(0, take) })
      currentLength += take
      remaining = remaining.slice(take)

      if (currentLength === width) {
        rows.push(current)
        current = []
        currentLength = 0
      }
    }
  }

  if (current.length > 0) {
    rows.push(current)
  }

  if (rows.length === 0) {
    rows.push([{ content: "", color: th("#e6edf3") }])
  }

  return rows
}

interface HighlightRequest {
  id: number
  key: string
  content: string
  filePath: string
}

interface HighlightResponse {
  id: number
  key: string
  result: HighlightedLine[]
}

function hashKey(content: string): string {
  return Bun.hash(content).toString(36)
}

function makeCacheKey(filePath: string, content: string): string {
  return `${filePath}:${content.length}:${hashKey(content)}`
}

// LRU-ish cache bounded by number of entries. Each value is a token array,
// which can be large, so we keep the cap modest to avoid unbounded memory growth.
const maxCacheEntries = 30
const highlightCache = new Map<string, HighlightedLine[]>()

function getCached(key: string): HighlightedLine[] | undefined {
  const value = highlightCache.get(key)
  if (value) {
    // Refresh insertion order for LRU eviction.
    highlightCache.delete(key)
    highlightCache.set(key, value)
  }
  return value
}

function setCached(key: string, value: HighlightedLine[]) {
  if (highlightCache.has(key)) {
    highlightCache.delete(key)
  } else if (highlightCache.size >= maxCacheEntries) {
    const oldest = highlightCache.keys().next().value
    if (oldest !== undefined) {
      highlightCache.delete(oldest)
    }
  }
  highlightCache.set(key, value)
}

let worker: Worker | null = null
let nextId = 0
let currentKey: string | null = null
const pending = new Map<
  number,
  {
    key: string
    resolve: (result: HighlightedLine[]) => void
    reject: (error: Error) => void
  }
>()

function terminateWorker(reason?: Error) {
  worker?.terminate()
  worker = null
  for (const { reject } of pending.values()) {
    reject(reason ?? new Error("Highlighter worker stopped"))
  }
  pending.clear()
}

// Compiled binaries embed the worker as a separate entrypoint; inside $bunfs
// the transpiled module carries a .js extension, and Bun resolves the .js
// specifier to the .ts source when running from source.
const workerUrl = new URL("../workers/syntax-highlighter.js", import.meta.url)

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(workerUrl)
    worker.unref()

    worker.onmessage = (event: MessageEvent<HighlightResponse>) => {
      const { id, key, result } = event.data
      const job = pending.get(id)
      if (!job) return

      pending.delete(id)

      // Stale result guard: only accept the response if this key is still
      // relevant. We cache it anyway because the user may navigate back.
      setCached(key, result)

      if (key === currentKey) {
        job.resolve(result)
      } else {
        job.reject(new Error("Highlight result is stale"))
      }
    }

    worker.onmessageerror = (event) => {
      console.error("Syntax highlighter worker message error:", event)
      terminateWorker(new Error("Highlighter worker crashed"))
    }

    worker.onerror = (event) => {
      console.error("Syntax highlighter worker error:", event)
      terminateWorker(new Error("Highlighter worker crashed"))
    }
  }
  return worker
}

function runHighlightInWorker(
  key: string,
  content: string,
  filePath: string
): Promise<HighlightedLine[]> {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { key, resolve, reject })

    try {
      getWorker().postMessage({ id, key, content, filePath } satisfies HighlightRequest)
    } catch (error) {
      pending.delete(id)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

/**
 * Highlight a file's content. Returns cached results immediately when available.
 *
 * All highlighting runs in a worker so the UI never blocks. If the user
 * navigates while a highlight is in flight, the worker is terminated and
 * restarted for the new selection. If the worker cannot run at all, highlighting
 * falls back to the main thread.
 */
export async function highlightFile(
  content: string,
  filePath: string
): Promise<HighlightedLine[]> {
  if (!content) {
    return []
  }

  const key = makeCacheKey(filePath, content)
  const cached = getCached(key)
  if (cached) {
    return cached
  }

  currentKey = key

  // Cancel any in-flight worker work for a different file so the current
  // selection gets highlighted as soon as possible. Terminating the worker is
  // the only reliable way to stop a run-to-completion Shiki tokenization
  // mid-flight.
  if (pending.size > 0) {
    terminateWorker()
  }

  try {
    const result = await runHighlightInWorker(key, content, filePath)
    return result
  } catch (error) {
    // Stale-result and stopped-worker rejections are expected when the user
    // navigates quickly; don't spam the console or waste main-thread work for
    // those.
    const expectedMessages = ["Highlight result is stale", "Highlighter worker stopped"]
    const isExpected = error instanceof Error && expectedMessages.includes(error.message)
    if (isExpected) {
      throw error
    }
    console.error("Failed to highlight in worker, falling back to main thread:", error)
    const result = await highlightDirect(content, filePath)
    setCached(key, result)
    return result
  }
}

// Maximum number of lines we'll eagerly preload. Large files are skipped because
// preloading them would delay highlighting for the current selection.
const eagerMaxLines = 2000

/**
 * Eagerly highlight a file in the background if the worker is idle and the file
 * is small enough. The result is cached so navigation feels instant. Errors are
 * swallowed — eager loading is purely opportunistic.
 */
export function preloadHighlight(content: string, filePath: string) {
  if (!content) {
    return
  }

  const key = makeCacheKey(filePath, content)
  if (highlightCache.has(key)) {
    return
  }

  const lineCount = content.split("\n").length
  if (lineCount > eagerMaxLines) {
    return
  }

  // Only preload when no foreground work is running.
  if (pending.size > 0) {
    return
  }

  runHighlightInWorker(key, content, filePath)
    .then((result) => {
      setCached(key, result)
    })
    .catch(() => {
      // Opportunistic preload failures are fine.
    })
}

/**
 * Clear the highlight cache and terminate the worker. Useful when unloading a
 * repository or running isolated tests that should not share worker state.
 */
export function resetHighlighter() {
  terminateWorker()
  clearHighlightCache()
  currentKey = null
}

/**
 * Clear the highlight cache. Useful when unloading a repository or testing.
 */
export function clearHighlightCache() {
  highlightCache.clear()
}
