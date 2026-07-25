# Kenvo

## Tech Stack & Architecture

- **Desktop shell**: Electron (Chromium-based native desktop shell with Node.js integration)
- **Frontend**: React 19 + TypeScript 5.8 + TanStack Router (file-based, type-safe routing)
- **Styling**: Tailwind CSS v4 + shadcn/ui (base-nova) + Geist Variable font
- **Build tool**: Vite 7 + vite-plus (ESLint, auto-formatting, pre-commit hooks)
- **Theming**: next-themes with dark/light mode via CSS variables

Designed as a desktop AI chat/assistant application with a modern, native-feeling UI.

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

### Screenshots go to the configured directory

`agent-browser.json` at the repo root sets `screenshotDir` to `.agent-browser/screenshots` and `downloadPath` to `.agent-browser/downloads` — keep all generated artifacts inside the project, never write them to `/tmp` or elsewhere.

When taking screenshots, pass a **relative filename only** (or none) so the configured directory is used:

```bash
agent-browser --cdp 9222 screenshot kenvo-light.png        # → .agent-browser/screenshots/kenvo-light.png
agent-browser --cdp 9222 screenshot                       # → auto-named in the configured dir
```

Do NOT pass absolute paths like `/tmp/...`. An absolute path overrides `screenshotDir` and writes outside the project, which the project config is meant to prevent.
