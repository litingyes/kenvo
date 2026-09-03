# Kenvo

> Write what you imagine, and beyond.

Kenvo is a local-first AI short-form screenplay production workbench. It turns a folder of Markdown into a practical loop from outline and episodes to scenes, shots, proposals, and structural checks.

---

## 1. Project Introduction

Kenvo is an Electron desktop app built around a simple idea: a writing project is just a folder of Markdown files, and an AI agent should be able to work in it like a co-author. A local agent server runs a real agent loop (model → tools → model → …) with file tools scoped to your project directory, while the desktop app gives you a screenplay map, a central Markdown editor, and an agent panel where you can watch and steer the work as it happens.

### Target Users

- AI video short-drama creators planning episodes, scenes, and shot prompts
- Screenwriters who want a visual script map with a central Markdown editor
- Creators who want local-first, file-based AI writing instead of a chat box

### Core Value

- **Local-first**: projects are plain folders of Markdown files; metadata and chat history live in SQLite. Your words never leave your machine except to the model APIs you choose.
- **Production loop**: the Screenwriter agent reads the project, proposes grouped changes, and helps move a script from outline to shot-ready scenes.
- **Steerable**: interrupt the agent mid-run to redirect the work ("rename the protagonist", "make it darker") without losing progress.
- **Reviewable writes**: every Agent run can produce before/after diffs; changes are hash-checked before batch confirmation and never silently overwrite conflicts.
- **Scene structure**: the screenplay map and Canvas expose episodes, scenes, shots, unorganized files, and deterministic structure reminders.

### Key Features

- Focused Screenwriter agent for AI-video short dramas, using proposal writes by default
- Project = local folder + Markdown files, with a screenplay map, Canvas, scene editor, and central CodeMirror Markdown editor
- Agent panel with streaming output, tool-call cards, thinking blocks, token/cost display, mid-run steering, and abort
- Chat history persisted per project; resume where you left off after restart
- Multi-provider models: OpenAI / Anthropic / DeepSeek / Moonshot / Alibaba Cloud / xAI
- Import existing folders without writing template files; organize unrecognized Markdown through a proposal
- Themes: light / dark / system; English and Simplified Chinese UI

### Tech Stack

| Layer            | Technology                                                   |
| ---------------- | ------------------------------------------------------------ |
| Desktop shell    | Electron                                                     |
| Frontend         | React 19 + TypeScript + TanStack Router (file-based routing) |
| Styling          | Tailwind CSS v4 + shadcn/ui (base-nova) + Geist Variable     |
| Build            | Vite + electron-vite                                         |
| Editor           | CodeMirror 6                                                 |
| Agent runtime    | `@earendil-works/pi-agent-core` + `@earendil-works/pi-ai`    |
| Local AI service | Hono (SSE streaming)                                         |
| Storage          | better-sqlite3 + Electron Store                              |
| State            | zustand                                                      |
| Theming          | next-themes                                                  |
| i18n             | i18next                                                      |

---

## 2. Quick Start

### Prerequisites

- Node.js 20+
- pnpm 11.14.0 (specified in root `package.json` `devEngines`)
- macOS / Windows / Linux desktop platform (currently developed and verified mainly on macOS)
- An API key for at least one of: OpenAI / Anthropic / DeepSeek / Moonshot AI / Alibaba Cloud / xAI

### Clone and Install

```bash
git clone https://github.com/litingyes/kenvo.git
cd kenvo
pnpm install
```

> `postinstall` automatically runs `electron-builder install-app-deps` to compile native dependencies such as `better-sqlite3`.

### Configure a Model Provider

1. Launch the app and go to **Settings → AI → Providers**
2. Select a provider, enter your API key (and optional Base URL), click **Test**, then save
3. Go to **Settings → AI → Models** and enable the models you want to use
4. Return to the screenplay workbench; choose a model from the coach header when you have more than one enabled model

> The agent server listens on port `32420` by default; override it with the `AGENT_SERVER_PORT` environment variable.

### Start Development

```bash
# Start both the agent server and the Electron desktop app
pnpm dev
```

- The agent server becomes ready first at `http://localhost:32420/health`
- The desktop dev window is served at `http://localhost:31420`

### Your First Project

1. On the home screen, click **New Project** to create the short-drama template, or **Import folder** to open an existing directory without changing its files
2. Start from the screenplay map: open the outline, episode outline, scene, or shot card in the central editor
3. Ask the Screenwriter coach to plan, break down, revise, or organize; one run produces a grouped proposal
4. Inspect each file's before/after Diff, confirm the batch write, then use Canvas structure reminders to continue polishing

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

---

## 3. Architecture

```
apps/desktop          Electron app (renderer UI + main process)
packages/agent-server Local Hono server: agent sessions, providers, SSE streaming
apps/portal           Astro landing page
```

- **Agent runtime**: `@earendil-works/pi-agent-core` runs the tool loop (list/read/search plus reviewable file proposals scoped to the project root), with steering, abort, and per-turn usage/cost events.
- **Providers**: `@earendil-works/pi-ai` supplies model catalogs (context window, reasoning, cost metadata) and streaming; API keys configured in the UI are injected into the local server.
- **Streaming**: the server forwards raw agent events over SSE (`POST /sessions/:id/messages`); the renderer incrementally builds the transcript.
- **Persistence**: project metadata and chat transcripts are stored in SQLite; document content is plain Markdown in the project folder. Open-tab UI state is intentionally ephemeral and legacy `project_tabs` data is removed during migration.

---

## License and Contributing

### License

Kenvo is released under the [AGPL-3.0](LICENSE) license.

### Feedback and Contributions

- Repository: [https://github.com/litingyes/kenvo](https://github.com/litingyes/kenvo)
- Issues and Pull Requests are welcome
