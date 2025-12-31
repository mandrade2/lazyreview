import { createSignal, createMemo, Show } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { FileList } from "./components/file-list"
import { DiffViewer } from "./components/diff-viewer"
import { Header } from "./components/header"
import { StatusBar } from "./components/status-bar"
import { getGitChanges, type FileChange } from "./utils/git"

export function App() {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  
  const [files, setFiles] = createSignal<FileChange[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [focusedPanel, setFocusedPanel] = createSignal<"files" | "diff">("files")
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)
  
  const selectedFile = createMemo(() => files()[selectedIndex()] ?? null)
  
  // Load git changes on mount
  ;(async () => {
    try {
      const changes = await getGitChanges()
      setFiles(changes)
      setLoading(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git changes")
      setLoading(false)
    }
  })()
  
  useKeyboard((key) => {
    // Global navigation
    if (key.name === "escape" || (key.ctrl && key.name === "c") || key.name === "q") {
      renderer.destroy()
      return
    }
    
    // Tab to switch panels
    if (key.name === "tab") {
      setFocusedPanel(p => p === "files" ? "diff" : "files")
      return
    }
    
    // h/l to switch panels (vim style)
    if (key.name === "h" && focusedPanel() === "diff") {
      setFocusedPanel("files")
      return
    }
    if (key.name === "l" && focusedPanel() === "files") {
      setFocusedPanel("diff")
      return
    }
    
    // File list navigation when focused
    if (focusedPanel() === "files") {
      if (key.name === "j" || key.name === "down") {
        setSelectedIndex(i => Math.min(i + 1, files().length - 1))
      } else if (key.name === "k" || key.name === "up") {
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (key.name === "g") {
        setSelectedIndex(0)
      } else if (key.name === "G") {
        setSelectedIndex(files().length - 1)
      }
    }
    
    // Refresh with 'r'
    if (key.name === "r") {
      setLoading(true)
      getGitChanges().then(changes => {
        setFiles(changes)
        setSelectedIndex(0)
        setLoading(false)
      }).catch(e => {
        setError(e instanceof Error ? e.message : "Failed to refresh")
        setLoading(false)
      })
    }
  })
  
  return (
    <box
      style={{
        width: dimensions().width,
        height: dimensions().height,
        flexDirection: "column",
        backgroundColor: "#0d1117",
      }}
    >
      <Header />
      
      <box style={{ flexDirection: "row", flexGrow: 1 }}>
        {/* File list sidebar */}
        <box
          style={{
            width: 35,
            flexShrink: 0,
            flexDirection: "column",
            border: ["right"],
            borderColor: focusedPanel() === "files" ? "#58a6ff" : "#30363d",
          }}
        >
          <Show
            when={!loading()}
            fallback={
              <box style={{ padding: 1 }}>
                <text style={{ fg: "#8b949e" }}>Loading...</text>
              </box>
            }
          >
            <Show
              when={!error()}
              fallback={
                <box style={{ padding: 1 }}>
                  <text style={{ fg: "#f85149" }}>Error: {error()}</text>
                </box>
              }
            >
              <FileList
                files={files()}
                selectedIndex={selectedIndex()}
                focused={focusedPanel() === "files"}
              />
            </Show>
          </Show>
        </box>
        
        {/* Diff viewer */}
        <box
          style={{
            flexGrow: 1,
            flexDirection: "column",
            border: ["left"],
            borderColor: focusedPanel() === "diff" ? "#58a6ff" : "#30363d",
          }}
        >
          <Show
            when={selectedFile()}
            fallback={
              <box
                style={{
                  flexGrow: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <text style={{ fg: "#8b949e" }}>
                  {files().length === 0 ? "No changes detected" : "Select a file to view diff"}
                </text>
              </box>
            }
          >
            <DiffViewer
              file={selectedFile()!}
              focused={focusedPanel() === "diff"}
            />
          </Show>
        </box>
      </box>
      
      <StatusBar
        fileCount={files().length}
        selectedIndex={selectedIndex()}
        focusedPanel={focusedPanel()}
      />
    </box>
  )
}
