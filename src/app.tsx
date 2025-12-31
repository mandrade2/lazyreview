import { createSignal, createMemo, createEffect, Show } from "solid-js"
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
  const [scrollOffset, setScrollOffset] = createSignal(0)
  
  const selectedFile = createMemo(() => files()[selectedIndex()] ?? null)
  
  // Calculate visible height for diff viewer (terminal height - header - file header - status bar)
  const visibleHeight = createMemo(() => dimensions().height - 4)
  
  // When selected file changes, set scroll to first change line
  createEffect(() => {
    const file = selectedFile()
    if (file) {
      // Set scroll to first change line, but leave some context above if possible
      const contextLines = 3
      const targetLine = Math.max(0, file.firstChangeLine - contextLines)
      setScrollOffset(targetLine)
    }
  })
  
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
  
  // Helper to get max scroll for current file
  const getMaxScroll = () => {
    const file = selectedFile()
    if (!file) return 0
    const totalLines = file.content.split("\n").length
    return Math.max(0, totalLines - visibleHeight())
  }
  
  useKeyboard((key) => {
    // Quit with q or Ctrl+c
    if ((key.ctrl && key.name === "c") || key.name === "q") {
      renderer.destroy()
      return
    }
    
    // Escape - go back to files panel (or quit if already there)
    if (key.name === "escape") {
      if (focusedPanel() === "diff") {
        setFocusedPanel("files")
      }
      return
    }
    
    // Tab to switch panels
    if (key.name === "tab") {
      setFocusedPanel(p => p === "files" ? "diff" : "files")
      return
    }
    
    // Enter to view diff (from files panel)
    if (key.name === "return" && focusedPanel() === "files" && selectedFile()) {
      setFocusedPanel("diff")
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
    
    // File list navigation when focused on files panel
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
    
    // Diff navigation when focused on diff panel
    if (focusedPanel() === "diff") {
      const halfPage = Math.floor(visibleHeight() / 2)
      const fullPage = visibleHeight()
      const maxScroll = getMaxScroll()
      
      // j/k for single line
      if (key.name === "j" || key.name === "down") {
        setScrollOffset(o => Math.min(o + 1, maxScroll))
      } else if (key.name === "k" || key.name === "up") {
        setScrollOffset(o => Math.max(o - 1, 0))
      }
      // Ctrl+d - half page down
      else if (key.ctrl && key.name === "d") {
        setScrollOffset(o => Math.min(o + halfPage, maxScroll))
      }
      // Ctrl+u - half page up
      else if (key.ctrl && key.name === "u") {
        setScrollOffset(o => Math.max(o - halfPage, 0))
      }
      // Ctrl+f - full page down
      else if (key.ctrl && key.name === "f") {
        setScrollOffset(o => Math.min(o + fullPage, maxScroll))
      }
      // Ctrl+b - full page up
      else if (key.ctrl && key.name === "b") {
        setScrollOffset(o => Math.max(o - fullPage, 0))
      }
      // g - go to top
      else if (key.name === "g") {
        setScrollOffset(0)
      }
      // G - go to bottom
      else if (key.name === "G") {
        setScrollOffset(maxScroll)
      }
    }
    
    // Refresh with 'r'
    if (key.name === "r") {
      setLoading(true)
      getGitChanges().then(changes => {
        setFiles(changes)
        setSelectedIndex(0)
        setScrollOffset(0)
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
              scrollOffset={scrollOffset()}
              onScroll={setScrollOffset}
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
