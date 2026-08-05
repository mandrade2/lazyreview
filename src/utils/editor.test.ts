import { test, expect, describe } from "bun:test"
import { openFileInEditor } from "./editor"
import type { FileChange } from "./git"

function createFileChange(overrides: Partial<FileChange> = {}): FileChange {
  return {
    path: "",
    status: "modified",
    oldPath: undefined,
    additions: 0,
    deletions: 0,
    diff: "",
    content: "",
    firstChangeLine: 0,
    firstChangeDiffLine: 0,
    changedLines: new Set(),
    addedLines: new Set(),
    removedLines: new Set(),
    ...overrides,
    isBinary: overrides.isBinary ?? false,
    fingerprint: "",
  }
}

describe("openFileInEditor", () => {
  test("resolves file path using git root", async () => {
    const file = createFileChange({ path: "src/components/button.tsx" })
    const calls: Array<{ command: string[]; options: object }> = []

    const filePath = await openFileInEditor(file, {
      editor: "vim",
      getGitRoot: async () => "/home/user/projects/myrepo",
      spawnSync: (command, options) => {
        calls.push({ command, options: options ?? {} })
        return { success: true }
      },
    })

    expect(filePath).toBe("/home/user/projects/myrepo/src/components/button.tsx")
    expect(calls).toHaveLength(1)
    expect(calls[0]!.command).toEqual([
      "vim",
      "/home/user/projects/myrepo/src/components/button.tsx",
    ])
  })

  test("uses git root instead of cwd when running from a subdirectory", async () => {
    // This is the exact bug that was fixed: when lazyreview is run from a
    // subdirectory, file paths are still relative to the repo root.
    const file = createFileChange({ path: "deep/nested/file.ts" })
    const calls: Array<{ command: string[]; options: object }> = []

    const filePath = await openFileInEditor(file, {
      editor: "nvim",
      getGitRoot: async () => "/repo",
      spawnSync: (command, options) => {
        calls.push({ command, options: options ?? {} })
        return { success: true }
      },
    })

    expect(filePath).toBe("/repo/deep/nested/file.ts")
    expect(calls[0]!.command).toEqual(["nvim", "/repo/deep/nested/file.ts"])
  })

  test("calls suspend and resume around editor spawn", async () => {
    const file = createFileChange({ path: "x.ts" })
    const lifecycle: string[] = []

    await openFileInEditor(file, {
      editor: "ed",
      getGitRoot: async () => "/tmp",
      spawnSync: () => {
        lifecycle.push("spawn")
        return { success: true }
      },
      suspend: () => lifecycle.push("suspend"),
      resume: () => lifecycle.push("resume"),
    })

    expect(lifecycle).toEqual(["suspend", "spawn", "resume"])
  })

  test("defaults to 'vi' when no editor env vars are set", async () => {
    const file = createFileChange({ path: "readme.md" })
    const calls: Array<string[]> = []

    // Temporarily clear env vars
    const originalEditor = process.env.EDITOR
    const originalVisual = process.env.VISUAL
    delete process.env.EDITOR
    delete process.env.VISUAL

    try {
      await openFileInEditor(file, {
        getGitRoot: async () => "/project",
        spawnSync: (command) => {
          calls.push(command)
          return { success: true }
        },
      })

      expect(calls[0]![0]).toBe("vi")
    } finally {
      if (originalEditor) process.env.EDITOR = originalEditor
      if (originalVisual) process.env.VISUAL = originalVisual
    }
  })
})
