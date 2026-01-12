import type { HighlightedLine, HighlightedToken } from "./syntax"

/**
 * Apply markdown-aware styling to highlighted lines.
 * This preserves the raw markdown tokens while adding font styles
 * (bold, italic, dim) based on markdown semantics.
 */
export function applyMarkdownStyles(lines: HighlightedLine[]): HighlightedLine[] {
  // First pass: identify and format tables
  const formattedLines = formatMarkdownTables(lines)

  let inCodeBlock = false

  return formattedLines.map((tokens) => {
    // Reconstruct the full line text for pattern matching
    const lineText = tokens.map(t => t.content).join("")

    // Track code block state
    if (lineText.match(/^```/)) {
      inCodeBlock = !inCodeBlock
      // Code fence markers are dimmed
      return tokens.map(t => ({ ...t, dim: true }))
    }

    // Inside code blocks, apply dim styling
    if (inCodeBlock) {
      return tokens.map(t => ({ ...t, dim: true }))
    }

    // Headers: # to ###### at start of line
    if (lineText.match(/^#{1,6}\s/)) {
      return tokens.map(t => ({ ...t, bold: true }))
    }

    // Blockquotes: > at start of line
    if (lineText.match(/^>\s/)) {
      return tokens.map(t => ({ ...t, dim: true }))
    }

    // Horizontal rules: ---, ***, ___
    if (lineText.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      return tokens.map(t => ({ ...t, dim: true }))
    }

    // Table rows (formatted) - return as-is, they're already styled
    if (isTableRow(lineText)) {
      return tokens
    }

    // For inline patterns, we need to process tokens more carefully
    return applyInlineStyles(tokens, lineText)
  })
}

/**
 * Check if a line is a markdown table row (starts with | or contains | delimiters)
 */
function isTableRow(lineText: string): boolean {
  // Table rows start with | or have | somewhere in the middle
  return /^\s*\|/.test(lineText) || /\|.*\|/.test(lineText)
}

/**
 * Check if a line is a table separator (like |---|---|)
 */
function isTableSeparator(lineText: string): boolean {
  return /^\s*\|?\s*[-:]+\s*(\|\s*[-:]+\s*)+\|?\s*$/.test(lineText)
}

/**
 * Parse a table row into cells
 */
function parseTableCells(lineText: string): string[] {
  // Remove leading/trailing pipes and split by |
  const trimmed = lineText.replace(/^\s*\|/, "").replace(/\|\s*$/, "")
  return trimmed.split("|").map(cell => cell.trim())
}

/**
 * Format markdown tables with proper column alignment
 */
function formatMarkdownTables(lines: HighlightedLine[]): HighlightedLine[] {
  const result: HighlightedLine[] = []
  let i = 0

  while (i < lines.length) {
    const currentLine = lines[i]
    if (!currentLine) {
      i++
      continue
    }
    const lineText = currentLine.map(t => t.content).join("")

    // Check if this starts a table
    if (isTableRow(lineText)) {
      // Find the extent of the table
      const tableStart = i
      let tableEnd = i

      while (tableEnd < lines.length) {
        const checkLine = lines[tableEnd]
        if (!checkLine) break
        const checkText = checkLine.map(t => t.content).join("")
        if (!isTableRow(checkText) && checkText.trim() !== "") {
          break
        }
        if (checkText.trim() === "") {
          break
        }
        tableEnd++
      }

      // Format the table if we found multiple rows
      if (tableEnd > tableStart) {
        const tableLines = lines.slice(tableStart, tableEnd)
        const formattedTable = formatTable(tableLines)
        result.push(...formattedTable)
        i = tableEnd
        continue
      }
    }

    result.push(currentLine)
    i++
  }

  return result
}

// Default text color matching the app theme
const DEFAULT_COLOR = "#e6edf3"

/**
 * Format a table block with proper column alignment
 */
function formatTable(tableLines: HighlightedLine[]): HighlightedLine[] {
  // Parse all rows to find column widths
  const rows: string[][] = []
  const lineTexts: string[] = []

  for (const tokens of tableLines) {
    const lineText = tokens.map(t => t.content).join("")
    lineTexts.push(lineText)
    rows.push(parseTableCells(lineText))
  }

  // Find max columns and max width per column
  const maxColumns = Math.max(...rows.map(r => r.length))
  const columnWidths: number[] = new Array(maxColumns).fill(0)

  for (const row of rows) {
    for (let col = 0; col < row.length; col++) {
      const cell = row[col] ?? ""
      // For separator rows, minimum width is 3 (---)
      const width = isTableSeparator(cell) ? Math.max(3, cell.length) : cell.length
      columnWidths[col] = Math.max(columnWidths[col] ?? 0, width)
    }
  }

  // Rebuild each line with proper spacing
  return tableLines.map((tokens, rowIndex) => {
    const lineText = lineTexts[rowIndex] ?? ""
    const cells = rows[rowIndex] ?? []
    const isSeparator = isTableSeparator(lineText)

    // Build the formatted line
    let formattedLine = "|"
    for (let col = 0; col < maxColumns; col++) {
      const cell = cells[col] ?? ""
      const width = columnWidths[col] ?? 0

      if (isSeparator) {
        // For separator, fill with dashes, preserving alignment markers
        const hasLeftColon = cell.startsWith(":")
        const hasRightColon = cell.endsWith(":")
        const dashCount = width - (hasLeftColon ? 1 : 0) - (hasRightColon ? 1 : 0)
        formattedLine += " " + (hasLeftColon ? ":" : "") + "-".repeat(dashCount) + (hasRightColon ? ":" : "") + " |"
      } else {
        // Regular cell - pad with spaces
        formattedLine += " " + cell.padEnd(width) + " |"
      }
    }

    // Use consistent default color for all table rows
    return [{ content: formattedLine, color: DEFAULT_COLOR }]
  })
}

/**
 * Apply inline markdown styles (bold, italic, code) to tokens.
 * This handles patterns like **bold**, *italic*, and `code`.
 */
function applyInlineStyles(tokens: HighlightedToken[], lineText: string): HighlightedLine {
  // Find ranges for inline patterns
  const boldRanges = findPatternRanges(lineText, /\*\*[^*]+\*\*|__[^_]+__/g)
  const italicRanges = findPatternRanges(lineText, /(?<!\*)\*(?!\*)[^*]+\*(?!\*)|(?<!_)_(?!_)[^_]+_(?!_)/g)
  const codeRanges = findPatternRanges(lineText, /`[^`]+`/g)

  // Apply styles based on character position
  let charIndex = 0

  return tokens.map((token) => {
    const tokenStart = charIndex
    const tokenEnd = charIndex + token.content.length
    charIndex = tokenEnd

    let bold = token.bold
    let italic = token.italic
    let dim = token.dim

    // Check if this token falls within any pattern range
    for (const range of boldRanges) {
      if (rangesOverlap(tokenStart, tokenEnd, range.start, range.end)) {
        bold = true
      }
    }

    for (const range of italicRanges) {
      if (rangesOverlap(tokenStart, tokenEnd, range.start, range.end)) {
        italic = true
      }
    }

    for (const range of codeRanges) {
      if (rangesOverlap(tokenStart, tokenEnd, range.start, range.end)) {
        dim = true
      }
    }

    // Only create a new object if we're adding styles
    if (bold || italic || dim) {
      return { ...token, bold, italic, dim }
    }

    return token
  })
}

interface Range {
  start: number
  end: number
}

/**
 * Find all ranges in a string that match a pattern.
 */
function findPatternRanges(text: string, pattern: RegExp): Range[] {
  const ranges: Range[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  return ranges
}

/**
 * Check if two ranges overlap.
 */
function rangesOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && e1 > s2
}
