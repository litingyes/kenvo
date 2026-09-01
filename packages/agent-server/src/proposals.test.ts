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
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true })
  }
})
