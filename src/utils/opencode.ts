import { getGitRoot } from "./git"
import type { FileChange } from "./git"

export interface OpencodeOptions {
  command?: string
  prompt?: string
  getGitRoot?: () => Promise<string>
  spawnSync?: (command: string[], options?: object) => unknown
  suspend?: () => void
  resume?: () => void
}

export async function openFileInOpencode(
  file: FileChange,
  options: OpencodeOptions = {},
): Promise<string> {
  const command = options.command ?? process.env.OPENCODE_COMMAND ?? "opencode"
  const getRoot = options.getGitRoot ?? getGitRoot
  const spawn = options.spawnSync ?? Bun.spawnSync

  const gitRoot = await getRoot()
  const filePath = `${gitRoot}/${file.path}`
  const prompt = options.prompt ?? `@${file.path} `

  options.suspend?.()
  spawn([command, "--prompt", prompt], {
    cwd: gitRoot,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  options.resume?.()

  return filePath
}
