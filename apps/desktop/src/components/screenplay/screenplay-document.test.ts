import assert from 'node:assert/strict'
import test from 'node:test'

import {
  analyzeSceneDocument,
  parseSceneDocument,
  reorderShotBlocks,
  updateEpisodeOutlineSceneOrder,
  updateFrontmatterOrder,
  updateShotField,
} from './screenplay-document'

const SOURCE = `---
title: 夜班电梯
order: 2
duration: 8
characters: [林夏, 保安]
custom_flag: keep-me
---

# 夜班电梯

- **摘要**：林夏在电梯里发现一条异常短信。
- **冲突**：电梯停在不存在的楼层。

## 镜头 01 · 3 秒
- **画面**：冷白灯下的电梯门
- **动作**：林夏抬头
- **镜头**：固定中近景
- **光色**：冷白
- **声音**：电梯提示音
- **连续性**：林夏穿深色风衣

## 镜头 02 · 5 秒
- **画面**：楼层数字跳到 13
- **动作**：数字闪烁
- **镜头**：快速推近
- **光色**：冷蓝
- **声音**：低频嗡鸣
- **连续性**：手机在右手
`

void test('解析场景 frontmatter、摘要和镜头字段', () => {
  const scene = parseSceneDocument(SOURCE, 'episodes/01/scenes/01-01-night.md')

  assert.equal(scene.title, '夜班电梯')
  assert.equal(scene.duration, 8)
  assert.deepEqual(scene.characters, ['林夏', '保安'])
  assert.equal(scene.summary, '林夏在电梯里发现一条异常短信。')
  assert.equal(scene.conflict, '电梯停在不存在的楼层。')
  assert.equal(scene.shots.length, 2)
  assert.equal(scene.shots[1].fields['连续性'], '手机在右手')
  assert.equal(scene.frontmatter.custom_flag, 'keep-me')
  assert.equal(analyzeSceneDocument(scene).length, 0)
})

void test('排序和局部更新保留未知字段', () => {
  const reordered = reorderShotBlocks(SOURCE, 0, 1)
  assert.match(reordered, /## 镜头 01 · 5 秒[\s\S]*数字闪烁[\s\S]*## 镜头 02 · 3 秒/)
  assert.match(reordered, /custom_flag: keep-me/)

  const updatedOrder = updateFrontmatterOrder(SOURCE, 7)
  assert.match(updatedOrder, /order: 7/)
  assert.match(updatedOrder, /custom_flag: keep-me/)

  const updatedField = updateShotField(SOURCE, 2, '动作', '林夏按住开门键')
  assert.match(updatedField, /- \*\*动作\*\*：林夏按住开门键/)

  const outline = updateEpisodeOutlineSceneOrder(
    '## 场景顺序\n\n- old.md: 旧顺序\n\n## 备注\n\n保留。\n',
    [
      { path: 'episodes/01/scenes/02.md', title: '第二场' },
      { path: 'episodes/01/scenes/01.md', title: '第一场' },
    ],
  )
  assert.match(
    outline,
    /## 场景顺序[\s\S]*- episodes\/01\/scenes\/02\.md: 第二场[\s\S]*- episodes\/01\/scenes\/01\.md: 第一场/,
  )
  assert.match(outline, /## 备注[\s\S]*保留。/)
})

void test('异常或未整理场景不会被静默丢弃', () => {
  const scene = parseSceneDocument('# 只有标题\n\n一句未整理的文本。', 'legacy.md')
  const warnings = analyzeSceneDocument(scene)

  assert.equal(scene.title, '只有标题')
  assert.equal(scene.shots.length, 0)
  assert.ok(warnings.some((warning) => warning.message === '还没有镜头卡片'))
})
