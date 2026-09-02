import { createSignal, onCleanup, onMount } from "solid-js"
import { th } from "../utils/theme"

// Braille spinner frames, cycled on a timer while the overlay is mounted.
const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

interface LoadingOverlayProps {
  label?: string
}

export function LoadingOverlay(props: LoadingOverlayProps) {
  const [frame, setFrame] = createSignal(0)

  onMount(() => {
    const timer = setInterval(
      () => setFrame(f => (f + 1) % spinnerFrames.length),
      80,
    )
    onCleanup(() => clearInterval(timer))
  })

  return (
    <box
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: th("#0d1117"),
        zIndex: 10,
      }}
    >
      <box style={{ flexDirection: "row", alignItems: "center" }}>
        <text style={{ fg: th("#58a6ff") }}>{spinnerFrames[frame()] ?? "⠋"}</text>
        <text style={{ fg: th("#8b949e") }}> {props.label ?? "Loading..."}</text>
      </box>
    </box>
  )
}
