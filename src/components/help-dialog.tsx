import { For } from "solid-js"

interface HelpDialogProps {
  onClose: () => void
}

const sections = [
  {
    title: "Navigation",
    keybinds: [
      { key: "j / ↓", desc: "Move down / scroll down" },
      { key: "k / ↑", desc: "Move up / scroll up" },
      { key: "g", desc: "Go to first item / top" },
      { key: "G", desc: "Go to last item / bottom" },
      { key: "Tab / h / l", desc: "Switch between panels" },
      { key: "Enter", desc: "Open diff view" },
      { key: "Esc", desc: "Go back to files panel" },
    ],
  },
  {
    title: "Scrolling (Diff)",
    keybinds: [
      { key: "Ctrl+d / Ctrl+u", desc: "Half page down / up" },
      { key: "Ctrl+f / Ctrl+b", desc: "Full page down / up" },
    ],
  },
  {
    title: "Actions",
    keybinds: [
      { key: "e", desc: "Open file in $EDITOR" },
      { key: "r", desc: "Refresh file list" },
      { key: "?", desc: "Toggle this help" },
      { key: "q / Ctrl+c", desc: "Quit" },
    ],
  },
]

export function HelpDialog(props: HelpDialogProps) {
  const dialogWidth = 50
  const dialogHeight = 24

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
      {/* Dialog box */}
      <box
        style={{
          width: dialogWidth,
          height: dialogHeight,
          flexDirection: "column",
          backgroundColor: "#161b22",
          borderStyle: "rounded",
          borderColor: "#58a6ff",
        }}
      >
        {/* Header */}
        <box
          style={{
            height: 1,
            flexShrink: 0,
            backgroundColor: "#58a6ff",
            justifyContent: "center",
          }}
        >
          <text style={{ fg: "#ffffff" }}>
            <b>LazyReview Help</b>
          </text>
        </box>

        {/* Content */}
        <box
          style={{
            flexGrow: 1,
            flexDirection: "column",
            paddingLeft: 2,
            paddingRight: 2,
            paddingTop: 1,
          }}
        >
          <text style={{ fg: "#8b949e" }}>
            A terminal UI for reviewing git changes with inline diffs.
          </text>
          <text> </text>

          <For each={sections}>
            {(section) => (
              <box style={{ flexDirection: "column", marginBottom: 1 }}>
                <text style={{ fg: "#58a6ff" }}>
                  <b>{section.title}</b>
                </text>
                <For each={section.keybinds}>
                  {(kb) => (
                    <box style={{ flexDirection: "row" }}>
                      <box style={{ width: 16, flexShrink: 0 }}>
                        <text style={{ fg: "#d29922" }}>{kb.key}</text>
                      </box>
                      <text style={{ fg: "#e6edf3" }}>{kb.desc}</text>
                    </box>
                  )}
                </For>
              </box>
            )}
          </For>
        </box>

        {/* Footer */}
        <box
          style={{
            height: 1,
            flexShrink: 0,
            backgroundColor: "#21262d",
            justifyContent: "center",
          }}
        >
          <text style={{ fg: "#8b949e" }}>Press ? / Esc / q to close</text>
        </box>
      </box>
    </box>
  )
}
