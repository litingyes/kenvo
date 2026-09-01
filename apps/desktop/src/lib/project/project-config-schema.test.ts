import assert from 'node:assert/strict'
import test from 'node:test'

import {
  defaultProjectConfig,
  parseProjectConfig,
  withProjectDefaultMode,
} from './project-config-schema'

void test('项目配置提供稳定的默认视图和剧本模式', () => {
  const config = defaultProjectConfig('short-video-drama')
  assert.deepEqual(config, {
    schemaVersion: 1,
    template: 'short-video-drama',
    views: ['screenplay'],
    defaultView: 'screenplay',
    screenplay: { defaultMode: 'canvas' },
  })
  assert.equal(withProjectDefaultMode(config, 'audit').screenplay.defaultMode, 'audit')
})

void test('项目配置解析器接受有效配置并拒绝损坏或未知配置', () => {
  const valid = defaultProjectConfig('blank')
  assert.deepEqual(parseProjectConfig(valid), valid)
  assert.equal(parseProjectConfig({ ...valid, schemaVersion: 2 }), null)
  assert.equal(parseProjectConfig({ ...valid, defaultView: 'unknown' }), null)
  assert.equal(
    parseProjectConfig({
      ...valid,
      views: ['screenplay'],
      defaultView: 'screenplay',
      screenplay: { defaultMode: 'editor' },
    }),
    null,
  )
  assert.equal(parseProjectConfig(null), null)
})
