import { For, Show } from "solid-js"
import type { FileChange } from "../utils/git"

interface FileListProps {
  files: FileChange[]
  selectedIndex: number
  focused: boolean
}

function getStatusIcon(status: FileChange["status"]): string {
  switch (status) {
    case "added": return "A"
    case "modified": return "M"
    case "deleted": return "D"
    case "renamed": return "R"
    case "untracked": return "?"
  }
}

function getStatusColor(status: FileChange["status"]): string {
  switch (status) {
    case "added": return "#3fb950"
    case "modified": return "#d29922"
    case "deleted": return "#f85149"
    case "renamed": return "#a371f7"
    case "untracked": return "#8b949e"
  }
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path
}

function getDirectory(path: string): string {
  const parts = path.split("/")
  if (parts.length <= 1) return ""
  return parts.slice(0, -1).join("/") + "/"
}

export function FileList(props: FileListProps) {
  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      {/* Header */}
      <box
        style={{
          height: 1,
          paddingLeft: 1,
          paddingRight: 1,
          backgroundColor: "#21262d",
        }}
      >
        <text style={{ fg: "#e6edf3" }}><b>Changed Files</b> </text>
        <text style={{ fg: "#8b949e" }}>({props.files.length})</text>
      </box>
      
      {/* File list */}
      <scrollbox
        focused={props.focused}
        style={{
          flexGrow: 1,
          flexDirection: "column",
        }}
      >
        <For each={props.files}>
          {(file, index) => {
            const isSelected = () => index() === props.selectedIndex
            const statusIcon = getStatusIcon(file.status)
            const statusColor = getStatusColor(file.status)
            const fileName = getFileName(file.path)
            const directory = getDirectory(file.path)
            
            return (
              <box
                style={{
                  height: 1,
                  paddingLeft: 1,
                  paddingRight: 1,
                  backgroundColor: isSelected() 
                    ? props.focused ? "#388bfd26" : "#30363d" 
                    : "transparent",
                  flexDirection: "row",
                }}
              >
                <text style={{ fg: statusColor }}>{statusIcon} </text>
                <Show when={directory}>
                  <text style={{ fg: "#8b949e" }}>{directory}</text>
                </Show>
                <text style={{ fg: isSelected() ? "#58a6ff" : "#e6edf3" }}>{fileName}</text>
                <Show when={file.additions > 0}>
                  <text style={{ fg: "#3fb950" }}> +{file.additions}</text>
                </Show>
                <Show when={file.deletions > 0}>
                  <text style={{ fg: "#f85149" }}> -{file.deletions}</text>
                </Show>
              </box>
            )
          }}
        </For>
      </scrollbox>
    </box>
  )
}
