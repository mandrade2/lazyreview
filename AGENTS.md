# AGENTS.md - LazyReview

A terminal UI code review tool built with OpenTUI and SolidJS, similar to lazygit but focused on reviewing code changes with inline diffs.

## Quick Reference

```bash
# Run the app
bun run index.ts [target-directory]

# Type check
bun run --bun tsc --noEmit

# Run tests
bun test                    # all tests
bun test src/utils          # unit tests only
bun test tests/scenarios    # integration scenarios
bun test --watch            # watch mode

# Preview integration scenarios
bun run test:preview golden 80 24
bun run tests/preview.ts golden 80 24

# Install dependencies
bun install
```

## Project Structure

```
lazyreview/
├── index.ts                 # Entry point - renders App, handles CLI args
├── install                  # Install script for curl installation
├── bunfig.toml              # Bun config with OpenTUI preload
├── script/
│   ├── build.ts             # Cross-platform binary builder
│   └── release.ts           # Release automation script
├── src/
│   ├── app.tsx              # Main app component - layout, state, keyboard
│   ├── components/          # UI components
│   └── utils/               # Git operations, diff parsing, helpers
└── tests/                   # Integration test harness and scenarios
    ├── harness.ts           # OpenTUI test renderer wrapper
    ├── fixtures.ts          # Temp git fixture builder
    ├── preview.ts           # Preview scenario output as ANSI/replay
    └── scenarios/           # Snapshot scenarios
```

## Technology Stack

- **Runtime**: Bun (NOT Node.js)
- **UI Framework**: OpenTUI (@opentui/solid) - Terminal UI with SolidJS
- **Reactivity**: SolidJS (NOT React)
- **Language**: TypeScript with strict mode

## Code Style Guidelines

### Imports
- Order: external packages first, then internal modules
- Use `type` imports for type-only imports: `import type { FileChange } from "../utils/git"`
- Destructure from solid-js: `import { createSignal, createMemo, Show, For } from "solid-js"`

### TypeScript
- Use strict mode (enabled in tsconfig.json)
- Define interfaces for component props with `interface FooProps { ... }`
- Use union types for constrained values: `status: "added" | "modified" | "deleted"`
- Prefer `??` over `||` for nullish coalescing
- Use optional chaining: `file?.path`

### Functions
- Use arrow functions for helpers: `const getStatusColor = (status: string): string => { ... }`
- Use regular function declarations for components: `export function Header() { ... }`
- Prefer `async/await` over `.then()` chains for async code

### Naming Conventions
- Components: PascalCase (`DiffViewer`, `FileList`)
- Functions/variables: camelCase (`getGitChanges`, `selectedFile`)
- Interfaces: PascalCase (`FileChange`, `DiffLine`)
- Constants: camelCase (not SCREAMING_CASE)
- Files: kebab-case (`diff-viewer.tsx`, `file-list.tsx`)

### SolidJS Patterns
- Use `createSignal` for reactive state: `const [value, setValue] = createSignal(initial)`
- Use `createMemo` for derived values: `const derived = createMemo(() => compute(value()))`
- Use `createEffect` for side effects when signals change
- Access signal values by calling them: `value()` not `value`
- Use `<Show when={condition}>` for conditional rendering
- Use `<For each={items}>{(item, index) => ...}</For>` for lists

### OpenTUI Components
- Use lowercase JSX elements: `<box>`, `<text>`, `<scrollbox>`
- Style with `style={{ ... }}` object (flexbox-based layout)
- Colors are hex strings: `fg: "#58a6ff"`, `backgroundColor: "#0d1117"`
- Text elements don't support `backgroundColor` - wrap in `<box>` instead
- Use `flexGrow: 1` for expanding elements, `flexShrink: 0` for fixed elements

### Error Handling
- Use try/catch with empty catch for non-critical errors: `try { ... } catch { }`
- Type check errors: `e instanceof Error ? e.message : "Unknown error"`
- Store errors in signals for display: `const [error, setError] = createSignal<string | null>(null)`

### Git Operations
- Use Bun shell: `await Bun.$\`git command\`.text()`
- Use `.quiet()` to suppress stderr: `await Bun.$\`git diff\`.quiet()`
- Use `-C ${dir}` for operations in different directories
- Use `--no-ext-diff` to get raw diff format

## Bun-Specific Guidelines

From `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc`:

- Use `bun <file>` instead of `node` or `ts-node`
- Use `bun test` instead of jest/vitest
- Use `bun install` instead of npm/yarn/pnpm install
- Use `Bun.file()` instead of `fs.readFile()`
- Use `Bun.$\`command\`` instead of execa or child_process
- Bun auto-loads .env files - don't use dotenv

## Color Palette (GitHub Dark Theme)

```typescript
const colors = {
  bg: "#0d1117",           // Main background
  bgSecondary: "#161b22",  // Header/status bar background
  bgTertiary: "#21262d",   // Panel headers, inactive elements
  border: "#30363d",       // Borders
  text: "#e6edf3",         // Primary text
  textMuted: "#8b949e",    // Secondary text
  accent: "#58a6ff",       // Links, active elements
  added: "#3fb950",        // Green for additions
  modified: "#d29922",     // Yellow for modifications
  deleted: "#f85149",      // Red for deletions
  renamed: "#a371f7",      // Purple for renames
  addedBg: "#0f1a0f",      // Subtle green background
  deletedBg: "#1a0f0f",    // Subtle red background
}
```

## Key Architecture Decisions

1. **Manual scroll management**: The diff viewer manually calculates visible lines based on terminal height rather than relying on scrollbox, enabling custom scroll-to-first-change behavior.

2. **Full file content**: Files are loaded in full (not just diff hunks) to allow viewing complete context with changes highlighted inline.

3. **Panel focus model**: Two panels (files, diff) with keyboard-driven focus switching. Active panel has highlighted header.

4. **Target directory support**: Git operations use `-C ${targetDir}` to support running from any location via the CLI wrapper.

## Testing Approach

Unit tests use Bun's test runner:

```typescript
import { test, expect, describe } from "bun:test"
import { parseChangedLines } from "./git"

describe("parseChangedLines", () => {
  test("parses additions correctly", () => {
    const diff = "@@ -1,3 +1,4 @@\n context\n+added line\n context"
    const result = parseChangedLines(diff)
    expect(result).toContain(1)
  })
})
```

Integration scenarios render the full app through OpenTUI's test renderer.
They use temp git fixtures, send key sequences, and snapshot both the
structured spans and the raw ANSI output. Scenarios live in `tests/scenarios/`
and are run with `bun test tests/scenarios`. Preview outputs can be generated
with `bun run test:preview <scenario> <width> <height>`.

## Common Tasks

### Adding a new component
1. Create file in `src/components/` with kebab-case name
2. Export function component with PascalCase name
3. Define props interface
4. Import in parent component

### Adding keyboard shortcuts
1. Add handler in `useKeyboard` callback in `src/app.tsx`
2. Check `key.name` for letter keys, `key.ctrl` for modifiers
3. Update status bar keybinds in `src/components/status-bar.tsx`

### Modifying git operations
1. Edit functions in `src/utils/git.ts`
2. Use `Bun.$` for shell commands
3. Use `targetDir` variable for path operations
