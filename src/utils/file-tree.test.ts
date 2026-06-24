import { test, expect, describe } from "bun:test"
import {
  buildFileTree,
  flattenTree,
  getFilesInFolder,
  collectFolderPaths,
} from "./file-tree"
import type { FileChange } from "./git"

function makeFile(path: string): FileChange {
  return {
    path,
    status: "modified",
    additions: 0,
    deletions: 0,
    diff: "",
    content: "",
    firstChangeLine: 0,
    firstChangeDiffLine: 0,
    changedLines: new Set(),
    addedLines: new Set(),
    removedLines: new Set(),
    isBinary: false,
  }
}

describe("buildFileTree", () => {
  test("groups files by directory", () => {
    const tree = buildFileTree([
      makeFile("src/app.tsx"),
      makeFile("src/components/file-list.tsx"),
      makeFile("README.md"),
    ])

    expect(tree.children.has("src")).toBe(true)
    expect(tree.children.has("README.md")).toBe(false)
    expect(tree.files).toHaveLength(1)
    expect(tree.files[0]?.path).toBe("README.md")

    const src = tree.children.get("src")!
    expect(src.children.has("components")).toBe(true)
    expect(src.files).toHaveLength(1)
    expect(src.files[0]?.path).toBe("src/app.tsx")

    const components = src.children.get("components")!
    expect(components.files).toHaveLength(1)
    expect(components.files[0]?.path).toBe("src/components/file-list.tsx")
  })

  test("tracks full folder paths", () => {
    const tree = buildFileTree([makeFile("a/b/c/file.ts")])
    const a = tree.children.get("a")!
    const b = a.children.get("b")!
    const c = b.children.get("c")!

    expect(a.path).toBe("a")
    expect(b.path).toBe("a/b")
    expect(c.path).toBe("a/b/c")
  })

  test("returns empty root for no files", () => {
    const tree = buildFileTree([])
    expect(tree.children.size).toBe(0)
    expect(tree.files).toHaveLength(0)
  })
})

describe("flattenTree", () => {
  test("lists folders first then files, sorted alphabetically", () => {
    const tree = buildFileTree([
      makeFile("src/app.tsx"),
      makeFile("src/utils/git.ts"),
      makeFile("README.md"),
    ])
    const expanded = new Set(["src", "src/utils"])

    const items = flattenTree(tree, expanded)
    expect(items.map((item) => (item.type === "folder" ? `folder:${item.name}` : `file:${item.file.path}`))).toEqual([
      "folder:src",
      "folder:utils",
      "file:src/utils/git.ts",
      "file:src/app.tsx",
      "file:README.md",
    ])
  })

  test("respects expanded set", () => {
    const tree = buildFileTree([makeFile("src/components/file.tsx")])

    const collapsed = new Set<string>()
    expect(flattenTree(tree, collapsed)).toHaveLength(1)
    expect(flattenTree(tree, collapsed)[0]?.type).toBe("folder")

    const expanded = new Set(["src", "src/components"])
    const expandedItems = flattenTree(tree, expanded)
    expect(expandedItems).toHaveLength(3)
    expect(expandedItems[2]?.type).toBe("file")
  })

  test("assigns increasing depth", () => {
    const tree = buildFileTree([makeFile("a/b/c/file.ts")])
    const expanded = new Set(["a", "a/b", "a/b/c"])

    const items = flattenTree(tree, expanded)
    expect(items[0]?.depth).toBe(0)
    expect(items[1]?.depth).toBe(1)
    expect(items[2]?.depth).toBe(2)
    expect(items[3]?.depth).toBe(3)
  })

  test("reports expanded state on folder items", () => {
    const tree = buildFileTree([makeFile("src/app.tsx")])
    const expanded = new Set(["src"])

    const items = flattenTree(tree, expanded)
    const folder = items.find((item) => item.type === "folder")
    expect(folder?.type === "folder" && folder.expanded).toBe(true)
  })
})

describe("getFilesInFolder", () => {
  test("returns all files under a folder recursively", () => {
    const tree = buildFileTree([
      makeFile("src/app.tsx"),
      makeFile("src/components/file-list.tsx"),
      makeFile("src/components/header.tsx"),
      makeFile("README.md"),
    ])

    const files = getFilesInFolder(tree, "src/components")
    expect(files.map((f) => f.path).sort()).toEqual([
      "src/components/file-list.tsx",
      "src/components/header.tsx",
    ])
  })

  test("returns empty array for unknown folder", () => {
    const tree = buildFileTree([makeFile("src/app.tsx")])
    expect(getFilesInFolder(tree, "does/not/exist")).toEqual([])
  })
})

describe("collectFolderPaths", () => {
  test("collects every folder path", () => {
    const tree = buildFileTree([makeFile("a/b/c/file.ts")])
    const paths = collectFolderPaths(tree)

    expect(paths).toContain("a")
    expect(paths).toContain("a/b")
    expect(paths).toContain("a/b/c")
    expect(paths.size).toBe(3)
  })
})
