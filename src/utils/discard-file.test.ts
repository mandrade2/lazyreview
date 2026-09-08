import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { mkdir, rm } from "fs/promises"
import { join, dirname } from "path"
import { tmpdir } from "os"
import { discardFile, getGitChanges, setTargetDir, getTargetDir, type FileChange } from "./git"

let repoDir = ""
let originalCwd = ""

const initRepo = async (files: Record<string, string>) => {
  repoDir = join(tmpdir(), `lazyreview-discard-${Date.now()}-${Math.random().toString(36).slice(2)}`)
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
const readFile = (relativePath: string) => Bun.file(join(repoDir, relativePath)).text()

// Get the real FileChange for a path, matching how the app builds its lists.
const changeFor = async (path: string): Promise<FileChange> => {
  const changes = await getGitChanges()
  const file = changes.find((f) => f.path === path)
  if (!file) throw new Error(`no change for ${path}`)
  return file
}

beforeEach(() => {
  originalCwd = getTargetDir()
})

afterEach(async () => {
  setTargetDir(originalCwd)
  if (repoDir) await rm(repoDir, { recursive: true, force: true })
  repoDir = ""
})

describe("discardFile", () => {
  test("restores a modified file", async () => {
    await initRepo({ "a.ts": "original\n" })
    setTargetDir(repoDir)
    await writeFiles({ "a.ts": "changed\n" })

    await discardFile(await changeFor("a.ts"))

    expect(await readFile("a.ts")).toBe("original\n")
    expect((await status()).trim()).toBe("")
  })

  test("restores a deleted file", async () => {
    await initRepo({ "a.ts": "original\n" })
    setTargetDir(repoDir)
    await Bun.$`rm ${join(repoDir, "a.ts")}`.quiet()

    await discardFile(await changeFor("a.ts"))

    expect(await readFile("a.ts")).toBe("original\n")
    expect((await status()).trim()).toBe("")
  })

  test("deletes an untracked file", async () => {
    await initRepo({ "a.ts": "original\n" })
    setTargetDir(repoDir)
    await writeFiles({ "new.ts": "new content\n" })

    await discardFile(await changeFor("new.ts"))

    expect(await Bun.file(join(repoDir, "new.ts")).exists()).toBe(false)
    expect((await status()).trim()).toBe("")
  })

  test("removes a staged new file", async () => {
    await initRepo({ "a.ts": "original\n" })
    setTargetDir(repoDir)
    await writeFiles({ "new.ts": "new content\n" })
    await Bun.$`git -C ${repoDir} add new.ts`.quiet()

    await discardFile(await changeFor("new.ts"))

    expect(await Bun.file(join(repoDir, "new.ts")).exists()).toBe(false)
    expect((await status()).trim()).toBe("")
  })

  test("reverts a renamed file", async () => {
    await initRepo({ "old.ts": "original\n" })
    setTargetDir(repoDir)
    await Bun.$`git -C ${repoDir} mv old.ts new.ts`.quiet()

    await discardFile(await changeFor("new.ts"))

    expect(await readFile("old.ts")).toBe("original\n")
    expect(await Bun.file(join(repoDir, "new.ts")).exists()).toBe(false)
    expect((await status()).trim()).toBe("")
  })

  test("discards a file whose path contains spaces", async () => {
    await initRepo({ "my dir/my file.ts": "original\n" })
    setTargetDir(repoDir)
    await writeFiles({ "my dir/my file.ts": "changed\n" })

    await discardFile(await changeFor("my dir/my file.ts"))

    expect(await readFile("my dir/my file.ts")).toBe("original\n")
    expect((await status()).trim()).toBe("")
  })
})
