import { render } from "@opentui/solid"
import { App } from "./src/app"
import { setTargetDir } from "./src/utils/git"

// Get target directory from args or use current working directory
const targetDir = Bun.argv[2] || process.cwd()
setTargetDir(targetDir)

render(App, {
  targetFps: 30,
  exitOnCtrlC: true,
  useMouse: true,
})
