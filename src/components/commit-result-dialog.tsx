import { For, Show, createSignal, onCleanup, onMount } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { th } from "../utils/theme"
import {
  shortModelName,
  wrapText,
  type CommitResult,
  type CommitSource,
  type CommitStage,
} from "../utils/commit-message"

interface CommitResultDialogProps {
  stage: CommitStage
  // Manual commits have no generation phase and no model to credit.
  source: CommitSource
  model: string
  branch: string
  listNumber: number
  fileCount: number
  result: CommitResult | null
  error: string | null
  startedAt: number
}

// Braille spinner frames, cycled on a timer while a request is in flight.
const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

const maxTitleRows = 2
const maxBodyRows = 6

function truncate(str: string, maxLength: number): string {
  if (maxLength <= 0) return ""
  if (str.length <= maxLength) return str
  return str.slice(0, Math.max(0, maxLength - 3)) + "..."
}

export function CommitResultDialog(props: CommitResultDialogProps) {
  const dimensions = useTerminalDimensions()
  const [frame, setFrame] = createSignal(0)
  const [now, setNow] = createSignal(Date.now())

  onMount(() => {
    const spinner = setInterval(() => setFrame(f => (f + 1) % spinnerFrames.length), 80)
    const clock = setInterval(() => setNow(Date.now()), 100)
    onCleanup(() => {
      clearInterval(spinner)
      clearInterval(clock)
    })
  })

  const done = () => props.stage === "done"
  const isAi = () => props.source === "ai"

  const dialogWidth = () => Math.min(84, Math.max(24, dimensions().width - 4))
  // Padding left + right plus the two border columns.
  const innerWidth = () => Math.max(8, dialogWidth() - 4)

  const elapsedMs = () => props.result?.elapsedMs ?? Math.max(0, now() - props.startedAt)
  const elapsed = () => `${(elapsedMs() / 1000).toFixed(1)}s`
  const model = () => shortModelName(props.model)

  // "✓ <sha> " sits in front of the first title row and is indented past on
  // the rest. One column of slack absorbs the width of the checkmark glyph.
  const titlePrefix = () => `✓ ${props.result?.shortHash ?? ""} `
  const titleRows = () => {
    const title = props.result?.title ?? ""
    const width = Math.max(8, innerWidth() - titlePrefix().length - 1)
    const wrapped = wrapText(title, width)
    return wrapped.length <= maxTitleRows
      ? wrapped
      : [...wrapped.slice(0, maxTitleRows - 1), "…"]
  }

  // The commit holds the full body; the dialog previews the head of it.
  const bodyRows = () => {
    const body = props.result?.body
    if (!body) return []
    const wrapped = wrapText(body, innerWidth())
    return wrapped.length <= maxBodyRows ? wrapped : [...wrapped.slice(0, maxBodyRows - 1), "…"]
  }

  const maxErrorRows = 6

  // Errors matter more than anything else on screen, so they get the same
  // budget as the body and say so when they are cut off.
  const errorRows = () => {
    if (!props.error) return []
    const wrapped = wrapText(props.error, innerWidth())
    return wrapped.length <= maxErrorRows ? wrapped : [...wrapped.slice(0, maxErrorRows - 1), "…"]
  }

  // Rows between the header and the footer. The content area is given exactly
  // this many rows so the footer stays pinned to the bottom border; every
  // rendered row is sized and counted here to keep the two in step.
  const contentRows = () => {
    if (props.error) return Math.max(1, errorRows().length)
    if (!done()) return 2
    const body = bodyRows().length
    return titleRows().length + (body > 0 ? body + 1 : 0) + 2
  }

  const dialogHeight = () => contentRows() + 6

  const borderColor = () => (props.error ? th("#f85149") : done() ? th("#3fb950") : th("#58a6ff"))

  const title = () => {
    if (props.error) return isAi() ? "AI commit failed" : "Commit failed"
    if (done()) return truncate(`Committed to ${props.branch}`, innerWidth())
    return truncate(
      `${isAi() ? "AI commit" : "Commit"} · list [${props.listNumber}] (${props.fileCount} ${props.fileCount === 1 ? "file" : "files"})`,
      innerWidth(),
    )
  }

  const hint = () =>
    props.stage === "committing"
      ? `${props.fileCount} ${props.fileCount === 1 ? "file" : "files"} on ${props.branch}`
      : `Writing a message for ${props.fileCount} ${props.fileCount === 1 ? "file" : "files"} on ${props.branch}`

  const statusLabel = () => (props.stage === "committing" ? "Creating commit…" : `Asking ${model()}…`)

  // Only the AI run is worth timing: for a manual commit the interesting part
  // is what landed, not how long git took.
  const footer = () => {
    if (props.error) return "Enter/Esc: close"
    if (props.stage === "committing") return "Creating commit…"
    if (!done()) return `Esc: cancel · ${model()} · ${elapsed()}`
    return isAi() ? `Enter/Esc: close · ${model()} · ${elapsed()}` : "Enter/Esc: close"
  }

  const summary = () => props.result?.summary

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
          height: dialogHeight(),
          flexDirection: "column",
          backgroundColor: th("#161b22"),
          borderStyle: "rounded",
          borderColor: borderColor(),
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

        <box style={{ flexGrow: 1, flexDirection: "column", paddingTop: 1, paddingBottom: 1 }}>
          {/* Waiting state: spinner plus what the model is being asked to do. */}
          <Show when={!done() && !props.error}>
            <box style={{ height: 1, flexShrink: 0, flexDirection: "row", alignItems: "center" }}>
              <text style={{ fg: th("#58a6ff") }}>{spinnerFrames[frame()] ?? "⠋"}</text>
              <text style={{ fg: th("#e6edf3") }}> {truncate(statusLabel(), innerWidth() - 2)}</text>
            </box>
            <box style={{ height: 1, flexShrink: 0 }}>
              <text style={{ fg: th("#8b949e") }}>{truncate(hint(), innerWidth())}</text>
            </box>
          </Show>

          {/* Result state: the commit that was created, then what it touched. */}
          <Show when={done() && props.result}>
            <For each={titleRows()}>
              {(row, index) => (
                <box style={{ height: 1, flexShrink: 0, flexDirection: "row", alignItems: "center" }}>
                  <Show
                    when={index() === 0}
                    fallback={<text>{" ".repeat(titlePrefix().length)}</text>}
                  >
                    <text style={{ fg: th("#3fb950") }}>✓ </text>
                    <text style={{ fg: th("#a371f7") }}>{props.result!.shortHash}</text>
                    <text> </text>
                  </Show>
                  <text style={{ fg: th("#e6edf3") }}>
                    <b>{row}</b>
                  </text>
                </box>
              )}
            </For>
            <Show when={bodyRows().length > 0}>
              <box style={{ height: 1, flexShrink: 0 }} />
              <For each={bodyRows()}>
                {(row) => (
                  <box style={{ height: 1, flexShrink: 0 }}>
                    <text style={{ fg: th("#8b949e") }}>{row}</text>
                  </box>
                )}
              </For>
            </Show>
            <box style={{ height: 1, flexShrink: 0 }} />
            <Show when={summary()}>
              <box style={{ height: 1, flexShrink: 0, flexDirection: "row", alignItems: "center" }}>
                <text style={{ fg: th("#8b949e") }}>
                  {summary()!.files} {summary()!.files === 1 ? "file" : "files"} changed
                </text>
                <text style={{ fg: th("#3fb950") }}>{`  +${summary()!.additions}`}</text>
                <text style={{ fg: th("#f85149") }}>{`  −${summary()!.deletions}`}</text>
              </box>
            </Show>
          </Show>

          <Show when={props.error}>
            <For each={errorRows()}>
              {(row) => (
                <box style={{ height: 1, flexShrink: 0 }}>
                  <text style={{ fg: th("#f85149") }}>{row}</text>
                </box>
              )}
            </For>
            <Show when={errorRows().length === 0}>
              <box style={{ height: 1, flexShrink: 0 }}>
                <text style={{ fg: th("#f85149") }}>Unknown error</text>
              </box>
            </Show>
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
          <text style={{ fg: th("#8b949e") }}>{truncate(footer(), innerWidth())}</text>
        </box>
      </box>
    </box>
  )
}
