import type { AppMode } from "../utils/git"

interface HeaderProps {
  mode: AppMode
}

export function Header(props: HeaderProps) {
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
        <text style={{ fg: "#58a6ff" }}><b>LazyReview</b></text>
      </box>
      <box style={{ flexDirection: "row" }}>
        <text style={{ fg: props.mode === "dirty" ? "#58a6ff" : "#6e7681" }}>
          {props.mode === "dirty" ? "[Dirty]" : "Dirty"}
        </text>
        <text style={{ fg: "#6e7681" }}> </text>
        <text style={{ fg: props.mode === "commit" ? "#58a6ff" : "#6e7681" }}>
          {props.mode === "commit" ? "[Commit]" : "Commit"}
        </text>
        <text style={{ fg: "#6e7681" }}> </text>
        <text style={{ fg: props.mode === "branch" ? "#58a6ff" : "#6e7681" }}>
          {props.mode === "branch" ? "[Branch]" : "Branch"}
        </text>
      </box>
      <text style={{ fg: "#8b949e" }}>m:mode ?:help</text>
    </box>
  )
}
