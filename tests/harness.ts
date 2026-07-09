import { testRender } from "@opentui/solid"
import { App } from "../src/app"
import { setTargetDir } from "../src/utils/git"
import type {
  TestRendererSetup,
  TestVisualIdleOptions,
} from "@opentui/core/testing"

export type CapturedFrame = ReturnType<TestRendererSetup["captureSpans"]>

export type KeyToken = string | { type: "text"; value: string }

export interface SnapshotResult {
  name: string
  ansi: string
  spans: CapturedFrame
}

export interface SnapshotOptions {
  waitForIdle?: boolean
  waitFor?: (frame: string) => boolean
  idleOptions?: TestVisualIdleOptions
}

export interface Harness {
  send(keys: KeyToken[]): Promise<void>
  snapshot(name: string, options?: SnapshotOptions): Promise<SnapshotResult>
  waitForIdle(options?: TestVisualIdleOptions): Promise<void>
  waitForFrame(
    predicate: (frame: string) => boolean,
    timeoutMs?: number,
  ): Promise<string>
  sleep(ms: number): Promise<void>
  ansi(): string
  spans(): CapturedFrame
  destroy(): Promise<void>
}

export interface HarnessOptions {
  fixture: string
  width: number
  height: number
}

const ESC = "\x1b"
const RESET = `${ESC}[0m`

function colorCode(channel: "38" | "48", rgba: { toInts(): readonly number[] }): string {
  const [r, g, b] = rgba.toInts()
  return `${channel};2;${r};${g};${b}`
}

function attributeCodes(attributes: number): string[] {
  const codes: string[] = []
  if (attributes & 1) codes.push("1")
  if (attributes & 2) codes.push("2")
  if (attributes & 4) codes.push("3")
  if (attributes & 8) codes.push("4")
  if (attributes & 16) codes.push("5")
  if (attributes & 32) codes.push("7")
  if (attributes & 64) codes.push("8")
  if (attributes & 128) codes.push("9")
  return codes
}

function spansToAnsi(frame: CapturedFrame): string {
  return frame.lines
    .map((line) => {
      let lineText = ""
      for (const span of line.spans) {
        if (span.text.length === 0) continue

        const codes = [
          colorCode("38", span.fg),
          colorCode("48", span.bg),
          ...attributeCodes(span.attributes),
        ]

        lineText += `${ESC}[${codes.join(";")}m${span.text}`
      }
      return lineText + RESET
    })
    .join("\n")
}

export async function createHarness(options: HarnessOptions): Promise<Harness> {
  setTargetDir(options.fixture)

  const setup: TestRendererSetup = await testRender(App, {
    width: options.width,
    height: options.height,
    targetFps: 30,
  })

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms))

  const waitForFrame = async (
    predicate: (frame: string) => boolean,
    timeoutMs = 10000,
    pollMs = 100,
  ): Promise<string> => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const frame = setup.captureCharFrame()
      if (predicate(frame)) {
        return frame
      }
      await sleep(pollMs)
    }
    throw new Error("Timed out waiting for frame predicate")
  }

  const send = async (keys: KeyToken[]) => {
    for (const key of keys) {
      if (typeof key === "string") {
        setup.mockInput.pressKey(key)
      } else if (key.type === "text") {
        await setup.mockInput.typeText(key.value)
      }
      await setup.flush()
    }
  }

  const snapshot = async (name: string, opts?: SnapshotOptions): Promise<SnapshotResult> => {
    if (opts?.waitFor) {
      await waitForFrame(opts.waitFor)
    }
    if (opts?.waitForIdle ?? true) {
      await setup.waitForVisualIdle(opts?.idleOptions)
    }
    const spans = setup.captureSpans()
    return {
      name,
      ansi: spansToAnsi(spans),
      spans,
    }
  }

  return {
    send,
    snapshot,
    waitForIdle: (options) => setup.waitForVisualIdle(options),
    waitForFrame,
    sleep,
    ansi: () => spansToAnsi(setup.captureSpans()),
    spans: () => setup.captureSpans(),
    destroy: async () => {
      setup.renderer.destroy()
    },
  }
}
