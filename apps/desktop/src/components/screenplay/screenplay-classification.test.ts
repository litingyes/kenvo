import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isRecognizedScreenplayDocument,
  isUnorganizedScreenplayDocument,
} from './screenplay-classification'

void test('识别剧本地图文件并保留未整理文件', () => {
  assert.equal(
    isRecognizedScreenplayDocument(
      'episodes/01/scenes/01-01.md',
      '---\ntype: scene\nepisode: 01\n---\n# 场景',
    ),
    true,
  )
  assert.equal(isRecognizedScreenplayDocument('characters/hero.md', '# 主角'), true)
  assert.equal(isRecognizedScreenplayDocument('notes/idea.md', '# 灵感'), false)
  assert.equal(isUnorganizedScreenplayDocument('notes/idea.md', '# 灵感'), true)
  assert.equal(isUnorganizedScreenplayDocument('README.md', '# 项目'), false)
})
