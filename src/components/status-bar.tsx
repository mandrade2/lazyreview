import type { AppMode } from "../utils/git"

interface StatusBarProps {
  mode: AppMode
  viewState: "list" | "files"
  fileCount: number
  selectedIndex: number
  focusedPanel: "files" | "diff"
  listCount?: number
  listSelectedIndex?: number
  contextInfo?: string // commit hash or branch name
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
      return `j/k:nav n/N:chunk enter:view e:edit ${backKey}m:mode ?:help q:quit`
    } else {
      return `j/k:scroll n/N:chunk ^d/^u:half e:edit ${backKey}m:mode ?:help q:quit`
    }
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
      <box style={{ flexDirection: "row" }}>
        <text style={{ fg: "#58a6ff" }}>{panelText()}</text>
        {contextText() && (
          <text style={{ fg: "#8b949e" }}> {contextText()}</text>
        )}
      </box>
      <text style={{ fg: "#e6edf3" }}>{itemInfo()}</text>
      <text style={{ fg: "#8b949e" }}>{keybinds()}</text>
    </box>
  )
}
