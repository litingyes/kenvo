# Changelog

## Unreleased

### 💥 Breaking Changes

- **app:** Repositioned Kenvo from an AI-native terminal workspace to a local-first AI writing studio — "Write what you imagine, and beyond." The terminal, Git panel, and workspace features were removed entirely; the old SQLite tables (workspaces, terminal_sessions, terminal_history, workspace_tabs) are dropped on first launch.
- **agent-server:** Replaced the Vercel AI SDK with `@earendil-works/pi-agent-core` + `@earendil-works/pi-ai` as the agent runtime. The old `coder` agent and `/agents/:id/run` endpoint were removed; new session-based SSE endpoints (`POST /sessions`, `POST /sessions/:id/messages`, `/steer`, `/abort`) power the writing agents.
- **desktop:** Replaced Monaco with CodeMirror 6 for the Markdown editor.

### 🚀 Enhancements

- **agents:** Four built-in writing agents — Writer, Novelist, Screenwriter, Prompt Engineer — each with craft-specific instructions and project templates.
- **agents:** Autonomous agent loop with six project-scoped file tools (list/read/write/edit/delete/search), mid-run steering, abort, and per-turn token/cost reporting.
- **desktop:** New home screen with project cards and a create-project flow that materializes the agent's template into a local folder.
- **desktop:** New writing studio: document tree, tabbed Markdown editor with external-change watching, and an agent panel with streaming messages, tool-call cards, and thinking blocks.
- **desktop:** Chat history persisted per project in SQLite and resumed into the agent on project open.
- **settings:** Models page now shows pi-ai catalog metadata (context window, reasoning, vision); Agents page configures the four writing agents.
- **portal:** Landing page rewritten for the writing-studio positioning.

## v0.0.5

[compare changes](https://github.com/litingyes/kenvo/compare/v0.0.4...v0.0.5)

### 🚀 Enhancements

- **desktop:** Add functional about page and in-app navigation ([e251908](https://github.com/litingyes/kenvo/commit/e251908))
- **desktop:** Add Monaco file editor with save and file watching ([11b21ef](https://github.com/litingyes/kenvo/commit/11b21ef))
- **desktop:** Add file preview and pin tab support ([44d33ec](https://github.com/litingyes/kenvo/commit/44d33ec))
- **desktop:** Add context-aware terminal info panel registry ([ef85b1c](https://github.com/litingyes/kenvo/commit/ef85b1c))
- **desktop:** Dim git-ignored files in file tree panel ([cf746e8](https://github.com/litingyes/kenvo/commit/cf746e8))

### 🩹 Fixes

- **desktop:** Use MutationObserver to sync Monaco theme ([e239dc2](https://github.com/litingyes/kenvo/commit/e239dc2))

### 📖 Documentation

- **agents:** Update screenshot and visual verification guidelines ([dd4665b](https://github.com/litingyes/kenvo/commit/dd4665b))

### ❤️ Contributors

- Litingyes ([@litingyes](https://github.com/litingyes))

## v0.0.4

[compare changes](https://github.com/litingyes/kenvo/compare/v0.0.3...v0.0.4)

### 🩹 Fixes

- Add publish config to electron-builder.yml to fix CI build failure ([b9bbdea](https://github.com/litingyes/kenvo/commit/b9bbdea))

## v0.0.3

[compare changes](https://github.com/litingyes/kenvo/compare/v0.0.2...v0.0.3)

### 🚀 Enhancements

- **desktop:** Add development context menu for electron windows ([9d85a34](https://github.com/litingyes/kenvo/commit/9d85a34))
- **desktop:** ⚠️ Replace terminal views with workspace-based tabs ([df6c5da](https://github.com/litingyes/kenvo/commit/df6c5da))
- **settings:** Add settings index route ([cca5a46](https://github.com/litingyes/kenvo/commit/cca5a46))
- **desktop:** Replace custom file icons with iconify ([6930f2b](https://github.com/litingyes/kenvo/commit/6930f2b))
- **terminal:** Replace custom shell with node-pty and xterm ([de33cd1](https://github.com/litingyes/kenvo/commit/de33cd1))

### 🩹 Fixes

- **desktop:** Limit git commit textarea height and add scrolling ([828cdea](https://github.com/litingyes/kenvo/commit/828cdea))

### 💅 Refactors

- **theme:** ⚠️ Remove theme presets and keep only kenvo ([b13817e](https://github.com/litingyes/kenvo/commit/b13817e))
- **settings:** Merge language settings into appearance ([c7b8476](https://github.com/litingyes/kenvo/commit/c7b8476))

### 📖 Documentation

- Init ([88aebfe](https://github.com/litingyes/kenvo/commit/88aebfe))

### 🎨 Styles

- **theme:** Update Kenvo palette and active sidebar path color ([4bfadf3](https://github.com/litingyes/kenvo/commit/4bfadf3))
- **terminal:** Add w-full to terminal view container ([9728089](https://github.com/litingyes/kenvo/commit/9728089))

### 🤖 CI

- **release:** Prevent electron-builder from auto-publishing ([fcb1e3a](https://github.com/litingyes/kenvo/commit/fcb1e3a))

#### ⚠️ Breaking Changes

- **desktop:** ⚠️ Replace terminal views with workspace-based tabs ([df6c5da](https://github.com/litingyes/kenvo/commit/df6c5da))
- **theme:** ⚠️ Remove theme presets and keep only kenvo ([b13817e](https://github.com/litingyes/kenvo/commit/b13817e))

### ❤️ Contributors

- Litingyes ([@litingyes](https://github.com/litingyes))

## v0.0.2

[compare changes](https://github.com/litingyes/kenvo/compare/v0.0.1...v0.0.2)

### 📖 Documentation

- Update readme ([c011e17](https://github.com/litingyes/kenvo/commit/c011e17))

### 📦 Build

- **desktop:** Configure macOS code signing and notarization ([bb86a5a](https://github.com/litingyes/kenvo/commit/bb86a5a))

### 🤖 CI

- **release:** Single release per tag with changelog ([3343ea7](https://github.com/litingyes/kenvo/commit/3343ea7))

### ❤️ Contributors

- Litingyes ([@litingyes](https://github.com/litingyes))

## v0.0.1

### 🚀 Enhancements

- Add shadcn/ui ([a007b9d](https://github.com/litingyes/kenvo/commit/a007b9d))
- Add tanstack router ([66ad813](https://github.com/litingyes/kenvo/commit/66ad813))
- Add tauri-pilot ([49a6497](https://github.com/litingyes/kenvo/commit/49a6497))
- **terminal:** Init layout ([6830e88](https://github.com/litingyes/kenvo/commit/6830e88))
- **terminal:** Enhance ([b699ba2](https://github.com/litingyes/kenvo/commit/b699ba2))
- **header:** Show view switch and context info ([cb015e5](https://github.com/litingyes/kenvo/commit/cb015e5))
- Init theme ([2c1f106](https://github.com/litingyes/kenvo/commit/2c1f106))
- Init settings ([10219ab](https://github.com/litingyes/kenvo/commit/10219ab))
- Adjust header layout ([ba27deb](https://github.com/litingyes/kenvo/commit/ba27deb))
- Init i18n ([629e277](https://github.com/litingyes/kenvo/commit/629e277))
- Support providers & models ([f9ce51d](https://github.com/litingyes/kenvo/commit/f9ce51d))
- Adjust ux/ui ([559ca70](https://github.com/litingyes/kenvo/commit/559ca70))
- **agents:** Add AI agent infrastructure and commit message generator ([db79ff7](https://github.com/litingyes/kenvo/commit/db79ff7))
- **logging:** Add logging and AI telemetry infrastructure ([878f209](https://github.com/litingyes/kenvo/commit/878f209))
- **logging:** Rotate logs and expose log/data folders ([d0f127e](https://github.com/litingyes/kenvo/commit/d0f127e))
- **log-viewer:** Add log viewer settings page and tauri commands ([3873b2e](https://github.com/litingyes/kenvo/commit/3873b2e))
- **theme:** Replace presets with kenvo, ayu and catppuccin ([36cf277](https://github.com/litingyes/kenvo/commit/36cf277))
- **desktop:** Use native traffic light inset on macOS header ([fc92178](https://github.com/litingyes/kenvo/commit/fc92178))

### 🩹 Fixes

- Open dir ([ec11398](https://github.com/litingyes/kenvo/commit/ec11398))
- Support header drag ([5dec000](https://github.com/litingyes/kenvo/commit/5dec000))

### 💅 Refactors

- **terminal:** Remove touchSession from tab click handler ([3af1a2b](https://github.com/litingyes/kenvo/commit/3af1a2b))
- Migrate tauri to electron ([a132a5d](https://github.com/litingyes/kenvo/commit/a132a5d))

### 📖 Documentation

- Add CLAUDE.md project instructions ([b1978b0](https://github.com/litingyes/kenvo/commit/b1978b0))

### 🏡 Chore

- Init ([ce9cb5a](https://github.com/litingyes/kenvo/commit/ce9cb5a))
- Init agents.md ([23ca5c8](https://github.com/litingyes/kenvo/commit/23ca5c8))
- Update skills ([14a431b](https://github.com/litingyes/kenvo/commit/14a431b))
- Rename ([d43b41a](https://github.com/litingyes/kenvo/commit/d43b41a))
- Upgrade vite@8 and typescript@7 ([a5090fc](https://github.com/litingyes/kenvo/commit/a5090fc))
- Remove native-select ([abc6777](https://github.com/litingyes/kenvo/commit/abc6777))
- **vp:** Update ignore patterns ([8468ca4](https://github.com/litingyes/kenvo/commit/8468ca4))
- Adjust struct ([80e9f39](https://github.com/litingyes/kenvo/commit/80e9f39))
- **tauri:** Update updater public key and fix app handle usage ([c2aef16](https://github.com/litingyes/kenvo/commit/c2aef16))
- Update agents.md ([e6d9d83](https://github.com/litingyes/kenvo/commit/e6d9d83))
- **gitignore:** Ignore .agent-browser directory ([4aa2b69](https://github.com/litingyes/kenvo/commit/4aa2b69))

### 🤖 CI

- Add lint & format ([2fd975d](https://github.com/litingyes/kenvo/commit/2fd975d))
- Init updater ([9fa9c16](https://github.com/litingyes/kenvo/commit/9fa9c16))
- Init release ([6235a3b](https://github.com/litingyes/kenvo/commit/6235a3b))
- **desktop:** Remove macOS code signing and notarization ([d606948](https://github.com/litingyes/kenvo/commit/d606948))

### ❤️ Contributors

- Litingyes ([@litingyes](https://github.com/litingyes))
