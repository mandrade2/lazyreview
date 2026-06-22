import { spawn, spawnSync } from "node:child_process"
import { platform } from "node:os"

function command(command: string, args: string[] = [], input?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"],
    })
    const output: Buffer[] = []
    child.on("error", reject)
    child.stdout?.on("data", (chunk: Buffer) => output.push(chunk))
    child.on("close", (code) => {
      if (code === 0) return resolve(Buffer.concat(output))
      reject(new Error(`${command} exited with code ${code}`))
    })
    if (input !== undefined) child.stdin?.end(input)
  })
}

function which(name: string): string | undefined {
  const result = spawnSync("which", [name], {
    stdio: ["ignore", "pipe", "ignore"],
  })
  if (result.status === 0) {
    return result.stdout.toString().trim()
  }
  return undefined
}

function writeOsc52(text: string) {
  if (!process.stdout.isTTY) return
  const sequence = `\x1b]52;c;${Buffer.from(text).toString("base64")}\x07`
  process.stdout.write(process.env.TMUX || process.env.STY ? `\x1bPtmux;\x1b${sequence}\x1b\\` : sequence)
}

function copyCommand(
  os: NodeJS.Platform,
  wayland: boolean,
  has: (name: string) => boolean,
): string[] | undefined {
  if (os === "darwin" && has("osascript")) return ["osascript"]
  if (os === "linux" && wayland && has("wl-copy")) return ["wl-copy"]
  if (os === "linux" && has("xclip")) return ["xclip", "-selection", "clipboard"]
  if (os === "linux" && has("xsel")) return ["xsel", "--clipboard", "--input"]
  if (os === "win32" && has("powershell.exe")) {
    return [
      "powershell.exe",
      "-NonInteractive",
      "-NoProfile",
      "-Command",
      "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd())",
    ]
  }
}

let copyMethod: Promise<(text: string) => Promise<void>> | undefined

function getCopyMethod() {
  return (copyMethod ??= (async () => {
    const native = copyCommand(platform(), Boolean(process.env.WAYLAND_DISPLAY), (name) => Boolean(which(name)))
    if (native?.[0] === "osascript") {
      return async (text: string) => {
        const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        await command("osascript", ["-e", `set the clipboard to "${escaped}"`]).catch(() => undefined)
      }
    }
    if (native) {
      const [cmd, ...args] = native
      return async (text: string) => {
        if (!cmd) return
        await command(cmd, args, text).catch(() => undefined)
      }
    }
    return async (_text: string) => {
      // No native clipboard utility found; OSC52 was already attempted.
    }
  })())
}

export async function copyToClipboard(text: string): Promise<void> {
  writeOsc52(text)
  const method = await getCopyMethod()
  await method(text)
}
