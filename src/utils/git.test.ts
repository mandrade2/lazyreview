import { test, expect, describe } from "bun:test"
import { parseDiff, parseChangedLines, generateUnifiedDiff } from "./git"
import type { DiffLine } from "./git"

// ---------------------------------------------------------------------------
// parseDiff – the core unified-diff parser
// ---------------------------------------------------------------------------
describe("parseDiff", () => {
  test("returns empty array for empty string", () => {
    expect(parseDiff("")).toEqual([])
  })

  test("returns empty array for whitespace-only input", () => {
    expect(parseDiff("   \n  \n")).toEqual([])
  })

  // ---- single-hunk diffs -------------------------------------------------

  test("parses a simple single-hunk diff with additions only", () => {
    const diff = [
      "diff --git a/file.ts b/file.ts",
      "new file mode 100644",
      "index 0000000..abc1234",
      "--- /dev/null",
      "+++ b/file.ts",
      "@@ -0,0 +1,3 @@",
      "+line one",
      "+line two",
      "+line three",
    ].join("\n")

    const result = parseDiff(diff)

    // Should have 1 header + 3 additions
    expect(result.length).toBe(4)
    expect(result[0]!.type).toBe("header")
    expect(result[0]!.content).toBe("@@ -0,0 +1,3 @@")

    expect(result[1]!.type).toBe("addition")
    expect(result[1]!.content).toBe("line one")
    expect(result[1]!.newLineNumber).toBe(1)

    expect(result[2]!.type).toBe("addition")
    expect(result[2]!.content).toBe("line two")
    expect(result[2]!.newLineNumber).toBe(2)

    expect(result[3]!.type).toBe("addition")
    expect(result[3]!.content).toBe("line three")
    expect(result[3]!.newLineNumber).toBe(3)
  })

  test("parses a simple single-hunk diff with deletions only", () => {
    const diff = [
      "diff --git a/file.ts b/file.ts",
      "deleted file mode 100644",
      "--- a/file.ts",
      "+++ /dev/null",
      "@@ -1,3 +0,0 @@",
      "-line one",
      "-line two",
      "-line three",
    ].join("\n")

    const result = parseDiff(diff)

    expect(result.length).toBe(4) // 1 header + 3 deletions
    expect(result[0]!.type).toBe("header")

    for (let i = 1; i <= 3; i++) {
      expect(result[i]!.type).toBe("deletion")
      expect(result[i]!.oldLineNumber).toBe(i)
    }
  })

  test("parses a diff with context, additions, and deletions", () => {
    const diff = [
      "diff --git a/file.ts b/file.ts",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,5 +1,5 @@",
      " context line 1",
      "-old line 2",
      "+new line 2",
      " context line 3",
      "-old line 4",
      "+new line 4",
      " context line 5",
    ].join("\n")

    const result = parseDiff(diff)

    expect(result.length).toBe(8) // 1 header + 7 lines
    expect(result[0]!.type).toBe("header")

    expect(result[1]!.type).toBe("context")
    expect(result[1]!.content).toBe("context line 1")
    expect(result[1]!.oldLineNumber).toBe(1)
    expect(result[1]!.newLineNumber).toBe(1)

    expect(result[2]!.type).toBe("deletion")
    expect(result[2]!.content).toBe("old line 2")
    expect(result[2]!.oldLineNumber).toBe(2)

    expect(result[3]!.type).toBe("addition")
    expect(result[3]!.content).toBe("new line 2")
    expect(result[3]!.newLineNumber).toBe(2)

    expect(result[4]!.type).toBe("context")
    expect(result[4]!.content).toBe("context line 3")
    expect(result[4]!.oldLineNumber).toBe(3)
    expect(result[4]!.newLineNumber).toBe(3)
  })

  // ---- multi-hunk diffs --------------------------------------------------

  test("parses a multi-hunk diff correctly", () => {
    const diff = [
      "diff --git a/file.ts b/file.ts",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,3 +1,4 @@",
      " line 1",
      "+inserted after line 1",
      " line 2",
      " line 3",
      "@@ -10,3 +11,2 @@",
      " line 10",
      "-removed line 11",
      " line 12",
    ].join("\n")

    const result = parseDiff(diff)

    // First hunk: header + 4 lines
    expect(result[0]!.type).toBe("header")
    expect(result[0]!.content).toContain("@@ -1,3 +1,4 @@")

    expect(result[1]!.type).toBe("context")
    expect(result[1]!.oldLineNumber).toBe(1)
    expect(result[1]!.newLineNumber).toBe(1)

    expect(result[2]!.type).toBe("addition")
    expect(result[2]!.newLineNumber).toBe(2)

    expect(result[3]!.type).toBe("context")
    expect(result[3]!.oldLineNumber).toBe(2)
    expect(result[3]!.newLineNumber).toBe(3)

    expect(result[4]!.type).toBe("context")
    expect(result[4]!.oldLineNumber).toBe(3)
    expect(result[4]!.newLineNumber).toBe(4)

    // Second hunk: header + 3 lines
    expect(result[5]!.type).toBe("header")
    expect(result[5]!.content).toContain("@@ -10,3 +11,2 @@")

    expect(result[6]!.type).toBe("context")
    expect(result[6]!.oldLineNumber).toBe(10)
    expect(result[6]!.newLineNumber).toBe(11)

    expect(result[7]!.type).toBe("deletion")
    expect(result[7]!.oldLineNumber).toBe(11)

    expect(result[8]!.type).toBe("context")
    expect(result[8]!.oldLineNumber).toBe(12)
    expect(result[8]!.newLineNumber).toBe(12)
  })

  // ---- line number tracking -----------------------------------------------

  test("tracks line numbers correctly across deletions and additions", () => {
    // Simulates replacing 2 lines with 3 lines at the start of a file
    const diff = [
      "@@ -1,4 +1,5 @@",
      "-old first",
      "-old second",
      "+new first",
      "+new second",
      "+new third",
      " unchanged line 3",
      " unchanged line 4",
    ].join("\n")

    const result = parseDiff(diff)

    // Deletions track old line numbers
    expect(result[1]!.type).toBe("deletion")
    expect(result[1]!.oldLineNumber).toBe(1)
    expect(result[2]!.type).toBe("deletion")
    expect(result[2]!.oldLineNumber).toBe(2)

    // Additions track new line numbers
    expect(result[3]!.type).toBe("addition")
    expect(result[3]!.newLineNumber).toBe(1)
    expect(result[4]!.type).toBe("addition")
    expect(result[4]!.newLineNumber).toBe(2)
    expect(result[5]!.type).toBe("addition")
    expect(result[5]!.newLineNumber).toBe(3)

    // Context lines track both
    expect(result[6]!.type).toBe("context")
    expect(result[6]!.oldLineNumber).toBe(3)
    expect(result[6]!.newLineNumber).toBe(4)
  })

  // ---- hunk header variations ---------------------------------------------

  test("handles hunk header without count (single-line hunk)", () => {
    // @@ -5 +5 @@ means count=1 for both sides
    const diff = [
      "@@ -5 +5 @@",
      "-old",
      "+new",
    ].join("\n")

    const result = parseDiff(diff)
    expect(result[0]!.type).toBe("header")
    expect(result[1]!.type).toBe("deletion")
    expect(result[1]!.oldLineNumber).toBe(5)
    expect(result[2]!.type).toBe("addition")
    expect(result[2]!.newLineNumber).toBe(5)
  })

  test("handles hunk header with function context after @@", () => {
    const diff = [
      "@@ -10,5 +10,6 @@ function foo() {",
      " context",
      "+added",
    ].join("\n")

    const result = parseDiff(diff)
    expect(result[0]!.type).toBe("header")
    expect(result[0]!.content).toContain("function foo()")
    expect(result[1]!.type).toBe("context")
    expect(result[1]!.oldLineNumber).toBe(10)
  })

  // ---- edge cases ---------------------------------------------------------

  test("skips git diff metadata lines (diff --git, index, new file)", () => {
    const diff = [
      "diff --git a/foo.ts b/foo.ts",
      "new file mode 100644",
      "index 0000000..1234567 100644",
      "--- /dev/null",
      "+++ b/foo.ts",
      "@@ -0,0 +1,1 @@",
      "+hello",
    ].join("\n")

    const result = parseDiff(diff)
    // Should only have header + addition, no metadata lines
    expect(result.length).toBe(2)
    expect(result[0]!.type).toBe("header")
    expect(result[1]!.type).toBe("addition")
  })

  test("skips --- and +++ file header lines", () => {
    const diff = [
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
    ].join("\n")

    const result = parseDiff(diff)
    // No --- or +++ lines in output
    expect(result.every(l => !l.content.startsWith("-- a/") && !l.content.startsWith("++ b/"))).toBe(true)
  })

  test("handles empty lines in diff as context", () => {
    const diff = [
      "@@ -1,3 +1,3 @@",
      " first",
      "",
      " third",
    ].join("\n")

    const result = parseDiff(diff)
    expect(result.length).toBe(4) // header + 3 context lines
    // The empty line between first and third
    expect(result[2]!.type).toBe("context")
    expect(result[2]!.content).toBe("")
  })

  test("handles diff with a single context line (no changes in hunk)", () => {
    const diff = [
      "@@ -1,1 +1,1 @@",
      " just context",
    ].join("\n")

    const result = parseDiff(diff)
    expect(result.length).toBe(2)
    expect(result[1]!.type).toBe("context")
    expect(result[1]!.content).toBe("just context")
  })

  test("correctly strips leading +/- characters from content", () => {
    const diff = [
      "@@ -1,2 +1,2 @@",
      "-  indented old",
      "+  indented new",
    ].join("\n")

    const result = parseDiff(diff)
    expect(result[1]!.content).toBe("  indented old")
    expect(result[2]!.content).toBe("  indented new")
  })

  test("handles line starting with + in content (e.g. C++ code)", () => {
    // In a diff, a line that starts with ++ is a file header and gets skipped,
    // but +something is an addition. Content like "++i" would appear as "++i"
    // in the diff, which starts with "+" so it's an addition with content "+i"
    const diff = [
      "@@ -1,1 +1,2 @@",
      " normal",
      "+++i;",
    ].join("\n")

    const result = parseDiff(diff)
    // "+++" lines are treated as file headers and skipped
    // This is a known limitation - "+++" at line start is ambiguous
    expect(result.length).toBe(2) // header + context only
  })

  test("handles large line numbers correctly", () => {
    const diff = [
      "@@ -1000,2 +2000,3 @@",
      " context",
      "+new line",
      " more context",
    ].join("\n")

    const result = parseDiff(diff)
    expect(result[1]!.oldLineNumber).toBe(1000)
    expect(result[1]!.newLineNumber).toBe(2000)
    expect(result[2]!.newLineNumber).toBe(2001)
    expect(result[3]!.oldLineNumber).toBe(1001)
    expect(result[3]!.newLineNumber).toBe(2002)
  })

  // ---- real-world patterns ------------------------------------------------

  test("parses a renamed file diff correctly", () => {
    const diff = [
      "diff --git a/old-name.ts b/new-name.ts",
      "index abc1234..def5678 100644",
      "--- a/old-name.ts",
      "+++ b/new-name.ts",
      "@@ -1,3 +1,3 @@",
      " line 1",
      "-old line 2",
      "+new line 2",
      " line 3",
    ].join("\n")

    const result = parseDiff(diff)
    expect(result.length).toBe(5) // header + 4 lines
    expect(result[2]!.type).toBe("deletion")
    expect(result[3]!.type).toBe("addition")
  })

  test("parses diff for a file that adds trailing content", () => {
    const diff = [
      "@@ -1,2 +1,5 @@",
      " existing line 1",
      " existing line 2",
      "+new line 3",
      "+new line 4",
      "+new line 5",
    ].join("\n")

    const result = parseDiff(diff)
    expect(result.length).toBe(6) // header + 2 context + 3 additions
    expect(result[3]!.type).toBe("addition")
    expect(result[3]!.newLineNumber).toBe(3)
    expect(result[5]!.type).toBe("addition")
    expect(result[5]!.newLineNumber).toBe(5)
  })

  test("handles interleaved additions and deletions (replacement pattern)", () => {
    const diff = [
      "@@ -1,4 +1,4 @@",
      "-a",
      "+A",
      "-b",
      "+B",
      "-c",
      "+C",
      "-d",
      "+D",
    ].join("\n")

    const result = parseDiff(diff)
    expect(result.length).toBe(9) // header + 8 change lines

    // Old line numbers: 1, 2, 3, 4 for deletions
    expect(result[1]!.oldLineNumber).toBe(1)
    expect(result[3]!.oldLineNumber).toBe(2)
    expect(result[5]!.oldLineNumber).toBe(3)
    expect(result[7]!.oldLineNumber).toBe(4)

    // New line numbers: 1, 2, 3, 4 for additions
    expect(result[2]!.newLineNumber).toBe(1)
    expect(result[4]!.newLineNumber).toBe(2)
    expect(result[6]!.newLineNumber).toBe(3)
    expect(result[8]!.newLineNumber).toBe(4)
  })

  test("handles consecutive deletions followed by consecutive additions", () => {
    const diff = [
      "@@ -1,3 +1,2 @@",
      "-old 1",
      "-old 2",
      "-old 3",
      "+new 1",
      "+new 2",
    ].join("\n")

    const result = parseDiff(diff)
    expect(result.length).toBe(6) // header + 3 del + 2 add

    expect(result[1]!.oldLineNumber).toBe(1)
    expect(result[2]!.oldLineNumber).toBe(2)
    expect(result[3]!.oldLineNumber).toBe(3)
    expect(result[4]!.newLineNumber).toBe(1)
    expect(result[5]!.newLineNumber).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// parseChangedLines – extracts line numbers of changes
// ---------------------------------------------------------------------------
describe("parseChangedLines", () => {
  test("returns empty arrays for empty diff", () => {
    const result = parseChangedLines("")
    expect(result.changedLines).toEqual([])
    expect(result.addedLines).toEqual([])
    expect(result.removedLines).toEqual([])
  })

  test("detects additions in a simple hunk", () => {
    const diff = [
      "@@ -1,2 +1,3 @@",
      " context",
      "+added line",
      " context",
    ].join("\n")

    const result = parseChangedLines(diff)
    expect(result.addedLines).toEqual([1]) // 0-indexed: line 2 (index 1)
    expect(result.changedLines).toEqual([1])
    expect(result.removedLines).toEqual([])
  })

  test("detects deletions without incrementing line counter", () => {
    const diff = [
      "@@ -1,3 +1,2 @@",
      " context",
      "-deleted line",
      " context",
    ].join("\n")

    const result = parseChangedLines(diff)
    expect(result.removedLines).toEqual([1]) // deletion happened at position 1
    expect(result.changedLines).toEqual([1])
    expect(result.addedLines).toEqual([])
  })

  test("handles mixed additions and deletions", () => {
    const diff = [
      "@@ -1,3 +1,3 @@",
      " context",
      "-old",
      "+new",
      " context",
    ].join("\n")

    const result = parseChangedLines(diff)
    // Deletion at position 1, addition at position 1
    expect(result.changedLines).toContain(1)
    expect(result.addedLines).toContain(1)
    expect(result.removedLines).toContain(1)
  })

  test("handles multi-hunk diff", () => {
    const diff = [
      "@@ -1,3 +1,4 @@",
      " context",
      "+added at line 2",
      " context",
      " context",
      "@@ -10,2 +11,3 @@",
      " context",
      "+added at line 12",
      " context",
    ].join("\n")

    const result = parseChangedLines(diff)
    expect(result.addedLines).toContain(1)  // first hunk: 0-indexed line 1
    expect(result.addedLines).toContain(11) // second hunk: 0-indexed line 11
  })

  test("handles all-additions (new file) diff", () => {
    const diff = [
      "@@ -0,0 +1,3 @@",
      "+first",
      "+second",
      "+third",
    ].join("\n")

    const result = parseChangedLines(diff)
    expect(result.addedLines).toEqual([0, 1, 2])
    expect(result.changedLines).toEqual([0, 1, 2])
    expect(result.removedLines).toEqual([])
  })

  test("handles all-deletions (removed file) diff", () => {
    const diff = [
      "@@ -1,3 +0,0 @@",
      "-first",
      "-second",
      "-third",
    ].join("\n")

    const result = parseChangedLines(diff)
    // +0 in hunk header means new file starts at line 0, so 0-indexed = -1
    // All deletions happen at position -1 since no new lines exist
    expect(result.removedLines).toEqual([-1, -1, -1])
    expect(result.addedLines).toEqual([])
  })

  test("correctly parses hunk starting at non-zero offset", () => {
    const diff = [
      "@@ -50,3 +50,4 @@",
      " context",
      "+new line",
      " context",
      " context",
    ].join("\n")

    const result = parseChangedLines(diff)
    // +50 means new file starts at line 50 (1-indexed), so 0-indexed is 49
    // context at 49, addition at 50, context at 51, context at 52
    expect(result.addedLines).toEqual([50])
  })

  test("skips +++ and --- header lines", () => {
    const diff = [
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,1 +1,2 @@",
      " context",
      "+added",
    ].join("\n")

    const result = parseChangedLines(diff)
    // Should not count +++ as an addition
    expect(result.addedLines).toEqual([1])
  })
})

// ---------------------------------------------------------------------------
// generateUnifiedDiff – creates synthetic diffs for untracked files
// ---------------------------------------------------------------------------
describe("generateUnifiedDiff", () => {
  test("generates diff for a single-line file", () => {
    const result = generateUnifiedDiff("test.ts", "hello world")
    expect(result).toContain("@@ -0,0 +1,1 @@")
    expect(result).toContain("+hello world")
  })

  test("generates diff for a multi-line file", () => {
    const content = "line 1\nline 2\nline 3"
    const result = generateUnifiedDiff("test.ts", content)
    expect(result).toContain("@@ -0,0 +1,3 @@")
    expect(result).toContain("+line 1")
    expect(result).toContain("+line 2")
    expect(result).toContain("+line 3")
  })

  test("generates diff for an empty file", () => {
    const result = generateUnifiedDiff("empty.ts", "")
    expect(result).toContain("@@ -0,0 +1,1 @@")
    expect(result).toContain("+")
  })

  test("all lines start with +", () => {
    const content = "a\nb\nc\nd"
    const result = generateUnifiedDiff("file.ts", content)
    const lines = result.split("\n")
    // First line is the hunk header, rest should be additions
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]!.startsWith("+")).toBe(true)
    }
  })

  test("round-trips with parseDiff correctly", () => {
    const content = "function foo() {\n  return 42\n}"
    const diff = generateUnifiedDiff("foo.ts", content)
    const parsed = parseDiff(diff)

    // All non-header lines should be additions
    const additions = parsed.filter(l => l.type === "addition")
    expect(additions.length).toBe(3)
    expect(additions[0]!.content).toBe("function foo() {")
    expect(additions[1]!.content).toBe("  return 42")
    expect(additions[2]!.content).toBe("}")
  })

  test("preserves indentation and special characters", () => {
    const content = "\t  spaces and tabs\n  $pecial chars: @#%"
    const diff = generateUnifiedDiff("file.ts", content)
    const parsed = parseDiff(diff)
    const additions = parsed.filter(l => l.type === "addition")
    expect(additions[0]!.content).toBe("\t  spaces and tabs")
    expect(additions[1]!.content).toBe("  $pecial chars: @#%")
  })
})

// ---------------------------------------------------------------------------
// parseDiff + parseChangedLines integration
// ---------------------------------------------------------------------------
describe("parseDiff + parseChangedLines integration", () => {
  test("both agree on which lines are changed for a simple modification", () => {
    const diff = [
      "@@ -1,5 +1,5 @@",
      " line 1",
      "-old line 2",
      "+new line 2",
      " line 3",
      " line 4",
      " line 5",
    ].join("\n")

    const parsed = parseDiff(diff)
    const changed = parseChangedLines(diff)

    // parseDiff: line 2 is an addition at newLineNumber=2 (1-indexed)
    const additionLines = parsed.filter(l => l.type === "addition")
    expect(additionLines.length).toBe(1)
    expect(additionLines[0]!.newLineNumber).toBe(2)

    // parseChangedLines: 0-indexed, so line 1
    expect(changed.addedLines).toContain(1)
  })

  test("handle a complex multi-hunk scenario consistently", () => {
    const diff = [
      "@@ -1,4 +1,3 @@",
      " line 1",
      "-removed line 2",
      " line 3",
      " line 4",
      "@@ -8,3 +7,5 @@",
      " line 8",
      "+new line 9a",
      "+new line 9b",
      " line 9",
      " line 10",
    ].join("\n")

    const parsed = parseDiff(diff)
    const changed = parseChangedLines(diff)

    // Check deletions
    const deletions = parsed.filter(l => l.type === "deletion")
    expect(deletions.length).toBe(1)
    expect(deletions[0]!.content).toBe("removed line 2")

    // Check additions
    const additions = parsed.filter(l => l.type === "addition")
    expect(additions.length).toBe(2)

    // parseChangedLines should find the same adds/removes
    expect(changed.removedLines.length).toBe(1)
    expect(changed.addedLines.length).toBe(2)
  })
})
