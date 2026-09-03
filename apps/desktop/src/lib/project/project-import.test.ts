import assert from 'node:assert/strict'
import test from 'node:test'

import { canCreateTemplateInDirectory } from './project-import'

void test('新建模板不会覆盖已有可见文件', () => {
  assert.equal(canCreateTemplateInDirectory([]), true)
  assert.equal(canCreateTemplateInDirectory([{ name: '.DS_Store' }]), true)
  assert.equal(canCreateTemplateInDirectory([{ name: 'outline.md' }]), false)
})
