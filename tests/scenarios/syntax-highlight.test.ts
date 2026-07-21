import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildSyntaxHighlightFixture } from "../fixtures"
import { runScenario, shikiKeywordColor } from "./syntax-highlight"
import { getSpanForeground, lineTextFrom } from "../assertions"
import type { CapturedFrame } from "../harness"

const SIDEBAR_WIDTH = 35

function diffPanelForegrounds(frame: CapturedFrame): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const line of frame.lines) {
    let col = 0
    for (const span of line.spans) {
      const start = col
      col += span.width
      if (start < SIDEBAR_WIDTH || span.text.trim().length === 0) continue
      const fg = getSpanForeground(span)
      const texts = result.get(fg) ?? []
      texts.push(span.text)
      result.set(fg, texts)
    }
  }
  return result
}

test("tsx, ts and js files always render with syntax highlighting", async () => {
  const configDir = join(tmpdir(), `lazyreview-test-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildSyntaxHighlightFixture()
  const harness = await createHarness({ fixture: fixture.path, width: 80, height: 24 })

  try {
    const { snapshots } = await runScenario(harness)

    const highlightSnapshots = snapshots.filter((s) => s.name.startsWith("highlight-file"))
    expect(highlightSnapshots.length).toBe(4)

    const seenFiles = new Set<string>()
    for (const snapshot of highlightSnapshots) {
      const panelText = snapshot.spans.lines
        .map((line) => lineTextFrom(line, SIDEBAR_WIDTH))
        .join("\n")

      const shownFile = ["component.tsx", "util.ts", "main.js", "big.tsx"].find((name) =>
        panelText.includes(name),
      )
      expect(shownFile, `snapshot ${snapshot.name} should show a known file`).toBeDefined()
      seenFiles.add(shownFile!)

      const foregrounds = diffPanelForegrounds(snapshot.spans)
      const keywordTokens = foregrounds.get(shikiKeywordColor) ?? []
      expect(
        keywordTokens.some((text) => /import|export|function/.test(text)),
        `${shownFile} should render JS/TS keywords with the Shiki keyword color; got foregrounds: ${[...foregrounds.keys()].join(", ")}`,
      ).toBe(true)
    }

    // Every file in the fixture must have been shown highlighted, including
    // big.tsx, which exceeds the 500-line threshold that used to disable
    // highlighting entirely in compiled binaries.
    expect(seenFiles).toEqual(new Set(["component.tsx", "util.ts", "main.js", "big.tsx"]))
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
}, { timeout: 30000 })
