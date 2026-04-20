/**
 * Pure UI display logic extracted from components for testability.
 *
 * These functions compute display strings, colors, icons, and layout decisions
 * that the components use. Keeping them here lets us unit-test every visual
 * decision without needing a terminal or SolidJS rendering context.
 */

import type { AppMode, FileChange, CommitInfo, BranchInfo, DiffLine } from "./git"

// ---------------------------------------------------------------------------
// File status display helpers
// ---------------------------------------------------------------------------

export function getStatusIcon(status: FileChange["status"]): string {
  switch (status) {
    case "added": return "A"
    case "modified": return "M"
    case "deleted": return "D"
    case "renamed": return "R"
    case "untracked": return "?"
  }
}

export function getStatusLabel(status: FileChange["status"]): string {
  switch (status) {
    case "added": return "Added"
    case "modified": return "Modified"
    case "deleted": return "Deleted"
    case "renamed": return "Renamed"
    case "untracked": return "Untracked"
  }
}

export function getStatusColor(status: FileChange["status"]): string {
  switch (status) {
    case "added": return "#3fb950"
    case "modified": return "#d29922"
    case "deleted": return "#f85149"
    case "renamed": return "#a371f7"
    case "untracked": return "#8b949e"
  }
}

// ---------------------------------------------------------------------------
// File path display helpers
// ---------------------------------------------------------------------------

export function getFileName(path: string): string {
  return path.split("/").pop() ?? path
}

export function getDirectory(path: string, maxLength: number): string {
  const parts = path.split("/")
  if (parts.length <= 1) return ""
  const dir = parts.slice(0, -1).join("/") + "/"
  if (dir.length <= maxLength) return dir
  return "..." + dir.slice(-(maxLength - 3))
}

// ---------------------------------------------------------------------------
// Commit display helpers
// ---------------------------------------------------------------------------

export function truncateMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message
  }
  return message.substring(0, maxLength - 1) + "..."
}

// ---------------------------------------------------------------------------
// Left panel header text
// ---------------------------------------------------------------------------

export function getLeftPanelHeader(
  mode: AppMode,
  viewState: "list" | "files",
  fileCount: number,
  commitCount: number,
  branchCount: number,
  selectedCommitShortHash: string | null,
  currentBranch: string | null,
  selectedBranchName: string | null,
): string {
  if (mode === "dirty") {
    return `FILES (${fileCount})`
  } else if (mode === "commit") {
    if (viewState === "list") {
      return `COMMITS (${commitCount})`
    } else {
      return `FILES (${fileCount}) · ${selectedCommitShortHash ?? ""}`
    }
  } else {
    if (viewState === "list") {
      return `BRANCHES (${branchCount})`
    } else {
      const current = currentBranch ?? "HEAD"
      const selected = selectedBranchName ?? ""
      return `FILES (${fileCount}) · ${current} vs ${selected}`
    }
  }
}

// ---------------------------------------------------------------------------
// Diff placeholder messages
// ---------------------------------------------------------------------------

export function getDiffPlaceholderMessage(
  mode: AppMode,
  viewState: "list" | "files",
  fileCount: number,
  currentBranch: string | null,
  selectableBranchCount: number,
): string {
  if (mode === "dirty") {
    return fileCount === 0 ? "No changes detected" : "Select a file to view diff"
  } else if (mode === "commit") {
    if (viewState === "list") {
      return "Select a commit to view its changes"
    }
    return fileCount === 0 ? "No files changed in this commit" : "Select a file to view diff"
  } else {
    if (viewState === "list") {
      if (currentBranch === null) {
        return "Cannot compare branches: HEAD is detached"
      }
      if (selectableBranchCount === 0) {
        return "No other branches to compare against"
      }
      return `Select a branch to compare against ${currentBranch}`
    }
    return fileCount === 0 ? "No differences between branches" : "Select a file to view diff"
  }
}

// ---------------------------------------------------------------------------
// Context info for status bar
// ---------------------------------------------------------------------------

export function getContextInfo(
  mode: AppMode,
  selectedCommitShortHash: string | null,
  currentBranch: string | null,
  selectedBranchName: string | null,
): string | undefined {
  if (mode === "commit" && selectedCommitShortHash) {
    return selectedCommitShortHash
  } else if (mode === "branch" && selectedBranchName) {
    const current = currentBranch ?? "HEAD"
    return `${current} vs ${selectedBranchName}`
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Status bar panel text
// ---------------------------------------------------------------------------

export function getPanelText(
  mode: AppMode,
  viewState: "list" | "files",
  focusedPanel: "files" | "diff",
): string {
  if (viewState === "list") {
    return mode === "commit" ? "Commits" : "Branches"
  }
  return focusedPanel === "files"
    ? "[Files] Diff"
    : "Files [Diff]"
}

// ---------------------------------------------------------------------------
// Status bar item info
// ---------------------------------------------------------------------------

export function getItemInfo(
  viewState: "list" | "files",
  fileCount: number,
  selectedIndex: number,
  listCount: number,
  listSelectedIndex: number,
): string {
  if (viewState === "list") {
    if (listCount === 0) return "Empty"
    return `${listSelectedIndex + 1}/${listCount}`
  }
  if (fileCount === 0) return "No changes"
  return `${selectedIndex + 1}/${fileCount}`
}

// ---------------------------------------------------------------------------
// Status bar keybinds
// ---------------------------------------------------------------------------

export function getKeybinds(
  viewState: "list" | "files",
  mode: AppMode,
  focusedPanel: "files" | "diff",
  diffViewMode: "diff" | "full",
): string {
  if (viewState === "list") {
    return "j/k:nav enter:select m:mode ?:help q:quit"
  }

  const hasBack = mode !== "dirty"
  const backKey = hasBack ? "esc:back " : ""

  if (focusedPanel === "files") {
    const viewToggle = `f:${diffViewMode === "diff" ? "full" : "diff"}`
    return `j/k:nav n/N:chunk ${viewToggle} enter:view e:edit ${backKey}m:mode ?:help q:quit`
  } else {
    const viewToggle = `f:${diffViewMode === "diff" ? "full" : "diff"}`
    return `j/k:scroll n/N:chunk ${viewToggle} ^d/^u:half e:edit ${backKey}m:mode ?:help q:quit`
  }
}

export function getEffectiveKeybinds(
  searchMode: boolean,
  searchActive: boolean,
  normalKeybinds: string,
): string {
  if (searchMode) {
    return "enter:search esc:cancel"
  }
  if (searchActive) {
    return "n/N:match esc:clear /:search"
  }
  return normalKeybinds
}

// ---------------------------------------------------------------------------
// Search status
// ---------------------------------------------------------------------------

export function getSearchStatus(
  searchMode: boolean,
  searchQuery: string,
  searchActive: boolean,
  searchMatchCount: number,
  currentMatchIndex: number,
): string | null {
  if (searchMode) {
    return `/${searchQuery}_`
  }
  if (searchActive) {
    if (searchMatchCount === 0) {
      return "No matches"
    }
    return `[${currentMatchIndex + 1}/${searchMatchCount}]`
  }
  return null
}

// ---------------------------------------------------------------------------
// Mode cycling
// ---------------------------------------------------------------------------

export function getNextMode(current: AppMode): AppMode {
  return current === "dirty" ? "commit"
       : current === "commit" ? "branch"
       : "dirty"
}

// ---------------------------------------------------------------------------
// Diff viewer line styling decisions
// ---------------------------------------------------------------------------

export function getLineBackground(type: DiffLine["type"] | "full-added" | "full-removed"): string {
  switch (type) {
    case "addition":
    case "full-added":
      return "#1a2f1a"
    case "deletion":
    case "full-removed":
      return "#2f1a1a"
    case "header":
      return "#21262d"
    default:
      return "#0d1117"
  }
}

export function getChangeIndicator(type: DiffLine["type"]): string {
  switch (type) {
    case "header": return "~"
    case "addition": return "+"
    case "deletion": return "-"
    default: return " "
  }
}

export function getLineNumberColor(type: DiffLine["type"]): string {
  switch (type) {
    case "header": return "#8b949e"
    case "addition": return "#3fb950"
    case "deletion": return "#f85149"
    default: return "#484f58"
  }
}

// ---------------------------------------------------------------------------
// Chunk position computation
// ---------------------------------------------------------------------------

export function getDiffChunkPositions(parsedDiff: DiffLine[]): number[] {
  const chunks: number[] = []
  let chunkStart = -1

  for (let i = 0; i < parsedDiff.length; i++) {
    const line = parsedDiff[i]!
    if (line.type === "addition" || line.type === "deletion") {
      if (chunkStart === -1) {
        chunkStart = i
        chunks.push(chunkStart)
      }
    } else {
      chunkStart = -1
    }
  }

  return chunks
}

export function getFullChunkPositions(changedLines: Set<number>): number[] {
  const indices = [...changedLines].sort((a, b) => a - b)
  if (indices.length === 0) return []

  const chunks: number[] = [indices[0]!]
  for (let i = 1; i < indices.length; i++) {
    const prev = indices[i - 1]!
    const cur = indices[i]!
    if (cur !== prev + 1) {
      chunks.push(cur)
    }
  }
  return chunks
}

// ---------------------------------------------------------------------------
// Scroll bounds
// ---------------------------------------------------------------------------

export function clampScroll(offset: number, totalLines: number, visibleHeight: number): number {
  const maxScroll = Math.max(0, totalLines - visibleHeight)
  return Math.max(0, Math.min(offset, maxScroll))
}

// ---------------------------------------------------------------------------
// Selectable branches (filter out current)
// ---------------------------------------------------------------------------

export function getSelectableBranches(branches: BranchInfo[]): BranchInfo[] {
  return branches.filter(b => !b.isCurrent)
}
