import { th } from "../utils/theme"
import { For, createMemo } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import type { TagInfo } from "../utils/git"

interface TagListProps {
  tags: TagInfo[]
  selectedIndex: number
  focused: boolean
  width: number
  reservedBottom?: number
}

const hashColumnWidth = 8
const dateColumnWidth = 13

export function TagList(props: TagListProps) {
  const dimensions = useTerminalDimensions()

  // Calculate visible height (terminal height - header - panel header - status bar)
  const visibleHeight = createMemo(() => dimensions().height - 4 - (props.reservedBottom ?? 0))

  // Calculate scroll offset to keep selected item visible
  const scrollOffset = createMemo(() => {
    const height = visibleHeight()
    const selected = props.selectedIndex

    if (selected < height) {
      return 0
    }
    return Math.max(0, selected - Math.floor(height / 2))
  })

  // Get visible tags based on scroll offset
  const visibleTags = createMemo(() => {
    const start = scrollOffset()
    const end = start + visibleHeight()
    return props.tags.slice(start, end).map((tag, i) => ({
      tag,
      actualIndex: start + i,
    }))
  })

  return (
    <box
      style={{
        flexGrow: 1,
        flexDirection: "column",
      }}
    >
      <For each={visibleTags()}>
        {({ tag, actualIndex }) => {
          const isSelected = () => actualIndex === props.selectedIndex
          const metaColor = isSelected() ? th("#8b949e") : th("#6e7681")
          const hashColor = th("#58a6ff")

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
              <box style={{ width: "33%", flexShrink: 0, flexDirection: "row" }}>
                <text style={{ fg: th("#e6edf3") }}>
                  {truncateTagName(tag.name, Math.max(0, Math.floor(props.width * 0.33) - 2))}
                </text>
              </box>
              <box style={{ width: hashColumnWidth, flexShrink: 0 }}>
                <text style={{ fg: hashColor }}>{formatHash(tag.shortHash, hashColumnWidth)}</text>
              </box>
              <box style={{ width: 1 }} />
              <box style={{ flexGrow: 1, flexShrink: 1 }}>
                <text style={{ fg: metaColor }}>{truncateMessage(tag.message, 48)}</text>
              </box>
              <box style={{ width: dateColumnWidth, flexShrink: 0 }}>
                <text style={{ fg: metaColor }}>{formatDate(tag.date, dateColumnWidth)}</text>
              </box>
            </box>
          )
        }}
      </For>
    </box>
  )
}

function truncateTagName(name: string, maxLength: number): string {
  if (name.length <= maxLength) {
    return name
  }
  return name.substring(0, maxLength - 1) + "…"
}

function truncateMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message
  }
  return message.substring(0, maxLength - 1) + "…"
}

function formatHash(hash: string, width: number): string {
  if (hash.length >= width) {
    return hash.slice(0, width)
  }
  return hash.padStart(width)
}

function formatDate(date: string, width: number): string {
  if (date.length >= width) {
    return date.slice(0, width)
  }
  return date.padStart(width)
}
