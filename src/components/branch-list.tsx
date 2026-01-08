import { For, createMemo } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import type { BranchInfo } from "../utils/git"

interface BranchListProps {
  branches: BranchInfo[]
  selectedIndex: number  // Index into selectable (non-current) branches
  focused: boolean
}

export function BranchList(props: BranchListProps) {
  const dimensions = useTerminalDimensions()
  
  // Calculate visible height (terminal height - header - panel header - status bar)
  const visibleHeight = createMemo(() => dimensions().height - 4)
  
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
          
          // Current branch is grayed out and not selectable
          if (branch.isCurrent) {
            return (
              <box
                style={{
                  height: 1,
                  paddingLeft: 1,
                  paddingRight: 1,
                  backgroundColor: "transparent",
                  flexDirection: "row",
                }}
              >
                <text style={{ fg: "#6e7681" }}>
                  {branch.name} (current)
                </text>
              </box>
            )
          }
          
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
              <text style={{ fg: isSelected() ? "#58a6ff" : "#e6edf3" }}>
                {branch.name}
              </text>
            </box>
          )
        }}
      </For>
    </box>
  )
}
