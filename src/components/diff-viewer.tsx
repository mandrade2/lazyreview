import { createEffect, createMemo, createSignal, Index, onCleanup, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { type FileChange } from "../utils/git"
import { highlightFile, type HighlightedLine, wrapTokens } from "../utils/dataloading"
import { parseDiff, type DiffLine as ParsedDiffLine } from "../utils/git"

interface DiffViewerProps {
  file: FileChange
  focused: boolean
  scrollOffset: number
  onScroll: (offset: number) => void
  currentChunk: number // 0-based index of current chunk
  totalChunks: number  // total number of chunks
  viewMode?: "diff" | "full"
  showLineBg?: boolean
  isReviewed?: boolean
  width: number
}

interface DisplayRow {
  lineNumber: string | number | null
  changeIndicator: string | null
  tokens: HighlightedLine
  isHeader: boolean
  isAdded: boolean
  isRemoved: boolean
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

  const viewMode = () => props.viewMode ?? "diff"

  // Store highlighted lines (syntax highlighted tokens) from diff
  const [highlightedDiffLines, setHighlightedDiffLines] = createSignal<Array<{
    line: ParsedDiffLine
    tokens: HighlightedLine
  }>>([])

  // Store highlighted lines for full file view
  const [highlightedFileLines, setHighlightedFileLines] = createSignal<HighlightedLine[]>([])

  // Parse the diff into displayable lines
  const diffLines = createMemo(() => {
    if (!props.file.diff) return []
    return parseDiff(props.file.diff)
  })

  // Build highlighted diff lines from the full file highlighting
  // This avoids broken syntax highlighting caused by incomplete statements
  // when joining diff hunks (e.g., an unclosed `import {` from one hunk
  // breaking parser state for subsequent hunks).
  createEffect(() => {
    const diff = diffLines()
    const fileLines = highlightedFileLines()
    if (diff.length === 0) {
      setHighlightedDiffLines([])
      return
    }

    const result = diff.map((line) => {
      if (line.type === "header" || line.type === "deletion") {
        return { line, tokens: [{ content: line.content, color: DEFAULT_COLOR }] }
      }
      const lineIndex = (line.newLineNumber ?? 1) - 1
      const tokens = fileLines[lineIndex] ?? [{ content: line.content, color: DEFAULT_COLOR }]
      return { line, tokens }
    })

    setHighlightedDiffLines(result)
  })

  // Highlight full file content when file changes
  // Always highlight so diff mode can pull correct tokens per line
  createEffect(() => {
    let cancelled = false
    const content = props.file.content
    if (!content) {
      setHighlightedFileLines([])
      return
    }

    // Start with plain text immediately (no delay)
    setHighlightedFileLines(
      content.split("\n").map((line) => [{ content: line, color: DEFAULT_COLOR }])
    )

    highlightFile(content, props.file.path).then((highlighted) => {
      if (cancelled) return
      setHighlightedFileLines(highlighted)
    }).catch(() => {
      // Stale-result rejections are expected when the user navigates quickly.
      // The current selection is already being highlighted by a new request.
    })

    onCleanup(() => {
      cancelled = true
    })
  })

  // Calculate visible rows based on terminal height (minus headers and status bar)
  const visibleHeight = createMemo(() => {
    return dimensions().height - 5 // 1 for app header, 1 for panel header, 2 for file header, 1 for status bar
  })

  // Line number width based on total lines
  const lineNumberWidth = createMemo(() => {
    const total = viewMode() === "full" ? highlightedFileLines().length : highlightedDiffLines().length
    return Math.max(4, String(total).length + 1)
  })

  // Available width for the actual code content
  const contentWidth = createMemo(() => Math.max(1, props.width - lineNumberWidth() - 1))

  const changeInfo = createMemo(() => {
    if (viewMode() === "full") {
      return {
        added: props.file.addedLines,
        removed: props.file.removedLines,
        changed: props.file.changedLines,
      }
    }
    return null
  })

  // Wrap logical lines into display rows that fit within the available width.
  // Returns both the flat row list and the starting row index for each logical line.
  const wrapData = createMemo(() => {
    const width = contentWidth()
    const rows: DisplayRow[] = []
    const logicalStartRows: number[] = []

    if (viewMode() === "full") {
      const lines = highlightedFileLines()
      const change = changeInfo()

      for (let i = 0; i < lines.length; i++) {
        logicalStartRows.push(rows.length)
        const tokens = lines[i] ?? [{ content: "", color: DEFAULT_COLOR }]
        const wrapped = wrapTokens(tokens, width)
        const isAdded = !!change?.added.has(i)
        const isRemoved = !!change?.removed.has(i)

        for (let r = 0; r < wrapped.length; r++) {
          rows.push({
            lineNumber: r === 0 ? i + 1 : null,
            changeIndicator: r === 0 ? " " : null,
            tokens: wrapped[r]!,
            isHeader: false,
            isAdded,
            isRemoved,
          })
        }
      }
    } else {
      const lines = highlightedDiffLines()

      for (let i = 0; i < lines.length; i++) {
        logicalStartRows.push(rows.length)
        const item = lines[i]!
        const wrapped = wrapTokens(item.tokens, width)
        const isHeader = item.line.type === "header"
        const isAdded = item.line.type === "addition"
        const isRemoved = item.line.type === "deletion"

        for (let r = 0; r < wrapped.length; r++) {
          rows.push({
            lineNumber: r === 0
              ? (isHeader ? "@@" : (item.line.newLineNumber ?? item.line.oldLineNumber ?? "-"))
              : null,
            changeIndicator: r === 0
              ? (isHeader ? "~" : isAdded ? "+" : isRemoved ? "-" : " ")
              : null,
            tokens: wrapped[r]!,
            isHeader,
            isAdded,
            isRemoved,
          })
        }
      }
    }

    logicalStartRows.push(rows.length)
    return { rows, logicalStartRows }
  })

  // Determine which display rows are visible based on the logical scroll offset.
  const visibleRows = createMemo(() => {
    const { rows, logicalStartRows } = wrapData()
    const height = visibleHeight()
    const totalLogical = Math.max(0, logicalStartRows.length - 1)
    const startLine = Math.max(0, Math.min(props.scrollOffset, totalLogical - 1))

    if (totalLogical === 0 || height <= 0) {
      return []
    }

    const result: DisplayRow[] = []
    let rowCount = 0

    for (let i = startLine; i < totalLogical && rowCount < height; i++) {
      const lineStart = logicalStartRows[i]!
      const lineEnd = logicalStartRows[i + 1]!
      const lineRows = rows.slice(lineStart, lineEnd)

      if (rowCount + lineRows.length <= height) {
        result.push(...lineRows)
        rowCount += lineRows.length
      } else if (rowCount === 0) {
        // The first logical line is taller than the viewport; show its top portion.
        result.push(...lineRows.slice(0, height))
        rowCount = height
        break
      } else {
        // The next logical line doesn't fit fully; stop to avoid clipping it.
        break
      }
    }

    return result
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
          <text style={{ fg: "#f0883e" }}> {props.isReviewed ? "[Reviewed]" : "[Not Reviewed]"}</text>
        </box>
        <box style={{ flexDirection: "row" }}>
          <text style={{ fg: "#3fb950" }}>+{props.file.additions}</text>
          <text style={{ fg: "#f85149" }}> -{props.file.deletions}</text>
          <text style={{ fg: "#8b949e" }}>
            {viewMode() === "full"
              ? ` | Full ${props.scrollOffset + 1}/${highlightedFileLines().length}`
              : ` | Line ${props.scrollOffset + 1}/${highlightedDiffLines().length}`}
          </text>
          {props.totalChunks > 0 && props.currentChunk >= 0 && (
            <text style={{ fg: "#d29922" }}> | Chunk {props.currentChunk + 1}/{props.totalChunks}</text>
          )}
        </box>
      </box>

      {/* File content */}
      <Show
        when={!props.file.isBinary && (viewMode() === "full" ? highlightedFileLines().length > 0 : highlightedDiffLines().length > 0)}
        fallback={
          <box
            style={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#0d1117",
            }}
          >
            <text style={{ fg: "#8b949e" }}>
              {props.file.isBinary ? "Binary file - cannot display diff" : "No diff available for this file"}
            </text>
          </box>
        }
      >
        <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: "#0d1117" }}>
          <Index each={visibleRows()}>
            {(item) => {
              const lineBg = () => props.showLineBg !== false

              const outerBg = () => item().isAdded && lineBg()
                ? "#1a2f1a"
                : item().isRemoved && lineBg()
                  ? "#2f1a1a"
                  : item().isHeader
                    ? "#21262d"
                    : "#0d1117"

              const gutterBg = () => item().isAdded
                ? "#1a2f1a"
                : item().isRemoved
                  ? "#2f1a1a"
                  : item().isHeader
                    ? "#21262d"
                    : "#161b22"

              const lineNumberFg = () => item().isHeader
                ? "#8b949e"
                : item().isAdded
                  ? "#3fb950"
                  : item().isRemoved
                    ? "#f85149"
                    : "#484f58"

              const indicatorFg = () => item().isHeader
                ? "#d29922"
                : item().isAdded
                  ? "#3fb950"
                  : item().isRemoved
                    ? "#f85149"
                    : "#0d1117"

              const lineNumberText = () => {
                const num = item().lineNumber
                if (num === null) return ""
                return num.toString().padStart(lineNumberWidth() - 1, " ")
              }

              return (
                <box
                  style={{
                    flexDirection: "row",
                    backgroundColor: outerBg(),
                    flexShrink: 0,
                  }}
                >
                  {/* Line number */}
                  <box
                    style={{
                      width: lineNumberWidth(),
                      backgroundColor: gutterBg(),
                    }}
                  >
                    <text style={{ fg: lineNumberFg() }}>
                      {lineNumberText()}
                    </text>
                  </box>
                  {/* Change indicator */}
                  <box
                    style={{
                      width: 1,
                      backgroundColor: outerBg(),
                    }}
                  >
                    <text style={{ fg: indicatorFg() }}>
                      {item().changeIndicator ?? " "}
                    </text>
                  </box>
                  {/* Content with syntax highlighting */}
                  <text
                    style={{
                      width: contentWidth(),
                      flexShrink: 0,
                      wrapMode: "none",
                    }}
                  >
                    <Index each={item().tokens}>
                      {(token) => (
                        <span
                          style={{
                            fg: item().isHeader ? "#8b949e" : token().color,
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
