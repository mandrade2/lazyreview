import { For, createMemo } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import type { CommitInfo } from "../utils/git"

interface CommitListProps {
  commits: CommitInfo[]
  selectedIndex: number
  focused: boolean
}

export function CommitList(props: CommitListProps) {
  const dimensions = useTerminalDimensions()
  
  // Calculate visible height (terminal height - header - panel header - status bar)
  const visibleHeight = createMemo(() => dimensions().height - 4)
  
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
                  ? props.focused ? "#388bfd26" : "#30363d"
                  : "transparent",
                flexDirection: "row",
              }}
            >
              <text style={{ fg: "#58a6ff" }}>{commit.shortHash} </text>
              <text style={{ fg: isSelected() ? "#e6edf3" : "#8b949e" }}>
                {truncateMessage(commit.message, 40)}
              </text>
              <box style={{ flexGrow: 1 }} />
              <text style={{ fg: "#6e7681" }}>{commit.date}</text>
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
  return message.substring(0, maxLength - 1) + "..."
}
