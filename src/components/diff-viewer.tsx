import { createMemo, Show } from "solid-js"
import { SyntaxStyle, RGBA } from "@opentui/core"
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

// Get filetype from file extension
function getFiletype(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase()
  const filetypeMap: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    sql: "sql",
    graphql: "graphql",
    vue: "vue",
    svelte: "svelte",
    lock: "json",
  }
  return ext ? filetypeMap[ext] : undefined
}

// Create a GitHub-dark inspired syntax style
const syntaxStyle = SyntaxStyle.fromStyles({
  keyword: { fg: RGBA.fromHex("#ff7b72") },
  "keyword.import": { fg: RGBA.fromHex("#ff7b72") },
  "keyword.export": { fg: RGBA.fromHex("#ff7b72") },
  string: { fg: RGBA.fromHex("#a5d6ff") },
  "string.special": { fg: RGBA.fromHex("#a5d6ff") },
  comment: { fg: RGBA.fromHex("#8b949e"), italic: true },
  number: { fg: RGBA.fromHex("#79c0ff") },
  boolean: { fg: RGBA.fromHex("#79c0ff") },
  "function": { fg: RGBA.fromHex("#d2a8ff") },
  "function.call": { fg: RGBA.fromHex("#d2a8ff") },
  "function.method": { fg: RGBA.fromHex("#d2a8ff") },
  type: { fg: RGBA.fromHex("#ffa657") },
  "type.builtin": { fg: RGBA.fromHex("#ffa657") },
  variable: { fg: RGBA.fromHex("#e6edf3") },
  "variable.builtin": { fg: RGBA.fromHex("#79c0ff") },
  property: { fg: RGBA.fromHex("#79c0ff") },
  operator: { fg: RGBA.fromHex("#ff7b72") },
  punctuation: { fg: RGBA.fromHex("#e6edf3") },
  "punctuation.bracket": { fg: RGBA.fromHex("#e6edf3") },
  "punctuation.delimiter": { fg: RGBA.fromHex("#e6edf3") },
  tag: { fg: RGBA.fromHex("#7ee787") },
  attribute: { fg: RGBA.fromHex("#79c0ff") },
  constant: { fg: RGBA.fromHex("#79c0ff") },
  "markup.heading": { fg: RGBA.fromHex("#58a6ff"), bold: true },
  "markup.bold": { bold: true },
  "markup.italic": { italic: true },
  "markup.link": { fg: RGBA.fromHex("#58a6ff"), underline: true },
  "markup.raw": { fg: RGBA.fromHex("#a5d6ff") },
  default: { fg: RGBA.fromHex("#e6edf3") },
})

export function DiffViewer(props: DiffViewerProps) {
  const filetype = createMemo(() => getFiletype(props.file.path))
  
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
      
      {/* Diff content with syntax highlighting */}
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
            filetype={filetype()}
            syntaxStyle={syntaxStyle}
            view="unified"
            showLineNumbers={true}
            // Subtle background colors - almost transparent
            addedBg="#0d1117"
            removedBg="#0d1117"
            contextBg="#0d1117"
            // Very subtle content highlights
            addedContentBg="#0f1a0f"
            removedContentBg="#1a0f0f"
            contextContentBg="#0d1117"
            // Line number backgrounds - subtle indication
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
