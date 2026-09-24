import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join, dirname } from "path"
import { tmpdir } from "os"
import { getCommitDiff, countDiffLines, getGitChanges, setTargetDir } from "./git"
import type { FileChange } from "./git"

let repoDir = ""
let originalCwd = ""

const initRepo = async (files: Record<string, string>) => {
  repoDir = join(tmpdir(), `lazyreview-commit-diff-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(repoDir, { recursive: true })
  await Bun.$`git -C ${repoDir} init`.quiet()
  await Bun.$`git -C ${repoDir} config user.email "test@example.com"`.quiet()
  await Bun.$`git -C ${repoDir} config user.name "Test User"`.quiet()
  for (const [relativePath, content] of Object.entries(files)) {
    await writeFiles({ [relativePath]: content })
  }
  await Bun.$`git -C ${repoDir} add .`.quiet()
  await Bun.$`git -C ${repoDir} commit -m "initial"`.quiet()
}

const writeFiles = async (files: Record<string, string>) => {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(repoDir, relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await Bun.write(absolutePath, content)
  }
}

const select = (changes: FileChange[], ...paths: string[]) =>
  changes.filter(c => paths.includes(c.path))

beforeEach(() => {
  originalCwd = getTargetDir()
})

afterEach(async () => {
  setTargetDir(originalCwd)
  if (repoDir) await rm(repoDir, { recursive: true, force: true })
  repoDir = ""
})

// getTargetDir is exported from git.ts; re-imported lazily to avoid cycles in
// the test setup helpers above.
import { getTargetDir } from "./git"

describe("countDiffLines", () => {
  test("counts additions and deletions, ignoring file headers", () => {
    const diff = [
      "diff --git a/x.ts b/x.ts",
      "--- a/x.ts",
      "+++ b/x.ts",
      "@@ -1,2 +1,2 @@",
      "-old",
      "+new",
      " context",
    ].join("\n")
    expect(countDiffLines(diff)).toEqual({ additions: 1, deletions: 1 })
  })

  test("counts nothing for an empty diff", () => {
    expect(countDiffLines("")).toEqual({ additions: 0, deletions: 0 })
  })
})

describe("getCommitDiff", () => {
  test("combines staged and unstaged edits to the same file", async () => {
    await initRepo({ "a.ts": "one\n" })
    setTargetDir(repoDir)
    await writeFiles({ "a.ts": "one\nstaged line\n" })
    await Bun.$`git -C ${repoDir} add a.ts`.quiet()
    await writeFiles({ "a.ts": "one\nstaged line\nunstaged line\n" })

    const changes = await getGitChanges()
    const diff = await getCommitDiff(select(changes, "a.ts"))

    expect(diff).toContain("+staged line")
    expect(diff).toContain("+unstaged line")
  })

  test("synthesizes a diff for untracked files", async () => {
    await initRepo({ "a.ts": "one\n" })
    setTargetDir(repoDir)
    await writeFiles({ "new.ts": "fresh\nlines\n" })

    const changes = await getGitChanges()
    const diff = await getCommitDiff(select(changes, "new.ts"))

    expect(diff).toContain("diff --git a/new.ts b/new.ts")
    expect(diff).toContain("+fresh")
    expect(diff).toContain("+lines")
    expect(countDiffLines(diff)).toEqual({ additions: 3, deletions: 0 })
  })

  test("omits files outside the selection", async () => {
    await initRepo({ "a.ts": "one\n", "b.ts": "one\n" })
    setTargetDir(repoDir)
    await writeFiles({ "a.ts": "two\n", "b.ts": "two\n" })

    const changes = await getGitChanges()
    const diff = await getCommitDiff(select(changes, "a.ts"))

    expect(diff).toContain("a/a.ts")
    expect(diff).not.toContain("b.ts")
  })

  test("describes a deletion", async () => {
    await initRepo({ "gone.ts": "so long\n" })
    setTargetDir(repoDir)
    await Bun.$`git -C ${repoDir} rm -q gone.ts`.quiet()

    const changes = await getGitChanges()
    const diff = await getCommitDiff(select(changes, "gone.ts"))

    expect(diff).toContain("-so long")
    expect(countDiffLines(diff).deletions).toBe(1)
  })

  test("returns an empty string when the selection has nothing to diff", async () => {
    await initRepo({ "a.ts": "one\n" })
    setTargetDir(repoDir)
    expect(await getCommitDiff([])).toBe("")
  })
})
