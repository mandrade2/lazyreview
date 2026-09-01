import { th } from "../utils/theme"
import { For } from "solid-js"

export interface ControlKeySpec {
  name: string
  sequence?: string
  shift?: boolean
}

interface OnScreenControlsProps {
  orientation: "portrait" | "landscape"
  onKey: (spec: ControlKeySpec) => void
}

export const controlButtonWidth = 10
export const controlButtonHeight = 2
// Portrait: three full-width rows (actions, paging/chunks/movement, lists).
// Landscape: two columns (actions, paging/chunks/movement/lists).
export const controlPortraitHeight = 3 * controlButtonHeight
export const controlLandscapeWidth = 2 * controlButtonWidth

interface ControlButton {
  label: string
  spec: ControlKeySpec
}

const actions: ControlButton[] = [
  { label: "esc", spec: { name: "escape", sequence: "\u001b" } },
  { label: "m", spec: { name: "m", sequence: "m" } },
  { label: "r", spec: { name: "r", sequence: "r" } },
  { label: "space", spec: { name: "space", sequence: " " } },
  { label: "enter", spec: { name: "return", sequence: "\r" } },
  { label: "tab", spec: { name: "tab", sequence: "\t" } },
]

const paging: ControlButton[] = [
  { label: "pgup", spec: { name: "pageup" } },
  { label: "pgdn", spec: { name: "pagedown" } },
]

const chunks: ControlButton[] = [
  { label: "N", spec: { name: "n", sequence: "N", shift: true } },
  { label: "n", spec: { name: "n", sequence: "n" } },
]

const movement: ControlButton[] = [
  { label: "↑", spec: { name: "up" } },
  { label: "↓", spec: { name: "down" } },
]

// Numbered change lists: inject the digit key so the selected file(s) get
// assigned to that list, like the 1-9 keyboard shortcuts.
const listButtons = (count: number): ControlButton[] =>
  Array.from({ length: count }, (_, i) => {
    const digit = String(i + 1)
    return { label: digit, spec: { name: digit, sequence: digit } }
  })

function ControlButton(props: { button: ControlButton; shade: number; stretch: boolean; onKey: (spec: ControlKeySpec) => void }) {
  return (
    <box
      onMouseDown={() => props.onKey(props.button.spec)}
      style={{
        width: props.stretch ? undefined : controlButtonWidth,
        flexGrow: props.stretch ? 1 : 0,
        flexBasis: props.stretch ? 1 : undefined,
        height: controlButtonHeight,
        flexShrink: 0,
        backgroundColor: props.shade % 2 === 0 ? th("#21262d") : th("#30363d"),
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <text style={{ fg: th("#e6edf3") }}>{props.button.label}</text>
    </box>
  )
}

export function OnScreenControls(props: OnScreenControlsProps) {
  const isRow = () => props.orientation === "portrait"
  // Both orientations stack rows: actions on top, navigation in the middle,
  // list numbers at the bottom. Portrait rows stretch full width in three
  // rows of five; landscape rows hold two fixed-width buttons inside the
  // right-side column.
  const lines = () => {
    if (isRow()) {
      return [
        [actions[0]!, actions[1]!, actions[2]!, chunks[0]!, chunks[1]!],
        [actions[5]!, actions[3]!, actions[4]!, paging[0]!, paging[1]!],
        [movement[0]!, movement[1]!, ...listButtons(3)],
      ]
    }
    return [
      [actions[0]!, actions[1]!],
      [actions[2]!, actions[3]!],
      [actions[4]!, actions[5]!],
      [paging[0]!, paging[1]!],
      [chunks[0]!, chunks[1]!],
      [movement[0]!, movement[1]!],
      [listButtons(4)[0]!, listButtons(4)[1]!],
      [listButtons(4)[2]!, listButtons(4)[3]!],
    ]
  }

  return (
    <box
      style={{
        flexDirection: "column",
        flexShrink: 0,
        width: isRow() ? "100%" : controlLandscapeWidth,
        height: isRow() ? controlPortraitHeight : "100%",
        overflow: "hidden",
        backgroundColor: th("#0d1117"),
      }}
    >
      <For each={lines()}>
        {(line, lineIndex) => (
          <box
            style={{
              flexDirection: "row",
              flexShrink: 0,
              width: isRow() ? "100%" : undefined,
            }}
          >
            <For each={line}>
              {(button, buttonIndex) => (
                <ControlButton
                  button={button}
                  shade={lineIndex() + buttonIndex()}
                  stretch={isRow()}
                  onKey={props.onKey}
                />
              )}
            </For>
          </box>
        )}
      </For>
    </box>
  )
}
