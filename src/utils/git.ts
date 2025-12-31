export interface FileChange {
  path: string
  status: "added" | "modified" | "deleted" | "renamed" | "untracked"
  oldPath?: string // for renamed files
  additions: number
  deletions: number
  diff: string
}

// Target directory for git operations
let targetDir = process.cwd()

export function setTargetDir(dir: string) {
  targetDir = dir
}

export function getTargetDir() {
  return targetDir
}

export interface DiffLine {
  type: "context" | "addition" | "deletion" | "header"
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

async function readFileContent(path: string): Promise<string> {
  try {
    const fullPath = `${targetDir}/${path}`
    const file = Bun.file(fullPath)
    return await file.text()
  } catch {
    return ""
  }
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

export async function getGitChanges(): Promise<FileChange[]> {
  const changes: FileChange[] = []
  
  // Get staged and unstaged changes
  const statusResult = await Bun.$`git -C ${targetDir} status --porcelain`.text()
  
  if (!statusResult.trim()) {
    return []
  }
  
  const lines = statusResult.split("\n").filter(l => l.length > 0)
  
  for (const line of lines) {
    if (!line.trim()) continue
    
    const statusCode = line.substring(0, 2)
    let filePath = line.substring(3)
    let oldPath: string | undefined
    
    // Handle renamed files (R  old -> new)
    if (filePath.includes(" -> ")) {
      const parts = filePath.split(" -> ")
      oldPath = parts[0]
      filePath = parts[1] ?? filePath
    }
    
    // Skip directories (they end with /)
    if (filePath.endsWith("/")) {
      continue
    }
    
    let status: FileChange["status"]
    
    // Parse status codes
    const staged = statusCode[0]
    const unstaged = statusCode[1]
    
    if (staged === "A" || unstaged === "A") {
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
    
    // Get diff for this file
    let diff = ""
    let additions = 0
    let deletions = 0
    
    try {
      if (status === "untracked") {
        // For untracked files, read content and generate diff
        const content = await readFileContent(filePath)
        if (content) {
          diff = generateUnifiedDiff(filePath, content)
          additions = content.split("\n").length
        }
      } else if (status === "deleted") {
        // For deleted files
        const result = await Bun.$`git -C ${targetDir} diff --no-ext-diff HEAD -- ${filePath}`.quiet()
        diff = result.stdout.toString()
      } else {
        // For modified/added files - show both staged and unstaged
        const stagedResult = await Bun.$`git -C ${targetDir} diff --no-ext-diff --cached -- ${filePath}`.quiet()
        const unstagedResult = await Bun.$`git -C ${targetDir} diff --no-ext-diff -- ${filePath}`.quiet()
        diff = stagedResult.stdout.toString() || unstagedResult.stdout.toString()
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
    } catch {
      // Ignore diff errors
    }
    
    changes.push({
      path: filePath,
      status,
      oldPath,
      additions,
      deletions,
      diff,
    })
  }
  
  return changes
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
