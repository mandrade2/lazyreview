import { test, expect, describe } from "bun:test"
import {
  buildCommitPrompt,
  extractMessageText,
  formatCommitMessage,
  generateCommitMessage,
  parseCommitMessage,
  shortModelName,
  splitCommitMessage,
  truncateDiff,
  wrapText,
} from "./commit-message"
import type { RunResult } from "./commit-message"

describe("parseCommitMessage", () => {
  test("splits title and body on the blank line", () => {
    const result = parseCommitMessage(
      "Add AI commit messages\n\nGenerates a message from the diff and\ncommits in one step.",
    )
    expect(result.title).toBe("Add AI commit messages")
    expect(result.body).toBe("Generates a message from the diff and\ncommits in one step.")
  })

  test("returns an empty body when the diff warranted only a subject", () => {
    expect(parseCommitMessage("Bump version to 0.2.6")).toEqual({
      title: "Bump version to 0.2.6",
      body: "",
    })
  })

  test("drops multiple blank lines between title and body", () => {
    const result = parseCommitMessage("Fix scroll\n\n\n\nKeeps the viewport stable.")
    expect(result.title).toBe("Fix scroll")
    expect(result.body).toBe("Keeps the viewport stable.")
  })

  test("unwraps a code fence", () => {
    const result = parseCommitMessage("```\nfeat: add tag mode\n\nTags are now reviewable.\n```")
    expect(result.title).toBe("feat: add tag mode")
    expect(result.body).toBe("Tags are now reviewable.")
  })

  test("accepts a labelled title/body shape", () => {
    const result = parseCommitMessage("TITLE: Discard files with d\nBODY:\nRestores the file to HEAD.")
    expect(result.title).toBe("Discard files with d")
    expect(result.body).toBe("Restores the file to HEAD.")
  })

  test("strips a preamble line and a bullet marker from the title", () => {
    const result = parseCommitMessage("Commit message:\n- Add file tree view\n\nFolders collapse.")
    expect(result.title).toBe("Add file tree view")
    expect(result.body).toBe("Folders collapse.")
  })

  test("drops the trailing period and clamps a long title", () => {
    const long = "Make the diff viewer handle pathological minified bundles gracefully"
    const result = parseCommitMessage(`${long} and also everything else you can imagine about it.`)
    expect(result.title.length).toBeLessThanOrEqual(72)
    expect(result.title.endsWith("…")).toBe(true)
  })

  test("handles CRLF line endings", () => {
    const result = parseCommitMessage("Fix picker\r\n\r\nUses the short hash.")
    expect(result.title).toBe("Fix picker")
    expect(result.body).toBe("Uses the short hash.")
  })

  test("returns an empty title for empty output", () => {
    expect(parseCommitMessage("").title).toBe("")
    expect(parseCommitMessage("   \n  ").title).toBe("")
  })
})

describe("extractMessageText", () => {
  test("concatenates text parts from NDJSON events", () => {
    const stdout = [
      '{"type":"step_start","part":{"type":"step-start"}}',
      '{"type":"text","part":{"type":"text","text":"Add tree view"}}',
      '{"type":"text","part":{"type":"text","text":"\\n\\nCollapses folders."}}',
      '{"type":"step_finish","part":{"type":"step-finish","reason":"stop"}}',
    ].join("\n")
    expect(extractMessageText(stdout)).toBe("Add tree view\n\nCollapses folders.")
  })

  test("ignores unknown events and blank lines", () => {
    const stdout = '\n{"type":"tool","part":{"type":"tool"}}\n{"type":"text","part":{"text":"x"}}\n'
    expect(extractMessageText(stdout)).toBe("x")
  })

  test("throws when the run reports an error event", () => {
    const stdout = '{"type":"error","part":{"message":"model not found"}}'
    expect(() => extractMessageText(stdout)).toThrow("model not found")
  })

  test("falls back to plain text when the output is not NDJSON", () => {
    expect(extractMessageText("Add tree view\n")).toBe("Add tree view")
  })

  test("returns empty text when the CLI streamed no message", () => {
    expect(extractMessageText('{"type":"step_finish","part":{"reason":"stop"}}')).toBe("")
  })
})

describe("truncateDiff", () => {
  test("leaves a small diff untouched", () => {
    const diff = "+one\n-two"
    expect(truncateDiff(diff, 100)).toEqual({ diff, truncated: false })
  })

  test("cuts on a line boundary and reports truncation", () => {
    const diff = Array.from({ length: 50 }, (_, i) => `+line ${i}`).join("\n")
    const result = truncateDiff(diff, 60)
    expect(result.truncated).toBe(true)
    expect(result.diff.length).toBeLessThanOrEqual(60)
    expect(result.diff.includes("\n")).toBe(true)
    expect(diff.startsWith(result.diff)).toBe(true)
  })
})

describe("buildCommitPrompt", () => {
  test("embeds the diff between markers", () => {
    const prompt = buildCommitPrompt("+hello")
    expect(prompt).toContain("--- BEGIN DIFF ---\n+hello\n--- END DIFF ---")
  })

  test("marks a truncated diff", () => {
    expect(buildCommitPrompt("+hello", { truncated: true })).toContain("--- BEGIN DIFF (truncated) ---")
  })
})

describe("wrapText", () => {
  test("wraps on word boundaries", () => {
    expect(wrapText("aa bb cc", 5)).toEqual(["aa bb", "cc"])
    expect(wrapText("abcdefgh", 3)).toEqual(["abc", "def", "gh"])
  })

  test("reflows hard-wrapped prose instead of keeping its line breaks", () => {
    expect(wrapText("one two\nthree", 20)).toEqual(["one two three"])
    expect(wrapText("aa bb\ncc dd", 5)).toEqual(["aa bb", "cc dd"])
  })

  test("keeps paragraphs apart", () => {
    expect(wrapText("a b\n\nc d", 10)).toEqual(["a b", "", "c d"])
    expect(wrapText("a\n\n\n\nb", 10)).toEqual(["a", "", "b"])
  })

  test("keeps each bullet on its own, folding its continuation lines in", () => {
    expect(wrapText("- a b\n- c d\n  e f", 10)).toEqual(["- a b", "- c d e f"])
    expect(wrapText("prose\n- a b", 10)).toEqual(["prose", "- a b"])
  })

  test("returns nothing for empty text", () => {
    expect(wrapText("", 10)).toEqual([])
    expect(wrapText("   \n  ", 10)).toEqual([])
  })
})

describe("formatCommitMessage", () => {
  test("joins title and body with a blank line", () => {
    expect(formatCommitMessage({ title: "Add thing", body: "Because." })).toBe("Add thing\n\nBecause.")
  })

  test("omits the blank line when there is no body", () => {
    expect(formatCommitMessage({ title: "Bump version", body: "" })).toBe("Bump version")
  })

  test("round-trips through splitCommitMessage", () => {
    const message = { title: "Add thing", body: "First.\n\nSecond." }
    expect(splitCommitMessage(formatCommitMessage(message))).toEqual(message)
  })
})

describe("splitCommitMessage", () => {
  test("splits without normalizing what the user typed", () => {
    expect(splitCommitMessage("fix thing.")).toEqual({ title: "fix thing.", body: "" })
    expect(splitCommitMessage("a 150 character title would stay intact here")).toEqual({
      title: "a 150 character title would stay intact here",
      body: "",
    })
  })

  test("keeps the body verbatim apart from its separating blank line", () => {
    expect(splitCommitMessage("Add thing\n\n  indented body  ")).toEqual({
      title: "Add thing",
      body: "indented body",
    })
  })
})

describe("shortModelName", () => {
  test("drops the provider prefix", () => {
    expect(shortModelName("opencode-go/gpt-6-luna")).toBe("gpt-6-luna")
    expect(shortModelName("gpt-6-luna")).toBe("gpt-6-luna")
  })
})

describe("generateCommitMessage", () => {
  const ok = (text: string): RunResult => ({
    stdout: `{"type":"text","part":{"text":${JSON.stringify(text)}}}`,
    stderr: "",
    exitCode: 0,
  })

  test("asks opencode for a message and parses the reply", async () => {
    const calls: Array<{ command: string[]; options: { cwd: string } }> = []
    const message = await generateCommitMessage("+added line", {
      command: "opencode",
      model: "opencode-go/gpt-6-luna",
      cwd: "/repo",
      run: async (command, options) => {
        calls.push({ command, options })
        return ok("Add tree view\n\nCollapses folders on demand.")
      },
    })

    expect(message).toEqual({ title: "Add tree view", body: "Collapses folders on demand." })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.command.slice(0, 6)).toEqual([
      "opencode",
      "run",
      "--format",
      "json",
      "--auto",
      "--model",
    ])
    expect(calls[0]!.command[6]).toBe("opencode-go/gpt-6-luna")
    expect(calls[0]!.command[7]).toContain("+added line")
    expect(calls[0]!.options.cwd).toBe("/repo")
  })

  test("hands the caller's abort handle to the runner", async () => {
    const kill = () => {}
    const registered: Array<() => void> = []
    await generateCommitMessage("+x", {
      onAbort: (abort) => {
        registered.push(abort)
      },
      run: async (_command, options) => {
        options.onAbort(kill)
        return ok("Fix thing")
      },
    })
    expect(registered).toHaveLength(1)
    expect(registered[0]).toBe(kill)
  })

  test("surfaces the CLI failure when no message comes back", async () => {
    await expect(
      generateCommitMessage("+x", {
        run: async () => ({ stdout: "", stderr: "opencode: model not found", exitCode: 1 }),
      }),
    ).rejects.toThrow("No commit message returned: opencode: model not found")
  })

  test("truncates a huge diff before sending it", async () => {
    const diff = Array.from({ length: 5000 }, (_, i) => `+line ${i} padding padding`).join("\n")
    let prompt = ""
    await generateCommitMessage(diff, {
      run: async (command) => {
        prompt = command[command.length - 1] ?? ""
        return ok("Bloat the diff")
      },
    })
    expect(prompt).toContain("BEGIN DIFF (truncated)")
    expect(prompt.length).toBeLessThan(diff.length)
  })
})
