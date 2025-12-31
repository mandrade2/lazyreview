import { createMemo, createSignal, createEffect, For, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { type FileChange } from "../utils/git"
import { highlightCode, type HighlightedLine } from "../utils/syntax"

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

// Default text color
const DEFAULT_COLOR = "#e6edf3"

export function DiffViewer(props: DiffViewerProps) {
  const dimensions = useTerminalDimensions()
  
  // Store highlighted lines (syntax highlighted tokens)
  const [highlightedLines, setHighlightedLines] = createSignal<HighlightedLine[]>([])
  
  // Parse file content into plain lines (for line count and fallback)
  const plainLines = createMemo(() => {
    if (!props.file.content) return []
    return props.file.content.split("\n")
  })
  
  // Highlight file content when file changes
  createEffect(() => {
    const file = props.file
    if (file.content) {
      // Start with plain text immediately (no delay)
      setHighlightedLines(
        file.content.split("\n").map((line) => [{ content: line, color: DEFAULT_COLOR }])
      )
      // Then asynchronously apply syntax highlighting
      highlightCode(file.content, file.path).then((highlighted) => {
        // Only update if the file hasn't changed
        if (props.file.path === file.path) {
          setHighlightedLines(highlighted)
        }
      })
    } else {
      setHighlightedLines([])
    }
  })
  
  // Calculate visible lines based on terminal height (minus headers and status bar)
  const visibleHeight = createMemo(() => {
    return dimensions().height - 5 // 1 for app header, 1 for panel header, 2 for file header, 1 for status bar
  })
  
  // Get the lines to display based on scroll offset
  const visibleLines = createMemo(() => {
    const allHighlighted = highlightedLines()
    const allPlain = plainLines()
    const lineCount = allPlain.length
    const start = props.scrollOffset
    const end = Math.min(start + visibleHeight(), lineCount)
    
    const result: Array<{
      lineNumber: number
      tokens: HighlightedLine
      isChanged: boolean
    }> = []
    
    for (let i = start; i < end; i++) {
      // Use highlighted tokens if available, otherwise fallback to plain text
      const tokens = allHighlighted[i] ?? [{ content: allPlain[i] ?? "", color: DEFAULT_COLOR }]
      result.push({
        lineNumber: i,
        tokens,
        isChanged: props.file.changedLines.has(i),
      })
    }
    
    return result
  })
  
  // Line number width based on total lines
  const lineNumberWidth = createMemo(() => {
    return Math.max(4, String(plainLines().length).length + 1)
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
          <text style={{ fg: "#8b949e" }}> changes | Line {props.scrollOffset + 1}/{plainLines().length}</text>
        </box>
      </box>
      
      {/* File content */}
      <Show
        when={plainLines().length > 0}
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
                {/* Content with syntax highlighting */}
                <text
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                  }}
                >
                  <For each={line.tokens}>
                    {(token) => (
                      <span style={{ fg: token.color }}>{token.content}</span>
                    )}
                  </For>
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>
    </box>
  )
}
