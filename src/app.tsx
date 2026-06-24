import { createSignal, createMemo, createEffect, Show, onMount, onCleanup } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import type { MouseEvent } from "@opentui/core"
import { FileList } from "./components/file-list"
import { DiffViewer } from "./components/diff-viewer"
import { Header } from "./components/header"
import { StatusBar } from "./components/status-bar"
import { HelpDialog } from "./components/help-dialog"
import { CommitList } from "./components/commit-list"
import { BranchList } from "./components/branch-list"
import {
  parseDiff,
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
  type DiffLine as ParsedDiffLine,
} from "./utils/git"
import {
  buildFileTree,
  flattenTree,
  getFilesInFolder,
  collectFolderPaths,
  type TreeFolder,
  type TreeFile,
} from "./utils/file-tree"
import { openFileInEditor } from "./utils/editor"
import { preloadHighlight, computeWrappedMaxScroll } from "./utils/dataloading"
import { copyToClipboard } from "./utils/clipboard"
import { loadSettings, saveSettings, type Settings } from "./utils/settings"

function truncate(str: string, maxLength: number): string {
  if (maxLength <= 0) return ""
  if (str.length <= maxLength) return str
  return str.slice(0, Math.max(0, maxLength - 3)) + "..."
}

export function App() {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()

  // Auto-copy any mouse selection to the system clipboard on mouseup and
  // clear the selection so it doesn't stay highlighted.
  onMount(() => {
    const handleSelection = async (selection: { getSelectedText(): string }) => {
      const text = selection.getSelectedText()
      if (!text) return
      await copyToClipboard(text)
      renderer.clearSelection()
    }

    renderer.on("selection", handleSelection)
    onCleanup(() => {
      renderer.off("selection", handleSelection)
    })
  })

  // Mode and view state
  const [mode, setMode] = createSignal<AppMode>("dirty")
  const [viewState, setViewState] = createSignal<"list" | "files">("files")
  
  // File-related state
  const [files, setFiles] = createSignal<FileChange[]>([])
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [focusedPanel, setFocusedPanel] = createSignal<"files" | "diff">("files")
  
  // Terminal width is measured in columns, not pixels.
  // Keep split-pane layout unless the terminal is truly narrow.
  // 80 columns is the common default; keep split panes at 80+.
  const narrowModeThreshold = 80
  const isNarrowMode = createMemo(() => dimensions().width < narrowModeThreshold)
  const sidebarWidth = createMemo(() => {
    if (isNarrowMode()) {
      return dimensions().width
    }

    return Math.max(35, Math.min(48, Math.floor(dimensions().width * 0.32)))
  })
  const diffViewerWidth = createMemo(() => {
    if (isNarrowMode()) {
      return dimensions().width
    }

    return Math.max(1, dimensions().width - sidebarWidth())
  })
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)
  const [scrollOffset, setScrollOffset] = createSignal(0)
  const [showHelp, setShowHelp] = createSignal(false)

  // Reviewed files state
  const [reviewedPaths, setReviewedPaths] = createSignal<Set<string>>(new Set())
  const [reviewedOrder, setReviewedOrder] = createSignal<string[]>([])
  const [filesGeneration, setFilesGeneration] = createSignal(0)

  // Diff display mode: show diff-only (unified diff) or full file with inline highlights
  const [diffViewMode, setDiffViewMode] = createSignal<"diff" | "full">("diff")

  // Toggle background highlighting on diff lines (line numbers keep their color)
  const [showLineBg, setShowLineBg] = createSignal(true)

  // File list view mode: flat list or tree view
  const [fileListViewMode, setFileListViewMode] = createSignal<"flat" | "tree">("flat")

  // Expanded folder paths in tree view
  const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(new Set())

  // Settings loaded flag to prevent overwriting before load completes
  const [settingsLoaded, setSettingsLoaded] = createSignal(false)

  // Search state (vim-style search in diff view)
  const [searchMode, setSearchMode] = createSignal(false) // true when typing search query
  const [searchQuery, setSearchQuery] = createSignal("") // current search input
  const [searchActive, setSearchActive] = createSignal(false) // true when search results are shown
  const [searchMatches, setSearchMatches] = createSignal<Array<{ line: number; start: number; length: number }>>([])
  const [currentMatchIndex, setCurrentMatchIndex] = createSignal(0)

  // Clear search state (defined early for use in effects)
  const clearSearch = () => {
    setSearchMode(false)
    setSearchQuery("")
    setSearchActive(false)
    setSearchMatches([])
    setCurrentMatchIndex(0)
  }

  // Commit mode state
  const [commits, setCommits] = createSignal<CommitInfo[]>([])
  const [listSelectedIndex, setListSelectedIndex] = createSignal(0)
  const [selectedCommit, setSelectedCommit] = createSignal<CommitInfo | null>(null)
  
  // Branch mode state
  const [branches, setBranches] = createSignal<BranchInfo[]>([])
  const [selectedBranch, setSelectedBranch] = createSignal<BranchInfo | null>(null)
  const [currentBranch, setCurrentBranch] = createSignal<string | null>(null)
  
  const toReviewFiles = createMemo(() => files().filter(f => !reviewedPaths().has(f.path)))
  const reviewedFiles = createMemo(() => {
    const order = reviewedOrder()
    const fileMap = new Map(files().map(f => [f.path, f]))
    return order.map(path => fileMap.get(path)).filter((f): f is FileChange => f !== undefined)
  })

  const toReviewTree = createMemo(() => buildFileTree(toReviewFiles()))
  const reviewedTree = createMemo(() => buildFileTree(reviewedFiles()))

  const flatToReviewItems = createMemo(() =>
    toReviewFiles().map(f => ({ type: "file" as const, file: f, depth: 0 })),
  )
  const flatReviewedItems = createMemo(() =>
    reviewedFiles().map(f => ({ type: "file" as const, file: f, depth: 0 })),
  )

  const toReviewVisibleItems = createMemo(() =>
    fileListViewMode() === "tree"
      ? flattenTree(toReviewTree(), expandedFolders())
      : flatToReviewItems(),
  )
  const reviewedVisibleItems = createMemo(() =>
    fileListViewMode() === "tree"
      ? flattenTree(reviewedTree(), expandedFolders())
      : flatReviewedItems(),
  )

  const allVisibleItems = createMemo(() => [...toReviewVisibleItems(), ...reviewedVisibleItems()])
  const selectedItem = createMemo(() => allVisibleItems()[selectedIndex()] ?? null)
  const selectedFile = createMemo(() => {
    const item = selectedItem()
    return item?.type === "file" ? item.file : null
  })

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
  
  // Calculate visible height for diff viewer (terminal height - app header - panel header - file header - status bar)
  const visibleHeight = createMemo(() => dimensions().height - 5)

  // Clear reviewed state when loading a new set of files
  createEffect(() => {
    filesGeneration() // track dependency
    setReviewedPaths(new Set<string>())
    setReviewedOrder([])
    setSelectedIndex(0)
    setScrollOffset(0)
    setExpandedFolders(collectFolderPaths(buildFileTree(files())))
    lastSelectedFilePath = null
  })

  // Persist settings whenever they change
  createEffect(() => {
    if (!settingsLoaded()) return
    saveSettings({
      diffViewMode: diffViewMode(),
      showLineBg: showLineBg(),
      fileListViewMode: fileListViewMode(),
    })
  })

  // Clamp selected index when file list changes
  createEffect(() => {
    const count = allVisibleItems().length
    const current = selectedIndex()
    if (count === 0) {
      if (current !== 0) setSelectedIndex(0)
    } else if (current >= count) {
      setSelectedIndex(count - 1)
    }
  })

  // When selected file changes, load its details if needed (lazy loading for commit/branch modes)
  createEffect(() => {
    const file = selectedFile()
    const currentMode = mode()
    const currentViewState = viewState()

    if (file && file.path !== lastSelectedFilePath && currentViewState === "files") {
      lastSelectedFilePath = file.path

      // perf measurement removed

      // Clear search state when switching files
      clearSearch()

      // Check if file needs lazy loading (no content yet)
      if (!file.content && (currentMode === "commit" || currentMode === "branch")) {
        setLoadingFile(true)

        const compareTarget =
          currentMode === "commit" && selectedCommit()
            ? { type: "commit" as const, hash: selectedCommit()!.hash }
            : currentMode === "branch" && selectedBranch()
              ? { type: "branch" as const, name: selectedBranch()!.name }
              : { type: "dirty" as const }

        loadFileDetails(file, compareTarget).then((loadedFile) => {
          // Update the file in the files array
          setFiles((prev) => prev.map((f) => (f.path === loadedFile.path ? loadedFile : f)))
          setLoadingFile(false)
          // Set scroll to first change line and reset chunk index
          const contextLines = 5
          const targetLine = diffViewMode() === "full"
            ? Math.max(0, loadedFile.firstChangeLine - contextLines)
            : Math.max(0, loadedFile.firstChangeDiffLine - contextLines)
          setScrollOffset(targetLine)
        }).catch((err) => {
          console.error("Failed to load file:", file.path, err)
          setLoadingFile(false)
        }).catch(() => {
          // If loading fails, still mark as not loading
          setLoadingFile(false)
        })
      } else {
        // File already has content, just update scroll and reset chunk index
        const contextLines = 5
        const targetLine = diffViewMode() === "full"
          ? Math.max(0, file.firstChangeLine - contextLines)
          : Math.max(0, file.firstChangeDiffLine - contextLines)
        setScrollOffset(targetLine)
      }
    }
  })

  // Eagerly preload syntax highlighting for nearby files when the current
  // selection changes. Only preloads when the worker is idle and the file is
  // small enough to avoid delaying the current file's highlight.
  createEffect(() => {
    const items = allVisibleItems()
    const index = selectedIndex()
    const nextFileItem = items.slice(index + 1).find((item): item is TreeFile => item.type === "file")
    if (nextFileItem?.file.content && !nextFileItem.file.isBinary) {
      preloadHighlight(nextFileItem.file.content, nextFileItem.file.path)
    }
  })

  // Load data helpers
  const loadDirtyChanges = async () => {
    setLoading(true)
    setError(null)
    setFilesGeneration(g => g + 1)
    try {
      const changes = await getGitChanges()
      setFiles(changes)
      // perf measurement removed
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
    setFilesGeneration(g => g + 1)
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
    setFilesGeneration(g => g + 1)
    try {
      const changes = await getBranchChanges(branch.name)
      setFiles(changes)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load branch changes")
    } finally {
      setLoading(false)
    }
  }
  
  // Load settings and git changes on mount
  ;(async () => {
    const settings = await loadSettings()
    setDiffViewMode(settings.diffViewMode)
    setShowLineBg(settings.showLineBg)
    setFileListViewMode(settings.fileListViewMode)
    setSettingsLoaded(true)
    await loadDirtyChanges()
  })()
  
  // Helper to get max scroll for current file, accounting for line wrapping in narrow panes
  const getMaxScroll = () => {
    const file = selectedFile()
    if (!file) return 0

    const viewportHeight = visibleHeight()

    if (diffViewMode() === "full") {
      const lines = file.content.split("\n")
      const lineNumberWidth = Math.max(4, String(lines.length).length + 1)
      const contentWidth = Math.max(1, diffViewerWidth() - lineNumberWidth - 1)
      return computeWrappedMaxScroll(lines, contentWidth, viewportHeight)
    }

    const parsedDiff = parseDiff(file.diff ?? "")
    const lineNumberWidth = Math.max(4, String(parsedDiff.length).length + 1)
    const contentWidth = Math.max(1, diffViewerWidth() - lineNumberWidth - 1)
    return computeWrappedMaxScroll(parsedDiff, contentWidth, viewportHeight)
  }
  
  const getDiffChunkPositions = (): number[] => {
    const file = selectedFile()
    if (!file || !file.diff) return []

    const parsedDiff = parseDiff(file.diff)
    const chunks: number[] = []

    let chunkStart = -1

    for (let i = 0; i < parsedDiff.length; i++) {
      const line = parsedDiff[i]!
      if (line.type === "addition" || line.type === "deletion") {
        if (chunkStart === -1) {
          chunkStart = i
          chunks.push(chunkStart)
        }
      } else {
        // Context or header line - end current chunk
        chunkStart = -1
      }
    }

    return chunks
  }

  const getFullChunkPositions = (): number[] => {
    const file = selectedFile()
    if (!file) return []

    // Use changed line positions in the new file; group consecutive lines into chunks
    const indices = [...file.changedLines].sort((a, b) => a - b)
    if (indices.length === 0) return []

    const chunks: number[] = [indices[0]!]
    for (let i = 1; i < indices.length; i++) {
      const prev = indices[i - 1]!
      const cur = indices[i]!
      if (cur !== prev + 1) {
        chunks.push(cur)
      }
    }
    return chunks
  }
  
  // Get sorted chunk start positions from parsed diff
  // A chunk is a contiguous group of changed lines (additions/deletions)
  const getChunkPositions = (): number[] => {
    return diffViewMode() === "full" ? getFullChunkPositions() : getDiffChunkPositions()
  }
  
  // Total chunk count for display
  const chunkCount = createMemo(() => getChunkPositions().length)

  // Current chunk index derived from scroll position (0-based, -1 means none)
  const currentChunkIndex = createMemo(() => {
    const chunks = getChunkPositions()
    if (chunks.length === 0) return -1

    const top = scrollOffset()
    const bottom = top + Math.max(0, visibleHeight() - 1)

    // Prefer a chunk whose start is visible in the viewport
    for (let i = 0; i < chunks.length; i++) {
      const start = chunks[i]!
      if (start >= top && start <= bottom) return i
    }

    // Otherwise, use the last chunk above the viewport
    let lastAbove = -1
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i]! < top) lastAbove = i
      else break
    }
    return lastAbove
  })
  
  // Jump to a specific chunk by index
  const jumpToChunk = (index: number) => {
    const chunks = getChunkPositions()
    if (chunks.length === 0) return
    
    const contextLines = 5
    const chunkStart = chunks[index]!
    const targetLine = Math.max(0, chunkStart - contextLines)
    setScrollOffset(Math.min(targetLine, getMaxScroll()))
  }
  
  // Jump to next chunk (n key)
  const jumpToNextChunk = () => {
    const chunks = getChunkPositions()
    if (chunks.length === 0) return
    
    const currentIdx = currentChunkIndex()
    const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % chunks.length
    jumpToChunk(nextIdx)
  }
  
  // Jump to previous chunk (N key)
  const jumpToPrevChunk = () => {
    const chunks = getChunkPositions()
    if (chunks.length === 0) return

    const currentIdx = currentChunkIndex()
    const prevIdx = currentIdx <= 0 ? chunks.length - 1 : currentIdx - 1
    jumpToChunk(prevIdx)
  }

  // Execute search and find all matches
  const executeSearch = () => {
    const query = searchQuery()
    const file = selectedFile()
    if (!query || !file) {
      setSearchMatches([])
      setSearchActive(false)
      return
    }

    const lines = file.content.split("\n")
    const matches: Array<{ line: number; start: number; length: number }> = []

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]!
      let startIdx = 0
      while (true) {
        const foundIdx = line.indexOf(query, startIdx)
        if (foundIdx === -1) break
        matches.push({ line: lineIdx, start: foundIdx, length: query.length })
        startIdx = foundIdx + 1
      }
    }

    setSearchMatches(matches)
    setCurrentMatchIndex(0)
    setSearchActive(true)

    // Jump to first match if found
    if (matches.length > 0) {
      const firstMatch = matches[0]!
      const contextLines = 5
      const targetLine = Math.max(0, firstMatch.line - contextLines)
      setScrollOffset(Math.min(targetLine, getMaxScroll()))
    }
  }

  // Jump to next search match
  const jumpToNextMatch = () => {
    const matches = searchMatches()
    if (matches.length === 0) return

    const nextIdx = (currentMatchIndex() + 1) % matches.length
    setCurrentMatchIndex(nextIdx)

    const match = matches[nextIdx]!
    const contextLines = 5
    const targetLine = Math.max(0, match.line - contextLines)
    setScrollOffset(Math.min(targetLine, getMaxScroll()))
  }

  // Jump to previous search match
  const jumpToPrevMatch = () => {
    const matches = searchMatches()
    if (matches.length === 0) return

    const prevIdx = currentMatchIndex() <= 0 ? matches.length - 1 : currentMatchIndex() - 1
    setCurrentMatchIndex(prevIdx)

    const match = matches[prevIdx]!
    const contextLines = 5
    const targetLine = Math.max(0, match.line - contextLines)
    setScrollOffset(Math.min(targetLine, getMaxScroll()))
  }

  // Mouse scroll handler for left sidebar (file/commit/branch lists)
  const handleSidebarScroll = (event: MouseEvent) => {
    if (event.type !== "scroll" || !event.scroll) return

    const delta = event.scroll.direction === "up" ? -4 : 4

    if (viewState() === "list") {
      // Commit or branch list
      if (mode() === "commit") {
        setListSelectedIndex(i => Math.max(0, Math.min(i + delta, commits().length - 1)))
      } else if (mode() === "branch") {
        setListSelectedIndex(i => Math.max(0, Math.min(i + delta, selectableBranches().length - 1)))
      }
    } else {
      // File list
      setSelectedIndex(i => Math.max(0, Math.min(i + delta, allVisibleItems().length - 1)))
    }
  }

  // Mouse scroll handler for diff viewer
  const handleDiffScroll = (event: MouseEvent) => {
    if (event.type !== "scroll" || !event.scroll) return

    const delta = event.scroll.direction === "up" ? -6 : 6
    setScrollOffset(o => {
      const maxScroll = getMaxScroll()
      return Math.max(0, Math.min(o + delta, maxScroll))
    })
  }

  useKeyboard(async (key) => {
    // Quit with q or Ctrl+c - ALWAYS works, regardless of state (except when in search mode)
    if ((key.ctrl && key.name === "c") || (key.name === "q" && !searchMode())) {
      renderer.destroy()
      return
    }

    // Search mode input handling
    if (searchMode()) {
      // Escape cancels search mode
      if (key.name === "escape") {
        clearSearch()
        return
      }
      // Enter executes the search
      if (key.name === "return") {
        setSearchMode(false)
        executeSearch()
        return
      }
      // Backspace removes last character
      if (key.name === "backspace") {
        setSearchQuery((q) => q.slice(0, -1))
        return
      }
      // Add printable characters to search query
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        setSearchQuery((q) => q + key.sequence)
        return
      }
      // Ignore other keys in search mode
      return
    }

    // Toggle help with ?
    if (key.name === "?" || key.sequence === "?") {
      setShowHelp((h) => !h)
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

    // Space to mark/unmark file as reviewed (only in files view)
    if (key.name === "space" && viewState() === "files" && selectedItem()) {
      const item = selectedItem()!

      if (item.type === "file") {
        const path = item.file.path
        const currentlyReviewed = reviewedPaths().has(path)

        if (currentlyReviewed) {
          setReviewedPaths(prev => {
            const next = new Set(prev)
            next.delete(path)
            return next
          })
          setReviewedOrder(prev => prev.filter(p => p !== path))
        } else {
          setReviewedPaths(prev => {
            const next = new Set(prev)
            next.add(path)
            return next
          })
          setReviewedOrder(prev => [path, ...prev.filter(p => p !== path)])
        }
      } else {
        // Folder: mark/unmark all files under it in the current section
        const toReviewLength = toReviewVisibleItems().length
        const isToReview = selectedIndex() < toReviewLength
        const tree = isToReview ? toReviewTree() : reviewedTree()
        const paths = getFilesInFolder(tree, item.path).map(f => f.path)

        if (isToReview) {
          setReviewedPaths(prev => new Set([...prev, ...paths]))
          setReviewedOrder(prev => [
            ...paths.filter(p => !prev.includes(p)),
            ...prev.filter(p => !paths.includes(p)),
          ])
        } else {
          setReviewedPaths(prev => {
            const next = new Set(prev)
            for (const path of paths) {
              next.delete(path)
            }
            return next
          })
          setReviewedOrder(prev => prev.filter(p => !paths.includes(p)))
        }
      }
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
      } else if (focusedPanel() === "files") {
        if (selectedItem()?.type === "folder") {
          // Toggle folder expand/collapse in tree view
          const folder = selectedItem() as TreeFolder
          setExpandedFolders(prev => {
            const next = new Set(prev)
            if (next.has(folder.path)) {
              next.delete(folder.path)
            } else {
              next.add(folder.path)
            }
            return next
          })
        } else if (selectedFile()) {
          // In files view: switch to diff panel
          setFocusedPanel("diff")
        }
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
        // perf measurement removed
        setSelectedIndex(i => Math.min(i + 1, allVisibleItems().length - 1))
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
        setSelectedIndex(allVisibleItems().length - 1)
      } else if (focusedPanel() === "diff") {
        setScrollOffset(getMaxScroll())
      }
      return
    }
    
    // t - toggle file list view mode (flat / tree)
    if (key.name === "t" && viewState() === "files") {
      const currentItem = selectedItem()
      setFileListViewMode(mode => (mode === "flat" ? "tree" : "flat"))
      // Preserve selection after the view mode switch
      queueMicrotask(() => {
        if (currentItem?.type === "file") {
          const newItems = allVisibleItems()
          const idx = newItems.findIndex(
            item => item.type === "file" && item.file.path === currentItem.file.path,
          )
          setSelectedIndex(idx >= 0 ? idx : Math.min(selectedIndex(), newItems.length - 1))
        } else {
          setSelectedIndex(Math.min(selectedIndex(), allVisibleItems().length - 1))
        }
      })
      return
    }

    // Global diff scroll controls (work from any panel when in files view)
    if (viewState() === "files" && selectedFile()) {
      const halfPage = Math.floor(visibleHeight() / 2)
      const fullPage = visibleHeight()
      const maxScroll = getMaxScroll()

      // / - start search mode
      if (key.sequence === "/") {
        if (diffViewMode() === "diff") {
          // Search is defined over full file lines; flip into full mode.
          setDiffViewMode("full")

          const file = selectedFile()!
          const parsed = parseDiff(file.diff ?? "")
          const current = parsed[Math.min(scrollOffset(), Math.max(0, parsed.length - 1))]
          const candidateLine = (current?.newLineNumber ?? current?.oldLineNumber ?? 1) - 1
          setScrollOffset(Math.max(0, Math.min(candidateLine, getMaxScroll())))
        }
        setSearchMode(true)
        setSearchQuery("")
        setSearchActive(false)
        return
      }

      // Escape clears active search
      if (key.name === "escape" && searchActive()) {
        clearSearch()
        return
      }

      // n/N - jump to next/prev search match (if search active) or chunk
      if (key.name === "n" && !key.shift) {
        if (searchActive() && searchMatches().length > 0) {
          jumpToNextMatch()
        } else {
          jumpToNextChunk()
        }
        return
      }
      if (key.name === "n" && key.shift) {
        if (searchActive() && searchMatches().length > 0) {
          jumpToPrevMatch()
        } else {
          jumpToPrevChunk()
        }
        return
      }

      // f - toggle between diff-only and full file view
      if (key.name === "f") {
        const nextMode = diffViewMode() === "diff" ? "full" : "diff"
        setDiffViewMode(nextMode)

        // Clear search: search currently only applies to full-file lines
        clearSearch()

        // Keep the user's approximate position: map diff index to file line when switching to full,
        // and map file line to nearest diff line when switching back to diff.
        const file = selectedFile()!

        if (nextMode === "full") {
          const parsed = parseDiff(file.diff ?? "")
          const current = parsed[Math.min(scrollOffset(), Math.max(0, parsed.length - 1))]
          const candidateLine = (current?.newLineNumber ?? current?.oldLineNumber ?? 1) - 1
          setScrollOffset(Math.max(0, Math.min(candidateLine, getMaxScroll())))
        } else {
          const parsed = parseDiff(file.diff ?? "")
          const currentFileLine = scrollOffset()

          let target = 0
          for (let i = 0; i < parsed.length; i++) {
            const l = parsed[i]!
            if (l.type === "header") continue
            const candidate = (l.newLineNumber ?? l.oldLineNumber ?? 1) - 1
            if (candidate >= currentFileLine) {
              target = i
              break
            }
          }

          setScrollOffset(Math.max(0, Math.min(target, getMaxScroll())))
        }

        return
      }
      
      // b - toggle background highlighting on diff lines
      if (key.name === "b") {
        setShowLineBg(v => !v)
        return
      }

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
      await openFileInEditor(selectedFile()!, {
        suspend: () => renderer.suspend(),
        resume: () => renderer.resume(),
      })
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
        const current = currentBranch() ?? "HEAD"
        const selected = selectedBranch()?.name ?? ""
        return `FILES (${files().length}) · ${current} vs ${selected}`
      }
    }
  }

  const filesHeaderWidth = () =>
    Math.max(1, (isNarrowMode() || viewState() === "list" ? dimensions().width : sidebarWidth()) - 1)
  const filesHeaderText = () => truncate(leftPanelHeader(), filesHeaderWidth())

  const diffHeaderWidth = () => Math.max(1, diffViewerWidth() - 1)

  const diffHeaderSuffix = () => {
    const maxSuffixWidth = Math.max(0, diffHeaderWidth() - 4)
    if (maxSuffixWidth === 0) return ""
    if (mode() === "commit" && selectedCommit()) {
      return truncate(` · ${selectedCommit()!.shortHash} ${selectedCommit()!.message}`, maxSuffixWidth)
    }
    if (mode() === "branch" && selectedBranch()) {
      return truncate(` · ${currentBranch() ?? "HEAD"} vs ${selectedBranch()!.name}`, maxSuffixWidth)
    }
    return ""
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
      const current = currentBranch() ?? "HEAD"
      return `${current} vs ${selectedBranch()!.name}`
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
      
      <box
        style={{
          flexDirection: "row",
          flexGrow: 1,
          height: "100%",
        }}
      >
        {/* Left sidebar - files, commits, or branches */}
        <Show when={!isNarrowMode() || focusedPanel() === "files"}>
          <box
            onMouseScroll={handleSidebarScroll}
            style={{
              width: isNarrowMode() || viewState() === "list" ? "100%" : sidebarWidth(),
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
              <text style={{ fg: focusedPanel() === "files" ? "#ffffff" : "#8b949e", width: filesHeaderWidth(), wrapMode: "none" }}>
                <b>{filesHeaderText()}</b>
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
                    toReviewItems={toReviewVisibleItems()}
                    reviewedItems={reviewedVisibleItems()}
                    selectedIndex={selectedIndex()}
                    focused={focusedPanel() === "files"}
                    width={sidebarWidth()}
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
                      width={isNarrowMode() || viewState() === "list" ? dimensions().width : sidebarWidth()}
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
                      width={isNarrowMode() || viewState() === "list" ? dimensions().width : sidebarWidth()}
                    />
                  </Show>
                </Show>
              </Show>
            </Show>
          </box>
        </Show>
        
        {/* Diff viewer - only shown when reviewing files */}
        <Show when={viewState() === "files" && (!isNarrowMode() || focusedPanel() === "diff")}>
          <box
            onMouseScroll={handleDiffScroll}
            style={{
              flexGrow: isNarrowMode() ? 1 : 1,
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
              <text style={{ fg: focusedPanel() === "diff" ? "#ffffff" : "#8b949e", width: diffHeaderWidth(), wrapMode: "none" }}>
                <b>DIFF</b>
                {diffHeaderSuffix()}
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
                  currentChunk={currentChunkIndex()}
                  totalChunks={chunkCount()}
                  viewMode={diffViewMode()}
                  showLineBg={showLineBg()}
                  isReviewed={selectedFile() ? reviewedPaths().has(selectedFile()!.path) : false}
                  width={diffViewerWidth()}
                />
              </Show>
            </Show>
          </box>
        </Show>
      </box>
      
      <StatusBar
        mode={mode()}
        viewState={viewState()}
        visibleItemCount={allVisibleItems().length}
        selectedIndex={selectedIndex()}
        focusedPanel={focusedPanel()}
        listCount={mode() === "commit" ? commits().length : selectableBranches().length}
        listSelectedIndex={listSelectedIndex()}
        contextInfo={contextInfo()}
        searchMode={searchMode()}
        searchQuery={searchQuery()}
        searchActive={searchActive()}
        searchMatchCount={searchMatches().length}
        currentMatchIndex={currentMatchIndex()}
        diffViewMode={diffViewMode()}
        showLineBg={showLineBg()}
        fileListViewMode={fileListViewMode()}
      />
      
      <Show when={showHelp()}>
        <HelpDialog onClose={() => setShowHelp(false)} />
      </Show>
    </box>
  )
}
