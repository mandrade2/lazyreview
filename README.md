# LazyReview

A terminal UI for reviewing git changes, built with [OpenTUI](https://github.com/sst/opentui).

Similar to lazygit but focused on code review with inline diff viewing.

## Features

- File list sidebar showing all changed files with status indicators
- Inline diff viewer with syntax highlighting
- Color-coded additions (green) and deletions (red)
- Line numbers in diff gutter
- Keyboard-driven navigation

## Installation

```bash
bun install
```

## Usage

```bash
bun run index.ts
```

Or with hot reloading during development:

```bash
bun --hot index.ts
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `Down` | Navigate down in file list |
| `k` / `Up` | Navigate up in file list |
| `Tab` | Switch between file list and diff viewer |
| `h` | Focus file list (vim-style) |
| `l` | Focus diff viewer (vim-style) |
| `g` | Go to first file |
| `G` | Go to last file |
| `r` | Refresh file list |
| `q` / `Esc` | Quit |

## File Status Colors

- **Green (A)** - Added files
- **Yellow (M)** - Modified files
- **Red (D)** - Deleted files
- **Purple (R)** - Renamed files
- **Gray (?)** - Untracked files

## Tech Stack

- [OpenTUI](https://github.com/sst/opentui) - Terminal UI framework
- [SolidJS](https://www.solidjs.com/) - Reactive UI framework
- [Bun](https://bun.sh) - JavaScript runtime

## Project Structure

```
src/
  app.tsx           # Main application component
  components/
    header.tsx      # Top header bar
    status-bar.tsx  # Bottom status bar
    file-list.tsx   # File list sidebar
    diff-viewer.tsx # Diff viewer panel
  utils/
    git.ts          # Git integration utilities
```

## License

MIT
