import { test, expect, describe } from "bun:test"
import { openFileInOpencode } from "./opencode"
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

describe("openFileInOpencode", () => {
  test("starts opencode with default file mention prompt", async () => {
    const file = createFileChange({ path: "src/components/button.tsx" })
    const calls: Array<{ command: string[]; options: object }> = []

    const filePath = await openFileInOpencode(file, {
      command: "opencode",
      getGitRoot: async () => "/home/user/projects/myrepo",
      spawnSync: (command, options) => {
        calls.push({ command, options: options ?? {} })
        return { success: true }
      },
    })

    expect(filePath).toBe("/home/user/projects/myrepo/src/components/button.tsx")
    expect(calls).toHaveLength(1)
    expect(calls[0]!.command).toEqual([
      "opencode",
      "--prompt",
      "@src/components/button.tsx ",
    ])
  })

  test("uses custom prompt when provided", async () => {
    const file = createFileChange({ path: "x.ts" })
    const calls: Array<string[]> = []

    await openFileInOpencode(file, {
      command: "opencode",
      prompt: "@/project/x.ts fix this",
      getGitRoot: async () => "/project",
      spawnSync: (command) => {
        calls.push(command)
        return { success: true }
      },
    })

    expect(calls[0]!).toEqual([
      "opencode",
      "--prompt",
      "@/project/x.ts fix this",
    ])
  })

  test("uses git root as cwd", async () => {
    const file = createFileChange({ path: "deep/nested/file.ts" })
    const calls: Array<{ command: string[]; options: object }> = []

    await openFileInOpencode(file, {
      command: "opencode",
      getGitRoot: async () => "/repo",
      spawnSync: (command, options) => {
        calls.push({ command, options: options ?? {} })
        return { success: true }
      },
    })

    expect(calls[0]!.options).toMatchObject({
      cwd: "/repo",
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    })
  })

  test("calls suspend and resume around spawn", async () => {
    const file = createFileChange({ path: "x.ts" })
    const lifecycle: string[] = []

    await openFileInOpencode(file, {
      command: "opencode",
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

  test("defaults to 'opencode' when no command env var is set", async () => {
    const file = createFileChange({ path: "readme.md" })
    const calls: Array<string[]> = []

    const originalCommand = process.env.OPENCODE_COMMAND
    delete process.env.OPENCODE_COMMAND

    try {
      await openFileInOpencode(file, {
        getGitRoot: async () => "/project",
        spawnSync: (command) => {
          calls.push(command)
          return { success: true }
        },
      })

      expect(calls[0]![0]).toBe("opencode")
    } finally {
      if (originalCommand) process.env.OPENCODE_COMMAND = originalCommand
    }
  })
})
