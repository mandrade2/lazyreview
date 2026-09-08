import { th } from "../utils/theme"
import { Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"

interface DiscardDialogProps {
  path: string
  branch: string
  error: string | null
  discarding: boolean
}

function truncate(str: string, maxLength: number): string {
  if (maxLength <= 0) return ""
  if (str.length <= maxLength) return str
  return str.slice(0, Math.max(0, maxLength - 3)) + "..."
}

export function DiscardDialog(props: DiscardDialogProps) {
  const dimensions = useTerminalDimensions()
  const dialogWidth = () => Math.min(80, Math.max(20, dimensions().width - 4))
  const message = () =>
    truncate(
      `Discard all changes to "${props.path}" on ${props.branch}? This cannot be undone.`,
      dialogWidth() - 4,
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
          height: 8,
          flexDirection: "column",
          backgroundColor: th("#161b22"),
          borderStyle: "rounded",
          borderColor: th("#f85149"),
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <box
          style={{
            height: 1,
            flexShrink: 0,
            backgroundColor: th("#f85149"),
            justifyContent: "center",
          }}
        >
          <text style={{ fg: th("#ffffff") }}>
            <b>Discard changes</b>
          </text>
        </box>
        <box style={{ flexDirection: "column", paddingTop: 1, flexGrow: 1 }}>
          <text style={{ fg: th("#e6edf3"), wrapMode: "word" }}>{message()}</text>
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
            {props.discarding ? "Discarding..." : "Enter/y: discard · Esc/n: cancel"}
          </text>
        </box>
      </box>
    </box>
  )
}
