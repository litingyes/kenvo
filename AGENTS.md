# Kenvo

> Write what you imagine, and beyond.

A local-first AI writing studio: autonomous writing agents create novels, screenplays, and prompts as real Markdown files in the user's own folders.

## Tech Stack & Architecture

- **Desktop shell**: Electron (Chromium-based native desktop shell with Node.js integration)
- **Frontend**: React 19 + TypeScript + TanStack Router (file-based, type-safe routing)
- **Styling**: Tailwind CSS v4 + shadcn/ui (base-nova, zinc) + Inter Variable font (Geist Mono Variable for code)
- **Build tool**: Vite + electron-vite + vite-plus (ESLint, auto-formatting, pre-commit hooks)
- **Theming**: next-themes with dark/light mode via CSS variables
- **Editor**: CodeMirror 6 (`@uiw/react-codemirror` + `@codemirror/lang-markdown`)
- **Agent runtime**: `@earendil-works/pi-agent-core` (tool loop, steering, abort) + `@earendil-works/pi-ai` (30+ providers, model catalogs with cost/context metadata)
- **Local AI service**: Hono server in `packages/agent-server`, streaming raw pi agent events over SSE
- **Storage**: better-sqlite3 (projects, tabs, chat sessions/messages) + Electron Store (settings)

### Repository layout

- `apps/desktop` — Electron app. Renderer in `src/`, main process in `electron/`
  - `src/routes/` — `/` studio (Codex-style unified workbench), `/settings/*`
  - `src/components/studio/` — studio shell (three-column resizable layout) + cross-project session sidebar (grouped by project or flat, toggleable)
  - `src/components/agent/` — chat main view (message stream, tool-call cards, steering input)
  - `src/components/files/` — docked right-side Files panel: project file tree (collapsible column) + document tabs + CodeMirror editor
  - `src/components/editor/` — CodeMirror Markdown editor with FS-watcher reload
  - `src/components/sidebar/` — project document tree
  - `src/lib/agent/use-agent-chat.ts` — SSE client + transcript state machine + SQLite persistence + session auto-titling
  - `src/lib/db/` — schema and repos (projects / project_tabs / chat_sessions / chat_messages)
- `packages/agent-server` — Hono server on port 32420
  - `src/sessions.ts` — SessionManager: pi `Agent` instances keyed by session id, prompt/steer/abort
  - `src/agents/` — writer / novelist / screenwriter / prompt-engineer definitions (system prompt + project template)
  - `src/tools/fs-tools.ts` — 6 file tools (list/read/write/edit/delete/search) locked to the project root
  - `src/providers.ts` — pi-ai Models collection over UI-configured provider credentials
- `apps/portal` — Astro landing page

### Key data flows

- **Chat**: renderer `POST /sessions/:id/messages` → server runs `agent.prompt()` and forwards every pi agent event as SSE → `use-agent-chat.ts` rebuilds the transcript; finished messages are appended to SQLite.
- **Resume / session switching**: on studio load, the renderer activates the most recent session across all projects: its messages are loaded from SQLite and passed as `history` to `POST /sessions`, scoped to that session's project (agent + folder). Switching sessions aborts + destroys the server-side agent and recreates it from the target session's SQLite history (running sessions require confirmation first).
- **File sync**: agent file tools write directly into the project folder; the Files panel editor reloads via the existing Electron FS watcher (`fs:watch`/`fs:file_changed` IPC), and the tree refreshes on agent file activity.

## Code Conventions

- All source files, scripts, and tooling are written in TypeScript.
- Do not create new `.js` files; always use `.ts` and run Node scripts with `tsx`.

## Testing

Every feature must be verified with `agent-browser` (globally installed CLI) by simulating real user interactions on the actual UI.

Before each use, run:

```bash
agent-browser skills get electron
```

to load the Electron skill and understand the available commands and workflow.

### Screenshots & mandatory visual verification

Artifact locations are configured project-wide in `agent-browser.json`. Never pass output paths or directories to CLI commands — just run `agent-browser screenshot` (optionally with a bare filename) and artifacts land in the configured location automatically. Never write artifacts outside the project (e.g. `/tmp`).

UI quality is critical for this project. After **every** UI-affecting change you MUST:

1. Take screenshot(s) of the affected views (both light and dark mode when theming is relevant).
2. Actually read the screenshot image and evaluate layout, spacing, alignment, typography, and colors against the design intent.
3. Fix any visual issues found before considering the task complete.
