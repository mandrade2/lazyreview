import { render } from "@opentui/solid"
import { App } from "./src/app"

render(App, {
  targetFps: 30,
  exitOnCtrlC: true,
})
