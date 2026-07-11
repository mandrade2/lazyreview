import type { Harness } from "../harness"
import { lineText } from "../assertions"

export const waitForFrameText = (harness: Harness, text: string, timeoutMs = 10000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      const frameText = harness.spans().lines.map(lineText).join("\n")
      if (frameText.includes(text)) {
        resolve()
        return
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`Timed out waiting for frame text: ${text}`))
        return
      }
      setTimeout(check, 100)
    }
    check()
  })
}
