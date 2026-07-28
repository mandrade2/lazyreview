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

export const controlButtonWidth = 8
export const controlButtonHeight = 2
// Portrait: two full-width rows (actions/paging, chunks/movement).
// Landscape: two columns (actions/paging, chunks/movement).
export const controlPortraitHeight = 2 * controlButtonHeight
export const controlLandscapeWidth = 2 * controlButtonWidth + 1

interface ControlButton {
  label: string
  spec: ControlKeySpec
  group: number
}

const actions: ControlButton[] = [
  { label: "esc", spec: { name: "escape", sequence: "\u001b" }, group: 0 },
  { label: "m", spec: { name: "m", sequence: "m" }, group: 0 },
  { label: "r", spec: { name: "r", sequence: "r" }, group: 0 },
  { label: "space", spec: { name: "space", sequence: " " }, group: 0 },
  { label: "enter", spec: { name: "return", sequence: "\r" }, group: 0 },
  { label: "tab", spec: { name: "tab", sequence: "\t" }, group: 0 },
]

const paging: ControlButton[] = [
  { label: "pgup", spec: { name: "pageup" }, group: 1 },
  { label: "pgdn", spec: { name: "pagedown" }, group: 1 },
]

const chunks: ControlButton[] = [
  { label: "N", spec: { name: "n", sequence: "N", shift: true }, group: 2 },
  { label: "n", spec: { name: "n", sequence: "n" }, group: 2 },
]

const movement: ControlButton[] = [
  { label: "↑", spec: { name: "up" }, group: 3 },
  { label: "↓", spec: { name: "down" }, group: 3 },
]

// Same grouping for both orientations: rendered as rows in portrait and as
// columns in landscape.
const lines: ControlButton[][] = [
  actions,
  [...paging, ...chunks, ...movement],
]

function ControlButton(props: { button: ControlButton; stretch: boolean; onKey: (spec: ControlKeySpec) => void }) {
  return (
    <box
      onMouseDown={() => props.onKey(props.button.spec)}
      style={{
        width: props.stretch ? undefined : controlButtonWidth,
        flexGrow: props.stretch ? 1 : 0,
        flexBasis: props.stretch ? 1 : undefined,
        height: controlButtonHeight,
        flexShrink: 0,
        backgroundColor: props.button.group % 2 === 0 ? "#21262d" : "#161b22",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <text style={{ fg: "#e6edf3" }}>{props.button.label}</text>
    </box>
  )
}

export function OnScreenControls(props: OnScreenControlsProps) {
  const isRow = () => props.orientation === "portrait"

  return (
    <box
      style={{
        flexDirection: isRow() ? "column" : "row",
        flexShrink: 0,
        width: isRow() ? "100%" : controlLandscapeWidth,
        height: isRow() ? controlPortraitHeight : "100%",
        overflow: "hidden",
        backgroundColor: "#0d1117",
        justifyContent: isRow() ? undefined : "flex-end",
      }}
    >
      <For each={lines}>
        {(line) => (
          <box
            style={{
              flexDirection: isRow() ? "row" : "column",
              flexShrink: 0,
              width: isRow() ? "100%" : undefined,
            }}
          >
            <For each={line}>
              {(button) => <ControlButton button={button} stretch={isRow()} onKey={props.onKey} />}
            </For>
          </box>
        )}
      </For>
    </box>
  )
}
