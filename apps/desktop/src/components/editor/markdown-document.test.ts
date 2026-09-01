import assert from 'node:assert/strict'
import test from 'node:test'

import { MarkdownManager } from '@tiptap/markdown'

import {
  analyzeMarkdownDocument,
  composeMarkdownDocument,
  splitFrontmatter,
} from './markdown-document'
import { markdownExtensions } from './markdown-extensions'

void test('preserves YAML frontmatter exactly while exposing the body', () => {
  const frontmatter = '---\r\nname: demo\r\ntarget: text\r\n---\r\n'
  const source = `${frontmatter}\r\n# Title\r\n\r\n正文`

  assert.deepEqual(splitFrontmatter(source), {
    frontmatter,
    body: '\r\n# Title\r\n\r\n正文',
  })

  const analysis = analyzeMarkdownDocument(source)
  assert.equal(analysis.canVisualize, true)
  assert.equal(
    composeMarkdownDocument(analysis.frontmatter, '# Changed'),
    `${frontmatter}# Changed`,
  )
})

void test('allows normal Markdown and Mermaid code fences', () => {
  const analysis = analyzeMarkdownDocument(
    '# 标题\n\n- **正文**\n\n```mermaid\ngraph TD\n  A --> B\n```',
  )

  assert.equal(analysis.canVisualize, true)
  assert.deepEqual(analysis.safetyReasons, [])
})

void test('falls back to Source mode for opaque Markdown constructs', () => {
  for (const source of [
    '<!-- keep this marker -->\n\n# Title',
    '<aside data-kind="note">\n内容\n</aside>',
    '正文中的 <span class="tag">HTML</span>',
    ':::note\n内容\n:::',
    '[^1]: 脚注内容\n\n正文[^1]',
  ]) {
    const analysis = analyzeMarkdownDocument(source)
    assert.equal(analysis.canVisualize, false)
    assert.equal(analysis.safetyReasons.length, 1)
  }
})

void test('does not classify Markdown autolinks as raw HTML', () => {
  const analysis = analyzeMarkdownDocument('<https://example.com>')

  assert.equal(analysis.canVisualize, true)
})

void test('round-trips supported Markdown through the shared Tiptap schema', () => {
  const manager = new MarkdownManager({ extensions: markdownExtensions })
  const source = [
    '# 标题',
    '',
    '中文段落与 [链接](https://example.com)',
    '',
    '![封面](https://example.com/cover.png)',
    '',
    '- [x] 任务',
    '',
    '| 名称 | 值 |',
    '| --- | --- |',
    '| 一 | 二 |',
    '',
    '> 引用',
    '',
    '```js',
    'const value = 1',
    '```',
    '',
    '```mermaid',
    'graph TD',
    '  A-->B',
    '```',
  ].join('\n')

  const output = manager.serialize(manager.parse(source))

  for (const fragment of [
    '# 标题',
    '中文段落',
    '[链接](https://example.com)',
    '![封面](https://example.com/cover.png)',
    '- [x] 任务',
    '| 名称',
    '> 引用',
    '```js',
    '```mermaid',
  ]) {
    assert.match(output, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})
