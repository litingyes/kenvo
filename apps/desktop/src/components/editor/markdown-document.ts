export type MarkdownSafetyReason = 'html-comment' | 'raw-html' | 'directive' | 'unknown-syntax'

export interface MarkdownDocumentAnalysis {
  frontmatter: string
  body: string
  canVisualize: boolean
  safetyReasons: MarkdownSafetyReason[]
}

const FRONTMATTER_OPEN = /^(?:\uFEFF)?---(?:\r\n|\n|\r)/
const FRONTMATTER_CLOSE = /^(?:---|\.\.\.)(?:\r\n|\n|\r|$)/gm
const FENCED_CODE_BLOCK =
  /(^|\r?\n)\s{0,3}(`{3,}|~{3,})[^\r\n]*(?:\r?\n|$)[\s\S]*?(?:\r?\n\s{0,3}\2\s*(?:\r?\n|$)|$)/g

/**
 * Split YAML frontmatter without normalizing its bytes. The prefix is kept
 * outside Tiptap so switching back from Visual mode never rewrites metadata.
 */
function splitFrontmatter(source: string): { frontmatter: string; body: string } {
  const opening = FRONTMATTER_OPEN.exec(source)
  if (!opening) return { frontmatter: '', body: source }

  FRONTMATTER_CLOSE.lastIndex = opening[0].length
  const closing = FRONTMATTER_CLOSE.exec(source)
  FRONTMATTER_CLOSE.lastIndex = 0
  if (!closing) return { frontmatter: '', body: source }

  const end = closing.index + closing[0].length
  return { frontmatter: source.slice(0, end), body: source.slice(end) }
}

function detectSafetyReasons(body: string): MarkdownSafetyReason[] {
  const reasons: MarkdownSafetyReason[] = []
  const outsideFencedCode = body.replace(FENCED_CODE_BLOCK, '$1')

  if (outsideFencedCode.includes('<!--') || outsideFencedCode.includes('-->')) {
    reasons.push('html-comment')
  }

  // Tiptap can parse some inline HTML, but the Markdown round-trip cannot
  // guarantee preserving arbitrary HTML blocks or their attributes.
  if (/<\/?[A-Za-z][\w:-]*(?:\s[^<>]*|\/?)>/m.test(outsideFencedCode)) {
    reasons.push('raw-html')
  }

  // Custom directive blocks (for example :::note) are opaque to the current
  // editor schema and should remain source-editable.
  if (/^\s{0,3}:{3,}/m.test(outsideFencedCode)) {
    reasons.push('directive')
  }

  // Footnotes and reference definitions are not represented by the current
  // schema and would otherwise be rewritten as ordinary links or text.
  if (
    /(?:^\s{0,3}\[\^[^\]\n]+\]:|\[\^[^\]\n]+\])|^\s{0,3}\[[^\]\n]+\]:\s*\S+/m.test(
      outsideFencedCode,
    )
  ) {
    reasons.push('unknown-syntax')
  }

  return reasons
}

export function analyzeMarkdownDocument(source: string): MarkdownDocumentAnalysis {
  const { frontmatter, body } = splitFrontmatter(source)
  const safetyReasons = detectSafetyReasons(body)
  return {
    frontmatter,
    body,
    canVisualize: safetyReasons.length === 0,
    safetyReasons,
  }
}

export function composeMarkdownDocument(frontmatter: string, body: string): string {
  return `${frontmatter}${body}`
}

export { splitFrontmatter }
