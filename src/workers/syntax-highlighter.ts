import { highlightCode } from "../utils/shiki"
import type { HighlightedLine } from "../utils/shiki"

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

interface WorkerContext {
  onmessage: ((event: MessageEvent<HighlightRequest>) => void) | null
  postMessage(message: HighlightResponse): void
}

const ctx = globalThis as unknown as WorkerContext

// Process requests one at a time. Shiki tokenization is synchronous once its
// language is loaded, but the async parts (highlighter + grammar loading) are
// not safe to interleave, so each message is chained behind the previous one.
let chain: Promise<void> = Promise.resolve()

ctx.onmessage = (event: MessageEvent<HighlightRequest>) => {
  const { id, key, content, filePath } = event.data
  chain = chain
    .catch(() => {})
    .then(async () => {
      const result = await highlightCode(content, filePath)
      ctx.postMessage({ id, key, result } satisfies HighlightResponse)
    })
}
