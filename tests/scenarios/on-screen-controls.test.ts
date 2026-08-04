import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildGoldenFixture } from "../fixtures"
import { lineText } from "../assertions"

async function withTempConfig(run: () => Promise<void>): Promise<void> {
  const configDir = join(tmpdir(), `lazyreview-test-config-${Date.now()}-${Math.random()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir
  try {
    await run()
  } finally {
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
}

test("on-screen controls toggle from help and click buttons (landscape)", async () => {
  await withTempConfig(async () => {
    const fixture = await buildGoldenFixture()
    const harness = await createHarness({
      fixture: fixture.path,
      width: 120,
      height: 24,
    })

    try {
      await harness.waitForFrame((frame) => frame.includes("To Review"))

      // No controls before the setting is enabled.
      let text = harness.spans().lines.map(lineText).join("\n")
      expect(text).not.toContain("tab")
      expect(text).not.toContain("esc")

      // Open help and toggle the config game-menu style with the right arrow.
      await harness.send(["?"])
      await harness.waitForFrame((frame) => frame.includes("On-screen controls"))
      text = harness.spans().lines.map(lineText).join("\n")
      expect(text).toContain("< Off >")

      await harness.send(["ARROW_RIGHT"])
      text = harness.spans().lines.map(lineText).join("\n")
      expect(text).toContain("< On >")

      // The other live settings are configurable here too.
      await harness.send(["ARROW_DOWN", "ARROW_RIGHT"])
      text = harness.spans().lines.map(lineText).join("\n")
      expect(text).toContain("< Full >")

      await harness.send(["ARROW_DOWN", "ARROW_RIGHT"])
      text = harness.spans().lines.map(lineText).join("\n")
      expect(text).toContain("< Tree >")
      await harness.send(["ARROW_RIGHT"])
      text = harness.spans().lines.map(lineText).join("\n")
      expect(text).toContain("< Flat >")

      await harness.send(["ARROW_DOWN", "ARROW_RIGHT"])
      text = harness.spans().lines.map(lineText).join("\n")
      expect(text).toContain("< Off >")
      await harness.send(["ARROW_RIGHT"])

      // Close help: the landscape column of buttons appears on the right.
      await harness.send(["?"])
      await harness.waitForFrame((frame) => frame.includes("tab") && frame.includes("esc"))
      const controlsSnapshot = await harness.snapshot("controls-column")
      expect(controlsSnapshot.spans).toMatchSnapshot("controls-column-spans")

      // Click the ↓ button (right button of the sixth control row) and
      // confirm it acts like the down arrow key.
      const before = harness.spans().lines.map(lineText).join("\n")
      expect(before).toContain("1/7")
      await harness.click(114, 11)
      const after = harness.spans().lines.map(lineText).join("\n")
      expect(after).toContain("2/7")

      // Click the "1" list button (left button of the seventh control row)
      // to send the selected file to change list 1.
      await harness.click(104, 13)
      await harness.waitForFrame((frame) => frame.includes("[1] Reviewed (1)"))
    } finally {
      await harness.destroy()
      await fixture.cleanup()
    }
  })
}, { timeout: 15000 })

test("on-screen controls render as a bottom row in portrait", async () => {
  await withTempConfig(async () => {
    const fixture = await buildGoldenFixture()
    const harness = await createHarness({
      fixture: fixture.path,
      width: 40,
      height: 30,
    })

    try {
      await harness.waitForFrame((frame) => frame.includes("To Review"))

      await harness.send(["?"])
      await harness.waitForFrame((frame) => frame.includes("On-screen controls"))
      await harness.send(["ARROW_RIGHT"])
      await harness.send(["?"])
      await harness.waitForFrame((frame) => frame.includes("tab") && frame.includes("esc"))

      const snapshot = await harness.snapshot("controls-row")
      expect(snapshot.spans).toMatchSnapshot("controls-row-spans")

      // Bottom rows: three full-width rows of five buttons sit above the
      // status bar. Row 3 holds ↑ ↓ 1 2 3 -> "↓" is the 2nd button.
      const before = harness.spans().lines.map(lineText).join("\n")
      expect(before).toContain("1/7")
      await harness.click(11, 27)
      const after = harness.spans().lines.map(lineText).join("\n")
      expect(after).toContain("2/7")

      // Click the "2" list button (4th button of the third row) to send the
      // selected file to change list 2. The list 2 section doesn't fit in
      // this short viewport, so check the "To Review" count instead.
      await harness.click(27, 27)
      await harness.waitForFrame((frame) => frame.includes("To Review (6)"))
    } finally {
      await harness.destroy()
      await fixture.cleanup()
    }
  })
}, { timeout: 15000 })
