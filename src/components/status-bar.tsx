import { useTerminalDimensions } from "@opentui/solid"
import { Show, createMemo } from "solid-js"
import type { AppMode } from "../utils/git"

interface StatusBarProps {
  mode: AppMode
  viewState: "list" | "files"
  visibleItemCount: number
  selectedIndex: number
  focusedPanel: "files" | "diff"
  diffViewMode?: "diff" | "full"
  showLineBg?: boolean
  fileListViewMode?: "flat" | "tree"
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
  const dimensions = useTerminalDimensions()

  const ellipsizeStart = (value: string, maxLength: number): string => {
    if (maxLength <= 0) return ""
    if (value.length <= maxLength) return value
    if (maxLength <= 3) return ".".repeat(maxLength)
    return `...${value.slice(-(maxLength - 3))}`
  }

  const ellipsizeEnd = (value: string, maxLength: number): string => {
    if (maxLength <= 0) return ""
    if (value.length <= maxLength) return value
    if (maxLength <= 3) return ".".repeat(maxLength)
    return `${value.slice(0, maxLength - 3)}...`
  }

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
    if (props.visibleItemCount === 0) return "No changes"
    return `${props.selectedIndex + 1}/${props.visibleItemCount}`
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
      return "j/k:nav enter:select r:refresh m:mode ?:help q:quit"
    }
    
    // File view - different keybinds based on mode and panel
    const hasBack = props.mode !== "dirty"
    const backKey = hasBack ? "esc:back " : ""

    const bgToggle = `b:bg${(props.showLineBg ?? true) ? "-" : "+"}`
    const viewToggle = `f:${(props.diffViewMode ?? "diff") === "diff" ? "full" : "diff"}`
    const listViewToggle = `t:${(props.fileListViewMode ?? "flat") === "flat" ? "tree" : "flat"}`
    const listKeys = props.mode === "dirty" ? "1-9:list c:commit " : ""

    if (props.focusedPanel === "files") {
      return `j/k:nav space:review ${listKeys}n/N:chunk ${viewToggle} ${listViewToggle} ${bgToggle} /:search enter:view e:edit o:opencode r:refresh ${backKey}m:mode ?:help q:quit`
    } else {
      return `j/k:scroll space:review ${listKeys}n/N:chunk ${viewToggle} ${listViewToggle} ${bgToggle} /:search ^d/^u:half e:edit o:opencode r:refresh ${backKey}m:mode ?:help q:quit`
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

  const layout = createMemo(() => {
    const width = Math.max(0, dimensions().width - 2)
    const leftPrimary = props.searchMode ? `/${props.searchQuery ?? ""}_` : panelText()
    const leftSecondary = props.searchMode ? "" : contextText() ? ` ${contextText()}` : ""
    const center = ellipsizeEnd(props.searchActive ? searchStatus() ?? "" : itemInfo(), width)

    const leftGap = leftPrimary.length > 0 && center.length > 0 && width > leftPrimary.length + center.length ? 1 : 0
    let remaining = width - leftPrimary.length - center.length - leftGap

    const secondaryBudget = Math.max(0, remaining - (remaining > 0 ? 1 : 0))
    const secondary = ellipsizeEnd(leftSecondary, secondaryBudget)

    remaining -= secondary.length

    const rightGap = secondary.length + leftPrimary.length + center.length > 0 && remaining > 0 ? 1 : 0
    remaining -= rightGap

    const right = ellipsizeStart(effectiveKeybinds(), Math.max(0, remaining))
    remaining -= right.length

    return {
      primary: leftPrimary,
      secondary,
      center,
      right,
      leftGap,
      rightGap,
      spacer: " ".repeat(Math.max(0, remaining)),
      isSearchMode: props.searchMode ?? false,
    }
  })

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
      <box style={{ flexDirection: "row", width: Math.max(0, dimensions().width - 2) }}>
        <Show when={layout().primary.length > 0}>
          <text style={{ fg: layout().isSearchMode ? "#d29922" : "#58a6ff" }}>{layout().primary}</text>
        </Show>
        <Show when={layout().secondary.length > 0}>
          <text style={{ fg: "#8b949e" }}>{layout().secondary}</text>
        </Show>
        <Show when={layout().leftGap > 0}>
          <text> </text>
        </Show>
        <text style={{ fg: props.searchActive && (props.searchMatchCount ?? 0) === 0 ? "#f85149" : "#e6edf3" }}>
          {layout().center}
        </text>
        <Show when={layout().spacer.length > 0}>
          <text>{layout().spacer}</text>
        </Show>
        <Show when={layout().rightGap > 0}>
          <text> </text>
        </Show>
        <Show when={layout().right.length > 0}>
          <text style={{ fg: "#8b949e" }}>{layout().right}</text>
        </Show>
      </box>
    </box>
  )
}
