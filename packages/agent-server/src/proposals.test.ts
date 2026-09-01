import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  applyProposal,
  listProposals,
  proposeFileChange,
  ProposalConflictError,
} from './proposals.js'

test('提案只在确认后落盘，并拒绝过期 hash', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kenvo-proposal-'))
  const sessionId = `test-${crypto.randomUUID()}`
  const filePath = path.join(projectRoot, 'scene.md')
  await fs.writeFile(filePath, 'before', 'utf8')

  try {
    const result = await proposeFileChange(sessionId, projectRoot, {
      path: 'scene.md',
      operation: 'update',
      content: 'after',
      summary: '更新场景',
    })
    assert.equal(await fs.readFile(filePath, 'utf8'), 'before')
    assert.equal(listProposals(sessionId).length, 1)

    await fs.writeFile(filePath, 'external change', 'utf8')
    await assert.rejects(
      () => applyProposal(sessionId, projectRoot, result.proposal.id),
      (error: unknown) => {
        if (!(error instanceof ProposalConflictError)) return false
        return error.conflicts[0] === 'scene.md'
      },
    )
    assert.equal(await fs.readFile(filePath, 'utf8'), 'external change')

    const fresh = await proposeFileChange(sessionId, projectRoot, {
      path: 'scene.md',
      operation: 'update',
      content: 'confirmed',
      summary: '再次更新场景',
    })
    await applyProposal(sessionId, projectRoot, fresh.proposal.id)
    assert.equal(await fs.readFile(filePath, 'utf8'), 'confirmed')
    assert.equal(listProposals(sessionId).length, 0)
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true })
  }
})

test('提案路径必须留在项目根目录内', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kenvo-proposal-path-'))
  try {
    await assert.rejects(() =>
      proposeFileChange('path-test', projectRoot, {
        path: '../outside.md',
        operation: 'create',
        content: 'blocked',
      }),
    )
    await assert.rejects(() =>
      proposeFileChange('hidden-path-test', projectRoot, {
        path: '.kenvo/project.json',
        operation: 'create',
        content: '{}',
      }),
    )
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true })
  }
})

test('move 提案在确认后移动文件，并拒绝目标冲突或源文件变化', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kenvo-proposal-move-'))
  const sessionId = `move-test-${crypto.randomUUID()}`
  const source = path.join(projectRoot, 'draft.md')
  const destination = path.join(projectRoot, 'episodes/01/scenes/01-01.md')
  await fs.writeFile(source, 'draft content', 'utf8')

  try {
    const result = await proposeFileChange(sessionId, projectRoot, {
      path: 'episodes/01/scenes/01-01.md',
      fromPath: 'draft.md',
      operation: 'move',
      summary: '归档场景',
    })
    assert.equal(await fs.readFile(source, 'utf8'), 'draft content')
    assert.equal(await fs.stat(destination).catch(() => null), null)

    await applyProposal(sessionId, projectRoot, result.proposal.id)
    assert.equal(await fs.readFile(destination, 'utf8'), 'draft content')
    assert.equal(await fs.stat(source).catch(() => null), null)

    await fs.writeFile(path.join(projectRoot, 'another.md'), 'another', 'utf8')
    const conflict = await proposeFileChange(sessionId, projectRoot, {
      path: 'episodes/01/scenes/01-02.md',
      fromPath: 'another.md',
      operation: 'move',
    })
    await fs.writeFile(path.join(projectRoot, 'episodes/01/scenes/01-02.md'), 'existing', 'utf8')
    await assert.rejects(
      () => applyProposal(sessionId, projectRoot, conflict.proposal.id),
      (error: unknown) =>
        error instanceof ProposalConflictError &&
        error.conflicts.includes('episodes/01/scenes/01-02.md'),
    )
    assert.equal(await fs.readFile(path.join(projectRoot, 'another.md'), 'utf8'), 'another')

    await fs.writeFile(path.join(projectRoot, 'third.md'), 'third', 'utf8')
    const stale = await proposeFileChange(sessionId, projectRoot, {
      path: 'episodes/01/scenes/01-03.md',
      fromPath: 'third.md',
      operation: 'move',
    })
    await fs.writeFile(path.join(projectRoot, 'third.md'), 'changed', 'utf8')
    await assert.rejects(
      () => applyProposal(sessionId, projectRoot, stale.proposal.id),
      (error: unknown) =>
        error instanceof ProposalConflictError && error.conflicts.includes('third.md'),
    )
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true })
  }
})
