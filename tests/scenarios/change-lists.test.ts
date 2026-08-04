import { test, expect } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildFixture } from "../fixtures"

test("tab cycling in tree mode lands on the first file, not a folder", async () => {
  const configDir = join(tmpdir(), `lazyreview-tree-tab-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildFixture({
    name: "tree-tab",
    commits: [
      {
        message: "initial",
        files: {
          "top.ts": "export const top = 1\n",
          "src/a.ts": "export const a = 1\n",
          "src/b.ts": "export const b = 1\n",
        },
      },
    ],
    dirty: {
      modified: {
        "top.ts": "export const top = 2\n",
        "src/a.ts": "export const a = 2\n",
        "src/b.ts": "export const b = 2\n",
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

    // Switch to tree view and mark the whole src folder into list 1. In tree
    // mode folders come first, so jumping to the top selects the src folder.
    await harness.send(["t"])
    await harness.waitForFrame((frame) => frame.includes("- src"))
    await harness.send(["g"])
    await harness.send([" "])
    await harness.waitForFrame((frame) => frame.includes("[1] Reviewed (2)"))

    // Selection is on top.ts in "To Review". Tab into list 1: the first row
    // there is the src folder, but the jump must land on src/a.ts instead.
    await harness.send(["TAB"])
    await harness.waitForFrame(
      (frame) => frame.includes("src/a.ts") && frame.includes("[Modified] [Reviewed]"),
    )

    // Tab back to "To Review" lands on its only file.
    await harness.send(["TAB"])
    await harness.waitForFrame((frame) => frame.includes("top.ts") && frame.includes("[Not Reviewed]"))
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
})

test("numbered change lists and commit flow", async () => {
  const configDir = join(tmpdir(), `lazyreview-change-lists-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildFixture({
    name: "change-lists",
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

    // Send a.ts to list 2 with the number key.
    await harness.send(["2"])
    await harness.waitForFrame((frame) => frame.includes("[2] Reviewed (1)"))

    // Send b.ts to list 1 with the spacebar (selection moved to b.ts).
    await harness.send([" "])
    await harness.waitForFrame((frame) => frame.includes("[1] Reviewed (1)"))

    // With two active lists and the selection in "To Review", c is ambiguous
    // and must not open the dialog.
    await harness.send(["c"])
    await harness.sleep(200)
    expect(harness.ansi().includes("Commit list")).toBe(false)

    // Tab cycles the selection through the sections: To Review (c.ts) ->
    // list 1 (b.ts) -> list 2 (a.ts) -> back to To Review.
    await harness.send(["TAB"])
    await harness.waitForFrame((frame) => frame.includes("b.ts") && frame.includes("[Modified] [Reviewed]"))
    await harness.send(["TAB"])
    await harness.waitForFrame((frame) => frame.includes("a.ts") && frame.includes("[Modified] [Reviewed]"))
    await harness.send(["TAB"])
    await harness.waitForFrame((frame) => frame.includes("c.ts") && frame.includes("[Modified] [Not Reviewed]"))

    // Navigate into list 2 (past c.ts and the list 1 entry) and commit it.
    await harness.send(["j", "j"])
    await harness.send(["c"])
    await harness.waitForFrame((frame) => frame.includes("Commit list [2] (1 files)"))
    await harness.send([{ type: "text", value: "commit a" }])
    await harness.waitForFrame((frame) => frame.includes("commit a_"))
    await harness.send(["RETURN"])
    // Wait for the dialog to close: it stays open (with an error) if the
    // commit fails, and closes only after the commit and reload complete.
    await harness.waitForFrame((frame) => !frame.includes("Commit list [2]"))

    const logAfterA = await Bun.$`git -C ${fixture.path} log -1 --format=%s`.text()
    expect(logAfterA.trim()).toBe("commit a")
    const statusAfterA = await Bun.$`git -C ${fixture.path} status --porcelain`.text()
    expect(statusAfterA).not.toContain("a.ts")
    expect(statusAfterA).toContain("b.ts")
    expect(statusAfterA).toContain("c.ts")

    // List 1 survives the reload; commit it via the single-list fallback
    // regardless of where the selection is.
    await harness.waitForFrame((frame) => frame.includes("[1] Reviewed (1)"))
    await harness.send(["c"])
    await harness.waitForFrame((frame) => frame.includes("Commit list [1] (1 files)"))
    await harness.send([{ type: "text", value: "commit b" }])
    await harness.waitForFrame((frame) => frame.includes("commit b_"))
    await harness.send(["RETURN"])
    await harness.waitForFrame(
      (frame) => frame.includes("To Review (1)") && !frame.includes("Commit list [1]"),
    )

    const logAfterB = await Bun.$`git -C ${fixture.path} log -1 --format=%s`.text()
    expect(logAfterB.trim()).toBe("commit b")
    const statusAfterB = await Bun.$`git -C ${fixture.path} status --porcelain`.text()
    expect(statusAfterB).toBe(" M c.ts\n")
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    process.env.XDG_CONFIG_HOME = originalXdg
  }
})
