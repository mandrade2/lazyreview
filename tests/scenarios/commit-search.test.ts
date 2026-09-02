import { test, expect } from "bun:test"
import { createHarness } from "../harness"
import { buildFixture } from "../fixtures"
import { lineText } from "../assertions"

const ENTER = "\r"
const ESCAPE = "\x1b"

test("commit list search filters commits", async () => {
  const fixture = await buildFixture({
    name: "commit-search",
    commits: [
      { message: "add alpha feature", files: { "a.txt": "a\n" } },
      { message: "add beta feature", files: { "b.txt": "b\n" } },
      { message: "add gamma feature", files: { "c.txt": "c\n" } },
    ],
  })

  const harness = await createHarness({ fixture: fixture.path, width: 80, height: 24 })

  try {
    // Wait for dirty mode to settle, then switch to commit mode.
    await harness.waitForFrame((f) => f.includes("To Review"))
    await harness.send(["m"])
    await harness.waitForFrame((f) => f.includes("COMMITS"))
    await harness.sleep(300)

    const frameText = () => harness.spans().lines.map(lineText).join("\n")
    const before = frameText()
    expect(before).toContain("add alpha feature")
    expect(before).toContain("add beta feature")
    expect(before).toContain("add gamma feature")

    // Start search and type "beta"
    await harness.send(["/"])
    await harness.send([{ type: "text", value: "beta" }])
    await harness.send([ENTER])
    await harness.sleep(300)

    const after = frameText()
    expect(after).toContain("COMMITS (1/3)")
    expect(after).toContain("add beta feature")
    expect(after).not.toContain("add alpha feature")
    expect(after).not.toContain("add gamma feature")

    // Escape clears the search and restores the full list.
    await harness.send([ESCAPE])
    await harness.sleep(300)
    const cleared = frameText()
    expect(cleared).toContain("COMMITS (3)")
    expect(cleared).toContain("add alpha feature")
  } finally {
    await harness.destroy()
    await fixture.cleanup()
  }
}, { timeout: 20000 })
