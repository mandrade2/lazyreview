import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join, dirname, relative } from "path"
import { tmpdir } from "os"
import { commitFiles, getGitChanges, setTargetDir } from "./git"

let repoDir = ""
let originalCwd = ""

const initRepo = async (files: Record<string, string>) => {
  repoDir = join(tmpdir(), `lazyreview-commit-files-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(repoDir, { recursive: true })
  await Bun.$`git -C ${repoDir} init`.quiet()
  await Bun.$`git -C ${repoDir} config user.email "test@example.com"`.quiet()
  await Bun.$`git -C ${repoDir} config user.name "Test User"`.quiet()
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(repoDir, relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await Bun.write(absolutePath, content)
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

const status = () => Bun.$`git -C ${repoDir} status --porcelain`.text()
const lastCommitMessage = () => Bun.$`git -C ${repoDir} log -1 --format=%s`.text()

const pathsOf = (changes: Array<{ path: string; oldPath?: string; status?: string }>) =>
  changes.map((f) => ({
    path: f.path,
    oldPath: f.oldPath,
    status: f.status as Parameters<typeof commitFiles>[0][number]["status"],
  }))

beforeEach(() => {
  originalCwd = getTargetDirSafe()
})

afterEach(async () => {
  setTargetDir(originalCwd)
  if (repoDir) await rm(repoDir, { recursive: true, force: true })
  repoDir = ""
})

// getTargetDir is exported from git.ts; re-imported lazily to avoid cycles in
// the test setup helpers above.
import { getTargetDir as getTargetDirSafe } from "./git"

describe("commitFiles", () => {
  test("commits only the listed files", async () => {
    await initRepo({ "a.ts": "a1\n", "b.ts": "b1\n" })
    setTargetDir(repoDir)
    await writeFiles({ "a.ts": "a2\n", "b.ts": "b2\n" })

    await commitFiles(pathsOf([{ path: "a.ts" }]), "commit a")

    expect((await lastCommitMessage()).trim()).toBe("commit a")
    expect(await status()).toBe(" M b.ts\n")
  })

  test("keeps unrelated staged changes out of the commit", async () => {
    await initRepo({ "a.ts": "a1\n", "b.ts": "b1\n" })
    setTargetDir(repoDir)
    await writeFiles({ "a.ts": "a2\n", "b.ts": "b2\n" })
    await Bun.$`git -C ${repoDir} add b.ts`.quiet()

    await commitFiles(pathsOf([{ path: "a.ts" }]), "commit a")

    expect(await status()).toBe("M  b.ts\n")
  })

  test("commits untracked files", async () => {
    await initRepo({ "a.ts": "a1\n" })
    setTargetDir(repoDir)
    await writeFiles({ "new.ts": "new\n" })

    await commitFiles(pathsOf([{ path: "new.ts" }]), "add new")

    expect((await lastCommitMessage()).trim()).toBe("add new")
    expect((await status()).trim()).toBe("")
  })

  test("commits deleted files", async () => {
    await initRepo({ "a.ts": "a1\n", "b.ts": "b1\n" })
    setTargetDir(repoDir)
    await Bun.$`rm ${join(repoDir, "b.ts")}`.quiet()

    await commitFiles(pathsOf([{ path: "b.ts" }]), "remove b")

    expect((await lastCommitMessage()).trim()).toBe("remove b")
    expect((await status()).trim()).toBe("")
  })

  test("commits files whose paths contain spaces", async () => {
    await initRepo({ "my dir/my file.ts": "a1\n" })
    setTargetDir(repoDir)
    await writeFiles({ "my dir/my file.ts": "a2\n" })

    // Paths must come from getGitChanges, the same way the app builds lists.
    const changes = await getGitChanges()
    expect(changes.map((f) => f.path)).toEqual(["my dir/my file.ts"])

    await commitFiles(pathsOf(changes), "spaced")

    expect((await lastCommitMessage()).trim()).toBe("spaced")
    expect((await status()).trim()).toBe("")
  })

  test("commits renamed files (old path removed, new path added)", async () => {
    await initRepo({ "old.ts": "a1\n" })
    setTargetDir(repoDir)
    await Bun.$`git -C ${repoDir} mv old.ts new.ts`.quiet()

    const changes = await getGitChanges()
    const renamed = changes.find((f) => f.status === "renamed")
    expect(renamed?.path).toBe("new.ts")
    expect(renamed?.oldPath).toBe("old.ts")

    await commitFiles(pathsOf(changes), "rename")

    expect((await status()).trim()).toBe("")
    const tree = await Bun.$`git -C ${repoDir} ls-tree --name-only HEAD`.text()
    expect(tree).toContain("new.ts")
    expect(tree).not.toContain("old.ts")
  })

  test("works when the target dir is a subdirectory of the repo", async () => {
    await initRepo({ "sub/a.ts": "a1\n", "root.ts": "r1\n" })
    await writeFiles({ "sub/a.ts": "a2\n", "root.ts": "r2\n" })
    // User launches lazyreview from inside a subdirectory.
    setTargetDir(join(repoDir, "sub"))

    const changes = await getGitChanges()
    const paths = changes.map((f) => f.path)
    expect(paths).toContain("sub/a.ts")
    expect(paths).toContain("root.ts")

    await commitFiles(pathsOf([{ path: "sub/a.ts" }]), "commit sub a")

    expect((await lastCommitMessage()).trim()).toBe("commit sub a")
    expect(await status()).toBe(" M root.ts\n")
  })

  test("works when the target dir is a relative path", async () => {
    await initRepo({ "a.ts": "a1\n" })
    await writeFiles({ "a.ts": "a2\n" })
    // Launch lazyreview with a path relative to the process cwd.
    setTargetDir(relative(process.cwd(), repoDir))

    const changes = await getGitChanges()
    expect(changes.map((f) => f.path)).toEqual(["a.ts"])

    await commitFiles(pathsOf([{ path: "a.ts" }]), "commit a")

    expect((await lastCommitMessage()).trim()).toBe("commit a")
    expect((await status()).trim()).toBe("")
  })

  test("commits multiple files in a single commit", async () => {
    await initRepo({ "a.ts": "a1\n", "b.ts": "b1\n", "c.ts": "c1\n" })
    setTargetDir(repoDir)
    await writeFiles({ "a.ts": "a2\n", "b.ts": "b2\n", "c.ts": "c2\n" })

    await commitFiles(pathsOf([{ path: "a.ts" }, { path: "c.ts" }]), "commit a and c")

    const committed = await Bun.$`git -C ${repoDir} show --name-only --format= HEAD`.text()
    expect(committed.trim().split("\n").sort()).toEqual(["a.ts", "c.ts"])
    expect(await status()).toBe(" M b.ts\n")
  })

  test("commits the working tree content of a file staged with older content", async () => {
    await initRepo({ "a.ts": "a1\n" })
    setTargetDir(repoDir)
    await writeFiles({ "a.ts": "staged content\n" })
    await Bun.$`git -C ${repoDir} add a.ts`.quiet()
    await writeFiles({ "a.ts": "working tree content\n" })

    await commitFiles(pathsOf([{ path: "a.ts" }]), "commit a")

    const committed = await Bun.$`git -C ${repoDir} show HEAD:a.ts`.text()
    expect(committed).toBe("working tree content\n")
    expect((await status()).trim()).toBe("")
  })

  test("commits a deletion that is already staged (git rm)", async () => {
    await initRepo({ "a.ts": "a1\n", "b.ts": "b1\n" })
    setTargetDir(repoDir)
    await Bun.$`git -C ${repoDir} rm -q b.ts`.quiet()

    const changes = await getGitChanges()
    const deleted = changes.find((f) => f.path === "b.ts")
    expect(deleted?.status).toBe("deleted")

    await commitFiles(pathsOf(changes), "remove b")

    expect((await lastCommitMessage()).trim()).toBe("remove b")
    expect((await status()).trim()).toBe("")
    const tree = await Bun.$`git -C ${repoDir} ls-tree --name-only HEAD`.text()
    expect(tree).not.toContain("b.ts")
  })

  test("commits an unstaged rename (deleted + untracked)", async () => {
    await initRepo({ "old.ts": "a1\n" })
    setTargetDir(repoDir)
    await Bun.$`rm ${join(repoDir, "old.ts")}`.quiet()
    await writeFiles({ "new.ts": "a1\n" })

    const changes = await getGitChanges()
    expect(changes.map((f) => `${f.status}:${f.path}`).sort()).toEqual([
      "deleted:old.ts",
      "untracked:new.ts",
    ])

    await commitFiles(pathsOf(changes), "rename")

    expect((await status()).trim()).toBe("")
    const tree = await Bun.$`git -C ${repoDir} ls-tree --name-only HEAD`.text()
    expect(tree).toContain("new.ts")
    expect(tree).not.toContain("old.ts")
  })

  test("commits files with unicode names", async () => {
    await initRepo({ "café ünïcode.ts": "a1\n", "日本語/ファイル.ts": "j1\n" })
    setTargetDir(repoDir)
    await writeFiles({ "café ünïcode.ts": "a2\n", "日本語/ファイル.ts": "j2\n" })

    const changes = await getGitChanges()
    expect(changes.map((f) => f.path).sort()).toEqual(["café ünïcode.ts", "日本語/ファイル.ts"])

    await commitFiles(pathsOf(changes), "unicode")

    expect((await status()).trim()).toBe("")
  })

  test("commits files in deeply nested directories", async () => {
    await initRepo({ "a/b/c/d/deep.ts": "d1\n" })
    setTargetDir(repoDir)
    await writeFiles({ "a/b/c/d/deep.ts": "d2\n" })

    await commitFiles(pathsOf([{ path: "a/b/c/d/deep.ts" }]), "deep")

    expect((await lastCommitMessage()).trim()).toBe("deep")
    expect((await status()).trim()).toBe("")
  })

  test("creates the first commit of a repository (no HEAD)", async () => {
    repoDir = join(tmpdir(), `lazyreview-commit-files-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(repoDir, { recursive: true })
    await Bun.$`git -C ${repoDir} init`.quiet()
    await Bun.$`git -C ${repoDir} config user.email "test@example.com"`.quiet()
    await Bun.$`git -C ${repoDir} config user.name "Test User"`.quiet()
    setTargetDir(repoDir)
    await writeFiles({ "a.ts": "a1\n", "b.ts": "b1\n" })

    await commitFiles(pathsOf([{ path: "a.ts" }]), "initial")

    expect((await lastCommitMessage()).trim()).toBe("initial")
    expect((await status()).trim()).toBe("?? b.ts")
  })

  test("preserves multi-line messages and shell metacharacters exactly", async () => {
    await initRepo({ "a.ts": "a1\n" })
    setTargetDir(repoDir)
    await writeFiles({ "a.ts": "a2\n" })

    const message = "feat: it's a \"quoted\" $HOME `tick` message\n\nwith a body"
    await commitFiles(pathsOf([{ path: "a.ts" }]), message)

    const committedMessage = await Bun.$`git -C ${repoDir} log -1 --format=%B`.text()
    expect(committedMessage.trimEnd()).toBe(message)
  })

  test("rejects with the git error when there is nothing to commit", async () => {
    await initRepo({ "a.ts": "a1\n" })
    setTargetDir(repoDir)
    await writeFiles({ "a.ts": "a2\n" })
    await commitFiles(pathsOf([{ path: "a.ts" }]), "commit a")

    await expect(commitFiles(pathsOf([{ path: "a.ts" }]), "again")).rejects.toThrow()
  })

  test("rejects with the hook output when a pre-commit hook fails", async () => {
    await initRepo({ "a.ts": "a1\n" })
    setTargetDir(repoDir)
    await writeFiles({ "a.ts": "a2\n" })
    const hookPath = join(repoDir, ".git", "hooks", "pre-commit")
    await Bun.write(hookPath, "#!/bin/sh\necho 'hook says no' >&2\nexit 1\n")
    await Bun.$`chmod +x ${hookPath}`.quiet()

    await expect(commitFiles(pathsOf([{ path: "a.ts" }]), "commit a")).rejects.toThrow(
      /hook says no/,
    )
    // The failed commit must not have happened.
    expect((await lastCommitMessage()).trim()).toBe("initial")
  })
})
