import { test, expect } from "bun:test"
import { mkdir, rm, writeFile } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { createHarness } from "../harness"
import { buildFixture, type BuiltFixture } from "../fixtures"

const ESCAPE = "\x1b"

// Stub for the opencode CLI. It answers with a fixed commit message after a
// delay, so the dialog's waiting state is observable before the result lands.
// Heredoc-quoted so the JSON payload needs no escaping.
const writeOpencodeStub = async (options: {
  delayMs?: number
  message?: string
  fail?: boolean
}): Promise<string> => {
  const dir = join(tmpdir(), `lazyreview-ai-commit-stub-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(dir, { recursive: true })
  const path = join(dir, "opencode")

  const payload = options.fail
    ? `{"type":"error","part":{"message":"model exploded"}}`
    : `{"type":"text","part":{"text":${JSON.stringify(options.message ?? "Update counter\n\nCounts every click.")}}}\n{"type":"step_finish","part":{"type":"step-finish","reason":"stop"}}`

  await writeFile(
    path,
    `#!/bin/sh\nsleep ${((options.delayMs ?? 0) / 1000).toFixed(3)}\ncat <<'LAZYREVIEW_STUB'\n${payload}\nLAZYREVIEW_STUB\n`,
  )
  await Bun.$`chmod +x ${path}`.quiet()
  return path
}

const withStub = async <T>(
  stub: string,
  run: () => Promise<T>,
): Promise<T> => {
  const original = process.env.OPENCODE_COMMAND
  process.env.OPENCODE_COMMAND = stub
  try {
    return await run()
  } finally {
    if (original === undefined) delete process.env.OPENCODE_COMMAND
    else process.env.OPENCODE_COMMAND = original
  }
}

const buildCounterFixture = (): Promise<BuiltFixture> =>
  buildFixture({
    name: "ai-commit",
    commits: [
      {
        message: "initial",
        files: {
          "a.ts": "export const a = 1\n",
          "b.ts": "export const b = 1\n",
        },
      },
    ],
    dirty: {
      modified: {
        "a.ts": "export const a = 2\n",
        "b.ts": "export const b = 2\n",
      },
    },
  })

const headSubject = (fixture: BuiltFixture) =>
  Bun.$`git -C ${fixture.path} log -1 --format=%s`.text()
const headBody = (fixture: BuiltFixture) =>
  Bun.$`git -C ${fixture.path} log -1 --format=%b`.text()
const status = (fixture: BuiltFixture) =>
  Bun.$`git -C ${fixture.path} status --porcelain`.text()
const shortHead = (fixture: BuiltFixture) =>
  Bun.$`git -C ${fixture.path} rev-parse --short HEAD`.text()

// The footer reports generation time, which is never deterministic, so asserts
// target the stable parts of the dialog rather than the whole frame.
test("a commits a change list with an AI-written message", async () => {
  const configDir = join(tmpdir(), `lazyreview-ai-commit-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildCounterFixture()
  const stub = await writeOpencodeStub({
    delayMs: 300,
    message: "Update counter\n\nCounts every click so the label matches the presses.",
  })

  await withStub(stub, async () => {
    const harness = await createHarness({ fixture: fixture.path, width: 80, height: 24 })
    try {
      await harness.waitForFrame((frame) => frame.includes("To Review (2)"))

      // Send a.ts to change list 1 so there is exactly one active list.
      await harness.send([" "])
      await harness.waitForFrame((frame) => frame.includes("[1] Reviewed (1)"))

      await harness.send(["a"])

      // Waiting state: the model is still being asked, nothing is committed.
      const waiting = await harness.waitForFrame((frame) => frame.includes("Asking gpt-6-luna"))
      expect(waiting).toContain("Writing a message for 1 file")

      // Result state: SHA, title, body and a summary of what landed.
      const done = await harness.waitForFrame((frame) => frame.includes("Committed to "))
      expect(done).toContain(await shortHead(fixture).then((s) => s.trim()))
      expect(done).toContain("Update counter")
      expect(done).toContain("Counts every click")
      expect(done).toContain("1 file changed")

      expect((await headSubject(fixture)).trim()).toBe("Update counter")
      expect(await headBody(fixture)).toContain("Counts every click")

      // Only the reviewed file was committed; the other change survives.
      expect(await status(fixture)).not.toContain("a.ts")
      expect(await status(fixture)).toContain("b.ts")

      // Dismissing the dialog returns to the file list, and the change list is
      // gone now that its files are committed.
      await harness.send(["\x1b"])
      await harness.waitForFrame((frame) => !frame.includes("Committed to "))
    } finally {
      await harness.destroy()
    }
  })

  await fixture.cleanup()
  await rm(configDir, { recursive: true, force: true })
  if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = originalXdg
})

test("Esc during generation cancels without committing", async () => {
  const configDir = join(tmpdir(), `lazyreview-ai-cancel-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildCounterFixture()
  const stub = await writeOpencodeStub({ delayMs: 1500 })

  await withStub(stub, async () => {
    const harness = await createHarness({ fixture: fixture.path, width: 80, height: 24 })
    try {
      await harness.waitForFrame((frame) => frame.includes("To Review (2)"))
      await harness.send([" "])
      await harness.waitForFrame((frame) => frame.includes("[1] Reviewed (1)"))

      await harness.send(["a"])
      await harness.waitForFrame((frame) => frame.includes("Asking gpt-6-luna"))
      await harness.send([ESCAPE])
      await harness.waitForFrame((frame) => !frame.includes("Asking gpt-6-luna"))

      // Give any late work a chance to run before asserting nothing was touched.
      await harness.sleep(1800)

      expect((await headSubject(fixture)).trim()).toBe("initial")
      expect(await status(fixture)).toContain("a.ts")
      expect(await status(fixture)).toContain("b.ts")
    } finally {
      await harness.destroy()
    }
  })

  await fixture.cleanup()
  await rm(configDir, { recursive: true, force: true })
  if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = originalXdg
})

test("a failed model run reports the error and commits nothing", async () => {
  const configDir = join(tmpdir(), `lazyreview-ai-fail-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildCounterFixture()
  const stub = await writeOpencodeStub({ fail: true })

  await withStub(stub, async () => {
    const harness = await createHarness({ fixture: fixture.path, width: 80, height: 24 })
    try {
      await harness.waitForFrame((frame) => frame.includes("To Review (2)"))
      await harness.send([" "])
      await harness.waitForFrame((frame) => frame.includes("[1] Reviewed (1)"))

      await harness.send(["a"])
      // The model's own failure is surfaced verbatim rather than a generic
      // "no message" wrapper, since that is what actually went wrong.
      const failed = await harness.waitForFrame((frame) => frame.includes("AI commit failed"))
      expect(failed).toContain("model exploded")

      expect((await headSubject(fixture)).trim()).toBe("initial")
      expect(await status(fixture)).toContain("a.ts")
    } finally {
      await harness.destroy()
    }
  })

  await fixture.cleanup()
  await rm(configDir, { recursive: true, force: true })
  if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = originalXdg
})

// A typed message gets the same report as a model-written one, minus the
// model's name and timing.
test("c reports the commit it made from a typed message", async () => {
  const configDir = join(tmpdir(), `lazyreview-ai-manual-config-${Date.now()}`)
  await mkdir(configDir, { recursive: true })
  const originalXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = configDir

  const fixture = await buildCounterFixture()
  const harness = await createHarness({ fixture: fixture.path, width: 80, height: 24 })
  try {
    await harness.waitForFrame((frame) => frame.includes("To Review (2)"))
    await harness.send([" "])
    await harness.waitForFrame((frame) => frame.includes("[1] Reviewed (1)"))

    await harness.send(["c"])
    await harness.waitForFrame((frame) => frame.includes("Enter: commit"))
    await harness.send([{ type: "text", value: "commit a" }])
    await harness.waitForFrame((frame) => frame.includes("commit a_"))
    await harness.send(["RETURN"])

    const done = await harness.waitForFrame((frame) => frame.includes("Committed to "))
    expect(done).toContain(await shortHead(fixture).then((s) => s.trim()))
    expect(done).toContain("commit a")
    expect(done).toContain("1 file changed")
    // No model was involved, so nothing is credited or timed.
    expect(done).not.toContain("gpt-6-luna")

    expect((await headSubject(fixture)).trim()).toBe("commit a")
    expect(await status(fixture)).not.toContain("a.ts")
    expect(await status(fixture)).toContain("b.ts")
  } finally {
    await harness.destroy()
    await fixture.cleanup()
    await rm(configDir, { recursive: true, force: true })
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = originalXdg
  }
})
