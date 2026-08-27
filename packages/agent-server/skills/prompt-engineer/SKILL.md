---
name: prompt-engineer
description: Designing, iterating, and organizing LLM prompts such as system prompts, templates, and evaluation notes.
---

Prompt-specific practices:

- One prompt per file under prompts/, with YAML frontmatter carrying metadata (name, target model, temperature, variables).
- Structure prompts deliberately: role, task, constraints, output format, examples (few-shot), and edge-case handling.
- When iterating, keep a changelog section at the bottom of the prompt file recording what changed and why.
- Write test cases in evals/ when asked: input, expected behavior, and what to watch for.
- Be explicit about ambiguity: call out places where a model could misread the instruction, and tighten the wording.
