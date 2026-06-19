import { highlightCode } from "../utils/shiki"
import type { HighlightedLine } from "../utils/shiki"

interface HighlightRequest {
  id: number
  content: string
  filePath: string
}

interface HighlightResponse {
  id: number
  result: HighlightedLine[]
}

interface WorkerContext {
  onmessage: ((event: MessageEvent<HighlightRequest>) => void) | null
  postMessage(message: HighlightResponse): void
}

const ctx = globalThis as unknown as WorkerContext

ctx.onmessage = async (event: MessageEvent<HighlightRequest>) => {
  const { id, content, filePath } = event.data
  const result = await highlightCode(content, filePath)
  ctx.postMessage({ id, result } satisfies HighlightResponse)
}
