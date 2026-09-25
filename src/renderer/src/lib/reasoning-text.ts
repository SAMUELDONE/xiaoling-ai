export type SplitReasoningText = {
  reasoning: string
  content: string
}

const REASONING_TAG_NAMES = new Set([
  'think',
  'thinking',
  'analysis',
  'reasoning',
  'reflection',
  'thought',
  'scratchpad',
  'chain_of_thought',
  'cot'
])

const OPEN_TAG = /^<\s*([a-z_][a-z0-9_-]*)(?:\s+[^>]*)?>/i
const CLOSE_TAG = /^<\s*\/\s*([a-z_][a-z0-9_-]*)\s*>/i

/**
 * Splits provider-emitted reasoning wrappers from assistant content. This is
 * a display-time compatibility path for old persisted messages; new streams
 * are normalized in Kun before persistence. Markdown code spans/fences remain
 * opaque so examples containing `<think>` are not rewritten.
 */
export function splitReasoningText(text: string): SplitReasoningText {
  if (!text) return { reasoning: '', content: text }
  const reasoningParts: string[] = []
  const contentParts: string[] = []
  const stack: string[] = []
  let codeFence = 0
  let inlineCode = 0
  let index = 0
  let sawTag = false

  const append = (value: string): void => {
    if (!value) return
    ;(stack.length > 0 ? reasoningParts : contentParts).push(value)
  }

  while (index < text.length) {
    const run = text.startsWith('```', index) ? 3 : text[index] === '`' ? 1 : 0
    if (run > 0) {
      const end = (() => {
        let cursor = index + run
        while (cursor < text.length && text[cursor] === '`') cursor += 1
        return cursor
      })()
      const runText = text.slice(index, end)
      append(runText)
      if (codeFence > 0) {
        if (run >= codeFence) codeFence = 0
      } else if (inlineCode > 0) {
        if (run === inlineCode) inlineCode = 0
      } else if (run >= 3) {
        codeFence = run
      } else {
        inlineCode = run
      }
      index = end
      continue
    }

    if (codeFence === 0 && inlineCode === 0 && text[index] === '<') {
      const remaining = text.slice(index)
      const close = remaining.match(CLOSE_TAG)
      if (close && REASONING_TAG_NAMES.has(close[1].toLowerCase())) {
        const name = close[1].toLowerCase()
        if (stack.length > 0 && stack[stack.length - 1] === name) {
          stack.pop()
        }
        // A stray/mismatched provider close marker is still protocol noise;
        // drop it without changing the nesting state.
        sawTag = true
        index += close[0].length
        continue
      }
      const open = remaining.match(OPEN_TAG)
      if (open && REASONING_TAG_NAMES.has(open[1].toLowerCase())) {
        stack.push(open[1].toLowerCase())
        sawTag = true
        index += open[0].length
        continue
      }
      if (looksLikeRecognizedPartialTag(remaining)) {
        // Old persisted messages can end with a provider marker split at the
        // final byte. It must not become visible simply because the stream was
        // interrupted before the closing `>` arrived.
        sawTag = true
        index = text.length
        continue
      }
    }

    append(text[index])
    index += 1
  }

  if (!sawTag) return { reasoning: '', content: text }
  return {
    reasoning: reasoningParts.join('').trim(),
    content: contentParts.join('').trim()
  }
}

export function stripReasoningText(text: string): string {
  return splitReasoningText(text).content
}

/**
 * Returns reasoning-channel text without provider wrapper markers.
 *
 * A structured reasoning block is already safe to show in the process panel,
 * but older persisted blocks can still contain tagged wrappers. Keep both the
 * tagged inner text and any ordinary text surrounding it; this helper is not
 * used for assistant answers, where tagged reasoning must be hidden entirely.
 */
export function displayReasoningText(text: string): string {
  if (!text) return text
  const parts: string[] = []
  let codeFence = 0
  let inlineCode = 0
  let index = 0

  while (index < text.length) {
    const run = text.startsWith('```', index) ? 3 : text[index] === '`' ? 1 : 0
    if (run > 0) {
      let end = index + run
      while (end < text.length && text[end] === '`') end += 1
      parts.push(text.slice(index, end))
      if (codeFence > 0) {
        if (run >= codeFence) codeFence = 0
      } else if (inlineCode > 0) {
        if (run === inlineCode) inlineCode = 0
      } else if (run >= 3) {
        codeFence = run
      } else {
        inlineCode = run
      }
      index = end
      continue
    }

    if (codeFence === 0 && inlineCode === 0 && text[index] === '<') {
      const remaining = text.slice(index)
      const close = remaining.match(CLOSE_TAG)
      if (close && REASONING_TAG_NAMES.has(close[1].toLowerCase())) {
        index += close[0].length
        continue
      }
      const open = remaining.match(OPEN_TAG)
      if (open && REASONING_TAG_NAMES.has(open[1].toLowerCase())) {
        index += open[0].length
        continue
      }
      if (looksLikeRecognizedPartialTag(remaining)) break
    }

    parts.push(text[index])
    index += 1
  }

  return parts.join('').trim()
}

function looksLikeRecognizedPartialTag(value: string): boolean {
  if (!value.startsWith('<') || value.includes('>') || value.length > 256) return false
  if (!/^<\s*\/?\s*[A-Za-z_][A-Za-z0-9_-]*(?:\s+[^>]*)?$/i.test(value)) return false
  const match = value.match(/^<\s*\/?\s*([A-Za-z_][A-Za-z0-9_-]*)?/i)
  const name = match?.[1]?.toLowerCase()
  if (!name) return false
  return [...REASONING_TAG_NAMES].some((tag) => tag.startsWith(name))
}
