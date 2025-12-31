export function Header() {
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
      }}
    >
      <text style={{ fg: "#58a6ff" }}><b>LazyReview</b></text>
      <text style={{ fg: "#8b949e" }}> - Code Review TUI</text>
      <text style={{ fg: "#8b949e" }}>Press ? for help</text>
    </box>
  )
}
