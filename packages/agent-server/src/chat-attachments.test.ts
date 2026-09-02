import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_CHAT_ATTACHMENTS,
  MAX_IMAGE_ATTACHMENT_BYTES,
  MAX_TEXT_ATTACHMENT_BYTES,
  buildAgentUserMessage,
  chatMessageSchema,
} from './chat-attachments.js'

test('消息载荷兼容旧的纯文本输入，并为附件提供默认数组', () => {
  const parsed = chatMessageSchema.safeParse({ input: '继续写下一场' })
  assert.equal(parsed.success, true)
  if (parsed.success) assert.deepEqual(parsed.data.attachments, [])
})

test('消息载荷限制附件数量、文本大小与不支持的格式', () => {
  const tooMany = chatMessageSchema.safeParse({
    input: '',
    attachments: Array.from({ length: MAX_CHAT_ATTACHMENTS + 1 }, (_, index) => ({
      name: `${index}.md`,
      kind: 'text',
      mimeType: 'text/markdown',
      size: 1,
      text: 'a',
    })),
  })
  assert.equal(tooMany.success, false)

  const tooLarge = chatMessageSchema.safeParse({
    input: '',
    attachments: [
      {
        name: 'context.md',
        kind: 'text',
        mimeType: 'text/markdown',
        size: MAX_TEXT_ATTACHMENT_BYTES + 1,
        text: 'a',
      },
    ],
  })
  assert.equal(tooLarge.success, false)

  const pdf = chatMessageSchema.safeParse({
    input: '',
    attachments: [
      { name: 'brief.pdf', kind: 'text', mimeType: 'application/pdf', size: 1, text: 'x' },
    ],
  })
  assert.equal(pdf.success, false)
})

test('图片载荷限制 5 MB，并转换成模型可识别的 text/image blocks', () => {
  const imageData = Buffer.from([137, 80, 78, 71]).toString('base64')
  const valid = chatMessageSchema.safeParse({
    input: '参考这张图',
    attachments: [
      { name: 'reference.png', kind: 'image', mimeType: 'image/png', size: 4, data: imageData },
    ],
  })
  assert.equal(valid.success, true)
  if (valid.success) {
    const message = buildAgentUserMessage(valid.data.input, valid.data.attachments)
    assert.equal(message.content[0]?.type, 'text')
    assert.equal(message.content[1]?.type, 'image')
    assert.equal(message.content[1]?.attachment?.name, 'reference.png')
  }

  const tooLarge = chatMessageSchema.safeParse({
    input: '',
    attachments: [
      {
        name: 'large.png',
        kind: 'image',
        mimeType: 'image/png',
        size: MAX_IMAGE_ATTACHMENT_BYTES + 1,
        data: imageData,
      },
    ],
  })
  assert.equal(tooLarge.success, false)
})
