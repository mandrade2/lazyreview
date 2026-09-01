import { th } from "../utils/theme"
import { For } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import type { ScrollBoxRenderable } from "@opentui/core"

interface HelpDialogProps {
  onClose: () => void
  configIndex: number
  onScreenControls: boolean
  diffViewMode: "diff" | "full"
  fileListViewMode: "flat" | "tree"
  showLineBg: boolean
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
      { key: "Tab / S-Tab", desc: "Cycle list sections (To Review / lists)" },
      { key: "h / l", desc: "Switch between panels" },
      { key: "Enter", desc: "Select / open diff view / toggle folder" },
      { key: "t", desc: "Toggle flat / tree file list" },
    ],
  },
  {
    title: "Scrolling (Diff)",
    keybinds: [
      { key: "n / N", desc: "Jump to next / previous chunk" },
      { key: "f", desc: "Toggle diff-only / full file" },
      { key: "b", desc: "Toggle line background colors" },
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
      { key: "Space", desc: "Send file or folder to list 1 / back" },
      { key: "1-9", desc: "Send file or folder to change list n" },
      { key: "c", desc: "Commit a change list (dirty mode)" },
      { key: "e", desc: "Open file in $EDITOR" },
      { key: "o", desc: "Open file in opencode" },
      { key: "r", desc: "Refresh current view" },
      { key: "?", desc: "Toggle this help" },
      { key: "q / Ctrl+c", desc: "Quit" },
    ],
  },
]

export function HelpDialog(props: HelpDialogProps) {
  const dimensions = useTerminalDimensions()
  const dialogWidth = () => Math.min(64, Math.max(20, dimensions().width - 2))
  const dialogHeight = () => Math.min(48, Math.max(10, dimensions().height - 2))

  let scrollbox: ScrollBoxRenderable | undefined

  const configs = () => [
    { label: "On-screen controls", value: props.onScreenControls ? "On" : "Off" },
    { label: "Diff view (f)", value: props.diffViewMode === "diff" ? "Diff" : "Full" },
    { label: "File list (t)", value: props.fileListViewMode === "flat" ? "Flat" : "Tree" },
    { label: "Line background (b)", value: props.showLineBg ? "On" : "Off" },
  ]

  // The app's keyboard handler blocks other keys while help is open, so this
  // only needs to handle scrolling the dialog content.
  useKeyboard((key) => {
    if (!scrollbox) return
    if (key.name === "j") {
      scrollbox.scrollTop += 1
    } else if (key.name === "k") {
      scrollbox.scrollTop = Math.max(0, scrollbox.scrollTop - 1)
    }
  })

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
          width: dialogWidth(),
          height: dialogHeight(),
          flexDirection: "column",
          backgroundColor: th("#161b22"),
          borderStyle: "rounded",
          borderColor: th("#58a6ff"),
        }}
      >
        {/* Header */}
        <box
          style={{
            height: 1,
            flexShrink: 0,
            backgroundColor: th("#58a6ff"),
            justifyContent: "center",
          }}
        >
          <text style={{ fg: th("#ffffff") }}>
            <b>LazyReview Help</b>
          </text>
        </box>

        {/* Content */}
        <scrollbox
          ref={(el: ScrollBoxRenderable) => { scrollbox = el }}
          style={{
            flexGrow: 1,
            paddingLeft: 2,
            paddingRight: 2,
            paddingTop: 1,
          }}
        >
          <box style={{ flexShrink: 0, flexDirection: "column" }}>
            <text style={{ fg: th("#8b949e") }}>
              A terminal UI for reviewing git changes with inline diffs.
            </text>
            <text> </text>
          </box>

          <box style={{ flexDirection: "column", marginBottom: 1, flexShrink: 0 }}>
            <text style={{ fg: th("#58a6ff") }}>
              <b>Configs</b>
            </text>
            <For each={configs()}>
              {(config, index) => (
                <box
                  style={{
                    flexDirection: "row",
                    backgroundColor: index() === props.configIndex ? th("#21262d") : undefined,
                  }}
                >
                  <box style={{ width: 22, flexShrink: 0 }}>
                    <text style={{ fg: index() === props.configIndex ? th("#58a6ff") : th("#e6edf3") }}>
                      {config.label}
                    </text>
                  </box>
                  <text style={{ fg: th("#d29922") }}>{`< ${config.value} >`}</text>
                </box>
              )}
            </For>
          </box>

          <For each={sections}>
            {(section) => (
              <box style={{ flexDirection: "column", marginBottom: 1, flexShrink: 0 }}>
                <text style={{ fg: th("#58a6ff") }}>
                  <b>{section.title}</b>
                </text>
                <For each={section.keybinds}>
                  {(kb) => (
                    <box style={{ flexDirection: "row" }}>
                      <box style={{ width: 16, flexShrink: 0 }}>
                        <text style={{ fg: th("#d29922") }}>{kb.key}</text>
                      </box>
                      <text style={{ fg: th("#e6edf3") }}>{kb.desc}</text>
                    </box>
                  )}
                </For>
              </box>
            )}
          </For>
        </scrollbox>

        {/* Footer */}
        <box
          style={{
            height: 1,
            flexShrink: 0,
            backgroundColor: th("#21262d"),
            justifyContent: "center",
          }}
        >
          <text style={{ fg: th("#8b949e") }}>j/k scroll · ↑/↓ select · ←/→ change · ? / Esc / q to close</text>
        </box>
      </box>
    </box>
  )
}
