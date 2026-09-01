import { homedir } from "os"
import { join } from "path"
import { readFileSync } from "fs"

export type ThemeMode = "dark" | "light"

// theme-switch (mandrade-configs) writes the active mode here.
// Reading a file instead of querying the terminal (OSC 10/11) because tmux
// answers those queries with a stale value cached when the client attached.
function detectMode(): ThemeMode {
  try {
    const dir = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
    const mode = readFileSync(join(dir, "theme-switch", "current"), "utf8").trim()
    if (mode === "light") return "light"
  } catch {
    // fall through
  }
  return "dark"
}

export const MODE: ThemeMode = detectMode()

export const SHIKI_THEME = MODE === "light" ? "github-light" : "github-dark"

// GitHub dark -> GitHub light palette equivalents
const LIGHT_MAP: Record<string, string> = {
  "#0d1117": "#ffffff", // canvas default
  "#161b22": "#f6f8fa", // canvas subtle
  "#1c2128": "#f6f8fa",
  "#21262d": "#eaeef2", // subtle header bg / inactive borders
  "#30363d": "#d0d7de", // border default
  "#484f58": "#afb8c1",
  "#388bfd26": "#0969da26", // selected row tint (with alpha)
  "#58a6ff": "#0969da", // accent fg
  "#8b949e": "#57606a", // fg muted
  "#6e7681": "#6e7781", // fg subtle
  "#e6edf3": "#1f2328", // fg default
  "#f85149": "#cf222e", // danger
  "#d29922": "#9a6700", // warning
  "#3fb950": "#1a7f37", // success
  "#f0883e": "#bc4c00", // orange
  "#d2a8ff": "#8250df", // purple
  "#a371f7": "#8250df",
  "#2f1a1a": "#ffebe9", // red tint bg
  "#1a2f1a": "#dafbe1", // green tint bg
  "#12261c": "#dafbe1",
  "#3b2d5c": "#fbefff", // purple tint bg
  "#2a1a3f": "#fbefff",
}

// th("#rrggbb") returns the color for the active mode.
// Dark colors pass through unchanged; in light mode they are remapped.
export function th(hex: string): string {
  if (MODE === "dark") return hex
  return LIGHT_MAP[hex.toLowerCase()] ?? hex
}
