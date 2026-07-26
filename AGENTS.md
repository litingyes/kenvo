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

### Screenshots & mandatory visual verification

Artifact locations are configured project-wide in `agent-browser.json`. Never pass output paths or directories to CLI commands — just run `agent-browser screenshot` (optionally with a bare filename) and artifacts land in the configured location automatically. Never write artifacts outside the project (e.g. `/tmp`).

UI quality is critical for this project. After **every** UI-affecting change you MUST:

1. Take screenshot(s) of the affected views (both light and dark mode when theming is relevant).
2. Actually read the screenshot image and evaluate layout, spacing, alignment, typography, and colors against the design intent.
3. Fix any visual issues found before considering the task complete.
