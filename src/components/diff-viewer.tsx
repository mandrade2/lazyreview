import { createMemo, createSignal, createEffect, Index, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { type FileChange } from "../utils/git"
import { highlightCode, type HighlightedLine } from "../utils/syntax"

interface SearchMatch {
  line: number
  start: number
  length: number
}

interface DiffViewerProps {
  file: FileChange
  focused: boolean
  scrollOffset: number
  onScroll: (offset: number) => void
  currentChunk: number // 0-based index of current chunk
  totalChunks: number  // total number of chunks
  searchMatches?: SearchMatch[] // all search matches
  currentMatchIndex?: number // index of currently focused match
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

// Search highlight colors
const SEARCH_MATCH_BG = "#d2992240" // yellow/orange background for matches
const SEARCH_CURRENT_BG = "#d29922" // brighter for current match

interface HighlightedToken {
  content: string
  color?: string
  bold?: boolean
  italic?: boolean
  dim?: boolean
  searchHighlight?: "match" | "current" // search match type
}

// Apply search highlighting to tokens by splitting them at match boundaries
function applySearchHighlighting(
  tokens: HighlightedLine,
  matches: Array<{ start: number; length: number; isCurrent: boolean }>
): HighlightedToken[] {
  if (matches.length === 0) {
    return tokens.map((t) => ({ ...t }))
  }

  // Build the full line content and track token boundaries
  let fullContent = ""
  const tokenBoundaries: Array<{ start: number; end: number; tokenIdx: number }> = []
  for (let i = 0; i < tokens.length; i++) {
    const start = fullContent.length
    fullContent += tokens[i]!.content
    tokenBoundaries.push({ start, end: fullContent.length, tokenIdx: i })
  }

  // Build a list of all split points (match starts and ends)
  const splitPoints = new Set<number>()
  splitPoints.add(0)
  splitPoints.add(fullContent.length)

  for (const match of matches) {
    splitPoints.add(match.start)
    splitPoints.add(match.start + match.length)
  }

  // Add token boundaries as split points
  for (const tb of tokenBoundaries) {
    splitPoints.add(tb.start)
    splitPoints.add(tb.end)
  }

  const sortedPoints = [...splitPoints].sort((a, b) => a - b)

  // Create segments between split points
  const result: HighlightedToken[] = []

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const segStart = sortedPoints[i]!
    const segEnd = sortedPoints[i + 1]!

    if (segStart >= segEnd) continue

    // Find which token this segment belongs to
    const tokenBoundary = tokenBoundaries.find(
      (tb) => segStart >= tb.start && segStart < tb.end
    )
    if (!tokenBoundary) continue

    const originalToken = tokens[tokenBoundary.tokenIdx]!
    const relativeStart = segStart - tokenBoundary.start
    const relativeEnd = segEnd - tokenBoundary.start
    const content = originalToken.content.slice(relativeStart, relativeEnd)

    if (content.length === 0) continue

    // Check if this segment is within any match
    let searchHighlight: "match" | "current" | undefined
    for (const match of matches) {
      const matchEnd = match.start + match.length
      if (segStart >= match.start && segEnd <= matchEnd) {
        searchHighlight = match.isCurrent ? "current" : "match"
        break
      }
    }

    result.push({
      content,
      color: originalToken.color,
      bold: originalToken.bold,
      italic: originalToken.italic,
      dim: originalToken.dim,
      searchHighlight,
    })
  }

  return result
}

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
  
  // Get matches for a specific line
  const getLineMatches = (lineIndex: number): Array<{ start: number; length: number; isCurrent: boolean }> => {
    const matches = props.searchMatches ?? []
    const currentIdx = props.currentMatchIndex ?? 0
    const lineMatches: Array<{ start: number; length: number; isCurrent: boolean }> = []

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]!
      if (match.line === lineIndex) {
        lineMatches.push({
          start: match.start,
          length: match.length,
          isCurrent: i === currentIdx,
        })
      }
    }

    return lineMatches.sort((a, b) => a.start - b.start)
  }

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
      searchMatches: Array<{ start: number; length: number; isCurrent: boolean }>
    }> = []

    for (let i = start; i < end; i++) {
      // Use highlighted tokens if available, otherwise fallback to plain text
      const tokens = allHighlighted[i] ?? [{ content: allPlain[i] ?? "", color: DEFAULT_COLOR }]
      result.push({
        lineNumber: i,
        tokens,
        isChanged: props.file.changedLines.has(i),
        searchMatches: getLineMatches(i),
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
          <text style={{ fg: "#8b949e" }}> | Line {props.scrollOffset + 1}/{plainLines().length}</text>
          {props.totalChunks > 0 && (
            <text style={{ fg: "#d29922" }}> | Chunk {props.currentChunk + 1}/{props.totalChunks}</text>
          )}
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
          <Index each={visibleLines()}>
            {(line) => (
              <box
                style={{
                  flexDirection: "row",
                  backgroundColor: "#0d1117",
                  height: 1,
                }}
              >
                {/* Line number - green for changed lines */}
                <box
                  style={{
                    width: lineNumberWidth(),
                    backgroundColor: "#161b22",
                  }}
                >
                  <text style={{ fg: line().isChanged ? "#3fb950" : "#484f58" }}>
                    {String(line().lineNumber + 1).padStart(lineNumberWidth() - 1, " ")}
                  </text>
                </box>
                {/* Change indicator */}
                <box
                  style={{
                    width: 1,
                    backgroundColor: "#0d1117",
                  }}
                >
                  <text style={{ fg: line().isChanged ? "#3fb950" : "#0d1117" }}>
                    {line().isChanged ? "+" : " "}
                  </text>
                </box>
                {/* Content with syntax highlighting and search matches */}
                <text
                  style={{
                    flexGrow: 1,
                    flexShrink: 1,
                  }}
                >
                  <Index each={applySearchHighlighting(line().tokens, line().searchMatches)}>
                    {(token) => (
                      <span
                        style={{
                          fg: token().searchHighlight === "current" ? "#0d1117" : token().color,
                          bg: token().searchHighlight === "current"
                            ? SEARCH_CURRENT_BG
                            : token().searchHighlight === "match"
                              ? SEARCH_MATCH_BG
                              : undefined,
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
            )}
          </Index>
        </box>
      </Show>
    </box>
  )
}
