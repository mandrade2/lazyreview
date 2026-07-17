import type { CapturedFrame } from "./harness"

export function lineText(line: CapturedFrame["lines"][0]): string {
  return line.spans.map((span) => span.text).join("")
}

export function findLine(
  frame: CapturedFrame,
  predicate: (text: string) => boolean,
): CapturedFrame["lines"][0] | null {
  return frame.lines.find((line) => predicate(lineText(line))) ?? null
}

export function lineTextUpTo(
  line: CapturedFrame["lines"][0],
  column: number,
): string {
  let text = ""
  let col = 0
  for (const span of line.spans) {
    if (col >= column) break
    const take = Math.min(span.text.length, column - col)
    text += span.text.slice(0, take)
    col += span.width
  }
  return text
}

export function lineTextFrom(
  line: CapturedFrame["lines"][0],
  column: number,
): string {
  let text = ""
  let col = 0
  for (const span of line.spans) {
    if (col + span.width <= column) {
      col += span.width
      continue
    }
    if (col < column) {
      text += span.text.slice(column - col)
    } else {
      text += span.text
    }
    col += span.width
  }
  return text
}

export function getSpanBackground(
  span: CapturedFrame["lines"][0]["spans"][0],
): string {
  const [r, g, b] = span.bg.toInts()
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

export function getRowBackground(line: CapturedFrame["lines"][0]): string {
  const firstSpan = line.spans[0]
  return firstSpan ? getSpanBackground(firstSpan) : "transparent"
}

// Background of the first span at or past the given column. Useful when the
// frame is split into panels and only one side's background is relevant.
export function getRowBackgroundFrom(
  line: CapturedFrame["lines"][0],
  column: number,
): string {
  let col = 0
  for (const span of line.spans) {
    if (col + span.width > column) {
      return getSpanBackground(span)
    }
    col += span.width
  }
  return "transparent"
}

export interface FileListStats {
  status: string
  additions: number
  deletions: number
}

export function extractFileListStats(
  frame: CapturedFrame,
  fileName: string,
  sidebarWidth: number,
): FileListStats | null {
  const line = findLine(
    frame,
    (text) => text.includes(fileName) && !text.includes("["),
  )
  if (!line) return null

  const text = lineTextUpTo(line, sidebarWidth)
  const statusMatch = text.match(/^\s*([RAMD?C])\s+/)
  const additionsMatch = text.match(/\+(\d+)\b/)
  const deletionsMatch = text.match(/-(\d+)\b/)

  return {
    status: statusMatch?.[1] ?? "",
    additions: additionsMatch ? parseInt(additionsMatch[1] ?? "0", 10) : 0,
    deletions: deletionsMatch ? parseInt(deletionsMatch[1] ?? "0", 10) : 0,
  }
}

export interface DiffHeaderStats {
  additions: number
  deletions: number
}

export function extractDiffHeaderStats(
  frame: CapturedFrame,
  sidebarWidth: number,
): DiffHeaderStats | null {
  // Find the diff header path row by looking for a status label in the diff
  // panel. The stats row is immediately below it.
  const pathLine = frame.lines.find((line) => {
    const text = lineTextFrom(line, sidebarWidth)
    return (
      text.includes("[Added]") ||
      text.includes("[Modified]") ||
      text.includes("[Deleted]") ||
      text.includes("[Renamed]") ||
      text.includes("[Untracked]") ||
      text.includes("[Conflicted]")
    )
  })
  if (!pathLine) return null

  const lineIndex = frame.lines.indexOf(pathLine)
  if (lineIndex < 0 || lineIndex + 1 >= frame.lines.length) return null

  const statsLine = frame.lines[lineIndex + 1]
  if (!statsLine) return null
  const text = lineTextFrom(statsLine, sidebarWidth)

  const additionsMatch = text.match(/\+(\d+)/)
  const deletionsMatch = text.match(/-(\d+)/)

  return {
    additions: additionsMatch ? parseInt(additionsMatch[1] ?? "0", 10) : 0,
    deletions: deletionsMatch ? parseInt(deletionsMatch[1] ?? "0", 10) : 0,
  }
}

export function findLineWithContent(
  frame: CapturedFrame,
  content: string,
): CapturedFrame["lines"][0] | null {
  return findLine(frame, (text) => text.includes(content))
}

export interface LineNumberAndIndicator {
  lineNumber: number
  indicator: string
}

// Find all diff-panel rows that contain the given content, returning their
// rendered line number and change indicator. This is useful for asserting that
// removed lines appear with their old line number and are distinguished from
// added/context lines.
export function findLineNumbersWithContent(
  frame: CapturedFrame,
  content: string,
  sidebarWidth: number,
): LineNumberAndIndicator[] {
  const results: LineNumberAndIndicator[] = []
  for (const line of frame.lines) {
    const text = lineTextFrom(line, sidebarWidth)
    if (text.includes(content)) {
      const match = text.match(/^\s*(\d+)\s*([-+ ])/)
      if (match) {
        results.push({
          lineNumber: parseInt(match[1]!, 10),
          indicator: match[2]!,
        })
      }
    }
  }
  return results
}
