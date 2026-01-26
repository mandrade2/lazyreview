# LazyReview

A terminal UI for reviewing git changes with syntax highlighting.

## Why LazyReview?

I love [lazygit](https://github.com/jesseduffield/lazygit) - it's an incredible tool that I use daily. But when reviewing code changes, I wanted two small things it doesn't have:

1. **Syntax highlighting** in the diff viewer
2. **Subtler colors** for change indicators (the bright red/green backgrounds can be overwhelming)

### Visual Comparison

**lazygit** - bright green backgrounds for all additions:
![lazygit diff](https://github.com/mandrade2/lazyreview/raw/master/lazygitdiff.png)

**LazyReview** - subtle highlighting with syntax colors:
![LazyReview diff](https://github.com/mandrade2/lazyreview/raw/master/lazyreview.png)

LazyReview is a focused tool for one thing: reviewing your changes with a clean, readable diff view.

**Note:** You can also configure lazygit to use a custom pager (like `delta` or `diff-so-fancy`) to achieve similar highlighting. LazyReview exists as a standalone alternative if you prefer a dedicated review tool without the full lazygit feature set.

## Installation

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/mandrade2/lazyreview/master/install | bash
```

This auto-detects your OS/architecture and installs the appropriate binary.

### Download Binary

Download the latest release for your platform from [Releases](https://github.com/mandrade2/lazyreview/releases):

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | `lazyreview-darwin-arm64.zip` |
| macOS (Intel) | `lazyreview-darwin-x64.zip` |
| Linux (x64) | `lazyreview-linux-x64.zip` |
| Linux (ARM64) | `lazyreview-linux-arm64.zip` |
| Windows (x64) | `lazyreview-windows-x64.zip` |

### From Source

Requires [Bun](https://bun.sh):

```bash
git clone https://github.com/mandrade2/lazyreview.git
cd lazyreview
bun install
bun run index.ts
```

## Usage

```bash
# Review changes in current directory
lazyreview

# Review changes in a specific directory
lazyreview /path/to/repo
```

### Three Main Modes

LazyReview operates in three modes, accessible by pressing `m`:

1. **Dirty** (default) - Review uncommitted changes in your working directory
2. **Commit** - Browse past commits and review their changes
3. **Branch** - Compare your current branch against another branch to see differences

Each mode shows a list in the left panel and displays diffs in the right panel.

## Keyboard Shortcuts

### Modes
| Key | Action |
|-----|--------|
| `m` | Cycle modes: Dirty → Commit → Branch |
| `Esc` | Go back (diff → files → list) |

### Navigation
| Key | Action |
|-----|--------|
| `j` / `↓` | Move down / scroll down |
| `k` / `↑` | Move up / scroll up |
| `g` | Go to first item / top |
| `G` | Go to last item / bottom |
| `Tab` / `h` / `l` | Switch between panels |
| `Enter` | Select / open diff view |

### Scrolling (Diff)
| Key | Action |
|-----|--------|
| `n` / `N` | Jump to next / previous change chunk |
| `Ctrl+d` / `Ctrl+u` | Scroll half page down / up |
| `Ctrl+f` / `Ctrl+b` | Scroll full page down / up |
| `Ctrl+↓` / `Ctrl+↑` | Scroll single line down / up |

### Search (Diff)
| Key | Action |
|-----|--------|
| `/` | Start search |
| `Enter` | Execute search |
| `n` / `N` | Jump to next / previous match |
| `Esc` | Clear search |

### Actions
| Key | Action |
|-----|--------|
| `e` | Open file in `$EDITOR` |
| `r` | Refresh current view |
| `?` | Toggle help |
| `q` / `Ctrl+c` | Quit |

## Credits

LazyReview is built with amazing open source projects:

- **[OpenTUI](https://github.com/sst/opentui)** - The terminal UI framework that makes this possible. OpenTUI provides the reactive rendering engine, layout system, and terminal handling.
- **[lazygit](https://github.com/jesseduffield/lazygit)** - The inspiration for this project. If you need a full-featured git TUI, lazygit is the way to go.
- **[SolidJS](https://www.solidjs.com/)** - Reactive primitives for the UI
- **[Shiki](https://shiki.style/)** - Syntax highlighting
- **[Bun](https://bun.sh)** - JavaScript runtime and bundler

## License

MIT License - see [LICENSE](LICENSE) for details.
