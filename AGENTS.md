# Lume

## Tech Stack & Architecture

- **Desktop shell**: Tauri v2 (Rust backend, native OS integration)
- **Frontend**: React 19 + TypeScript 5.8 + TanStack Router (file-based, type-safe routing)
- **Styling**: Tailwind CSS v4 + shadcn/ui (base-nova) + Geist Variable font
- **Build tool**: Vite 7 + vite-plus (ESLint, auto-formatting, pre-commit hooks)
- **Theming**: next-themes with dark/light mode via CSS variables

Designed as a desktop AI chat/assistant application with a modern, native-feeling UI.

## Testing

Every feature must be verified with `tauri-pilot` (globally installed CLI) by simulating real user interactions on the actual UI. See `.agents/skills/tauri-pilot/SKILL.md` for the full command reference and workflow.
