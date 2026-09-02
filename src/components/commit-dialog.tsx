import { th } from "../utils/theme"
import { Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"

interface CommitDialogProps {
  listNumber: number
  fileCount: number
  message: string
  error: string | null
  committing: boolean
  branch: string
}

function truncate(str: string, maxLength: number): string {
  if (maxLength <= 0) return ""
  if (str.length <= maxLength) return str
  return str.slice(0, Math.max(0, maxLength - 3)) + "..."
}

export function CommitDialog(props: CommitDialogProps) {
  const dimensions = useTerminalDimensions()
  const dialogWidth = () => Math.min(90, Math.max(20, dimensions().width - 4))
  const promptText = () => `${props.message}_`
  const title = () =>
    truncate(
      `Commit to ${props.branch} · list [${props.listNumber}] (${props.fileCount} files)`,
      dialogWidth() - 2,
    )

  return (
    <box
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <box
        style={{
          width: dialogWidth(),
          height: 10,
          flexDirection: "column",
          backgroundColor: th("#161b22"),
          borderStyle: "rounded",
          borderColor: th("#58a6ff"),
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <box
          style={{
            height: 1,
            flexShrink: 0,
            backgroundColor: th("#58a6ff"),
            justifyContent: "center",
          }}
        >
          <text style={{ fg: th("#ffffff") }}>
            <b>{title()}</b>
          </text>
        </box>
        <box style={{ flexDirection: "column", paddingTop: 1, flexGrow: 1 }}>
          <text style={{ fg: th("#e6edf3"), wrapMode: "word" }}>{promptText()}</text>
          <Show when={props.error}>
            <text style={{ fg: th("#f85149"), wrapMode: "word" }}>{props.error}</text>
          </Show>
        </box>
        <box
          style={{
            height: 1,
            flexShrink: 0,
            backgroundColor: th("#21262d"),
            justifyContent: "center",
          }}
        >
          <text style={{ fg: th("#8b949e") }}>
            {props.committing ? "Committing..." : "Enter: commit · Esc: cancel"}
          </text>
        </box>
      </box>
    </box>
  )
}
