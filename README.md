# Kenvo

> An AI-native terminal desktop workspace for developers.

Kenvo brings terminal, file browsing, Git operations, and local AI capabilities into a single Electron desktop window, letting you switch seamlessly between the command line and AI assistance.

---

## 1. Project Introduction

Kenvo is an Electron-based desktop terminal application centered around a “terminal-first workspace.” It launches real shell processes through Electron IPC and displays path, command history, Git status, and file tree in a side panel, while a local Hono agent server connects to models from OpenAI, Anthropic, DeepSeek, Moonshot, Alibaba Cloud, and xAI through the Vercel AI SDK for reusable AI workflows.

### Target Users

- Command-line-first developers, DevOps engineers, and SREs
- Users who want terminal, Git, file browsing, and AI assistance in one window
- Users who prefer local-first, data-sovereign desktop tooling

### Core Value

- **Local-first**: sessions, history, and settings are persisted in SQLite and Electron Store
- **Unified workspace**: terminal + file tree + Git panel + command history + path info without switching windows
- **Extensible AI**: local Hono agent server with multi-provider support through Vercel AI SDK
- **Modern UI**: React 19 + TanStack Router + Tailwind CSS v4 + shadcn/ui, with light/dark/system themes and multiple theme presets

### Key Features

- Multi-session / multi-tab terminal powered by `@wterm/react` / `just-bash`
- Left session tree: group by time / path, sort by creation / update time
- Right info panel: path info, command history, Git status, file tree
- Git panel: stage / commit / pull / push / fetch, with AI-generated commit messages
- AI configuration: Providers / Models / Agents settings
- Themes: light / dark / system, with Kenvo / Ayu / Catppuccin presets
- Internationalization: English, Simplified Chinese
- Log and AI telemetry viewer
- Auto-updater entry point

### Tech Stack

| Layer              | Technology                                                       |
| ------------------ | ---------------------------------------------------------------- |
| Desktop shell      | Electron                                                         |
| Frontend           | React 19 + TypeScript 5.8 + TanStack Router (file-based routing) |
| Styling            | Tailwind CSS v4 + shadcn/ui (base-nova) + Geist Variable         |
| Build              | Vite 7 + electron-vite                                           |
| Storage            | better-sqlite3                                                   |
| Local AI service   | Hono + Vercel AI SDK                                             |
| Terminal rendering | `@wterm/react` / `just-bash`                                     |
| State              | zustand                                                          |
| Theming            | next-themes                                                      |
| i18n               | i18next                                                          |

---

## 2. Quick Start

### Prerequisites

- Node.js 20+
- pnpm 11.14.0 (specified in root `package.json` `devEngines`)
- macOS / Windows / Linux desktop platform (currently developed and verified mainly on macOS)
- Optional: API keys for OpenAI / Anthropic / DeepSeek / Moonshot / Alibaba Cloud / xAI

### Clone and Install

```bash
git clone https://github.com/litingyes/kenvo.git
cd kenvo
pnpm install
```

> `postinstall` automatically runs `electron-builder install-app-deps` to compile native dependencies such as `better-sqlite3`.

### Configure AI Provider

1. Launch the app and go to **Settings → AI → Providers**
2. Select a provider (OpenAI / Anthropic / DeepSeek / Moonshot AI / Alibaba Cloud / xAI)
3. Enter your API key and optional Base URL, then click **Test** and save
4. Go to **Settings → AI → Models** and enable the models you need
5. Go to **Settings → AI → Agents** and assign a default model to the built-in agent

> The agent server listens on port `32420` by default; override it with the `AGENT_SERVER_PORT` environment variable.

### Start Development

```bash
# Start both the agent server and the Electron desktop app
pnpm dev
```

- The agent server becomes ready first at `http://localhost:32420/health`
- The desktop dev window is served at `http://localhost:31420`

```bash
# Start only the agent server
pnpm dev:agent-server
```

### Build and Package

```bash
# Build the renderer and Electron main process
pnpm build

# Package with electron-builder
pnpm dist

# Bump version, build, and package
pnpm release

# Run lint checks
pnpm lint
```

### Screenshots Placeholder

> Place app screenshots under `docs/screenshots/` and reference them in the README:
> `![Terminal](docs/screenshots/terminal.png)`

---

## 3. Current Progress and Roadmap

### Implemented

- [x] Multi-session / multi-tab terminal powered by `@wterm/react` / `just-bash`
- [x] Real shell processes launched through Electron IPC
- [x] Session / tab persistence in SQLite
- [x] Left session tree: group by time / path, sort by creation / update time
- [x] Right info panel: path info, command history, Git status, file tree
- [x] Git panel: stage / commit / pull / push / fetch, with AI-generated commit messages
- [x] Theme settings: light / dark / system, with Kenvo / Ayu / Catppuccin presets
- [x] Internationalization: English, Simplified Chinese
- [x] AI provider management: OpenAI / Anthropic / DeepSeek / Moonshot / Alibaba Cloud / xAI
- [x] AI model enable / disable
- [x] Local Hono agent server (default port 32420)
- [x] Built-in agent: `coder` → `commit-message`
- [x] Log and AI telemetry viewer
- [x] Auto-updater entry point

### Near-Term Roadmap

- [ ] AI Chat UI: implement the `/chat` endpoint to replace the current 501 placeholder
- [ ] Multi-view layout: add AppViews such as Chat and Browser in addition to Terminal
- [ ] More built-in agents: command explanation, script generation, code review, etc.
- [ ] Command palette / keyboard shortcuts / plugin system
- [ ] Session search, export, and optional cloud sync

### Known Limitations / TODO

- Only the Terminal main view is available; `/chat` returns 501 and is not yet implemented
- Only one built-in agent is available (`coder` → `commit-message`)
- AI conversation history is not yet shown in the UI
- Windows / Linux packaged builds are not yet published through CI
- The project is in early stage; configuration and APIs may change incompatibly

---

## License and Contributing

### License

Kenvo is released under the [AGPL-3.0](LICENSE) license.

### Feedback and Contributions

- Repository: [https://github.com/litingyes/kenvo](https://github.com/litingyes/kenvo)
- Issues and Pull Requests are welcome
