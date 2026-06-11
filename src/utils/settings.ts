import { homedir } from "os"
import { join } from "path"
import { mkdir } from "fs/promises"

export interface Settings {
  diffViewMode: "diff" | "full"
  showLineBg: boolean
}

const defaultSettings: Settings = {
  diffViewMode: "diff",
  showLineBg: true,
}

function getConfigPath(): string {
  const configDir = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
  return join(configDir, "lazyreview", "settings.json")
}

export async function loadSettings(): Promise<Settings> {
  const path = getConfigPath()
  try {
    const file = Bun.file(path)
    if (!(await file.exists())) return defaultSettings
    const parsed = await file.json()
    return {
      diffViewMode: parsed.diffViewMode === "full" ? "full" : "diff",
      showLineBg: typeof parsed.showLineBg === "boolean" ? parsed.showLineBg : true,
    }
  } catch {
    return defaultSettings
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const path = getConfigPath()
  try {
    await mkdir(join(path, ".."), { recursive: true })
    await Bun.write(path, JSON.stringify(settings, null, 2))
  } catch {
    // Non-critical: silently fail if we can't write config
  }
}
