export type AppMode = "dirty" | "commit" | "branch"

export interface CommitInfo {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
}

export interface BranchInfo {
  name: string
  isCurrent: boolean
  shortHash: string
  date: string
  message: string
}

export interface FileChange {
  path: string
  status: "added" | "modified" | "deleted" | "renamed" | "untracked" | "conflicted"
  oldPath?: string // for renamed files
  additions: number
  deletions: number
  diff: string
  content: string // Full file content
  firstChangeLine: number // 0-indexed line number of first change (deprecated, for backward compat)
  firstChangeDiffLine: number // 0-indexed index of first change in parsed diff
  changedLines: Set<number> // Set of changed line numbers (0-indexed)
  addedLines: Set<number> // Set of added line numbers (0-indexed)
  removedLines: Set<number> // Set of removed line numbers (0-indexed)
  isBinary: boolean // Whether the file is binary and should not be rendered as text
  fingerprint: string // Hash of everything shown in the review view for this file
}

// Target directory for git operations
let targetDir = process.cwd()
let cachedGitRoot: string | null = null

export function setTargetDir(dir: string) {
  targetDir = dir
  cachedGitRoot = null
}

export function getTargetDir() {
  return targetDir
}

// Bun.$ subprocess promises can permanently hang when spawned while a Worker
// is starting up (observed on Bun 1.3.x with the syntax-highlight worker).
// A hung spawn never resolves, which would wedge file loading forever, so
// every git invocation is retried with a timeout.
const gitTimeoutMs = 10000
const gitAttempts = 3

export async function runGit<T>(
  command: () => Promise<T>,
  options: { timeoutMs?: number; attempts?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? gitTimeoutMs
  const maxAttempts = options.attempts ?? gitAttempts
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        command(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`git command timed out after ${timeoutMs}ms`)),
            timeoutMs,
          )
        }),
      ])
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError
}

// Run async tasks over items with bounded concurrency to limit the number of
// simultaneous git subprocesses.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index]!)
    }
  })
  await Promise.all(lanes)
  return results
}

const maxConcurrentFileLoads = 8

// Get the git repository root directory
export async function getGitRoot(): Promise<string> {
  if (cachedGitRoot) {
    return cachedGitRoot
  }
  try {
    const result = await runGit(() => Bun.$`git -C ${targetDir} rev-parse --show-toplevel`.quiet())
    cachedGitRoot = result.stdout.toString().trim()
    return cachedGitRoot
  } catch {
    return targetDir
  }
}

export interface DiffLine {
  type: "context" | "addition" | "deletion" | "header"
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

// Width for the line number gutter, sized so the largest displayed line
// number always fits (plus one trailing space).
export function getLineNumberWidth(diffLines: DiffLine[], fileLineCount: number): number {
  let max = fileLineCount
  for (const line of diffLines) {
    if (line.newLineNumber !== undefined && line.newLineNumber > max) max = line.newLineNumber
    if (line.oldLineNumber !== undefined && line.oldLineNumber > max) max = line.oldLineNumber
  }
  return Math.max(4, String(max).length + 1)
}

async function readFileContent(path: string): Promise<string> {
  try {
    const gitRoot = await getGitRoot()
    const fullPath = `${gitRoot}/${path}`
    const file = Bun.file(fullPath)
    return await file.text()
  } catch (err) {
    console.error(`Failed to read file: ${path}`, err)
    return ""
  }
}

// Common binary file extensions that should not be rendered as text
const binaryExtensions = new Set([
  "gz", "zip", "tar", "rar", "7z", "bz2", "xz",
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "ico", "svgz",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "exe", "dll", "so", "dylib", "bin", "o", "a",
  "sqlite", "sqlite3", "db", "wal", "shm",
  "wasm", "mp3", "mp4", "avi", "mov", "mkv", "webm",
  "woff", "woff2", "ttf", "otf", "eot",
  "class", "jar", "war", "ear",
  "pyc", "pyo", "o", "obj", "lib",
  "yarn-state", "install-state",
])

function isBinaryByExtension(filePath: string): boolean {
  const parts = filePath.split(".")
  if (parts.length < 2) return false
  const ext = parts[parts.length - 1]
  if (!ext) return false
  return binaryExtensions.has(ext.toLowerCase())
}

// Check if content contains null bytes (standard binary heuristic)
function isBinaryContent(content: string): boolean {
  const sample = content.slice(0, 8192)
  return sample.includes("\0")
}

// Check if git diff indicates a binary file
function isBinaryDiff(diff: string): boolean {
  return diff.includes("Binary files") || diff.includes("\0")
}

// Detect if a file is binary based on all available signals
export function detectBinaryFile(filePath: string, content: string, diff: string): boolean {
  if (isBinaryByExtension(filePath)) return true
  if (diff && isBinaryDiff(diff)) return true
  if (content && isBinaryContent(content)) return true
  return false
}

function generateUnifiedDiff(filePath: string, content: string): string {
  const lines = content.split("\n")
  const diffLines: string[] = [
    `@@ -0,0 +1,${lines.length} @@`,
  ]
  
  for (const line of lines) {
    diffLines.push(`+${line}`)
  }
  
  return diffLines.join("\n")
}

// Unmerged porcelain status codes (both sides changed in conflicting ways)
const unmergedStatusCodes = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"])

// Generate a synthetic unified diff for a conflicted file so conflict blocks
// are visible in diff mode. Lines inside a conflict block (markers and both
// sides) are emitted as additions; surrounding lines are context. Unmerged
// paths have no staged diff and `git diff` emits a combined diff (diff --cc)
// that doesn't parse as a normal unified diff, hence the synthetic version.
export function generateConflictDiff(content: string): string {
  const lines = content.split("\n")
  const conflict = new Array<boolean>(lines.length).fill(false)
  let inBlock = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.startsWith("<<<<<<<")) inBlock = true
    if (inBlock) conflict[i] = true
    if (line.startsWith(">>>>>>>")) inBlock = false
  }

  const contextLines = 3
  const diffLines: string[] = []
  let i = 0
  while (i < lines.length) {
    if (!conflict[i]) {
      i++
      continue
    }

    const hunkStart = Math.max(0, i - contextLines)
    let lastConflict = i
    let j = i + 1
    while (j < lines.length) {
      if (conflict[j]) {
        lastConflict = j
        j++
      } else if (j - lastConflict <= contextLines * 2) {
        j++
      } else {
        break
      }
    }
    const hunkEnd = Math.min(lines.length - 1, lastConflict + contextLines)

    let oldCount = 0
    for (let k = hunkStart; k <= hunkEnd; k++) {
      if (!conflict[k]) oldCount++
    }
    const newCount = hunkEnd - hunkStart + 1
    diffLines.push(`@@ -${hunkStart + 1},${oldCount} +${hunkStart + 1},${newCount} @@`)
    for (let k = hunkStart; k <= hunkEnd; k++) {
      diffLines.push(`${conflict[k] ? "+" : " "}${lines[k]}`)
    }

    i = hunkEnd + 1
  }

  return diffLines.join("\n")
}

interface ParsedChanges {
  changedLines: number[]
  addedLines: number[]
  removedLines: number[]
}

// Parse a diff to extract the line numbers that were changed (0-indexed, in the new file)
export function parseChangedLines(diff: string): ParsedChanges {
  const changedLines: number[] = []
  const addedLines: number[] = []
  const removedLines: number[] = []
  let currentLine = 0
  
  for (const line of diff.split("\n")) {
    if (line.startsWith("@@")) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        currentLine = parseInt(match[1] ?? "1", 10) - 1 // Convert to 0-indexed
      }
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      // Addition - this line exists in new file
      changedLines.push(currentLine)
      addedLines.push(currentLine)
      currentLine++
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      // Deletion - don't increment currentLine (line doesn't exist in new file).
      // Record the position in changedLines so navigation can jump here, but do
      // NOT add it to removedLines: the position points at the next surviving
      // new-file line, which must not be painted as removed. Deleted content is
      // shown inline via buildRemovedLinesByPosition in the diff viewer, and
      // fully deleted files mark every line removed in getGitChanges.
      changedLines.push(currentLine)
    } else if (line.startsWith(" ") || line === "") {
      // Context line
      currentLine++
    }
  }
  
  return { changedLines, addedLines, removedLines }
}

// Hash of everything the review view shows for a file: its status, path(s),
// the diff that determines the highlighted changes, and the full content
// rendered inline. Used to detect that the repo state changed after the view
// was loaded (see commitFiles).
export function computeFileFingerprint(file: {
  path: string
  oldPath?: string
  status: FileChange["status"]
  diff: string
  content: string
  isBinary: boolean
}): string {
  return String(
    Bun.hash(
      [file.status, file.oldPath ?? "", file.path, file.diff, file.content, file.isBinary ? "1" : "0"].join("\0"),
    ),
  )
}

export async function getGitChanges(): Promise<FileChange[]> {
  const changes: FileChange[] = []
  
  const gitRoot = await getGitRoot()
  
  // Get staged and unstaged changes
  // Use -uall to show all untracked files (not just directories).
  // Use -z so paths are NUL-separated and never C-quoted (the line format
  // quotes paths containing spaces or special characters).
  const statusResult = await runGit(() => Bun.$`git -C ${gitRoot} status --porcelain -z -uall`.text())

  if (!statusResult.trim()) {
    return []
  }

  const entries = statusResult.split("\0").filter(e => e.length > 0)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!

    const statusCode = entry.substring(0, 2)
    let filePath = entry.substring(3)
    let oldPath: string | undefined

    // Renames/copies: in -z mode the new path comes first and the source
    // path follows as the next NUL-separated field.
    if (statusCode.includes("R") || statusCode.includes("C")) {
      oldPath = entries[++i]
    }

    // Skip directories (they end with /)
    if (filePath.endsWith("/")) {
      continue
    }
    
    let status: FileChange["status"]
    
    // Parse status codes
    const staged = statusCode[0]
    const unstaged = statusCode[1]
    
    if (unmergedStatusCodes.has(statusCode)) {
      status = "conflicted"
    } else if (staged === "A" || unstaged === "A") {
      status = "added"
    } else if (staged === "D" || unstaged === "D") {
      status = "deleted"
    } else if (staged === "R" || unstaged === "R") {
      status = "renamed"
    } else if (staged === "?" && unstaged === "?") {
      status = "untracked"
    } else {
      status = "modified"
    }
    
    // Get diff and full content for this file
    let diff = ""
    let content = ""
    let additions = 0
    let deletions = 0
    const changedLines = new Set<number>()
    const addedLines = new Set<number>()
    const removedLines = new Set<number>()
    let firstChangeLine = 0
    let firstChangeDiffLine = 0 // Index of first change in the parsed diff
    
    try {
      if (status === "untracked") {
        // For untracked files, read content and generate diff
        content = await readFileContent(filePath)
        if (content) {
          diff = generateUnifiedDiff(filePath, content)
          additions = content.split("\n").length
          // All lines are additions for untracked files
          for (let i = 0; i < additions; i++) {
            changedLines.add(i)
            addedLines.add(i)
          }
        }
      } else if (status === "deleted") {
        // For deleted files, get content from git
        const result = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff HEAD -- ${filePath}`.quiet())
        diff = result.stdout.toString()
        // Get the old content from git
        const showResult = await runGit(() => Bun.$`git -C ${gitRoot} show HEAD:${filePath}`.quiet())
        content = showResult.stdout.toString()
        // All lines are deletions
        const lines = content.split("\n")
        for (let i = 0; i < lines.length; i++) {
          changedLines.add(i)
          removedLines.add(i)
        }
      } else {
        // For modified/added/renamed/conflicted files - get current content
        content = await readFileContent(filePath)
        
        if (status === "conflicted") {
          // Conflicted files still contain the conflict markers in the working
          // tree; build a synthetic diff around them.
          diff = generateConflictDiff(content)
        } else if (status === "renamed" && oldPath) {
          const stagedResult = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff --cached -- ${oldPath} ${filePath}`.quiet())
          const unstagedResult = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff -- ${oldPath} ${filePath}`.quiet())
          diff = stagedResult.stdout.toString() || unstagedResult.stdout.toString()
        } else {
          const stagedResult = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff --cached -- ${filePath}`.quiet())
          const unstagedResult = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff -- ${filePath}`.quiet())
          diff = stagedResult.stdout.toString() || unstagedResult.stdout.toString()
        }
        
        // Parse diff to find changed lines
        const { changedLines: parsedChanged, addedLines: parsedAdded, removedLines: parsedRemoved } = parseChangedLines(diff)
        for (const line of parsedChanged) {
          changedLines.add(line)
        }
        for (const line of parsedAdded) {
          addedLines.add(line)
        }
        for (const line of parsedRemoved) {
          removedLines.add(line)
        }
      }
      
      // Count additions/deletions from diff
      if (diff && status !== "untracked") {
        for (const diffLine of diff.split("\n")) {
          if (diffLine.startsWith("+") && !diffLine.startsWith("+++")) {
            additions++
          } else if (diffLine.startsWith("-") && !diffLine.startsWith("---")) {
            deletions++
          }
        }
      }
      
      // Find first changed line
      if (changedLines.size > 0) {
        firstChangeLine = Math.min(...changedLines)
      }
      
      // Find first change in the diff (for scrolling)
      const parsedDiff = parseDiff(diff)
      for (let i = 0; i < parsedDiff.length; i++) {
        if (parsedDiff[i]!.type === "addition" || parsedDiff[i]!.type === "deletion") {
          firstChangeDiffLine = i
          break
        }
      }
    } catch {
      // Ignore diff errors
    }
    
    const isBinary = detectBinaryFile(filePath, content, diff)
    
    // For binary files, don't store raw content/diff to avoid leaking
    // binary data into the terminal renderer
    if (isBinary) {
      diff = ""
      content = ""
    }
    
    changes.push({
      path: filePath,
      status,
      oldPath,
      additions,
      deletions,
      diff,
      content,
      firstChangeLine,
      firstChangeDiffLine,
      changedLines,
      addedLines,
      removedLines,
      isBinary,
      fingerprint: computeFileFingerprint({ path: filePath, oldPath, status, diff, content, isBinary }),
    })
  }
  
  return changes
}

// Stage the given files and create a commit containing only their changes.
// Renamed files contribute both their old and new paths so the deletion is
// committed too. The pathspec on commit keeps unrelated staged changes out
// of the commit.
//
// Files carrying a fingerprint (taken from the FileChange shown in the
// review view) are re-verified against the current repo state first: if a
// file changed since the view was loaded, the commit is aborted so it can
// never contain more or fewer changes than what was reviewed. Re-running
// getGitChanges guarantees the comparison uses the exact same computation
// that produced the shown state.
export async function commitFiles(
  files: Array<{ path: string; oldPath?: string; status?: FileChange["status"]; fingerprint?: string }>,
  message: string,
): Promise<void> {
  const gitRoot = await getGitRoot()
  const fingerprinted = files.filter(f => f.fingerprint !== undefined)
  if (fingerprinted.length > 0) {
    const current = await getGitChanges()
    const currentByPath = new Map(current.map(c => [c.path, c.fingerprint]))
    const stale = fingerprinted.filter(f => currentByPath.get(f.path) !== f.fingerprint)
    if (stale.length > 0) {
      throw new Error(
        `${stale.map(f => f.path).join(", ")} changed since the review was loaded. Refresh and try again.`,
      )
    }
  }
  // Deleted files are staged via rm --cached: once a deletion is already
  // staged (git rm), the path exists in neither the working tree nor the
  // index, so a plain add fails to match it. Same for renamed-away paths.
  const deletedPaths = files.filter(f => f.status === "deleted").map(f => f.path)
  const addPaths = files.filter(f => f.status !== "deleted").map(f => f.path)
  const oldPaths = files.map(f => f.oldPath).filter((p): p is string => !!p)
  const removedPaths = [...new Set([...deletedPaths, ...oldPaths])]
  try {
    if (addPaths.length > 0) {
      await runGit(() => Bun.$`git -C ${gitRoot} add -- ${addPaths}`.quiet())
    }
    if (removedPaths.length > 0) {
      await runGit(() => Bun.$`git -C ${gitRoot} rm -q --cached --ignore-unmatch -- ${removedPaths}`.quiet())
    }
    await runGit(() => Bun.$`git -C ${gitRoot} commit -m ${message} -- ${[...addPaths, ...removedPaths]}`.quiet())
  } catch (e) {
    const stderr = (e as { stderr?: unknown })?.stderr
    const detail = stderr ? new TextDecoder().decode(stderr as Uint8Array).trim() : ""
    throw new Error(detail || (e instanceof Error ? e.message : "Commit failed"))
  }
}

export function parseDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = []
  let oldLineNum = 0
  let newLineNum = 0
  
  for (const line of diff.split("\n")) {
    if (line.startsWith("@@")) {
      // Parse hunk header: @@ -start,count +start,count @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldLineNum = parseInt(match[1] ?? "1", 10)
        newLineNum = parseInt(match[2] ?? "1", 10)
      }
      lines.push({ type: "header", content: line })
    } else if (line.startsWith("+++") || line.startsWith("---")) {
      // File header, skip
      continue
    } else if (line.startsWith("diff --git") || line.startsWith("new file") || line.startsWith("index ")) {
      // Git diff header, skip
      continue
    } else if (line.startsWith("+")) {
      lines.push({
        type: "addition",
        content: line.substring(1),
        newLineNumber: newLineNum,
      })
      newLineNum++
    } else if (line.startsWith("-")) {
      lines.push({
        type: "deletion",
        content: line.substring(1),
        oldLineNumber: oldLineNum,
      })
      oldLineNum++
    } else if (line.startsWith(" ") || line === "") {
      // Only count as context if we're past the header
      if (oldLineNum > 0 || newLineNum > 0) {
        lines.push({
          type: "context",
          content: line.substring(1) || "",
          oldLineNumber: oldLineNum,
          newLineNumber: newLineNum,
        })
        oldLineNum++
        newLineNum++
      }
    }
  }
  
  return lines
}

// Get list of recent commits
export async function getCommitList(limit = 50): Promise<CommitInfo[]> {
  try {
    const format = "%H|%h|%an|%ar|%s"
    const result = await runGit(() => Bun.$`git -C ${targetDir} log --format=${format} -n ${limit}`.quiet())
    const output = result.stdout.toString().trim()
    
    if (!output) {
      return []
    }
    
    return output.split("\n").map(line => {
      const [hash, shortHash, author, date, ...messageParts] = line.split("|")
      return {
        hash: hash ?? "",
        shortHash: shortHash ?? "",
        author: author ?? "",
        date: date ?? "",
        message: messageParts.join("|"), // In case message contains |
      }
    })
  } catch {
    return []
  }
}

// Get current branch name (null if detached HEAD)
export async function getCurrentBranch(): Promise<string | null> {
  try {
    const result = await runGit(() => Bun.$`git -C ${targetDir} rev-parse --abbrev-ref HEAD`.quiet())
    const branch = result.stdout.toString().trim()
    if (branch === "HEAD") {
      return null // Detached HEAD
    }
    return branch
  } catch {
    return null
  }
}

// Get list of local branches (sorted by most recently committed)
export async function getBranchList(): Promise<BranchInfo[]> {
  try {
    const format = "%(refname:short)|%(HEAD)|%(objectname:short)|%(committerdate:relative)|%(subject)"
    const result = await runGit(() => Bun.$`git -C ${targetDir} branch --sort=-committerdate --format=${format}`.quiet())
    const output = result.stdout.toString().trim()
    
    if (!output) {
      return []
    }
    
    return output.split("\n").map(line => {
      const [name, head, shortHash, date, ...messageParts] = line.split("|")
      return {
        name: name ?? "",
        isCurrent: head === "*",
        shortHash: shortHash ?? "",
        date: date ?? "",
        message: messageParts.join("|"),
      }
    })
  } catch {
    return []
  }
}

// Get files changed in a specific commit (shows what that commit introduced)
// Loads full diffs/content eagerly so behavior matches dirty mode.
export async function getCommitChanges(commitHash: string): Promise<FileChange[]> {
  try {
    // Get file list only (fast) - stats loaded eagerly per file below
    const statusResult = await runGit(() => Bun.$`git -C ${targetDir} diff-tree --no-commit-id --name-status -r --root ${commitHash}`.quiet())
    const statusOutput = statusResult.stdout.toString().trim()

    if (!statusOutput) {
      return []
    }

    // Parse name-status
    const changes: FileChange[] = []
    for (const line of statusOutput.split("\n")) {
      if (!line.trim()) continue

      const parts = line.split("\t")
      const statusCode = parts[0]
      let filePath = parts.slice(1).join("\t")
      let oldPath: string | undefined

      if (statusCode?.startsWith("R")) {
        oldPath = parts[1]
        filePath = parts[2] ?? filePath
      }

      let status: FileChange["status"]
      switch (statusCode?.[0]) {
        case "A": status = "added"; break
        case "D": status = "deleted"; break
        case "R": status = "renamed"; break
        default: status = "modified"
      }

      changes.push({
        path: filePath,
        status,
        oldPath,
        additions: 0,
        deletions: 0,
        diff: "",
        content: "",
        firstChangeLine: 0,
        firstChangeDiffLine: 0,
        changedLines: new Set<number>(),
        addedLines: new Set<number>(),
        removedLines: new Set<number>(),
        isBinary: false,
        fingerprint: "",
      })
    }

    // Eagerly load full content/diff for every file to match dirty mode behavior
    const loaded = await mapWithConcurrency(
      changes,
      maxConcurrentFileLoads,
      (file) => loadFileDetails(file, { type: "commit", hash: commitHash }),
    )

    return loaded
  } catch {
    return []
  }
}

// Get files changed between current branch and target branch
// Loads full diffs/content eagerly so behavior matches dirty mode.
export async function getBranchChanges(targetBranch: string): Promise<FileChange[]> {
  try {
    // Get file list only (fast) - stats loaded eagerly per file below
    const statusResult = await runGit(() => Bun.$`git -C ${targetDir} diff --name-status ${targetBranch}...HEAD`.quiet())
    const statusOutput = statusResult.stdout.toString().trim()

    if (!statusOutput) {
      return []
    }

    // Parse name-status: status\tfilepath
    const changes: FileChange[] = []
    for (const line of statusOutput.split("\n")) {
      if (!line.trim()) continue

      const parts = line.split("\t")
      const statusCode = parts[0]
      let filePath = parts.slice(1).join("\t")
      let oldPath: string | undefined

      if (statusCode?.startsWith("R")) {
        oldPath = parts[1]
        filePath = parts[2] ?? filePath
      }

      let status: FileChange["status"]
      switch (statusCode?.[0]) {
        case "A": status = "added"; break
        case "D": status = "deleted"; break
        case "R": status = "renamed"; break
        default: status = "modified"
      }

      changes.push({
        path: filePath,
        status,
        oldPath,
        additions: 0,
        deletions: 0,
        diff: "",
        content: "",
        firstChangeLine: 0,
        firstChangeDiffLine: 0,
        changedLines: new Set<number>(),
        addedLines: new Set<number>(),
        removedLines: new Set<number>(),
        isBinary: false,
        fingerprint: "",
      })
    }

    // Eagerly load full content/diff for every file to match dirty mode behavior
    const loaded = await mapWithConcurrency(
      changes,
      maxConcurrentFileLoads,
      (file) => loadFileDetails(file, { type: "branch", name: targetBranch }),
    )

    return loaded
  } catch {
    return []
  }
}

// Load full content and diff for a specific file (called when file is selected)
export async function loadFileDetails(
  file: FileChange,
  compareTarget: { type: "commit"; hash: string } | { type: "branch"; name: string } | { type: "dirty" }
): Promise<FileChange> {
  try {
    const gitRoot = await getGitRoot()
    let diff = ""
    let content = ""
    
    if (compareTarget.type === "dirty") {
      // Dirty mode - current working tree changes
      if (file.status === "untracked") {
        content = await readFileContent(file.path)
        diff = generateUnifiedDiff(file.path, content)
      } else if (file.status === "deleted") {
        const result = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff HEAD -- ${file.path}`.quiet())
        diff = result.stdout.toString()
        const showResult = await runGit(() => Bun.$`git -C ${gitRoot} show HEAD:${file.path}`.quiet())
        content = showResult.stdout.toString()
      } else {
        content = await readFileContent(file.path)
        // For renamed files, include both old and new paths so git reports the
        // rename metadata instead of showing the new path as a new file.
        if (file.status === "renamed" && file.oldPath) {
          const stagedResult = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff --cached -- ${file.oldPath} ${file.path}`.quiet())
          const unstagedResult = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff -- ${file.oldPath} ${file.path}`.quiet())
          diff = stagedResult.stdout.toString() || unstagedResult.stdout.toString()
        } else {
          const stagedResult = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff --cached -- ${file.path}`.quiet())
          const unstagedResult = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff -- ${file.path}`.quiet())
          diff = stagedResult.stdout.toString() || unstagedResult.stdout.toString()
        }
      }
    } else if (compareTarget.type === "commit") {
      // Commit mode - changes in a specific commit
      const hash = compareTarget.hash

      if (file.status !== "deleted") {
        const showResult = await runGit(() => Bun.$`git -C ${gitRoot} show ${hash}:${file.path}`.quiet())
        content = showResult.stdout.toString()
      } else {
        const showResult = await runGit(() => Bun.$`git -C ${gitRoot} show ${hash}^:${file.path}`.quiet())
        content = showResult.stdout.toString()
      }

      const diffArgs = file.oldPath ? [file.oldPath, file.path] : [file.path]
      try {
        const diffResult = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff ${hash}^..${hash} -- ${diffArgs}`.quiet())
        diff = diffResult.stdout.toString()
      } catch {
        // Root commits have no parent, so `hash^..hash` is invalid. For added
        // files in a root commit, generate a unified diff from the content.
        if (file.status === "added") {
          diff = generateUnifiedDiff(file.path, content)
        }
      }
    } else if (compareTarget.type === "branch") {
      // Branch mode - changes between branches
      const branch = compareTarget.name
      const diffArgs = file.oldPath ? [file.oldPath, file.path] : [file.path]
      const diffResult = await runGit(() => Bun.$`git -C ${gitRoot} diff --no-ext-diff ${branch}...HEAD -- ${diffArgs}`.quiet())
      diff = diffResult.stdout.toString()
      
      if (file.status !== "deleted") {
        content = await readFileContent(file.path)
      } else {
        const showResult = await runGit(() => Bun.$`git -C ${gitRoot} show ${branch}:${file.path}`.quiet())
        content = showResult.stdout.toString()
      }
    }
    
    // Parse diff to find changed lines and count additions/deletions
    const changedLines = new Set<number>()
    const addedLines = new Set<number>()
    const removedLines = new Set<number>()
    const { changedLines: parsedChanged, addedLines: parsedAdded, removedLines: parsedRemoved } = parseChangedLines(diff)
    for (const lineNum of parsedChanged) {
      changedLines.add(lineNum)
    }
    for (const lineNum of parsedAdded) {
      addedLines.add(lineNum)
    }
    for (const lineNum of parsedRemoved) {
      removedLines.add(lineNum)
    }
    
    let additions = 0
    let deletions = 0
    for (const diffLine of diff.split("\n")) {
      if (diffLine.startsWith("+") && !diffLine.startsWith("+++")) {
        additions++
      } else if (diffLine.startsWith("-") && !diffLine.startsWith("---")) {
        deletions++
      }
    }
    
    const firstChangeLine = changedLines.size > 0 ? Math.min(...changedLines) : 0

    // Find first change in the parsed diff (for scrolling in diff view)
    let firstChangeDiffLine = 0
    const parsedDiff = parseDiff(diff)
    for (let i = 0; i < parsedDiff.length; i++) {
      if (parsedDiff[i]!.type === "addition" || parsedDiff[i]!.type === "deletion") {
        firstChangeDiffLine = i
        break
      }
    }
    
    const isBinary = detectBinaryFile(file.path, content, diff)

    // For binary files, don't store raw content/diff to avoid leaking
    // binary data into the terminal renderer
    if (isBinary) {
      diff = ""
      content = ""
    }

    return {
      ...file,
      diff,
      content,
      additions,
      deletions,
      firstChangeLine,
      firstChangeDiffLine,
      changedLines,
      addedLines,
      removedLines,
      isBinary,
      fingerprint: computeFileFingerprint({ path: file.path, oldPath: file.oldPath, status: file.status, diff, content, isBinary }),
    }
  } catch {
    return file
  }
}
