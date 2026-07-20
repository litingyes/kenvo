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
