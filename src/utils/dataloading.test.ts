import { test, expect, describe } from "bun:test"
import { estimateWrappedRows, computeWrappedMaxScroll, highlightFile, clearHighlightCache } from "./dataloading"

describe("estimateWrappedRows", () => {
  test("returns 1 for empty or short lines", () => {
    expect(estimateWrappedRows(0, 10)).toBe(1)
    expect(estimateWrappedRows(5, 10)).toBe(1)
    expect(estimateWrappedRows(10, 10)).toBe(1)
  })

  test("wraps long lines across multiple rows", () => {
    expect(estimateWrappedRows(11, 10)).toBe(2)
    expect(estimateWrappedRows(20, 10)).toBe(2)
    expect(estimateWrappedRows(21, 10)).toBe(3)
  })

  test("treats non-positive width as single row", () => {
    expect(estimateWrappedRows(100, 0)).toBe(1)
    expect(estimateWrappedRows(100, -5)).toBe(1)
  })
})

describe("computeWrappedMaxScroll", () => {
  test("returns 0 for empty input", () => {
    expect(computeWrappedMaxScroll([], 80, 10)).toBe(0)
  })

  test("returns 0 for non-positive viewport", () => {
    expect(computeWrappedMaxScroll(["a"], 80, 0)).toBe(0)
    expect(computeWrappedMaxScroll(["a"], 80, -5)).toBe(0)
  })

  test("matches unwrapped max scroll", () => {
    const lines = Array.from({ length: 10 }, () => "short")
    expect(computeWrappedMaxScroll(lines, 80, 5)).toBe(5)
  })

  test("increases max scroll when lines wrap", () => {
    const lines = Array.from({ length: 5 }, () => "0123456789")
    // 5 lines * 2 rows each = 10 display rows; viewport 5 -> start at line 3
    expect(computeWrappedMaxScroll(lines, 5, 5)).toBe(3)
  })

  test("handles a final line that is taller than the viewport", () => {
    const lines = ["short", "short", "01234567890123456789"]
    // row counts: 1, 1, 4; viewport 5 -> start at line 1
    expect(computeWrappedMaxScroll(lines, 5, 5)).toBe(1)
  })

  test("allows scrolling to the only line even when it exceeds viewport", () => {
    expect(computeWrappedMaxScroll(["01234567890123456789"], 5, 5)).toBe(0)
  })

  test("treats non-positive content width as single row per line", () => {
    const lines = ["a", "b", "c"]
    expect(computeWrappedMaxScroll(lines, 0, 5)).toBe(0)
  })

  test("accepts objects with content property", () => {
    const lines = [{ content: "0123456789" }, { content: "0123456789" }]
    expect(computeWrappedMaxScroll(lines, 5, 2)).toBe(1)
  })
})

describe("highlightFile", () => {
  test("returns colored tokens for TypeScript TSX files", async () => {
    clearHighlightCache()
    const content = `import React from "react"\nexport function App() { return <div>Hello</div> }\n`
    const result = await highlightFile(content, "src/components/App.tsx")
    expect(result.length).toBeGreaterThan(0)
    const colors = [...new Set(result.flat().map((token) => token.color))]
    expect(colors.length).toBeGreaterThan(1)
  })
})
