import { th } from "../utils/theme"
import { For, Show, createMemo } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import type { BranchInfo } from "../utils/git"

interface BranchListProps {
  branches: BranchInfo[]
  selectedIndex: number  // Index into selectable (non-current) branches
  focused: boolean
  width: number
  reservedBottom?: number
}

const hashColumnWidth = 8
const dateColumnWidth = 13

export function BranchList(props: BranchListProps) {
  const dimensions = useTerminalDimensions()

  // Calculate visible height (terminal height - header - panel header - status bar)
  const visibleHeight = createMemo(() => dimensions().height - 4 - (props.reservedBottom ?? 0))

  // Create a mapping of which selectable index each branch corresponds to
  // Current branch gets -1 (not selectable)
  const selectableIndexMap = createMemo(() => {
    const map: number[] = []
    let selectableCount = 0
    for (const branch of props.branches) {
      if (branch.isCurrent) {
        map.push(-1)
      } else {
        map.push(selectableCount)
        selectableCount++
      }
    }
    return map
  })

  // Calculate scroll offset to keep selected item visible
  const scrollOffset = createMemo(() => {
    const height = visibleHeight()
    const selected = props.selectedIndex

    if (selected < height) {
      return 0
    }
    return Math.max(0, selected - Math.floor(height / 2))
  })

  // Get visible branches based on scroll offset
  const visibleBranches = createMemo(() => {
    const start = scrollOffset()
    const end = start + visibleHeight()
    return props.branches.slice(start, end).map((branch, i) => ({
      branch,
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
      <For each={visibleBranches()}>
        {({ branch, actualIndex }) => {
          const selectableIdx = () => selectableIndexMap()[actualIndex]
          const isSelected = () => selectableIdx() === props.selectedIndex
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
                <Show when={branch.isCurrent}>
                  <text style={{ fg: metaColor }}>(c) </text>
                </Show>
                <text style={{ fg: th("#e6edf3") }}>
                  {truncateBranchName(branch.name, Math.max(0, Math.floor(props.width * 0.33) - 2))}
                </text>
              </box>
              <box style={{ width: hashColumnWidth, flexShrink: 0 }}>
                <text style={{ fg: hashColor }}>{formatHash(branch.shortHash, hashColumnWidth)}</text>
              </box>
              <box style={{ width: 1 }} />
              <box style={{ flexGrow: 1, flexShrink: 1 }}>
                <text style={{ fg: metaColor }}>{truncateMessage(branch.message, 48)}</text>
              </box>
              <box style={{ width: dateColumnWidth, flexShrink: 0 }}>
                <text style={{ fg: metaColor }}>{formatDate(branch.date, dateColumnWidth)}</text>
              </box>
            </box>
          )
        }}
      </For>
    </box>
  )
}

function truncateBranchName(name: string, maxLength: number): string {
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
