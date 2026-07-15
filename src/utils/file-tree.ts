import type { FileChange } from "./git"

export interface TreeFolder {
  type: "folder"
  name: string
  path: string
  depth: number
  expanded: boolean
}

export interface TreeFile {
  type: "file"
  file: FileChange
  depth: number
}

export type TreeItem = TreeFolder | TreeFile

export interface TreeNode {
  name: string
  path: string
  children: Map<string, TreeNode>
  files: FileChange[]
}

export function buildFileTree(files: FileChange[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map(), files: [] }

  for (const file of files) {
    const parts = file.path.split("/")
    const fileName = parts.pop()
    if (!fileName) continue

    let current = root
    let currentPath = ""

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: currentPath,
          children: new Map(),
          files: [],
        })
      }
      current = current.children.get(part)!
    }

    current.files.push(file)
  }

  return root
}

export function flattenTree(
  root: TreeNode,
  expanded: Set<string>,
  depth = 0,
): TreeItem[] {
  const items: TreeItem[] = []

  const folders = [...root.children.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  const files = [...root.files].sort((a, b) => a.path.localeCompare(b.path))

  for (const folder of folders) {
    items.push({
      type: "folder",
      name: folder.name,
      path: folder.path,
      depth,
      expanded: expanded.has(folder.path),
    })

    if (expanded.has(folder.path)) {
      items.push(...flattenTree(folder, expanded, depth + 1))
    }
  }

  for (const file of files) {
    items.push({ type: "file", file, depth })
  }

  return items
}

function findNode(root: TreeNode, folderPath: string): TreeNode | null {
  if (root.path === folderPath) return root

  for (const child of root.children.values()) {
    const found = findNode(child, folderPath)
    if (found) return found
  }

  return null
}

export function findNearestFileIndex(items: TreeItem[], startIndex: number): number {
  if (items.length === 0) return 0
  const clamped = Math.min(Math.max(startIndex, 0), items.length - 1)

  for (let i = clamped; i < items.length; i++) {
    if (items[i]?.type === "file") return i
  }
  for (let i = clamped - 1; i >= 0; i--) {
    if (items[i]?.type === "file") return i
  }

  return clamped
}

export function getFilesInFolder(
  root: TreeNode,
  folderPath: string,
): FileChange[] {
  const target = findNode(root, folderPath)
  if (!target) return []

  const result: FileChange[] = []
  const collect = (node: TreeNode): void => {
    result.push(...node.files)
    for (const child of node.children.values()) {
      collect(child)
    }
  }

  collect(target)
  return result
}

export function collectFolderPaths(root: TreeNode): Set<string> {
  const paths = new Set<string>()

  const walk = (node: TreeNode): void => {
    for (const child of node.children.values()) {
      paths.add(child.path)
      walk(child)
    }
  }

  walk(root)
  return paths
}
