import { createMemo, For, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { type FileChange } from "../utils/git"

interface DiffViewerProps {
  file: FileChange
  focused: boolean
  scrollOffset: number
  onScroll: (offset: number) => void
}

function getStatusLabel(status: FileChange["status"]): string {
  switch (status) {
    case "added": return "Added"
    case "modified": return "Modified"
    case "deleted": return "Deleted"
    case "renamed": return "Renamed"
    case "untracked": return "Untracked"
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

export function DiffViewer(props: DiffViewerProps) {
  const dimensions = useTerminalDimensions()
  
  // Parse file content into lines
  const lines = createMemo(() => {
    if (!props.file.content) return []
    return props.file.content.split("\n")
  })
  
  // Calculate visible lines based on terminal height (minus header and status bar)
  const visibleHeight = createMemo(() => {
    return dimensions().height - 4 // 1 for header, 2 for file header, 1 for status bar
  })
  
  // Get the lines to display based on scroll offset
  const visibleLines = createMemo(() => {
    const allLines = lines()
    const start = props.scrollOffset
    const end = Math.min(start + visibleHeight(), allLines.length)
    return allLines.slice(start, end).map((content, idx) => ({
      lineNumber: start + idx,
      content,
      isChanged: props.file.changedLines.has(start + idx),
    }))
  })
  
  // Line number width based on total lines
  const lineNumberWidth = createMemo(() => {
    return Math.max(4, String(lines().length).length + 1)
  })
  
  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      {/* File header */}
      <box
        style={{
          height: 2,
          paddingLeft: 1,
          paddingRight: 1,
          backgroundColor: "#21262d",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <box style={{ flexDirection: "row" }}>
          <text style={{ fg: "#e6edf3" }}><b>{props.file.path}</b></text>
          <text style={{ fg: getStatusColor(props.file.status) }}> [{getStatusLabel(props.file.status)}]</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text style={{ fg: "#3fb950" }}>+{props.file.additions}</text>
          <text style={{ fg: "#f85149" }}> -{props.file.deletions}</text>
          <text style={{ fg: "#8b949e" }}> changes | Line {props.scrollOffset + 1}/{lines().length}</text>
        </box>
      </box>
      
      {/* File content */}
      <Show
        when={lines().length > 0}
        fallback={
          <box
            style={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#0d1117",
            }}
          >
            <text style={{ fg: "#8b949e" }}>No content available for this file</text>
          </box>
        }
      >
        <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: "#0d1117" }}>
          <For each={visibleLines()}>
            {(line) => (
              <box
                style={{
                  flexDirection: "row",
                  backgroundColor: line.isChanged ? "#0f1a0f" : "#0d1117",
                  height: 1,
                }}
              >
                {/* Line number */}
                <box
                  style={{
                    width: lineNumberWidth(),
                    backgroundColor: line.isChanged ? "#0f1a0f" : "#161b22",
                  }}
                >
                  <text style={{ fg: line.isChanged ? "#3fb950" : "#484f58" }}>
                    {String(line.lineNumber + 1).padStart(lineNumberWidth() - 1, " ")} 
                  </text>
                </box>
                {/* Change indicator */}
                <box
                  style={{
                    width: 1,
                    backgroundColor: line.isChanged ? "#0f1a0f" : "#0d1117",
                  }}
                >
                  <text style={{ fg: line.isChanged ? "#3fb950" : "#0d1117" }}>
                    {line.isChanged ? "+" : " "}
                  </text>
                </box>
                {/* Content */}
                <box
                  style={{
                    flexGrow: 1,
                    backgroundColor: line.isChanged ? "#0f1a0f" : "#0d1117",
                  }}
                >
                  <text style={{ fg: "#e6edf3" }}>
                    {line.content}
                  </text>
                </box>
              </box>
            )}
          </For>
        </box>
      </Show>
    </box>
  )
}
