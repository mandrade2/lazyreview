import { test, expect, describe } from "bun:test"
import {
  getStatusIcon,
  getStatusLabel,
  getStatusColor,
  getFileName,
  getDirectory,
  truncateMessage,
  getLeftPanelHeader,
  getDiffPlaceholderMessage,
  getContextInfo,
  getPanelText,
  getItemInfo,
  getKeybinds,
  getEffectiveKeybinds,
  getSearchStatus,
  getNextMode,
  getLineBackground,
  getChangeIndicator,
  getLineNumberColor,
  getDiffChunkPositions,
  getFullChunkPositions,
  clampScroll,
  getSelectableBranches,
} from "./ui-logic"
import type { DiffLine, BranchInfo, FileChange, AppMode } from "./git"

// ---------------------------------------------------------------------------
// File status display
// ---------------------------------------------------------------------------
describe("getStatusIcon", () => {
  test("returns correct icon for each status", () => {
    expect(getStatusIcon("added")).toBe("A")
    expect(getStatusIcon("modified")).toBe("M")
    expect(getStatusIcon("deleted")).toBe("D")
    expect(getStatusIcon("renamed")).toBe("R")
    expect(getStatusIcon("untracked")).toBe("?")
  })
})

describe("getStatusLabel", () => {
  test("returns human-readable label for each status", () => {
    expect(getStatusLabel("added")).toBe("Added")
    expect(getStatusLabel("modified")).toBe("Modified")
    expect(getStatusLabel("deleted")).toBe("Deleted")
    expect(getStatusLabel("renamed")).toBe("Renamed")
    expect(getStatusLabel("untracked")).toBe("Untracked")
  })
})

describe("getStatusColor", () => {
  test("returns correct hex color for each status", () => {
    expect(getStatusColor("added")).toBe("#3fb950")
    expect(getStatusColor("modified")).toBe("#d29922")
    expect(getStatusColor("deleted")).toBe("#f85149")
    expect(getStatusColor("renamed")).toBe("#a371f7")
    expect(getStatusColor("untracked")).toBe("#8b949e")
  })

  test("all colors are valid hex codes", () => {
    const statuses: FileChange["status"][] = ["added", "modified", "deleted", "renamed", "untracked"]
    for (const status of statuses) {
      expect(getStatusColor(status)).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

// ---------------------------------------------------------------------------
// File path display
// ---------------------------------------------------------------------------
describe("getFileName", () => {
  test("returns filename from simple path", () => {
    expect(getFileName("file.ts")).toBe("file.ts")
  })

  test("returns filename from nested path", () => {
    expect(getFileName("src/utils/git.ts")).toBe("git.ts")
  })

  test("returns filename from deeply nested path", () => {
    expect(getFileName("a/b/c/d/e/file.tsx")).toBe("file.tsx")
  })

  test("returns full path if no directory separator", () => {
    expect(getFileName("README.md")).toBe("README.md")
  })

  test("handles path ending with /", () => {
    // pop() on ["a", "b", ""] returns ""
    expect(getFileName("a/b/")).toBe("")
  })
})

describe("getDirectory", () => {
  test("returns empty string for root-level files", () => {
    expect(getDirectory("file.ts", 20)).toBe("")
  })

  test("returns full directory for short paths", () => {
    expect(getDirectory("src/file.ts", 20)).toBe("src/")
  })

  test("returns full directory for nested paths within limit", () => {
    expect(getDirectory("src/utils/file.ts", 20)).toBe("src/utils/")
  })

  test("truncates long directory paths with ellipsis", () => {
    const result = getDirectory("very/long/deeply/nested/directory/structure/file.ts", 15)
    expect(result.startsWith("...")).toBe(true)
    expect(result.length).toBeLessThanOrEqual(15)
    expect(result.endsWith("/")).toBe(true)
  })

  test("handles zero maxLength", () => {
    const result = getDirectory("src/file.ts", 0)
    expect(result.startsWith("...")).toBe(true)
  })

  test("returns empty for single-segment path", () => {
    expect(getDirectory("file.ts", 50)).toBe("")
  })
})

// ---------------------------------------------------------------------------
// Commit display
// ---------------------------------------------------------------------------
describe("truncateMessage", () => {
  test("returns short message unchanged", () => {
    expect(truncateMessage("fix bug", 40)).toBe("fix bug")
  })

  test("truncates long message with ellipsis", () => {
    const long = "This is a very long commit message that should be truncated"
    const result = truncateMessage(long, 20)
    // substring(0, 19) + "..." = 22 chars — the function keeps maxLength-1 chars + "..."
    expect(result.length).toBe(22)
    expect(result.endsWith("...")).toBe(true)
    expect(result).toBe("This is a very long...")
  })

  test("returns message at exact max length unchanged", () => {
    const msg = "exactly twenty chars"
    expect(truncateMessage(msg, 20)).toBe(msg)
  })

  test("handles empty message", () => {
    expect(truncateMessage("", 40)).toBe("")
  })

  test("handles maxLength of 3 (edge: minimum for ellipsis)", () => {
    // substring(0, 2) + "..." = "he..."
    expect(truncateMessage("hello", 3)).toBe("he...")
  })
})

// ---------------------------------------------------------------------------
// Left panel header
// ---------------------------------------------------------------------------
describe("getLeftPanelHeader", () => {
  test("dirty mode shows file count", () => {
    expect(getLeftPanelHeader("dirty", "files", 5, 0, 0, null, null, null)).toBe("FILES (5)")
  })

  test("dirty mode with zero files", () => {
    expect(getLeftPanelHeader("dirty", "files", 0, 0, 0, null, null, null)).toBe("FILES (0)")
  })

  test("commit mode list view shows commit count", () => {
    expect(getLeftPanelHeader("commit", "list", 0, 42, 0, null, null, null)).toBe("COMMITS (42)")
  })

  test("commit mode files view shows file count and commit hash", () => {
    expect(getLeftPanelHeader("commit", "files", 3, 42, 0, "abc1234", null, null)).toBe("FILES (3) · abc1234")
  })

  test("commit mode files view with no commit hash", () => {
    expect(getLeftPanelHeader("commit", "files", 3, 42, 0, null, null, null)).toBe("FILES (3) · ")
  })

  test("branch mode list view shows branch count", () => {
    expect(getLeftPanelHeader("branch", "list", 0, 0, 5, null, "main", null)).toBe("BRANCHES (5)")
  })

  test("branch mode files view shows comparison", () => {
    expect(getLeftPanelHeader("branch", "files", 7, 0, 5, null, "main", "feature")).toBe("FILES (7) · main vs feature")
  })

  test("branch mode files view with detached HEAD", () => {
    expect(getLeftPanelHeader("branch", "files", 2, 0, 5, null, null, "feature")).toBe("FILES (2) · HEAD vs feature")
  })

  test("branch mode files view with no selected branch", () => {
    expect(getLeftPanelHeader("branch", "files", 2, 0, 5, null, "main", null)).toBe("FILES (2) · main vs ")
  })
})

// ---------------------------------------------------------------------------
// Diff placeholder messages
// ---------------------------------------------------------------------------
describe("getDiffPlaceholderMessage", () => {
  // Dirty mode
  test("dirty mode with no changes", () => {
    expect(getDiffPlaceholderMessage("dirty", "files", 0, null, 0)).toBe("No changes detected")
  })

  test("dirty mode with files available", () => {
    expect(getDiffPlaceholderMessage("dirty", "files", 3, null, 0)).toBe("Select a file to view diff")
  })

  // Commit mode
  test("commit mode list view", () => {
    expect(getDiffPlaceholderMessage("commit", "list", 0, null, 0)).toBe("Select a commit to view its changes")
  })

  test("commit mode files view with no changes", () => {
    expect(getDiffPlaceholderMessage("commit", "files", 0, null, 0)).toBe("No files changed in this commit")
  })

  test("commit mode files view with changes", () => {
    expect(getDiffPlaceholderMessage("commit", "files", 5, null, 0)).toBe("Select a file to view diff")
  })

  // Branch mode
  test("branch mode list view with detached HEAD", () => {
    expect(getDiffPlaceholderMessage("branch", "list", 0, null, 3)).toBe("Cannot compare branches: HEAD is detached")
  })

  test("branch mode list view with no other branches", () => {
    expect(getDiffPlaceholderMessage("branch", "list", 0, "main", 0)).toBe("No other branches to compare against")
  })

  test("branch mode list view normal", () => {
    expect(getDiffPlaceholderMessage("branch", "list", 0, "main", 3)).toBe("Select a branch to compare against main")
  })

  test("branch mode files view with no differences", () => {
    expect(getDiffPlaceholderMessage("branch", "files", 0, "main", 3)).toBe("No differences between branches")
  })

  test("branch mode files view with differences", () => {
    expect(getDiffPlaceholderMessage("branch", "files", 4, "main", 3)).toBe("Select a file to view diff")
  })
})

// ---------------------------------------------------------------------------
// Context info
// ---------------------------------------------------------------------------
describe("getContextInfo", () => {
  test("returns undefined for dirty mode", () => {
    expect(getContextInfo("dirty", null, null, null)).toBeUndefined()
  })

  test("returns commit hash for commit mode", () => {
    expect(getContextInfo("commit", "abc1234", null, null)).toBe("abc1234")
  })

  test("returns undefined for commit mode with no selected commit", () => {
    expect(getContextInfo("commit", null, null, null)).toBeUndefined()
  })

  test("returns comparison string for branch mode", () => {
    expect(getContextInfo("branch", null, "main", "feature")).toBe("main vs feature")
  })

  test("returns HEAD comparison for branch mode with detached HEAD", () => {
    expect(getContextInfo("branch", null, null, "feature")).toBe("HEAD vs feature")
  })

  test("returns undefined for branch mode with no selected branch", () => {
    expect(getContextInfo("branch", null, "main", null)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Status bar panel text
// ---------------------------------------------------------------------------
describe("getPanelText", () => {
  test("commit list view shows 'Commits'", () => {
    expect(getPanelText("commit", "list", "files")).toBe("Commits")
  })

  test("branch list view shows 'Branches'", () => {
    expect(getPanelText("branch", "list", "files")).toBe("Branches")
  })

  test("files focused shows '[Files] Diff'", () => {
    expect(getPanelText("dirty", "files", "files")).toBe("[Files] Diff")
  })

  test("diff focused shows 'Files [Diff]'", () => {
    expect(getPanelText("dirty", "files", "diff")).toBe("Files [Diff]")
  })
})

// ---------------------------------------------------------------------------
// Item info
// ---------------------------------------------------------------------------
describe("getItemInfo", () => {
  test("list view with items", () => {
    expect(getItemInfo("list", 0, 0, 10, 3)).toBe("4/10")
  })

  test("list view with empty list", () => {
    expect(getItemInfo("list", 0, 0, 0, 0)).toBe("Empty")
  })

  test("files view with files", () => {
    expect(getItemInfo("files", 5, 2, 0, 0)).toBe("3/5")
  })

  test("files view with no changes", () => {
    expect(getItemInfo("files", 0, 0, 0, 0)).toBe("No changes")
  })

  test("first file selected", () => {
    expect(getItemInfo("files", 10, 0, 0, 0)).toBe("1/10")
  })

  test("last file selected", () => {
    expect(getItemInfo("files", 10, 9, 0, 0)).toBe("10/10")
  })
})

// ---------------------------------------------------------------------------
// Keybinds
// ---------------------------------------------------------------------------
describe("getKeybinds", () => {
  test("list view keybinds", () => {
    const result = getKeybinds("list", "dirty", "files", "diff")
    expect(result).toContain("j/k:nav")
    expect(result).toContain("enter:select")
    expect(result).toContain("q:quit")
  })

  test("file view in dirty mode (no back key)", () => {
    const result = getKeybinds("files", "dirty", "files", "diff")
    expect(result).not.toContain("esc:back")
    expect(result).toContain("e:edit")
  })

  test("file view in commit mode (has back key)", () => {
    const result = getKeybinds("files", "commit", "files", "diff")
    expect(result).toContain("esc:back")
  })

  test("diff panel shows scroll-specific keybinds", () => {
    const result = getKeybinds("files", "dirty", "diff", "diff")
    expect(result).toContain("j/k:scroll")
    expect(result).toContain("^d/^u:half")
  })

  test("toggle label says 'full' when in diff mode", () => {
    const result = getKeybinds("files", "dirty", "files", "diff")
    expect(result).toContain("f:full")
  })

  test("toggle label says 'diff' when in full mode", () => {
    const result = getKeybinds("files", "dirty", "files", "full")
    expect(result).toContain("f:diff")
  })
})

describe("getEffectiveKeybinds", () => {
  test("search mode shows search keybinds", () => {
    expect(getEffectiveKeybinds(true, false, "normal")).toBe("enter:search esc:cancel")
  })

  test("search active shows match navigation keybinds", () => {
    expect(getEffectiveKeybinds(false, true, "normal")).toBe("n/N:match esc:clear /:search")
  })

  test("neither search mode returns normal keybinds", () => {
    expect(getEffectiveKeybinds(false, false, "normal keybinds")).toBe("normal keybinds")
  })

  test("search mode takes priority over search active", () => {
    expect(getEffectiveKeybinds(true, true, "normal")).toBe("enter:search esc:cancel")
  })
})

// ---------------------------------------------------------------------------
// Search status
// ---------------------------------------------------------------------------
describe("getSearchStatus", () => {
  test("returns query with cursor while typing", () => {
    expect(getSearchStatus(true, "foo", false, 0, 0)).toBe("/foo_")
  })

  test("returns empty query cursor when search just started", () => {
    expect(getSearchStatus(true, "", false, 0, 0)).toBe("/_")
  })

  test("returns match count when active with matches", () => {
    expect(getSearchStatus(false, "foo", true, 5, 2)).toBe("[3/5]")
  })

  test("returns 'No matches' when active with zero matches", () => {
    expect(getSearchStatus(false, "foo", true, 0, 0)).toBe("No matches")
  })

  test("returns null when not searching", () => {
    expect(getSearchStatus(false, "", false, 0, 0)).toBeNull()
  })

  test("first match is displayed as 1-indexed", () => {
    expect(getSearchStatus(false, "x", true, 10, 0)).toBe("[1/10]")
  })

  test("last match index", () => {
    expect(getSearchStatus(false, "x", true, 10, 9)).toBe("[10/10]")
  })
})

// ---------------------------------------------------------------------------
// Mode cycling
// ---------------------------------------------------------------------------
describe("getNextMode", () => {
  test("dirty -> commit", () => {
    expect(getNextMode("dirty")).toBe("commit")
  })

  test("commit -> branch", () => {
    expect(getNextMode("commit")).toBe("branch")
  })

  test("branch -> dirty", () => {
    expect(getNextMode("branch")).toBe("dirty")
  })

  test("full cycle returns to start", () => {
    let mode: AppMode = "dirty"
    mode = getNextMode(mode)
    mode = getNextMode(mode)
    mode = getNextMode(mode)
    expect(mode).toBe("dirty")
  })
})

// ---------------------------------------------------------------------------
// Diff viewer line styling
// ---------------------------------------------------------------------------
describe("getLineBackground", () => {
  test("additions get green background", () => {
    expect(getLineBackground("addition")).toBe("#1a2f1a")
  })

  test("deletions get red background", () => {
    expect(getLineBackground("deletion")).toBe("#2f1a1a")
  })

  test("headers get gray background", () => {
    expect(getLineBackground("header")).toBe("#21262d")
  })

  test("context lines get dark background", () => {
    expect(getLineBackground("context")).toBe("#0d1117")
  })

  test("full-added lines get green background", () => {
    expect(getLineBackground("full-added")).toBe("#1a2f1a")
  })

  test("full-removed lines get red background", () => {
    expect(getLineBackground("full-removed")).toBe("#2f1a1a")
  })
})

describe("getChangeIndicator", () => {
  test("returns ~ for header", () => {
    expect(getChangeIndicator("header")).toBe("~")
  })

  test("returns + for addition", () => {
    expect(getChangeIndicator("addition")).toBe("+")
  })

  test("returns - for deletion", () => {
    expect(getChangeIndicator("deletion")).toBe("-")
  })

  test("returns space for context", () => {
    expect(getChangeIndicator("context")).toBe(" ")
  })
})

describe("getLineNumberColor", () => {
  test("returns gray for header", () => {
    expect(getLineNumberColor("header")).toBe("#8b949e")
  })

  test("returns green for addition", () => {
    expect(getLineNumberColor("addition")).toBe("#3fb950")
  })

  test("returns red for deletion", () => {
    expect(getLineNumberColor("deletion")).toBe("#f85149")
  })

  test("returns muted color for context", () => {
    expect(getLineNumberColor("context")).toBe("#484f58")
  })
})

// ---------------------------------------------------------------------------
// Chunk positions
// ---------------------------------------------------------------------------
describe("getDiffChunkPositions", () => {
  test("returns empty for no lines", () => {
    expect(getDiffChunkPositions([])).toEqual([])
  })

  test("returns empty for all context lines", () => {
    const lines: DiffLine[] = [
      { type: "context", content: "a" },
      { type: "context", content: "b" },
    ]
    expect(getDiffChunkPositions(lines)).toEqual([])
  })

  test("identifies a single chunk of additions", () => {
    const lines: DiffLine[] = [
      { type: "header", content: "@@" },
      { type: "context", content: "a" },
      { type: "addition", content: "b" },
      { type: "addition", content: "c" },
      { type: "context", content: "d" },
    ]
    expect(getDiffChunkPositions(lines)).toEqual([2])
  })

  test("identifies multiple chunks separated by context", () => {
    const lines: DiffLine[] = [
      { type: "addition", content: "a" },
      { type: "addition", content: "b" },
      { type: "context", content: "c" },
      { type: "deletion", content: "d" },
      { type: "context", content: "e" },
      { type: "addition", content: "f" },
    ]
    expect(getDiffChunkPositions(lines)).toEqual([0, 3, 5])
  })

  test("mixed addition and deletion in same chunk", () => {
    const lines: DiffLine[] = [
      { type: "context", content: "a" },
      { type: "deletion", content: "b" },
      { type: "addition", content: "c" },
      { type: "context", content: "d" },
    ]
    // deletion and addition are consecutive, so one chunk starting at index 1
    expect(getDiffChunkPositions(lines)).toEqual([1])
  })

  test("header breaks chunks", () => {
    const lines: DiffLine[] = [
      { type: "addition", content: "a" },
      { type: "header", content: "@@" },
      { type: "addition", content: "b" },
    ]
    expect(getDiffChunkPositions(lines)).toEqual([0, 2])
  })
})

describe("getFullChunkPositions", () => {
  test("returns empty for empty set", () => {
    expect(getFullChunkPositions(new Set())).toEqual([])
  })

  test("returns single position for single changed line", () => {
    expect(getFullChunkPositions(new Set([5]))).toEqual([5])
  })

  test("groups consecutive lines into one chunk", () => {
    expect(getFullChunkPositions(new Set([3, 4, 5]))).toEqual([3])
  })

  test("identifies separate chunks for non-consecutive lines", () => {
    expect(getFullChunkPositions(new Set([1, 2, 3, 10, 11, 20]))).toEqual([1, 10, 20])
  })

  test("handles single-line gaps", () => {
    // Lines 1,2 then gap at 3, then 4,5
    expect(getFullChunkPositions(new Set([1, 2, 4, 5]))).toEqual([1, 4])
  })

  test("sorts unordered input", () => {
    expect(getFullChunkPositions(new Set([20, 5, 10]))).toEqual([5, 10, 20])
  })
})

// ---------------------------------------------------------------------------
// Scroll bounds
// ---------------------------------------------------------------------------
describe("clampScroll", () => {
  test("clamps to zero for negative offset", () => {
    expect(clampScroll(-5, 100, 20)).toBe(0)
  })

  test("clamps to max when offset exceeds content", () => {
    // maxScroll = 100 - 20 = 80
    expect(clampScroll(90, 100, 20)).toBe(80)
  })

  test("returns offset when within bounds", () => {
    expect(clampScroll(50, 100, 20)).toBe(50)
  })

  test("returns zero when content fits in viewport", () => {
    expect(clampScroll(10, 15, 20)).toBe(0)
  })

  test("returns zero when content equals viewport", () => {
    expect(clampScroll(0, 20, 20)).toBe(0)
  })

  test("handles zero total lines", () => {
    expect(clampScroll(5, 0, 20)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Selectable branches
// ---------------------------------------------------------------------------
describe("getSelectableBranches", () => {
  test("filters out current branch", () => {
    const branches: BranchInfo[] = [
      { name: "main", isCurrent: true },
      { name: "feature-a", isCurrent: false },
      { name: "feature-b", isCurrent: false },
    ]
    const result = getSelectableBranches(branches)
    expect(result.length).toBe(2)
    expect(result.map(b => b.name)).toEqual(["feature-a", "feature-b"])
  })

  test("returns empty if only current branch exists", () => {
    const branches: BranchInfo[] = [
      { name: "main", isCurrent: true },
    ]
    expect(getSelectableBranches(branches)).toEqual([])
  })

  test("returns all branches if none is current", () => {
    const branches: BranchInfo[] = [
      { name: "feature-a", isCurrent: false },
      { name: "feature-b", isCurrent: false },
    ]
    expect(getSelectableBranches(branches).length).toBe(2)
  })

  test("returns empty for empty input", () => {
    expect(getSelectableBranches([])).toEqual([])
  })
})
