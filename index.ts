import { render } from "@opentui/solid"
import { App } from "./src/app"
import { setTargetDir } from "./src/utils/git"

// @ts-ignore - injected at build time
const version: string = typeof LAZYREVIEW_VERSION !== "undefined" ? LAZYREVIEW_VERSION : "dev"

const args = Bun.argv.slice(2)

if (args.includes("--version") || args.includes("-v")) {
  console.log(version)
  process.exit(0)
}

// Get target directory from args or use current working directory
const targetDir = args[0] || process.cwd()
setTargetDir(targetDir)

render(App, {
  targetFps: 30,
  exitOnCtrlC: true,
  useMouse: true,
  exitSignals: ["SIGINT", "SIGTERM"],
  onDestroy: () => {
    process.stdout.write("\x1b[?1000l")
    process.stdout.write("\x1b[?25h")
  },
})
