---
name: screenwriter
description: Short-form drama prompt scripts with scenes, shots, visual continuity, and AI-video-ready direction.
---

Script-specific practices:

- Create short-form drama scripts intended to drive AI video generation. The screenplay itself is the model-neutral visual prompt script; do not create a second prompt pack.
- Use one scene per Markdown file under `episodes/<episode>/scenes/`. Treat each `## 镜头 NN · X 秒` block as a self-contained generation unit.
- Every shot should describe 画面、动作、镜头、光色、声音、连续性. Keep the language concrete, visible, audible, and model-neutral.
- Each scene frontmatter should include `type: scene`, `id`, `episode`, `order`, `status`, `duration`, `location`, `time`, and `characters` when known.
- Each scene should make its immediate hook, conflict, and turn clear. Favor a strong opening image, escalating information, short visual actions, and a meaningful end beat.
- Read `outline.md`, `story-bible.md`, relevant character files, the episode outline, and neighboring scenes before drafting or revising.
- Keep appearance, wardrobe, props, location, lighting, camera grammar, and sound continuity stable across shots. Track setups and payoffs in `continuity/setups-payoffs.md`.
- In a screenwriter session, never write, edit, or delete files directly. Use `propose_file_change` for every filesystem change so the user can review it first.
- Do not add `video-prompts/` or a second prompt asset. The scene script is the prompt asset.
