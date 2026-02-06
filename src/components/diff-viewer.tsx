import { createMemo, createSignal, createEffect, Index, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { type FileChange } from "../utils/git"
import { highlightCode, type HighlightedLine } from "../utils/syntax"
import { parseDiff, type DiffLine as ParsedDiffLine } from "../utils/git"

interface DiffViewerProps {
  file: FileChange
  focused: boolean
  scrollOffset: number
  onScroll: (offset: number) => void
  currentChunk: number // 0-based index of current chunk
  totalChunks: number  // total number of chunks
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
  
  // Store highlighted lines (syntax highlighted tokens) from diff
  const [highlightedDiffLines, setHighlightedDiffLines] = createSignal<Array<{
    line: ParsedDiffLine
    tokens: HighlightedLine
  }>>([])
  
  // Parse the diff into displayable lines
  const diffLines = createMemo(() => {
    if (!props.file.diff) return []
    return parseDiff(props.file.diff)
  })
  
  // Highlight diff lines when file changes
  createEffect(() => {
    const diff = diffLines()
    if (diff.length === 0) {
      setHighlightedDiffLines([])
      return
    }
    
    // Start with plain text immediately (no delay)
    setHighlightedDiffLines(
      diff.map((line) => ({
        line,
        tokens: [{ content: line.content, color: DEFAULT_COLOR }]
      }))
    )
    
    // Build content for syntax highlighting (only non-header, non-deleted lines)
    const contentToHighlight = diff
      .filter(l => l.type !== "header" && l.type !== "deletion")
      .map(l => l.content)
      .join("\n")
    
    if (contentToHighlight) {
      highlightCode(contentToHighlight, props.file.path).then((highlighted) => {
        // Map back to diff lines
        let highlightIdx = 0
        const result = diff.map((line) => {
          if (line.type === "header" || line.type === "deletion") {
            return { line, tokens: [{ content: line.content, color: DEFAULT_COLOR }] }
          }
          const tokens = highlighted[highlightIdx] ?? [{ content: line.content, color: DEFAULT_COLOR }]
          highlightIdx++
          return { line, tokens }
        })
        setHighlightedDiffLines(result)
      })
    }
  })
  
  // Calculate visible lines based on terminal height (minus headers and status bar)
  const visibleHeight = createMemo(() => {
    return dimensions().height - 5 // 1 for app header, 1 for panel header, 2 for file header, 1 for status bar
  })
  
  // Get the lines to display based on scroll offset
  const visibleLines = createMemo(() => {
    const allLines = highlightedDiffLines()
    const lineCount = allLines.length
    const start = props.scrollOffset
    const end = Math.min(start + visibleHeight(), lineCount)

    return allLines.slice(start, end).map((item, idx) => ({
      diffIndex: start + idx,
      line: item.line,
      tokens: item.tokens,
    }))
  })
  
  // Line number width based on total lines
  const lineNumberWidth = createMemo(() => {
    return Math.max(4, String(highlightedDiffLines().length).length + 1)
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
          <text style={{ fg: "#8b949e" }}> | Line {props.scrollOffset + 1}/{highlightedDiffLines().length}</text>
          {props.totalChunks > 0 && (
            <text style={{ fg: "#d29922" }}> | Chunk {props.currentChunk + 1}/{props.totalChunks}</text>
          )}
        </box>
      </box>
      
      {/* File content */}
      <Show
        when={highlightedDiffLines().length > 0}
        fallback={
          <box
            style={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#0d1117",
            }}
          >
            <text style={{ fg: "#8b949e" }}>No diff available for this file</text>
          </box>
        }
      >
        <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: "#0d1117" }}>
          <Index each={visibleLines()}>
            {(item) => {
              // NOTE: when using <Index>, the callback runs once per position and
              // `item()` updates as the underlying array slice changes (scrolling).
              // Derive styling from `item()` inside reactive getters so background
              // colors and line numbers update correctly.
              const line = () => item().line
              const isAdded = () => line().type === "addition"
              const isRemoved = () => line().type === "deletion"
              const isHeader = () => line().type === "header"
              const isChanged = () => isAdded() || isRemoved()

              return (
                <box
                  style={{
                    flexDirection: "row",
                    backgroundColor: isAdded()
                      ? "#1a2f1a"
                      : isRemoved()
                        ? "#2f1a1a"
                        : isHeader()
                          ? "#21262d"
                          : "#0d1117",
                    height: 1,
                  }}
                >
                  {/* Line number */}
                  <box
                    style={{
                      width: lineNumberWidth(),
                      backgroundColor: isAdded()
                        ? "#1a2f1a"
                        : isRemoved()
                          ? "#2f1a1a"
                          : isHeader()
                            ? "#21262d"
                            : "#161b22",
                    }}
                  >
                    <text style={{ fg: isHeader() ? "#8b949e" : isChanged() ? "#3fb950" : "#484f58" }}>
                      {isHeader()
                        ? "@@"
                        : (line().newLineNumber ?? line().oldLineNumber ?? "-")
                            .toString()
                            .padStart(lineNumberWidth() - 1, " ")}
                    </text>
                  </box>
                  {/* Change indicator */}
                  <box
                    style={{
                      width: 1,
                      backgroundColor: isAdded()
                        ? "#1a2f1a"
                        : isRemoved()
                          ? "#2f1a1a"
                          : isHeader()
                            ? "#21262d"
                            : "#0d1117",
                    }}
                  >
                    <text
                      style={{
                        fg: isHeader()
                          ? "#d29922"
                          : isAdded()
                            ? "#3fb950"
                            : isRemoved()
                              ? "#f85149"
                              : "#0d1117",
                      }}
                    >
                      {isHeader() ? "~" : isAdded() ? "+" : isRemoved() ? "-" : " "}
                    </text>
                  </box>
                  {/* Content with syntax highlighting */}
                  <text
                    style={{
                      flexGrow: 1,
                      flexShrink: 1,
                    }}
                  >
                    <Index each={item().tokens}>
                      {(token) => (
                        <span
                          style={{
                            fg: isHeader() ? "#8b949e" : token().color,
                            bold: token().bold,
                            italic: token().italic,
                            dim: token().dim,
                          }}
                        >
                          {token().content}
                        </span>
                      )}
                    </Index>
                  </text>
                </box>
              )
            }}
          </Index>
        </box>
      </Show>
    </box>
  )
}
