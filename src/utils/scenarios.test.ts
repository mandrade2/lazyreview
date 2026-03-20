/**
 * Scenario-based tests that simulate the many possible git states the UI
 * must handle correctly. These tests verify that the display logic produces
 * correct output for realistic combinations of:
 *
 *   - App modes (dirty / commit / branch)
 *   - View states (list / files)
 *   - Panel focus (files / diff)
 *   - File statuses (added / modified / deleted / renamed / untracked)
 *   - Search states (inactive / typing / active-with-matches / no-matches)
 *   - Edge cases (empty repos, detached HEAD, single branch, etc.)
 */

import { test, expect, describe } from "bun:test"
import { parseDiff, parseChangedLines, generateUnifiedDiff } from "./git"
import type { DiffLine, FileChange, BranchInfo, CommitInfo } from "./git"
import {
  getLeftPanelHeader,
  getDiffPlaceholderMessage,
  getContextInfo,
  getPanelText,
  getItemInfo,
  getKeybinds,
  getEffectiveKeybinds,
  getSearchStatus,
  getNextMode,
  getDiffChunkPositions,
  getFullChunkPositions,
  clampScroll,
  getSelectableBranches,
  getStatusIcon,
  getStatusLabel,
  getStatusColor,
} from "./ui-logic"

// ---------------------------------------------------------------------------
// Helper: build a realistic FileChange for test scenarios
// ---------------------------------------------------------------------------
function makeFile(overrides: Partial<FileChange> & { path: string; status: FileChange["status"] }): FileChange {
  return {
    additions: 0,
    deletions: 0,
    diff: "",
    content: "",
    firstChangeLine: 0,
    firstChangeDiffLine: 0,
    changedLines: new Set(),
    addedLines: new Set(),
    removedLines: new Set(),
    ...overrides,
  }
}

// ===========================================================================
// SCENARIO 1: Empty / fresh repository
// ===========================================================================
describe("Scenario: Empty repository (no changes)", () => {
  const files: FileChange[] = []

  test("dirty mode shows correct placeholder", () => {
    expect(getDiffPlaceholderMessage("dirty", "files", 0, null, 0)).toBe("No changes detected")
  })

  test("header shows zero file count", () => {
    expect(getLeftPanelHeader("dirty", "files", 0, 0, 0, null, null, null)).toBe("FILES (0)")
  })

  test("item info shows 'No changes'", () => {
    expect(getItemInfo("files", 0, 0, 0, 0)).toBe("No changes")
  })
})

// ===========================================================================
// SCENARIO 2: Working tree with all file status types
// ===========================================================================
describe("Scenario: Dirty mode with every file status", () => {
  const files: FileChange[] = [
    makeFile({ path: "new-feature.ts", status: "added", additions: 50 }),
    makeFile({ path: "src/app.ts", status: "modified", additions: 10, deletions: 5 }),
    makeFile({ path: "old-module.ts", status: "deleted", deletions: 30 }),
    makeFile({ path: "src/utils/renamed.ts", status: "renamed", oldPath: "src/utils/old-name.ts", additions: 2, deletions: 1 }),
    makeFile({ path: "scratch.txt", status: "untracked", additions: 5 }),
  ]

  test("all status icons are distinct single characters", () => {
    const icons = files.map(f => getStatusIcon(f.status))
    expect(icons).toEqual(["A", "M", "D", "R", "?"])
    // All unique
    expect(new Set(icons).size).toBe(5)
  })

  test("all status colors are distinct", () => {
    const colors = files.map(f => getStatusColor(f.status))
    expect(new Set(colors).size).toBe(5)
  })

  test("header shows correct count", () => {
    expect(getLeftPanelHeader("dirty", "files", files.length, 0, 0, null, null, null)).toBe("FILES (5)")
  })

  test("item info shows position for each file", () => {
    for (let i = 0; i < files.length; i++) {
      expect(getItemInfo("files", files.length, i, 0, 0)).toBe(`${i + 1}/${files.length}`)
    }
  })

  test("no back key in dirty mode", () => {
    const kb = getKeybinds("files", "dirty", "files", "diff")
    expect(kb).not.toContain("esc:back")
  })
})

// ===========================================================================
// SCENARIO 3: Untracked file (synthetic diff)
// ===========================================================================
describe("Scenario: Untracked file generates valid synthetic diff", () => {
  const content = 'export function hello() {\n  console.log("world")\n}\n'

  test("generateUnifiedDiff produces parseable output", () => {
    const diff = generateUnifiedDiff("hello.ts", content)
    const parsed = parseDiff(diff)

    // All non-header lines should be additions
    const additions = parsed.filter(l => l.type === "addition")
    expect(additions.length).toBe(4) // 4 lines (including trailing empty from \n)
    expect(additions[0]!.content).toBe("export function hello() {")
  })

  test("parseChangedLines marks all lines as added", () => {
    const diff = generateUnifiedDiff("hello.ts", content)
    const result = parseChangedLines(diff)
    expect(result.addedLines.length).toBe(4)
    expect(result.removedLines.length).toBe(0)
  })

  test("status displays correctly", () => {
    expect(getStatusIcon("untracked")).toBe("?")
    expect(getStatusLabel("untracked")).toBe("Untracked")
  })
})

// ===========================================================================
// SCENARIO 4: Deleted file
// ===========================================================================
describe("Scenario: Deleted file", () => {
  const diff = [
    "@@ -1,3 +0,0 @@",
    "-const x = 1",
    "-const y = 2",
    "-export { x, y }",
  ].join("\n")

  test("parseDiff produces only deletions", () => {
    const parsed = parseDiff(diff)
    const types = parsed.filter(l => l.type !== "header").map(l => l.type)
    expect(types.every(t => t === "deletion")).toBe(true)
  })

  test("parseChangedLines reports only removals", () => {
    const result = parseChangedLines(diff)
    expect(result.addedLines.length).toBe(0)
    expect(result.removedLines.length).toBe(3)
  })

  test("chunk positions for all-deletion diff", () => {
    const parsed = parseDiff(diff)
    const chunks = getDiffChunkPositions(parsed)
    // All 3 deletions are consecutive -> 1 chunk
    expect(chunks.length).toBe(1)
  })
})

// ===========================================================================
// SCENARIO 5: Renamed file with changes
// ===========================================================================
describe("Scenario: Renamed file with content changes", () => {
  const diff = [
    "diff --git a/old.ts b/new.ts",
    "--- a/old.ts",
    "+++ b/new.ts",
    "@@ -1,3 +1,3 @@",
    " import { foo } from './foo'",
    "-export const name = 'old'",
    "+export const name = 'new'",
    " export default foo",
  ].join("\n")

  test("parseDiff captures the rename change", () => {
    const parsed = parseDiff(diff)
    const changes = parsed.filter(l => l.type === "addition" || l.type === "deletion")
    expect(changes.length).toBe(2)
    expect(changes[0]!.type).toBe("deletion")
    expect(changes[0]!.content).toContain("old")
    expect(changes[1]!.type).toBe("addition")
    expect(changes[1]!.content).toContain("new")
  })

  test("status display for renamed", () => {
    expect(getStatusIcon("renamed")).toBe("R")
    expect(getStatusColor("renamed")).toBe("#a371f7")
  })
})

// ===========================================================================
// SCENARIO 6: Large multi-hunk diff (simulates a big refactor)
// ===========================================================================
describe("Scenario: Multi-hunk refactor", () => {
  // Build a diff with 5 hunks
  const hunks = []
  for (let h = 0; h < 5; h++) {
    const start = h * 20 + 1
    hunks.push(`@@ -${start},5 +${start},5 @@`)
    hunks.push(` context before ${h}`)
    hunks.push(`-old line ${h}a`)
    hunks.push(`-old line ${h}b`)
    hunks.push(`+new line ${h}a`)
    hunks.push(`+new line ${h}b`)
    hunks.push(` context after ${h}`)
  }
  const diff = hunks.join("\n")

  test("parseDiff handles all 5 hunks", () => {
    const parsed = parseDiff(diff)
    const headers = parsed.filter(l => l.type === "header")
    expect(headers.length).toBe(5)
  })

  test("identifies 5 chunks (one per hunk)", () => {
    const parsed = parseDiff(diff)
    const chunks = getDiffChunkPositions(parsed)
    expect(chunks.length).toBe(5)
  })

  test("parseChangedLines finds changes in all hunks", () => {
    const result = parseChangedLines(diff)
    expect(result.addedLines.length).toBe(10) // 2 per hunk * 5
    expect(result.removedLines.length).toBe(10)
  })
})

// ===========================================================================
// SCENARIO 7: Commit mode
// ===========================================================================
describe("Scenario: Commit mode navigation", () => {
  test("list view shows commit count in header", () => {
    expect(getLeftPanelHeader("commit", "list", 0, 25, 0, null, null, null)).toBe("COMMITS (25)")
  })

  test("files view shows commit hash in header", () => {
    expect(getLeftPanelHeader("commit", "files", 3, 25, 0, "a1b2c3d", null, null)).toBe("FILES (3) · a1b2c3d")
  })

  test("context info shows commit hash", () => {
    expect(getContextInfo("commit", "a1b2c3d", null, null)).toBe("a1b2c3d")
  })

  test("placeholder for list view", () => {
    expect(getDiffPlaceholderMessage("commit", "list", 0, null, 0)).toBe("Select a commit to view its changes")
  })

  test("placeholder for empty commit", () => {
    expect(getDiffPlaceholderMessage("commit", "files", 0, null, 0)).toBe("No files changed in this commit")
  })

  test("panel text shows 'Commits' in list view", () => {
    expect(getPanelText("commit", "list", "files")).toBe("Commits")
  })

  test("back key available in commit mode", () => {
    expect(getKeybinds("files", "commit", "files", "diff")).toContain("esc:back")
  })
})

// ===========================================================================
// SCENARIO 8: Branch mode
// ===========================================================================
describe("Scenario: Branch mode with multiple branches", () => {
  const branches: BranchInfo[] = [
    { name: "main", isCurrent: true },
    { name: "feature/auth", isCurrent: false },
    { name: "fix/login-bug", isCurrent: false },
    { name: "develop", isCurrent: false },
  ]

  test("selectable branches exclude current", () => {
    const selectable = getSelectableBranches(branches)
    expect(selectable.length).toBe(3)
    expect(selectable.find(b => b.name === "main")).toBeUndefined()
  })

  test("header shows branch count in list view", () => {
    expect(getLeftPanelHeader("branch", "list", 0, 0, branches.length, null, "main", null)).toBe("BRANCHES (4)")
  })

  test("header shows comparison in files view", () => {
    expect(getLeftPanelHeader("branch", "files", 5, 0, 4, null, "main", "feature/auth")).toBe("FILES (5) · main vs feature/auth")
  })

  test("context info shows comparison", () => {
    expect(getContextInfo("branch", null, "main", "feature/auth")).toBe("main vs feature/auth")
  })

  test("panel text shows 'Branches' in list view", () => {
    expect(getPanelText("branch", "list", "files")).toBe("Branches")
  })
})

// ===========================================================================
// SCENARIO 9: Detached HEAD in branch mode
// ===========================================================================
describe("Scenario: Detached HEAD", () => {
  test("placeholder warns about detached HEAD", () => {
    expect(getDiffPlaceholderMessage("branch", "list", 0, null, 3)).toBe("Cannot compare branches: HEAD is detached")
  })

  test("header falls back to HEAD in comparison", () => {
    expect(getLeftPanelHeader("branch", "files", 2, 0, 3, null, null, "feature")).toBe("FILES (2) · HEAD vs feature")
  })

  test("context info uses HEAD when branch is null", () => {
    expect(getContextInfo("branch", null, null, "feature")).toBe("HEAD vs feature")
  })
})

// ===========================================================================
// SCENARIO 10: Single branch (no comparison possible)
// ===========================================================================
describe("Scenario: Repository with only one branch", () => {
  test("placeholder says no branches to compare", () => {
    expect(getDiffPlaceholderMessage("branch", "list", 0, "main", 0)).toBe("No other branches to compare against")
  })

  test("selectable branches is empty", () => {
    const branches: BranchInfo[] = [{ name: "main", isCurrent: true }]
    expect(getSelectableBranches(branches).length).toBe(0)
  })

  test("list item info shows 'Empty'", () => {
    expect(getItemInfo("list", 0, 0, 0, 0)).toBe("Empty")
  })
})

// ===========================================================================
// SCENARIO 11: Search states
// ===========================================================================
describe("Scenario: Search flow", () => {
  test("before search: no search status, normal keybinds", () => {
    expect(getSearchStatus(false, "", false, 0, 0)).toBeNull()
    expect(getEffectiveKeybinds(false, false, "normal")).toBe("normal")
  })

  test("typing search query: shows query, search-specific keybinds", () => {
    expect(getSearchStatus(true, "func", false, 0, 0)).toBe("/func_")
    expect(getEffectiveKeybinds(true, false, "normal")).toBe("enter:search esc:cancel")
  })

  test("search active with matches: shows count, match navigation keybinds", () => {
    expect(getSearchStatus(false, "func", true, 8, 2)).toBe("[3/8]")
    expect(getEffectiveKeybinds(false, true, "normal")).toBe("n/N:match esc:clear /:search")
  })

  test("search active with no matches: shows 'No matches'", () => {
    expect(getSearchStatus(false, "nonexistent", true, 0, 0)).toBe("No matches")
  })
})

// ===========================================================================
// SCENARIO 12: Mode cycling end-to-end
// ===========================================================================
describe("Scenario: Complete mode cycle", () => {
  test("cycling 3 times returns to start", () => {
    let mode = "dirty" as const
    const visited: string[] = [mode]

    mode = getNextMode(mode) as typeof mode
    visited.push(mode)
    mode = getNextMode(mode) as typeof mode
    visited.push(mode)
    mode = getNextMode(mode) as typeof mode
    visited.push(mode)

    expect(visited).toEqual(["dirty", "commit", "branch", "dirty"])
  })

  test("each mode switch resets to list view for commit/branch", () => {
    // Simulate what the app does on mode switch
    const states: Array<{ mode: string; viewState: string }> = []

    let mode: "dirty" | "commit" | "branch" = "dirty"
    let viewState: "list" | "files" = "files"
    states.push({ mode, viewState })

    // Switch to commit
    mode = getNextMode(mode) as typeof mode
    viewState = mode === "dirty" ? "files" : "list"
    states.push({ mode, viewState })

    // Switch to branch
    mode = getNextMode(mode) as typeof mode
    viewState = mode === "dirty" ? "files" : "list"
    states.push({ mode, viewState })

    // Switch back to dirty
    mode = getNextMode(mode) as typeof mode
    viewState = mode === "dirty" ? "files" : "list"
    states.push({ mode, viewState })

    expect(states).toEqual([
      { mode: "dirty", viewState: "files" },
      { mode: "commit", viewState: "list" },
      { mode: "branch", viewState: "list" },
      { mode: "dirty", viewState: "files" },
    ])
  })
})

// ===========================================================================
// SCENARIO 13: Diff view mode toggle
// ===========================================================================
describe("Scenario: Diff vs full view toggle", () => {
  test("keybinds label changes based on current mode", () => {
    const inDiff = getKeybinds("files", "dirty", "files", "diff")
    expect(inDiff).toContain("f:full")

    const inFull = getKeybinds("files", "dirty", "files", "full")
    expect(inFull).toContain("f:diff")
  })
})

// ===========================================================================
// SCENARIO 14: Scroll edge cases
// ===========================================================================
describe("Scenario: Scroll boundary conditions", () => {
  test("cannot scroll below zero", () => {
    expect(clampScroll(-100, 500, 30)).toBe(0)
  })

  test("cannot scroll past end of content", () => {
    // 500 lines, 30 visible => max = 470
    expect(clampScroll(480, 500, 30)).toBe(470)
  })

  test("short file (less lines than viewport)", () => {
    // 10 lines, 30 visible => max = 0
    expect(clampScroll(5, 10, 30)).toBe(0)
  })

  test("exact fit (lines == viewport)", () => {
    expect(clampScroll(0, 30, 30)).toBe(0)
  })
})

// ===========================================================================
// SCENARIO 15: Complex diff with interleaved changes across hunks
// ===========================================================================
describe("Scenario: Complex real-world diff patterns", () => {
  test("function signature change + body modification", () => {
    const diff = [
      "@@ -1,6 +1,7 @@",
      "-function add(a, b) {",
      "+function add(a: number, b: number): number {",
      "+  // Type-safe addition",
      "   return a + b",
      " }",
      " ",
      "-module.exports = add",
      "+export default add",
    ].join("\n")

    const parsed = parseDiff(diff)
    const chunks = getDiffChunkPositions(parsed)

    // Two chunks: the function signature + comment, and the export change
    expect(chunks.length).toBe(2)

    // First chunk has 3 lines (deletion + 2 additions)
    // Second chunk has 2 lines (deletion + addition)
    const additions = parsed.filter(l => l.type === "addition")
    const deletions = parsed.filter(l => l.type === "deletion")
    expect(additions.length).toBe(3)
    expect(deletions.length).toBe(2)
  })

  test("pure addition at end of file", () => {
    const diff = [
      "@@ -3,3 +3,6 @@",
      " line 3",
      " line 4",
      " line 5",
      "+line 6",
      "+line 7",
      "+line 8",
    ].join("\n")

    const parsed = parseDiff(diff)
    const chunks = getDiffChunkPositions(parsed)
    expect(chunks.length).toBe(1)

    const changed = parseChangedLines(diff)
    expect(changed.addedLines).toEqual([5, 6, 7]) // 0-indexed
  })

  test("pure deletion from middle of file", () => {
    const diff = [
      "@@ -1,6 +1,3 @@",
      " keep this",
      "-remove 1",
      "-remove 2",
      "-remove 3",
      " keep this too",
      " and this",
    ].join("\n")

    const parsed = parseDiff(diff)
    const deletions = parsed.filter(l => l.type === "deletion")
    expect(deletions.length).toBe(3)

    const chunks = getDiffChunkPositions(parsed)
    expect(chunks.length).toBe(1)
  })
})

// ===========================================================================
// SCENARIO 16: Full-file view chunk detection
// ===========================================================================
describe("Scenario: Full-file view with scattered changes", () => {
  test("detects isolated single-line changes as separate chunks", () => {
    const changedLines = new Set([5, 15, 25])
    const chunks = getFullChunkPositions(changedLines)
    expect(chunks).toEqual([5, 15, 25])
  })

  test("detects block of changes as single chunk", () => {
    const changedLines = new Set([10, 11, 12, 13, 14])
    const chunks = getFullChunkPositions(changedLines)
    expect(chunks).toEqual([10])
  })

  test("mixed blocks and isolated changes", () => {
    const changedLines = new Set([2, 3, 4, 10, 20, 21, 22, 30])
    const chunks = getFullChunkPositions(changedLines)
    expect(chunks).toEqual([2, 10, 20, 30])
  })
})

// ===========================================================================
// SCENARIO 17: Panel focus and keybind context
// ===========================================================================
describe("Scenario: Panel focus affects display", () => {
  test("files panel focused: shows nav keybinds", () => {
    const kb = getKeybinds("files", "dirty", "files", "diff")
    expect(kb).toContain("j/k:nav")
    expect(kb).toContain("enter:view")
  })

  test("diff panel focused: shows scroll keybinds", () => {
    const kb = getKeybinds("files", "dirty", "diff", "diff")
    expect(kb).toContain("j/k:scroll")
    expect(kb).toContain("^d/^u:half")
  })

  test("panel indicator text reflects focus", () => {
    expect(getPanelText("dirty", "files", "files")).toBe("[Files] Diff")
    expect(getPanelText("dirty", "files", "diff")).toBe("Files [Diff]")
  })
})

// ===========================================================================
// SCENARIO 18: Diff with no newline at EOF marker
// ===========================================================================
describe("Scenario: 'No newline at end of file' handling", () => {
  test("parseDiff handles \\ No newline at end of file gracefully", () => {
    const diff = [
      "@@ -1,2 +1,2 @@",
      "-old last line",
      "\\ No newline at end of file",
      "+new last line",
      "\\ No newline at end of file",
    ].join("\n")

    // The parser treats lines starting with \\ as context (starting with space or empty)
    // The key thing is it doesn't crash
    const parsed = parseDiff(diff)
    expect(parsed.length).toBeGreaterThanOrEqual(2) // at least header + deletion
  })
})

// ===========================================================================
// SCENARIO 19: Empty diff for a file
// ===========================================================================
describe("Scenario: File with empty diff", () => {
  test("parseDiff returns empty for empty string", () => {
    expect(parseDiff("")).toEqual([])
  })

  test("parseChangedLines returns empty arrays", () => {
    const result = parseChangedLines("")
    expect(result.changedLines).toEqual([])
    expect(result.addedLines).toEqual([])
    expect(result.removedLines).toEqual([])
  })

  test("chunk positions are empty", () => {
    expect(getDiffChunkPositions([])).toEqual([])
    expect(getFullChunkPositions(new Set())).toEqual([])
  })
})
