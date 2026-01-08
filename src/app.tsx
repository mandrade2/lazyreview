import { createSignal, createMemo, createEffect, Show } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { FileList } from "./components/file-list"
import { DiffViewer } from "./components/diff-viewer"
import { Header } from "./components/header"
import { StatusBar } from "./components/status-bar"
import { HelpDialog } from "./components/help-dialog"
import { CommitList } from "./components/commit-list"
import { BranchList } from "./components/branch-list"
import {
  getGitChanges,
  getTargetDir,
  getCommitList,
  getBranchList,
  getCurrentBranch,
  getCommitChanges,
  getBranchChanges,
  loadFileDetails,
  type FileChange,
  type AppMode,
  type CommitInfo,
  type BranchInfo,
} from "./utils/git"

export function App() {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  
  // Mode and view state
  const [mode, setMode] = createSignal<AppMode>("dirty")
  const [viewState, setViewState] = createSignal<"list" | "files">("files")
  
  // File-related state
  const [files, setFiles] = createSignal<FileChange[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [focusedPanel, setFocusedPanel] = createSignal<"files" | "diff">("files")
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)
  const [scrollOffset, setScrollOffset] = createSignal(0)
  const [showHelp, setShowHelp] = createSignal(false)
  
  // Commit mode state
  const [commits, setCommits] = createSignal<CommitInfo[]>([])
  const [listSelectedIndex, setListSelectedIndex] = createSignal(0)
  const [selectedCommit, setSelectedCommit] = createSignal<CommitInfo | null>(null)
  
  // Branch mode state
  const [branches, setBranches] = createSignal<BranchInfo[]>([])
  const [selectedBranch, setSelectedBranch] = createSignal<BranchInfo | null>(null)
  const [currentBranch, setCurrentBranch] = createSignal<string | null>(null)
  
  const selectedFile = createMemo(() => files()[selectedIndex()] ?? null)
  
  // Get selectable branches (excluding current)
  const selectableBranches = createMemo(() => 
    branches().filter(b => !b.isCurrent)
  )
  
  // Get the currently selected branch from the list
  const getSelectedBranchFromList = (): BranchInfo | null => {
    const selectable = selectableBranches()
    return selectable[listSelectedIndex()] ?? null
  }
  
  // Track the last selected file path to detect file changes
  let lastSelectedFilePath: string | null = null
  const [loadingFile, setLoadingFile] = createSignal(false)
  
  // Calculate visible height for diff viewer (terminal height - header - file header - status bar)
  const visibleHeight = createMemo(() => dimensions().height - 4)
  
  // When selected file changes, load its details if needed (lazy loading for commit/branch modes)
  createEffect(() => {
    const file = selectedFile()
    const currentMode = mode()
    const currentViewState = viewState()
    
    if (file && file.path !== lastSelectedFilePath && currentViewState === "files") {
      lastSelectedFilePath = file.path
      
      // Check if file needs lazy loading (no content yet)
      if (!file.content && (currentMode === "commit" || currentMode === "branch")) {
        setLoadingFile(true)
        
        const compareTarget = currentMode === "commit" && selectedCommit()
          ? { type: "commit" as const, hash: selectedCommit()!.hash }
          : currentMode === "branch" && selectedBranch()
          ? { type: "branch" as const, name: selectedBranch()!.name }
          : { type: "dirty" as const }
        
        loadFileDetails(file, compareTarget).then(loadedFile => {
          // Update the file in the files array
          setFiles(prev => prev.map(f => f.path === loadedFile.path ? loadedFile : f))
          setLoadingFile(false)
          
          // Set scroll to first change line
          const contextLines = 3
          const targetLine = Math.max(0, loadedFile.firstChangeLine - contextLines)
          setScrollOffset(targetLine)
        })
      } else {
        // File already has content, just update scroll
        const contextLines = 3
        const targetLine = Math.max(0, file.firstChangeLine - contextLines)
        setScrollOffset(targetLine)
      }
    }
  })
  
  // Load data helpers
  const loadDirtyChanges = async () => {
    setLoading(true)
    setError(null)
    try {
      const changes = await getGitChanges()
      setFiles(changes)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git changes")
    } finally {
      setLoading(false)
    }
  }
  
  const loadCommits = async () => {
    setLoading(true)
    setError(null)
    try {
      const commitList = await getCommitList()
      setCommits(commitList)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load commits")
    } finally {
      setLoading(false)
    }
  }
  
  const loadBranches = async () => {
    setLoading(true)
    setError(null)
    try {
      const [branchList, current] = await Promise.all([
        getBranchList(),
        getCurrentBranch(),
      ])
      setBranches(branchList)
      setCurrentBranch(current)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load branches")
    } finally {
      setLoading(false)
    }
  }
  
  const loadCommitChanges = async (commit: CommitInfo) => {
    setLoading(true)
    setError(null)
    try {
      const changes = await getCommitChanges(commit.hash)
      setFiles(changes)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load commit changes")
    } finally {
      setLoading(false)
    }
  }
  
  const loadBranchChanges = async (branch: BranchInfo) => {
    setLoading(true)
    setError(null)
    try {
      const changes = await getBranchChanges(branch.name)
      setFiles(changes)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load branch changes")
    } finally {
      setLoading(false)
    }
  }
  
  // Load git changes on mount
  ;(async () => {
    await loadDirtyChanges()
  })()
  
  // Helper to get max scroll for current file
  const getMaxScroll = () => {
    const file = selectedFile()
    if (!file) return 0
    const totalLines = file.content.split("\n").length
    return Math.max(0, totalLines - visibleHeight())
  }
  
  useKeyboard((key) => {
    // Quit with q or Ctrl+c - ALWAYS works, regardless of state
    if ((key.ctrl && key.name === "c") || key.name === "q") {
      renderer.destroy()
      return
    }
    
    // Toggle help with ?
    if (key.name === "?" || key.sequence === "?") {
      setShowHelp(h => !h)
      return
    }
    
    // Close help dialog with Escape
    if (key.name === "escape" && showHelp()) {
      setShowHelp(false)
      return
    }
    
    // Block all other keys while help is open
    if (showHelp()) {
      return
    }
    
    // Mode switching with 'm'
    if (key.name === "m") {
      const nextMode: AppMode = mode() === "dirty" ? "commit" 
                               : mode() === "commit" ? "branch" 
                               : "dirty"
      setMode(nextMode)
      setViewState(nextMode === "dirty" ? "files" : "list")
      setFocusedPanel("files")
      setListSelectedIndex(0)
      setSelectedIndex(0)
      setScrollOffset(0)
      setSelectedCommit(null)
      setSelectedBranch(null)
      setFiles([])
      
      // Load data for new mode
      if (nextMode === "dirty") {
        loadDirtyChanges()
      } else if (nextMode === "commit") {
        loadCommits()
      } else if (nextMode === "branch") {
        loadBranches()
      }
      return
    }
    
    // Escape - hierarchical back navigation
    if (key.name === "escape") {
      if (focusedPanel() === "diff") {
        // Diff -> Files
        setFocusedPanel("files")
        return
      }
      if (viewState() === "files" && mode() !== "dirty") {
        // Files -> List (for commit/branch modes)
        setViewState("list")
        setSelectedCommit(null)
        setSelectedBranch(null)
        setFiles([])
        setSelectedIndex(0)
        setScrollOffset(0)
        // Don't reset listSelectedIndex - keep the previous selection
        return
      }
      // At top level (list view or dirty mode files), do nothing
      return
    }
    
    // Tab to switch panels (only in files view)
    if (key.name === "tab" && viewState() === "files") {
      setFocusedPanel(p => p === "files" ? "diff" : "files")
      return
    }
    
    // Enter key handling
    if (key.name === "return") {
      if (viewState() === "list") {
        // In list view: select commit/branch and load changes
        if (mode() === "commit") {
          const commit = commits()[listSelectedIndex()]
          if (commit) {
            setSelectedCommit(commit)
            setViewState("files")
            setFocusedPanel("files")
            setSelectedIndex(0)
            setScrollOffset(0)
            loadCommitChanges(commit)
          }
        } else if (mode() === "branch") {
          const branch = getSelectedBranchFromList()
          if (branch) {
            setSelectedBranch(branch)
            setViewState("files")
            setFocusedPanel("files")
            setSelectedIndex(0)
            setScrollOffset(0)
            loadBranchChanges(branch)
          }
        }
      } else if (focusedPanel() === "files" && selectedFile()) {
        // In files view: switch to diff panel
        setFocusedPanel("diff")
      }
      return
    }
    
    // h/l to switch panels (vim style) - only in files view
    if (viewState() === "files") {
      if (key.name === "h" && focusedPanel() === "diff") {
        setFocusedPanel("files")
        return
      }
      if (key.name === "l" && focusedPanel() === "files") {
        setFocusedPanel("diff")
        return
      }
    }
    
    // Navigation with j/k
    if (key.name === "j" || key.name === "down") {
      if (viewState() === "list") {
        // List navigation
        if (mode() === "commit") {
          setListSelectedIndex(i => Math.min(i + 1, commits().length - 1))
        } else if (mode() === "branch") {
          setListSelectedIndex(i => Math.min(i + 1, selectableBranches().length - 1))
        }
      } else if (focusedPanel() === "files") {
        // File list navigation
        setSelectedIndex(i => Math.min(i + 1, files().length - 1))
      } else if (focusedPanel() === "diff") {
        // Diff scroll
        const maxScroll = getMaxScroll()
        setScrollOffset(o => Math.min(o + 1, maxScroll))
      }
      return
    }
    
    if (key.name === "k" || key.name === "up") {
      if (viewState() === "list") {
        // List navigation
        setListSelectedIndex(i => Math.max(i - 1, 0))
      } else if (focusedPanel() === "files") {
        // File list navigation
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (focusedPanel() === "diff") {
        // Diff scroll
        setScrollOffset(o => Math.max(o - 1, 0))
      }
      return
    }
    
    // g/G for jump to top/bottom
    if (key.name === "g" && !key.shift) {
      if (viewState() === "list") {
        setListSelectedIndex(0)
      } else if (focusedPanel() === "files") {
        setSelectedIndex(0)
      } else if (focusedPanel() === "diff") {
        setScrollOffset(0)
      }
      return
    }
    
    if (key.name === "g" && key.shift) {
      if (viewState() === "list") {
        if (mode() === "commit") {
          setListSelectedIndex(commits().length - 1)
        } else if (mode() === "branch") {
          setListSelectedIndex(selectableBranches().length - 1)
        }
      } else if (focusedPanel() === "files") {
        setSelectedIndex(files().length - 1)
      } else if (focusedPanel() === "diff") {
        setScrollOffset(getMaxScroll())
      }
      return
    }
    
    // Global diff scroll controls (work from any panel when in files view)
    if (viewState() === "files" && selectedFile()) {
      const halfPage = Math.floor(visibleHeight() / 2)
      const fullPage = visibleHeight()
      const maxScroll = getMaxScroll()
      
      // Ctrl+d - half page down
      if (key.ctrl && key.name === "d") {
        setScrollOffset(o => Math.min(o + halfPage, maxScroll))
        return
      }
      // Ctrl+u - half page up
      if (key.ctrl && key.name === "u") {
        setScrollOffset(o => Math.max(o - halfPage, 0))
        return
      }
      // Ctrl+f - full page down
      if (key.ctrl && key.name === "f") {
        setScrollOffset(o => Math.min(o + fullPage, maxScroll))
        return
      }
      // Ctrl+b - full page up
      if (key.ctrl && key.name === "b") {
        setScrollOffset(o => Math.max(o - fullPage, 0))
        return
      }
      // Ctrl+up - single line up
      if (key.ctrl && key.name === "up") {
        setScrollOffset(o => Math.max(o - 1, 0))
        return
      }
      // Ctrl+down - single line down
      if (key.ctrl && key.name === "down") {
        setScrollOffset(o => Math.min(o + 1, maxScroll))
        return
      }
    }
    
    // Refresh with 'r' - refreshes current mode's data
    if (key.name === "r") {
      if (mode() === "dirty") {
        loadDirtyChanges()
      } else if (mode() === "commit") {
        if (viewState() === "list") {
          loadCommits()
        } else if (selectedCommit()) {
          loadCommitChanges(selectedCommit()!)
        }
      } else if (mode() === "branch") {
        if (viewState() === "list") {
          loadBranches()
        } else if (selectedBranch()) {
          loadBranchChanges(selectedBranch()!)
        }
      }
      return
    }
    
    // Open file in editor with 'e' (only in files view with a selected file)
    if (key.name === "e" && viewState() === "files" && selectedFile()) {
      const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi"
      const filePath = `${getTargetDir()}/${selectedFile()!.path}`
      // Suspend terminal UI, run editor, then resume
      renderer.suspend()
      Bun.spawnSync([editor, filePath], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      })
      renderer.resume()
      // Refresh current mode's data after editing
      if (mode() === "dirty") {
        loadDirtyChanges()
      } else if (mode() === "commit" && selectedCommit()) {
        loadCommitChanges(selectedCommit()!)
      } else if (mode() === "branch" && selectedBranch()) {
        loadBranchChanges(selectedBranch()!)
      }
      return
    }
  })
  
  // Left panel header text based on mode and view state
  const leftPanelHeader = () => {
    if (mode() === "dirty") {
      return `FILES (${files().length})`
    } else if (mode() === "commit") {
      if (viewState() === "list") {
        return `COMMITS (${commits().length})`
      } else {
        return `FILES (${files().length}) · ${selectedCommit()?.shortHash ?? ""}`
      }
    } else {
      if (viewState() === "list") {
        return `BRANCHES (${branches().length})`
      } else {
        return `FILES (${files().length}) vs ${selectedBranch()?.name ?? ""}`
      }
    }
  }
  
  // Diff panel placeholder message
  const diffPlaceholderMessage = () => {
    if (mode() === "dirty") {
      return files().length === 0 ? "No changes detected" : "Select a file to view diff"
    } else if (mode() === "commit") {
      if (viewState() === "list") {
        return "Select a commit to view its changes"
      }
      return files().length === 0 ? "No files changed in this commit" : "Select a file to view diff"
    } else {
      if (viewState() === "list") {
        if (currentBranch() === null) {
          return "Cannot compare branches: HEAD is detached"
        }
        if (selectableBranches().length === 0) {
          return "No other branches to compare against"
        }
        return `Select a branch to compare against ${currentBranch()}`
      }
      return files().length === 0 ? "No differences between branches" : "Select a file to view diff"
    }
  }
  
  // Context info for status bar
  const contextInfo = () => {
    if (mode() === "commit" && selectedCommit()) {
      return selectedCommit()!.shortHash
    } else if (mode() === "branch" && selectedBranch()) {
      return selectedBranch()!.name
    }
    return undefined
  }
  
  return (
    <box
      style={{
        width: dimensions().width,
        height: dimensions().height,
        flexDirection: "column",
        backgroundColor: "#0d1117",
      }}
    >
      <Header mode={mode()} />
      
      <box style={{ flexDirection: "row", flexGrow: 1 }}>
        {/* Left sidebar - files, commits, or branches */}
        <box
          style={{
            width: 35,
            flexShrink: 0,
            flexDirection: "column",
          }}
        >
          {/* Panel header */}
          <box
            style={{
              height: 1,
              flexShrink: 0,
              backgroundColor: focusedPanel() === "files" ? "#58a6ff" : "#21262d",
              paddingLeft: 1,
            }}
          >
            <text style={{ fg: focusedPanel() === "files" ? "#ffffff" : "#8b949e" }}>
              <b>{leftPanelHeader()}</b>
            </text>
          </box>
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
              {/* Dirty mode or files view: show file list */}
              <Show when={mode() === "dirty" || viewState() === "files"}>
                <FileList
                  files={files()}
                  selectedIndex={selectedIndex()}
                  focused={focusedPanel() === "files"}
                />
              </Show>
              
              {/* Commit mode list view: show commits */}
              <Show when={mode() === "commit" && viewState() === "list"}>
                <Show
                  when={commits().length > 0}
                  fallback={
                    <box style={{ padding: 1 }}>
                      <text style={{ fg: "#8b949e" }}>No commits found</text>
                    </box>
                  }
                >
                  <CommitList
                    commits={commits()}
                    selectedIndex={listSelectedIndex()}
                    focused={focusedPanel() === "files"}
                  />
                </Show>
              </Show>
              
              {/* Branch mode list view: show branches */}
              <Show when={mode() === "branch" && viewState() === "list"}>
                <Show
                  when={branches().length > 0}
                  fallback={
                    <box style={{ padding: 1 }}>
                      <text style={{ fg: "#8b949e" }}>No branches found</text>
                    </box>
                  }
                >
                  <BranchList
                    branches={branches()}
                    selectedIndex={listSelectedIndex()}
                    focused={focusedPanel() === "files"}
                  />
                </Show>
              </Show>
            </Show>
          </Show>
        </box>
        
        {/* Diff viewer */}
        <box
          style={{
            flexGrow: 1,
            flexDirection: "column",
          }}
        >
          {/* Panel header */}
          <box
            style={{
              height: 1,
              flexShrink: 0,
              backgroundColor: focusedPanel() === "diff" ? "#58a6ff" : "#21262d",
              paddingLeft: 1,
            }}
          >
            <text style={{ fg: focusedPanel() === "diff" ? "#ffffff" : "#8b949e" }}>
              <b>DIFF</b>
            </text>
          </box>
          <Show
            when={viewState() === "files" && selectedFile()}
            fallback={
              <box
                style={{
                  flexGrow: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <text style={{ fg: "#8b949e" }}>
                  {diffPlaceholderMessage()}
                </text>
              </box>
            }
          >
            <Show
              when={!loadingFile() && selectedFile()?.content}
              fallback={
                <box
                  style={{
                    flexGrow: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <text style={{ fg: "#8b949e" }}>Loading file...</text>
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
          </Show>
        </box>
      </box>
      
      <StatusBar
        mode={mode()}
        viewState={viewState()}
        fileCount={files().length}
        selectedIndex={selectedIndex()}
        focusedPanel={focusedPanel()}
        listCount={mode() === "commit" ? commits().length : selectableBranches().length}
        listSelectedIndex={listSelectedIndex()}
        contextInfo={contextInfo()}
      />
      
      <Show when={showHelp()}>
        <HelpDialog onClose={() => setShowHelp(false)} />
      </Show>
    </box>
  )
}
