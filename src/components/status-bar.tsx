import type { AppMode } from "../utils/git"

interface StatusBarProps {
  mode: AppMode
  viewState: "list" | "files"
  fileCount: number
  selectedIndex: number
  focusedPanel: "files" | "diff"
  diffViewMode?: "diff" | "full"
  listCount?: number
  listSelectedIndex?: number
  contextInfo?: string // commit hash or branch name
  searchMode?: boolean // true when typing search query
  searchQuery?: string // current search input
  searchActive?: boolean // true when search results are shown
  searchMatchCount?: number // total number of matches
  currentMatchIndex?: number // current match index (0-based)
}

export function StatusBar(props: StatusBarProps) {
  const panelText = () => {
    // In list view, no panel switching
    if (props.viewState === "list") {
      return props.mode === "commit" ? "Commits" : "Branches"
    }
    return props.focusedPanel === "files" 
      ? "[Files] Diff"
      : "Files [Diff]"
  }
  
  const itemInfo = () => {
    if (props.viewState === "list") {
      const count = props.listCount ?? 0
      const index = props.listSelectedIndex ?? 0
      if (count === 0) return "Empty"
      return `${index + 1}/${count}`
    }
    if (props.fileCount === 0) return "No changes"
    return `${props.selectedIndex + 1}/${props.fileCount}`
  }
  
  const contextText = () => {
    if (props.viewState === "files" && props.contextInfo) {
      if (props.mode === "commit") {
        return `Commit: ${props.contextInfo}`
      } else if (props.mode === "branch") {
        return props.contextInfo // Already formatted as "current vs selected"
      }
    }
    return ""
  }
  
  const keybinds = () => {
    // List view (commits or branches)
    if (props.viewState === "list") {
      return "j/k:nav enter:select m:mode ?:help q:quit"
    }
    
    // File view - different keybinds based on mode and panel
    const hasBack = props.mode !== "dirty"
    const backKey = hasBack ? "esc:back " : ""
    
    if (props.focusedPanel === "files") {
      const viewToggle = `f:${(props.diffViewMode ?? "diff") === "diff" ? "full" : "diff"}`
      return `j/k:nav n/N:chunk ${viewToggle} enter:view e:edit ${backKey}m:mode ?:help q:quit`
    } else {
      const viewToggle = `f:${(props.diffViewMode ?? "diff") === "diff" ? "full" : "diff"}`
      return `j/k:scroll n/N:chunk ${viewToggle} ^d/^u:half e:edit ${backKey}m:mode ?:help q:quit`
    }
  }
  
  // Search status display
  const searchStatus = () => {
    if (props.searchMode) {
      return `/${props.searchQuery ?? ""}_`
    }
    if (props.searchActive) {
      const count = props.searchMatchCount ?? 0
      if (count === 0) {
        return "No matches"
      }
      const current = (props.currentMatchIndex ?? 0) + 1
      return `[${current}/${count}]`
    }
    return null
  }

  // Show search-specific keybinds when search is active
  const effectiveKeybinds = () => {
    if (props.searchMode) {
      return "enter:search esc:cancel"
    }
    if (props.searchActive) {
      return "n/N:match esc:clear /:search"
    }
    return keybinds()
  }

  return (
    <box
      style={{
        height: 1,
        flexShrink: 0,
        backgroundColor: "#161b22",
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {/* Left section: search input or panel info */}
      <box style={{ flexDirection: "row" }}>
        {props.searchMode ? (
          <text style={{ fg: "#d29922" }}>/{props.searchQuery ?? ""}<span style={{ bg: "#d29922", fg: "#0d1117" }}> </span></text>
        ) : (
          <>
            <text style={{ fg: "#58a6ff" }}>{panelText()}</text>
            {contextText() && (
              <text style={{ fg: "#8b949e" }}> {contextText()}</text>
            )}
          </>
        )}
      </box>

      {/* Center section: item info or search status */}
      <text style={{ fg: props.searchActive && (props.searchMatchCount ?? 0) === 0 ? "#f85149" : "#e6edf3" }}>
        {props.searchActive ? searchStatus() : itemInfo()}
      </text>

      {/* Right section: keybinds */}
      <text style={{ fg: "#8b949e" }}>{effectiveKeybinds()}</text>
    </box>
  )
}
