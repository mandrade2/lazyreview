interface StatusBarProps {
  fileCount: number
  selectedIndex: number
  focusedPanel: "files" | "diff"
}

export function StatusBar(props: StatusBarProps) {
  const panelText = () => {
    return props.focusedPanel === "files" 
      ? "[Files] Diff"
      : "Files [Diff]"
  }
  
  const fileInfo = () => {
    if (props.fileCount === 0) return "No changes"
    return `${props.selectedIndex + 1}/${props.fileCount}`
  }
  
  const keybinds = () => {
    if (props.focusedPanel === "files") {
      return "j/k:nav enter:view esc:blur tab:switch q:quit"
    } else {
      return "j/k:scroll ^d/^u:half ^f/^b:page esc:back tab:switch q:quit"
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
      <text style={{ fg: "#58a6ff" }}>{panelText()}</text>
      <text style={{ fg: "#e6edf3" }}>{fileInfo()}</text>
      <text style={{ fg: "#8b949e" }}>{keybinds()}</text>
    </box>
  )
}
