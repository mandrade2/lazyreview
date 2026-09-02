import { th } from "../utils/theme"
import { For, createMemo } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import type { CommitInfo } from "../utils/git"

interface CommitListProps {
  commits: CommitInfo[]
  selectedIndex: number
  focused: boolean
  width: number
  reservedBottom?: number
  searchQuery?: string
}

const dateColumnWidth = 13

// Renders text with case-insensitive matches of `query` highlighted.
function HighlightedText(props: {
  text: string
  query: string | undefined
  baseFg: string
  highlightFg: string
}) {
  const segments = createMemo(() => {
    const query = (props.query ?? "").trim()
    const text = props.text

    if (!query) {
      return [{ text, match: false }]
    }

    const result: Array<{ text: string; match: boolean }> = []
    const lower = text.toLowerCase()
    const queryLower = query.toLowerCase()
    let i = 0
    while (i < text.length) {
      const idx = lower.indexOf(queryLower, i)
      if (idx === -1) {
        result.push({ text: text.slice(i), match: false })
        break
      }
      if (idx > i) {
        result.push({ text: text.slice(i, idx), match: false })
      }
      result.push({ text: text.slice(idx, idx + query.length), match: true })
      i = idx + query.length
    }
    return result
  })

  return (
    <>
      <For each={segments()}>
        {(segment) => (
          <text style={{ fg: segment.match ? props.highlightFg : props.baseFg }}>{segment.text}</text>
        )}
      </For>
    </>
  )
}

export function CommitList(props: CommitListProps) {
  const dimensions = useTerminalDimensions()
  
  // Calculate visible height (terminal height - header - panel header - status bar)
  const visibleHeight = createMemo(() => dimensions().height - 4 - (props.reservedBottom ?? 0))
  
  // Calculate scroll offset to keep selected item visible
  const scrollOffset = createMemo(() => {
    const height = visibleHeight()
    const selected = props.selectedIndex
    
    // Keep selected item in view with some context
    if (selected < height) {
      return 0
    }
    // Keep a few items visible above the selection
    return Math.max(0, selected - Math.floor(height / 2))
  })
  
  // Get visible commits based on scroll offset
  const visibleCommits = createMemo(() => {
    const start = scrollOffset()
    const end = start + visibleHeight()
    return props.commits.slice(start, end).map((commit, i) => ({
      commit,
      actualIndex: start + i,
    }))
  })

  // Calculate max hash length for alignment
  const maxHashLength = createMemo(() => {
    return Math.max(...props.commits.map(c => c.shortHash.length), 7)
  })

  // Reserve space for the date column so messages can't push it off-screen
  const messageMaxWidth = createMemo(() => {
    const padding = 2
    const hashWidth = maxHashLength() + 1
    return Math.max(10, props.width - padding - hashWidth - dateColumnWidth)
  })
   
  return (
    <box
      style={{
        flexGrow: 1,
        flexDirection: "column",
      }}
    >
      <For each={visibleCommits()}>
        {({ commit, actualIndex }) => {
          const isSelected = () => actualIndex === props.selectedIndex
          
          return (
            <box
              style={{
                height: 1,
                paddingLeft: 1,
                paddingRight: 1,
                backgroundColor: isSelected()
                  ? props.focused ? th("#388bfd26") : th("#30363d")
                  : "transparent",
                flexDirection: "row",
              }}
            >
              <box style={{ width: maxHashLength() + 1, flexDirection: "row" }}>
                <HighlightedText
                  text={commit.shortHash}
                  query={props.searchQuery}
                  baseFg={th("#58a6ff")}
                  highlightFg={th("#d29922")}
                />
              </box>
              <HighlightedText
                text={truncateMessage(commit.message, messageMaxWidth())}
                query={props.searchQuery}
                baseFg={isSelected() ? th("#e6edf3") : th("#8b949e")}
                highlightFg={th("#d29922")}
              />
              <box style={{ flexGrow: 1 }} />
              <box style={{ width: dateColumnWidth }}>
                <text style={{ fg: th("#6e7681") }}>{formatDate(commit.date, dateColumnWidth)}</text>
              </box>
            </box>
          )
        }}
      </For>
    </box>
  )
}

function truncateMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message
  }
  return message.substring(0, maxLength - 1) + "…"
}

function formatDate(date: string, width: number): string {
  if (date.length >= width) {
    return date.slice(0, width)
  }
  return date.padStart(width)
}
