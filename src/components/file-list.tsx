import { For, Show, createMemo } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import type { FileChange } from "../utils/git"

interface FileListProps {
  toReviewFiles: FileChange[]
  reviewedFiles: FileChange[]
  selectedIndex: number
  focused: boolean
  width: number
}

function getStatusIcon(status: FileChange["status"]): string {
  switch (status) {
    case "added": return "A"
    case "modified": return "M"
    case "deleted": return "D"
    case "renamed": return "R"
    case "untracked": return "?"
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

function truncateMiddle(value: string, maxLength: number): string {
  if (maxLength <= 0) return ""
  if (value.length <= maxLength) return value
  if (maxLength <= 3) return ".".repeat(maxLength)

  const visible = maxLength - 3
  const startLength = Math.ceil(visible / 2)
  const endLength = Math.floor(visible / 2)
  return `${value.slice(0, startLength)}...${value.slice(-endLength)}`
}

function formatPath(path: string, maxLength: number): { directory: string; fileName: string } {
  const parts = path.split("/")
  const fileName = parts.pop() ?? path

  if (parts.length === 0) {
    return { directory: "", fileName: truncateMiddle(fileName, maxLength) }
  }

  if (path.length <= maxLength) {
    return {
      directory: parts.join("/") + "/",
      fileName,
    }
  }

  if (fileName.length >= maxLength) {
    return { directory: "", fileName: truncateMiddle(fileName, maxLength) }
  }

  let visiblePath = fileName
  let startIndex = parts.length

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const candidate = `${parts[i]}/${visiblePath}`
    const displayed = i > 0 ? `.../${candidate}` : candidate

    if (displayed.length > maxLength) {
      break
    }

    visiblePath = candidate
    startIndex = i
  }

  if (startIndex > 0) {
    const visibleParts = visiblePath.split("/")
    return {
      directory: ".../" + visibleParts.slice(0, -1).join("/") + "/",
      fileName: visibleParts[visibleParts.length - 1] ?? fileName,
    }
  }

  return {
    directory: parts.join("/") + "/",
    fileName,
  }
}

function FileRow(props: {
  file: FileChange
  isSelected: boolean
  focused: boolean
  width: number
}) {
  const statusIcon = getStatusIcon(props.file.status)
  const statusColor = getStatusColor(props.file.status)
  const additionsText = props.file.additions > 0 ? ` +${props.file.additions}` : ""
  const deletionsText = props.file.deletions > 0 ? ` -${props.file.deletions}` : ""
  const statsLength = additionsText.length + deletionsText.length

  const padding = 2
  const iconLength = 2
  const pathWidth = Math.max(0, props.width - padding - iconLength - statsLength)
  const { directory, fileName } = formatPath(props.file.path, pathWidth)

  return (
    <box
      style={{
        height: 1,
        paddingLeft: 1,
        paddingRight: 1,
        backgroundColor: props.isSelected
          ? props.focused ? "#388bfd26" : "#30363d"
          : "transparent",
        flexDirection: "row",
      }}
    >
      <text style={{ fg: statusColor }}>{statusIcon} </text>
      <Show when={directory}>
        <text style={{ fg: "#8b949e" }}>{directory}</text>
      </Show>
      <text style={{ fg: props.isSelected ? "#58a6ff" : "#e6edf3" }}>{fileName}</text>
      <box style={{ flexGrow: 1 }} />
      <Show when={props.file.additions > 0}>
        <text style={{ fg: "#3fb950" }}>{additionsText}</text>
      </Show>
      <Show when={props.file.deletions > 0}>
        <text style={{ fg: "#f85149" }}>{deletionsText}</text>
      </Show>
    </box>
  )
}

export function FileList(props: FileListProps) {
  const dimensions = useTerminalDimensions()

  // Calculate visible height (terminal height - app header - panel header - status bar)
  const visibleHeight = createMemo(() => dimensions().height - 5)

  const hasToReview = () => props.toReviewFiles.length > 0
  const hasReviewed = () => props.reviewedFiles.length > 0
  const hasAnyFiles = () => hasToReview() || hasReviewed()

  const sectionHeight = createMemo(() => {
    return Math.max(3, Math.floor(visibleHeight() / 2))
  })

  const toReviewHeight = createMemo(() => {
    if (!hasAnyFiles()) return 0
    return sectionHeight()
  })

  const reviewedHeight = createMemo(() => {
    if (!hasAnyFiles()) return 0
    return visibleHeight() - sectionHeight()
  })

  const toReviewScrollOffset = createMemo(() => {
    const height = toReviewHeight() - 1 // minus header
    const selected = props.selectedIndex < props.toReviewFiles.length ? props.selectedIndex : -1
    if (selected < 0 || height <= 0) return 0
    if (selected < height) return 0
    return Math.max(0, selected - height + 1)
  })

  const reviewedScrollOffset = createMemo(() => {
    const height = reviewedHeight() - 1 // minus header
    const reviewedSelected = props.selectedIndex - props.toReviewFiles.length
    const selected = reviewedSelected >= 0 ? reviewedSelected : -1
    if (selected < 0 || height <= 0) return 0
    if (selected < height) return 0
    return Math.max(0, selected - height + 1)
  })

  const visibleToReviewFiles = createMemo(() => {
    const start = toReviewScrollOffset()
    const end = start + Math.max(0, toReviewHeight() - 1)
    return props.toReviewFiles.slice(start, end).map((file, i) => ({
      file,
      actualIndex: start + i,
    }))
  })

  const visibleReviewedFiles = createMemo(() => {
    const start = reviewedScrollOffset()
    const end = start + Math.max(0, reviewedHeight() - 1)
    return props.reviewedFiles.slice(start, end).map((file, i) => ({
      file,
      actualIndex: start + i,
    }))
  })

  const isToReviewSelected = (index: number) => index === props.selectedIndex
  const isReviewedSelected = (index: number) => props.toReviewFiles.length + index === props.selectedIndex

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <Show when={!hasAnyFiles()}>
        <box style={{ padding: 1 }}>
          <text style={{ fg: "#8b949e" }}>No changes</text>
        </box>
      </Show>

      {/* To Review section */}
      <Show when={hasAnyFiles()}>
        <box
          style={{
            height: 1,
            paddingLeft: 1,
            paddingRight: 1,
            backgroundColor: "#21262d",
            flexShrink: 0,
            flexDirection: "row",
          }}
        >
          <text style={{ fg: "#f0883e" }}><b>To Review</b></text>
          <text style={{ fg: "#8b949e" }}> ({props.toReviewFiles.length})</text>
        </box>
        <box
          style={{
            flexDirection: "column",
            height: Math.max(0, toReviewHeight() - 1),
            flexShrink: 0,
          }}
        >
          <Show
            when={hasToReview()}
            fallback={
              <box style={{ paddingLeft: 1, paddingRight: 1, paddingTop: 1 }}>
                <text style={{ fg: "#8b949e" }}>None</text>
              </box>
            }
          >
            <For each={visibleToReviewFiles()}>
              {({ file, actualIndex }) => (
                <FileRow
                  file={file}
                  isSelected={isToReviewSelected(actualIndex)}
                  focused={props.focused}
                  width={props.width}
                />
              )}
            </For>
          </Show>
        </box>
      </Show>

      {/* Already Reviewed section */}
      <Show when={hasAnyFiles()}>
        <box
          style={{
            height: 1,
            paddingLeft: 1,
            paddingRight: 1,
            backgroundColor: "#21262d",
            flexShrink: 0,
            flexDirection: "row",
          }}
        >
          <text style={{ fg: "#f0883e" }}><b>Already Reviewed</b></text>
          <text style={{ fg: "#8b949e" }}> ({props.reviewedFiles.length})</text>
        </box>
        <box
          style={{
            flexDirection: "column",
            height: Math.max(0, reviewedHeight() - 1),
            flexShrink: 0,
          }}
        >
          <Show
            when={hasReviewed()}
            fallback={
              <box style={{ paddingLeft: 1, paddingRight: 1, paddingTop: 1 }}>
                <text style={{ fg: "#8b949e" }}>None</text>
              </box>
            }
          >
            <For each={visibleReviewedFiles()}>
              {({ file, actualIndex }) => (
                <FileRow
                  file={file}
                  isSelected={isReviewedSelected(actualIndex)}
                  focused={props.focused}
                  width={props.width}
                />
              )}
            </For>
          </Show>
        </box>
      </Show>
    </box>
  )
}
