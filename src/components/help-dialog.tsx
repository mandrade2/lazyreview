import { For } from "solid-js"

interface HelpDialogProps {
  onClose: () => void
}

const sections = [
  {
    title: "Modes",
    keybinds: [
      { key: "m", desc: "Cycle modes: Dirty → Commit → Branch" },
      { key: "Esc", desc: "Go back (diff → files → list)" },
    ],
  },
  {
    title: "Navigation",
    keybinds: [
      { key: "j / ↓", desc: "Move down / scroll down" },
      { key: "k / ↑", desc: "Move up / scroll up" },
      { key: "g", desc: "Go to first item / top" },
      { key: "G", desc: "Go to last item / bottom" },
      { key: "Tab / h / l", desc: "Switch between panels" },
      { key: "Enter", desc: "Select / open diff view" },
    ],
  },
  {
    title: "Scrolling (Diff)",
    keybinds: [
      { key: "n / N", desc: "Jump to next / previous chunk" },
      { key: "Ctrl+d / Ctrl+u", desc: "Half page down / up" },
      { key: "Ctrl+f / Ctrl+b", desc: "Full page down / up" },
    ],
  },
  {
    title: "Search (Diff)",
    keybinds: [
      { key: "/", desc: "Start search" },
      { key: "Enter", desc: "Execute search" },
      { key: "n / N", desc: "Next / previous match" },
      { key: "Esc", desc: "Clear search" },
    ],
  },
  {
    title: "Actions",
    keybinds: [
      { key: "e", desc: "Open file in $EDITOR" },
      { key: "r", desc: "Refresh current view" },
      { key: "?", desc: "Toggle this help" },
      { key: "q / Ctrl+c", desc: "Quit" },
    ],
  },
]

export function HelpDialog(props: HelpDialogProps) {
  const dialogWidth = 50
  const dialogHeight = 32

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
