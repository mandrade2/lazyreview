import { th } from "../utils/theme"
interface OpencodeDialogProps {
  prompt: string
}

export function OpencodeDialog(props: OpencodeDialogProps) {
  const dialogWidth = 90
  const promptText = () => `${props.prompt}_`

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
          width: dialogWidth,
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
            <b>OpenCode prompt</b>
          </text>
        </box>
        <box style={{ flexDirection: "column", paddingTop: 1, flexGrow: 1 }}>
          <text style={{ fg: th("#e6edf3"), wrapMode: "word" }}>{promptText()}</text>
        </box>
        <box
          style={{
            height: 1,
            flexShrink: 0,
            backgroundColor: th("#21262d"),
            justifyContent: "center",
          }}
        >
          <text style={{ fg: th("#8b949e") }}>Enter: send · Esc: cancel</text>
        </box>
      </box>
    </box>
  )
}
