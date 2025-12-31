import { createMemo, Show } from "solid-js"
import { type FileChange } from "../utils/git"

interface DiffViewerProps {
  file: FileChange
  focused: boolean
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

export function DiffViewer(props: DiffViewerProps) {
  // Build a proper unified diff format for the diff component
  const fullDiff = createMemo(() => {
    if (!props.file.diff) return ""
    
    // If it already has the diff header, use as-is
    if (props.file.diff.startsWith("diff --git") || props.file.diff.startsWith("@@")) {
      // Add file headers if missing
      if (props.file.diff.startsWith("@@")) {
        return `--- a/${props.file.path}\n+++ b/${props.file.path}\n${props.file.diff}`
      }
      return props.file.diff
    }
    
    return props.file.diff
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
        </box>
        <box style={{ flexDirection: "row" }}>
          <text style={{ fg: "#3fb950" }}>+{props.file.additions}</text>
          <text style={{ fg: "#f85149" }}> -{props.file.deletions}</text>
          <text style={{ fg: "#8b949e" }}> changes</text>
        </box>
      </box>
      
      {/* Diff content */}
      <Show
        when={fullDiff()}
        fallback={
          <box
            style={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#0d1117",
            }}
          >
            <text style={{ fg: "#8b949e" }}>No diff available for this file</text>
          </box>
        }
      >
        <scrollbox
          focused={props.focused}
          style={{
            flexGrow: 1,
            backgroundColor: "#0d1117",
          }}
        >
          <diff
            diff={fullDiff()}
            view="unified"
            showLineNumbers={true}
            // Subtle background colors
            addedBg="#0d1117"
            removedBg="#0d1117"
            contextBg="#0d1117"
            // Very subtle content highlights
            addedContentBg="#0f1a0f"
            removedContentBg="#1a0f0f"
            contextContentBg="#0d1117"
            // Line number backgrounds
            addedLineNumberBg="#0f1a0f"
            removedLineNumberBg="#1a0f0f"
            lineNumberBg="#161b22"
            lineNumberFg="#484f58"
            // Sign colors (the +/- indicators)
            addedSignColor="#3fb950"
            removedSignColor="#f85149"
            fg="#e6edf3"
          />
        </scrollbox>
      </Show>
    </box>
  )
}
