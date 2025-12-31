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
  
  return (
    <box
      style={{
        height: 1,
        backgroundColor: "#161b22",
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        border: ["top"],
        borderColor: "#30363d",
      }}
    >
      <text style={{ fg: "#58a6ff" }}>{panelText()}</text>
      <text style={{ fg: "#e6edf3" }}>{fileInfo()}</text>
      <text style={{ fg: "#8b949e" }}>j/k:nav tab:switch r:refresh q:quit</text>
    </box>
  )
}
