import { For, Show, createMemo } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
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

function getDirectory(path: string, maxLength: number): string {
  const parts = path.split("/")
  if (parts.length <= 1) return ""
  const dir = parts.slice(0, -1).join("/") + "/"
  if (dir.length <= maxLength) return dir
  return "..." + dir.slice(-(maxLength - 3))
}

export function FileList(props: FileListProps) {
  const dimensions = useTerminalDimensions()
  
  // Calculate visible height (terminal height - app header - panel header - file list header - status bar)
  const visibleHeight = createMemo(() => dimensions().height - 5)
  
  // Calculate scroll offset to keep selected item visible
  const scrollOffset = createMemo(() => {
    const height = visibleHeight()
    const selected = props.selectedIndex
    
    if (selected < height) {
      return 0
    }
    return Math.max(0, selected - Math.floor(height / 2))
  })
  
  // Get visible files based on scroll offset
  const visibleFiles = createMemo(() => {
    const start = scrollOffset()
    const end = start + visibleHeight()
    return props.files.slice(start, end).map((file, i) => ({
      file,
      actualIndex: start + i,
    }))
  })
  
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
      <box
        style={{
          flexGrow: 1,
          flexDirection: "column",
        }}
      >
        <For each={visibleFiles()}>
          {({ file, actualIndex }) => {
            const isSelected = () => actualIndex === props.selectedIndex
            const statusIcon = getStatusIcon(file.status)
            const statusColor = getStatusColor(file.status)
            const fileName = getFileName(file.path)
            
            const additionsText = file.additions > 0 ? ` +${file.additions}` : ""
            const deletionsText = file.deletions > 0 ? ` -${file.deletions}` : ""
            const statsLength = additionsText.length + deletionsText.length
            
            const sidebarWidth = 35
            const padding = 2
            const iconLength = 2
            const minFileNameLength = 25
            const availableForDirectory = Math.max(0, sidebarWidth - padding - iconLength - minFileNameLength - statsLength)
            const directory = getDirectory(file.path, availableForDirectory)
            
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
                <box style={{ flexGrow: 1 }} />
                <Show when={file.additions > 0}>
                  <text style={{ fg: "#3fb950" }}>{additionsText}</text>
                </Show>
                <Show when={file.deletions > 0}>
                  <text style={{ fg: "#f85149" }}>{deletionsText}</text>
                </Show>
              </box>
            )
          }}
        </For>
      </box>
    </box>
  )
}
