import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildFixture } from "../fixtures"
import { lineText } from "../assertions"

test("refresh returns changed reviewed files to To Review without clearing review state", async () => {
  const configDir = join(tmpdir(), `lazyreview-refresh-reconcile-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildFixture({
    name: "refresh-reconcile",
    commits: [
      {
        message: "initial",
        files: {
          "a.ts": "export const a = 1\n",
          "b.ts": "export const b = 1\n",
          "c.ts": "export const c = 1\n",
        },
      },
    ],
    dirty: {
      modified: {
        "a.ts": "export const a = 2\n",
        "b.ts": "export const b = 2\n",
        "c.ts": "export const c = 2\n",
      },
    },
  })
  const harness = await createHarness({
    fixture: fixture.path,
    width: 80,
    height: 24,
  })

  try {
    await harness.waitForFrame((frame) => frame.includes("To Review (3)"))

    // Review a.ts and b.ts into list 1, leaving c.ts in "To Review".
    await harness.send([" ", " "])
    await harness.waitForFrame((frame) => frame.includes("[1] Reviewed (2)"))

    // b.ts gains a new change after it was reviewed.
    await Bun.write(join(fixture.path, "b.ts"), "export const b = 3\n")

    await harness.send(["r"])
    await harness.waitForFrame(
      (frame) => frame.includes("To Review (2)") && frame.includes("[1] Reviewed (1)"),
    )

    const texts = harness.spans().lines.map(lineText)
    const toReviewIdx = texts.findIndex((t) => t.includes("To Review ("))
    const reviewedIdx = texts.findIndex((t) => t.includes("[1] Reviewed ("))

    expect(toReviewIdx).toBeGreaterThanOrEqual(0)
    expect(reviewedIdx).toBeGreaterThan(toReviewIdx)

    const toReviewTexts = texts.slice(toReviewIdx + 1, reviewedIdx)
    const reviewedTexts = texts.slice(reviewedIdx + 1)

    // The changed file moved back to "To Review"; the unchanged reviewed file
    // stayed put in list 1.
    expect(toReviewTexts.some((t) => t.includes("b.ts"))).toBe(true)
    expect(toReviewTexts.some((t) => t.includes("c.ts"))).toBe(true)
    expect(reviewedTexts.some((t) => t.includes("a.ts"))).toBe(true)
    expect(reviewedTexts.some((t) => t.includes("b.ts"))).toBe(false)
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
})
