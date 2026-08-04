import { Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"

interface CommitDialogProps {
  listNumber: number
  fileCount: number
  message: string
  error: string | null
  committing: boolean
}

export function CommitDialog(props: CommitDialogProps) {
  const dimensions = useTerminalDimensions()
  const dialogWidth = () => Math.min(90, Math.max(20, dimensions().width - 4))
  const promptText = () => `${props.message}_`

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
          backgroundColor: "#161b22",
          borderStyle: "rounded",
          borderColor: "#58a6ff",
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <box
          style={{
            height: 1,
            flexShrink: 0,
            backgroundColor: "#58a6ff",
            justifyContent: "center",
          }}
        >
          <text style={{ fg: "#ffffff" }}>
            <b>{`Commit list [${props.listNumber}] (${props.fileCount} files)`}</b>
          </text>
        </box>
        <box style={{ flexDirection: "column", paddingTop: 1, flexGrow: 1 }}>
          <text style={{ fg: "#e6edf3", wrapMode: "word" }}>{promptText()}</text>
          <Show when={props.error}>
            <text style={{ fg: "#f85149", wrapMode: "word" }}>{props.error}</text>
          </Show>
        </box>
        <box
          style={{
            height: 1,
            flexShrink: 0,
            backgroundColor: "#21262d",
            justifyContent: "center",
          }}
        >
          <text style={{ fg: "#8b949e" }}>
            {props.committing ? "Committing..." : "Enter: commit · Esc: cancel"}
          </text>
        </box>
      </box>
    </box>
  )
}
