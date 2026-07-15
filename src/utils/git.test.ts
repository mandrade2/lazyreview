import { test, expect, describe } from "bun:test"
import { parseDiff, parseChangedLines, getLineNumberWidth } from "./git"

describe("parseDiff", () => {
  test("returns empty array for empty diff", () => {
    expect(parseDiff("")).toEqual([])
  })

  test("parses a simple addition hunk", () => {
    const diff = `@@ -1,2 +1,3 @@
 context line
+added line
 another context`
    const result = parseDiff(diff)

    expect(result).toEqual([
      { type: "header", content: "@@ -1,2 +1,3 @@" },
      { type: "context", content: "context line", oldLineNumber: 1, newLineNumber: 1 },
      { type: "addition", content: "added line", newLineNumber: 2 },
      { type: "context", content: "another context", oldLineNumber: 2, newLineNumber: 3 },
    ])
  })

  test("parses a simple deletion hunk", () => {
    const diff = `@@ -1,3 +1,2 @@
 context line
-removed line
 another context`
    const result = parseDiff(diff)

    expect(result).toEqual([
      { type: "header", content: "@@ -1,3 +1,2 @@" },
      { type: "context", content: "context line", oldLineNumber: 1, newLineNumber: 1 },
      { type: "deletion", content: "removed line", oldLineNumber: 2 },
      { type: "context", content: "another context", oldLineNumber: 3, newLineNumber: 2 },
    ])
  })

  test("parses mixed additions and deletions", () => {
    const diff = `@@ -5,5 +5,5 @@
 line five
-old six
+new six
 line seven
 line eight
 line nine`
    const result = parseDiff(diff)

    expect(result).toEqual([
      { type: "header", content: "@@ -5,5 +5,5 @@" },
      { type: "context", content: "line five", oldLineNumber: 5, newLineNumber: 5 },
      { type: "deletion", content: "old six", oldLineNumber: 6 },
      { type: "addition", content: "new six", newLineNumber: 6 },
      { type: "context", content: "line seven", oldLineNumber: 7, newLineNumber: 7 },
      { type: "context", content: "line eight", oldLineNumber: 8, newLineNumber: 8 },
      { type: "context", content: "line nine", oldLineNumber: 9, newLineNumber: 9 },
    ])
  })

  test("increments line numbers correctly across multiple changes", () => {
    const diff = `@@ -1,2 +1,4 @@
+first
+second
 original
 context`
    const result = parseDiff(diff)

    expect(result[1]).toEqual({ type: "addition", content: "first", newLineNumber: 1 })
    expect(result[2]).toEqual({ type: "addition", content: "second", newLineNumber: 2 })
    expect(result[3]).toEqual({ type: "context", content: "original", oldLineNumber: 1, newLineNumber: 3 })
    expect(result[4]).toEqual({ type: "context", content: "context", oldLineNumber: 2, newLineNumber: 4 })
  })

  test("skips git metadata lines", () => {
    const diff = `diff --git a/file.ts b/file.ts
index abc..def 100644
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-old
+new`
    const result = parseDiff(diff)

    expect(result).toEqual([
      { type: "header", content: "@@ -1,2 +1,2 @@" },
      { type: "deletion", content: "old", oldLineNumber: 1 },
      { type: "addition", content: "new", newLineNumber: 1 },
    ])
  })

  test("handles multiple hunks", () => {
    const diff = `@@ -1,2 +1,3 @@
 line1
+inserted
 line2
@@ -10,2 +11,3 @@
 line10
+inserted2
 line11`
    const result = parseDiff(diff)

    const hunks = result.filter((l) => l.type === "header")
    expect(hunks).toHaveLength(2)

    // First hunk
    expect(result[1]).toEqual({ type: "context", content: "line1", oldLineNumber: 1, newLineNumber: 1 })
    expect(result[2]).toEqual({ type: "addition", content: "inserted", newLineNumber: 2 })

    // Second hunk - line numbers reset
    expect(result[4]).toEqual({ type: "header", content: "@@ -10,2 +11,3 @@" })
    expect(result[5]).toEqual({ type: "context", content: "line10", oldLineNumber: 10, newLineNumber: 11 })
    expect(result[6]).toEqual({ type: "addition", content: "inserted2", newLineNumber: 12 })
  })

  test("handles new file diff", () => {
    const diff = `diff --git a/newfile.ts b/newfile.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,3 @@
+line1
+line2
+line3`
    const result = parseDiff(diff)

    expect(result.filter((l) => l.type === "addition")).toHaveLength(3)
    expect(result[1]).toEqual({ type: "addition", content: "line1", newLineNumber: 1 })
    expect(result[2]).toEqual({ type: "addition", content: "line2", newLineNumber: 2 })
    expect(result[3]).toEqual({ type: "addition", content: "line3", newLineNumber: 3 })
  })

  test("handles deleted file diff", () => {
    const diff = `diff --git a/oldfile.ts b/oldfile.ts
deleted file mode 100644
index 1234567..0000000
--- a/oldfile.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-line1
-line2
-line3`
    const result = parseDiff(diff)

    expect(result.filter((l) => l.type === "deletion")).toHaveLength(3)
    expect(result[1]).toEqual({ type: "deletion", content: "line1", oldLineNumber: 1 })
    expect(result[2]).toEqual({ type: "deletion", content: "line2", oldLineNumber: 2 })
    expect(result[3]).toEqual({ type: "deletion", content: "line3", oldLineNumber: 3 })
  })

  test("handles empty context lines", () => {
    const diff = `@@ -1,3 +1,3 @@
 line1

 line3`
    const result = parseDiff(diff)

    expect(result).toEqual([
      { type: "header", content: "@@ -1,3 +1,3 @@" },
      { type: "context", content: "line1", oldLineNumber: 1, newLineNumber: 1 },
      { type: "context", content: "", oldLineNumber: 2, newLineNumber: 2 },
      { type: "context", content: "line3", oldLineNumber: 3, newLineNumber: 3 },
    ])
  })

  test("handles rename metadata with no content changes", () => {
    const diff = `diff --git a/old.ts b/new.ts
similarity index 100%
rename from old.ts
rename to new.ts`
    const result = parseDiff(diff)

    expect(result).toEqual([])
  })
})

describe("parseChangedLines", () => {
  test("pure deletion does not mark the surviving new-file line as removed", () => {
    // The deleted import block leaves "export function Spinner() {" at
    // new-file index 1. That line survives and must not end up in
    // removedLines, otherwise the full view paints it red.
    const diff = `@@ -1,6 +1,4 @@
 context line
-import { ScreenBase } from './Screenbase';
-
export function Spinner() {`
    const { removedLines } = parseChangedLines(diff)

    expect(removedLines).not.toContain(1)
    expect(removedLines).toHaveLength(0)
  })

  test("deletion position is still tracked in changedLines for navigation", () => {
    const diff = `@@ -1,3 +1,2 @@
 keep
-removed
 still here`
    const { changedLines } = parseChangedLines(diff)

    expect(changedLines).toContain(1)
  })

  test("modification marks the new line as added, not removed", () => {
    const diff = `@@ -1,2 +1,2 @@
-old
+new
 context`
    const { addedLines, removedLines } = parseChangedLines(diff)

    expect(addedLines).toEqual([0])
    expect(removedLines).toEqual([])
  })

  test("deletion at end of file does not produce removed new-file lines", () => {
    const diff = `@@ -1,3 +1,1 @@
 keep
-gone one
-gone two`
    const { removedLines, changedLines } = parseChangedLines(diff)

    expect(removedLines).toEqual([])
    expect(changedLines).toEqual([1, 1])
  })
})

describe("getLineNumberWidth", () => {
  test("has a minimum width of 4", () => {
    expect(getLineNumberWidth([], 0)).toBe(4)
    expect(getLineNumberWidth([], 12)).toBe(4)
  })

  test("fits 5-digit line numbers in a small diff hunk (regression: gutter wrap)", () => {
    const diff = `@@ -9998,3 +9998,4 @@
 context
+added
 context
 context`
    const lines = parseDiff(diff)
    expect(lines).toHaveLength(5)
    expect(getLineNumberWidth(lines, 0)).toBe(6)
  })

  test("accounts for old line numbers of deletions", () => {
    const diff = `@@ -99999,2 +1,1 @@
-removed
 context`
    const lines = parseDiff(diff)
    expect(getLineNumberWidth(lines, 1)).toBe(7)
  })

  test("accounts for file line count", () => {
    expect(getLineNumberWidth([], 12345)).toBe(6)
  })
})
