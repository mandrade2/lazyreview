# LazyReview

A terminal UI for reviewing git changes with syntax highlighting.

![LazyReview Screenshot](https://github.com/mandrade2/lazyreview/raw/master/screenshot.png)

## Why LazyReview?

I love [lazygit](https://github.com/jesseduffield/lazygit) - it's an incredible tool that I use daily. But when reviewing code changes, I wanted two small things it doesn't have:

1. **Syntax highlighting** in the diff viewer
2. **Subtler colors** for change indicators (the bright red/green backgrounds can be overwhelming)

LazyReview is a focused tool for one thing: reviewing your uncommitted changes with a clean, readable diff view.

## Installation

### Download Binary

Download the latest release for your platform from [Releases](https://github.com/mandrade2/lazyreview/releases):

```bash
# macOS (Apple Silicon)
curl -L https://github.com/mandrade2/lazyreview/releases/latest/download/lazyreview-darwin-arm64.zip -o lazyreview.zip
unzip lazyreview.zip && chmod +x lazyreview-darwin-arm64
sudo mv lazyreview-darwin-arm64 /usr/local/bin/lazyreview

# macOS (Intel)
curl -L https://github.com/mandrade2/lazyreview/releases/latest/download/lazyreview-darwin-x64.zip -o lazyreview.zip
unzip lazyreview.zip && chmod +x lazyreview-darwin-x64
sudo mv lazyreview-darwin-x64 /usr/local/bin/lazyreview

# Linux (x64)
curl -L https://github.com/mandrade2/lazyreview/releases/latest/download/lazyreview-linux-x64.zip -o lazyreview.zip
unzip lazyreview.zip && chmod +x lazyreview-linux-x64
sudo mv lazyreview-linux-x64 /usr/local/bin/lazyreview

# Linux (ARM64)
curl -L https://github.com/mandrade2/lazyreview/releases/latest/download/lazyreview-linux-arm64.zip -o lazyreview.zip
unzip lazyreview.zip && chmod +x lazyreview-linux-arm64
sudo mv lazyreview-linux-arm64 /usr/local/bin/lazyreview
```

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

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate up/down |
| `g` / `G` | Go to first/last item |
| `Ctrl+d` / `Ctrl+u` | Scroll half page down/up |
| `Ctrl+f` / `Ctrl+b` | Scroll full page down/up |
| `Tab` | Switch between panels |
| `Enter` | View file diff |
| `e` | Open file in editor |
| `r` | Refresh file list |
| `?` | Show help |
| `q` / `Esc` | Quit |

## File Status Indicators

| Color | Status |
|-------|--------|
| Green (A) | Added |
| Yellow (M) | Modified |
| Red (D) | Deleted |
| Purple (R) | Renamed |
| Gray (?) | Untracked |

## Credits

LazyReview is built with amazing open source projects:

- **[OpenTUI](https://github.com/sst/opentui)** - The terminal UI framework that makes this possible. OpenTUI provides the reactive rendering engine, layout system, and terminal handling.
- **[lazygit](https://github.com/jesseduffield/lazygit)** - The inspiration for this project. If you need a full-featured git TUI, lazygit is the way to go.
- **[SolidJS](https://www.solidjs.com/)** - Reactive primitives for the UI
- **[Shiki](https://shiki.style/)** - Syntax highlighting
- **[Bun](https://bun.sh)** - JavaScript runtime and bundler

## License

MIT License - see [LICENSE](LICENSE) for details.
