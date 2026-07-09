import { ensureSolidTransformPlugin } from "@opentui/solid/bun-plugin"

const g = globalThis as unknown as {
  requestAnimationFrame?: (callback: (time: number) => void) => number | ReturnType<typeof setTimeout>
  cancelAnimationFrame?: (id: number | ReturnType<typeof setTimeout>) => void
}

if (typeof g.requestAnimationFrame !== "function") {
  g.requestAnimationFrame = (callback: (time: number) => void) => {
    return setTimeout(() => callback(Date.now()), 16)
  }
}
if (typeof g.cancelAnimationFrame !== "function") {
  g.cancelAnimationFrame = (id: number | ReturnType<typeof setTimeout>) => {
    clearTimeout(id as ReturnType<typeof setTimeout>)
  }
}

ensureSolidTransformPlugin()
