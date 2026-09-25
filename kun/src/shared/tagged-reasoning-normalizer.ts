/**
 * Normalizes reasoning wrappers emitted as ordinary assistant text by
 * compatibility providers. Structured reasoning chunks are handled by the
 * caller and never pass through this parser.
 *
 * Some relays emit `<think>`, `<thinking>`, or similar wrappers even though
 * the selected wire protocol has no reasoning channel. The parser is
 * incremental because a wrapper can be split across SSE frames. It also keeps
 * code spans/fences opaque so an answer containing an example XML tag remains
 * ordinary answer text.
 */

import type { ModelStreamChunk } from '../ports/model-client.js'

export type TaggedReasoningDelta =
  | { kind: 'assistant_text_delta'; text: string }
  | { kind: 'assistant_reasoning_delta'; text: string }

/** Small collector for one-shot callers that consume a model stream directly. */
export class TaggedReasoningTextAccumulator {
  private readonly normalizer = new TaggedReasoningNormalizer()
  private readonly reasoningNormalizer = new TaggedReasoningNormalizer()
  private readonly textParts: string[] = []
  private readonly reasoningParts: string[] = []

  append(text: string): void {
    this.recordReasoning(this.reasoningNormalizer.flush())
    this.record(this.normalizer.push(text))
  }

  appendReasoning(text: string): void {
    this.record(this.normalizer.flush())
    this.recordReasoning(this.reasoningNormalizer.push(text))
  }

  flush(): void {
    this.record(this.normalizer.flush())
    this.recordReasoning(this.reasoningNormalizer.flush())
  }

  get text(): string {
    return this.textParts.join('')
  }

  get reasoning(): string {
    return this.reasoningParts.join('')
  }

  private record(deltas: readonly TaggedReasoningDelta[]): void {
    for (const delta of deltas) {
      if (delta.kind === 'assistant_text_delta') this.textParts.push(delta.text)
      else this.reasoningParts.push(delta.text)
    }
  }

  private recordReasoning(deltas: readonly TaggedReasoningDelta[]): void {
    for (const delta of deltas) this.reasoningParts.push(delta.text)
  }
}

/**
 * Removes recognized wrapper markers from a fragment that is already known to
 * belong to the reasoning channel. Code spans and fences remain opaque.
 */
export function normalizeTaggedReasoningFragment(text: string): string {
  if (!text) return ''
  const normalizer = new TaggedReasoningNormalizer()
  return [...normalizer.push(text), ...normalizer.flush()].map((delta) => delta.text).join('')
}

export function normalizeTaggedReasoningText(text: string): {
  text: string
  reasoning: string
} {
  const normalizer = new TaggedReasoningNormalizer()
  const deltas = [...normalizer.push(text), ...normalizer.flush()]
  return {
    text: deltas.filter((delta) => delta.kind === 'assistant_text_delta').map((delta) => delta.text).join(''),
    reasoning: deltas.filter((delta) => delta.kind === 'assistant_reasoning_delta').map((delta) => delta.text).join('')
  }
}

const TAG_NAMES = [
  'think',
  'thinking',
  'analysis',
  'reasoning',
  'reflection',
  'thought',
  'scratchpad',
  'chain_of_thought',
  'cot'
] as const

const TAG_NAME_PATTERN = TAG_NAMES.join('|')
const OPEN_TAG_PATTERN = new RegExp(
  `^<\\s*(${TAG_NAME_PATTERN})(?:\\s+[^>]*)?>`,
  'i'
)
const CLOSE_TAG_PATTERN = new RegExp(
  `^<\\s*\\/\\s*(${TAG_NAME_PATTERN})\\s*>`,
  'i'
)

type ParsedTag = { kind: 'open' | 'close'; name: string; length: number }

/** Incrementally converts recognized tagged-thought text into reasoning deltas. */
export class TaggedReasoningNormalizer {
  private buffer = ''
  private readonly reasoningTags: string[] = []
  private fencedCode = false
  private inlineCode = false

  push(text: string): TaggedReasoningDelta[] {
    if (!text) return []
    this.buffer += text
    return this.process(false)
  }

  /** Flushes a final partial tag/content at the end of a model response. */
  flush(): TaggedReasoningDelta[] {
    const output = this.process(true)
    // A flush is also a protocol boundary. Do not let an unfinished wrapper
    // or Markdown state affect a later response/retry on the same client.
    this.buffer = ''
    this.reasoningTags.length = 0
    this.fencedCode = false
    this.inlineCode = false
    return output
  }

  private process(final: boolean): TaggedReasoningDelta[] {
    const output: TaggedReasoningDelta[] = []
    let index = 0
    let segmentStart = 0

    while (index < this.buffer.length) {
      if (this.fencedCode || this.inlineCode) {
        if (this.buffer.startsWith('```', index)) {
          this.emit(output, this.buffer.slice(segmentStart, index + 3), false)
          this.fencedCode = !this.fencedCode
          this.inlineCode = false
          index += 3
          segmentStart = index
          continue
        }
        if (!this.fencedCode && this.buffer[index] === '`') {
          this.emit(output, this.buffer.slice(segmentStart, index + 1), false)
          this.inlineCode = false
          index += 1
          segmentStart = index
          continue
        }
        index += 1
        continue
      }

      if (this.buffer.startsWith('```', index)) {
        this.emit(output, this.buffer.slice(segmentStart, index + 3), false)
        this.fencedCode = true
        index += 3
        segmentStart = index
        continue
      }
      if (this.buffer[index] === '`') {
        this.emit(output, this.buffer.slice(segmentStart, index + 1), false)
        this.inlineCode = true
        index += 1
        segmentStart = index
        continue
      }

      if (this.buffer[index] !== '<') {
        index += 1
        continue
      }

      const parsed = parseTag(this.buffer.slice(index))
      if (!parsed) {
        if (!final && looksLikePartialTag(this.buffer.slice(index))) {
          this.emit(output, this.buffer.slice(segmentStart, index), this.reasoningTags.length > 0)
          this.buffer = this.buffer.slice(index)
          return output
        }
        if (final && looksLikeRecognizedPartialTag(this.buffer.slice(index))) {
          // Providers occasionally terminate after emitting only `<think` or
          // `</analysis`. These are protocol markers, not user content.
          this.emit(output, this.buffer.slice(segmentStart, index), this.reasoningTags.length > 0)
          this.buffer = ''
          return output
        }
        index += 1
        continue
      }

      this.emit(output, this.buffer.slice(segmentStart, index), this.reasoningTags.length > 0)
      if (parsed.kind === 'open') {
        this.reasoningTags.push(parsed.name)
      } else if (this.reasoningTags.length > 0) {
        const last = this.reasoningTags.at(-1)
        if (last === parsed.name) this.reasoningTags.pop()
      }
      index += parsed.length
      segmentStart = index
    }

    if (segmentStart < this.buffer.length) {
      const tail = this.buffer.slice(segmentStart)
      if (!final && this.reasoningTags.length === 0 && looksLikePartialTag(tail)) {
        this.emit(output, '', false)
        this.buffer = tail
        return output
      }
      if (final && looksLikeRecognizedPartialTag(tail)) {
        this.emit(output, '', false)
      } else {
        this.emit(output, tail, this.reasoningTags.length > 0)
      }
    }
    this.buffer = ''
    return output
  }

  private emit(output: TaggedReasoningDelta[], text: string, reasoning: boolean): void {
    if (!text || (reasoning && !text.trim())) return
    const kind = reasoning ? 'assistant_reasoning_delta' : 'assistant_text_delta'
    const previous = output.at(-1)
    if (previous?.kind === kind) {
      previous.text += text
    } else {
      output.push({ kind, text })
    }
  }
}

/**
 * Normalizes one model stream chunk while preserving all non-text metadata.
 * The same helper is used at provider and runtime boundaries so extension,
 * native, and compatibility providers share identical tag semantics.
 */
export function normalizeTaggedReasoningChunk(
  chunk: ModelStreamChunk,
  normalizer: TaggedReasoningNormalizer,
  structuredReasoningNormalizer: TaggedReasoningNormalizer
): ModelStreamChunk[] {
  if (chunk.kind === 'assistant_text_delta') {
    return [
      ...structuredReasoningNormalizer.flush().map(asReasoningDelta),
      ...normalizer.push(chunk.text)
    ].map((delta) => ({
      ...delta,
      ...(chunk.route ? { route: chunk.route } : {})
    }))
  }
  if (chunk.kind === 'assistant_reasoning_delta') {
    const visibleText = normalizer.flush()
    const structured = structuredReasoningNormalizer.push(chunk.text).map(asReasoningDelta)
    return [...visibleText, ...structured].map((delta) => ({
      ...delta,
      ...(chunk.route ? { route: chunk.route } : {})
    }))
  }
  if (
    chunk.kind === 'tool_call_complete' ||
    chunk.kind === 'image_generation_complete' ||
    chunk.kind === 'completed' ||
    chunk.kind === 'error'
  ) {
    return [
      ...normalizer.flush().map((delta) => ({
        ...delta,
        ...(chunk.route ? { route: chunk.route } : {})
      })),
      ...structuredReasoningNormalizer.flush().map((delta) => ({
        ...asReasoningDelta(delta),
        ...(chunk.route ? { route: chunk.route } : {})
      })),
      chunk
    ]
  }
  return [chunk]
}

/** Flushes a stream-local normalizer after the provider ends without a marker. */
export function flushTaggedReasoningNormalizer(
  normalizer: TaggedReasoningNormalizer,
  structuredReasoningNormalizer: TaggedReasoningNormalizer
): ModelStreamChunk[] {
  return [
    ...normalizer.flush(),
    ...structuredReasoningNormalizer.flush().map(asReasoningDelta)
  ]
}

function asReasoningDelta(delta: TaggedReasoningDelta): TaggedReasoningDelta {
  return { kind: 'assistant_reasoning_delta', text: delta.text }
}

function parseTag(value: string): ParsedTag | undefined {
  const close = value.match(CLOSE_TAG_PATTERN)
  if (close) return { kind: 'close', name: close[1].toLowerCase(), length: close[0].length }
  const open = value.match(OPEN_TAG_PATTERN)
  if (open) return { kind: 'open', name: open[1].toLowerCase(), length: open[0].length }
  return undefined
}

function looksLikePartialTag(value: string): boolean {
  if (!value.startsWith('<') || value.includes('>') || value.length > 256) return false
  return /^<\s*\/?\s*[A-Za-z_][A-Za-z0-9_-]*(?:\s+[^>]*)?$/i.test(value) || value === '<'
}

function looksLikeRecognizedPartialTag(value: string): boolean {
  if (!looksLikePartialTag(value)) return false
  const match = value.match(/^<\s*\/?\s*([A-Za-z_][A-Za-z0-9_-]*)?/i)
  const name = match?.[1]?.toLowerCase()
  if (!name) return false
  return TAG_NAMES.some((tag) => tag.startsWith(name))
}
