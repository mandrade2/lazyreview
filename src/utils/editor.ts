import { getGitRoot } from "./git"
import type { FileChange } from "./git"

export interface EditorOptions {
  editor?: string
  getGitRoot?: () => Promise<string>
  spawnSync?: (command: string[], options?: object) => unknown
  suspend?: () => void
  resume?: () => void
}

export async function openFileInEditor(
  file: FileChange,
  options: EditorOptions = {},
): Promise<string> {
  const editor = options.editor ?? process.env.EDITOR ?? process.env.VISUAL ?? "vi"
  const getRoot = options.getGitRoot ?? getGitRoot
  const spawn = options.spawnSync ?? Bun.spawnSync

  const gitRoot = await getRoot()
  const filePath = `${gitRoot}/${file.path}`

  options.suspend?.()
  spawn([editor, filePath], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  options.resume?.()

  return filePath
}
