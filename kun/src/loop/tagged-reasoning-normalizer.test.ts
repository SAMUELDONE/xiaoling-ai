import { describe, expect, it } from 'vitest'
import {
  normalizeTaggedReasoningFragment,
  TaggedReasoningNormalizer,
  TaggedReasoningTextAccumulator
} from '../shared/tagged-reasoning-normalizer.js'

function collect(parts: string[]): ReturnType<TaggedReasoningNormalizer['push']> {
  const normalizer = new TaggedReasoningNormalizer()
  const deltas = parts.flatMap((part) => normalizer.push(part))
  return [...deltas, ...normalizer.flush()]
}

describe('TaggedReasoningNormalizer', () => {
  it.each([
    ['think', 'analysis'],
    ['thinking', 'reasoning'],
    ['reflection', 'thought'],
    ['scratchpad', 'cot']
  ])('recognizes %s and %s wrappers', (first, second) => {
    expect(collect([`before <${first}>hidden</${first}> middle <${second}>more</${second}> after`]))
      .toEqual([
        { kind: 'assistant_text_delta', text: 'before ' },
        { kind: 'assistant_reasoning_delta', text: 'hidden' },
        { kind: 'assistant_text_delta', text: ' middle ' },
        { kind: 'assistant_reasoning_delta', text: 'more' },
        { kind: 'assistant_text_delta', text: ' after' }
      ])
  })

  it('does not reinterpret inline or fenced code examples', () => {
    const text = '`<think>inline</think>`\n\n```\n<thinking>fenced</thinking>\n```'
    expect(collect([text])).toEqual([{ kind: 'assistant_text_delta', text }])
  })

  it('does not lose a wrapper split immediately after the opening angle bracket', () => {
    expect(collect(['before <', 'think', 'ing>hidden</think', 'ing> after'])).toEqual([
      { kind: 'assistant_text_delta', text: 'before ' },
      { kind: 'assistant_reasoning_delta', text: 'hidden' },
      { kind: 'assistant_text_delta', text: ' after' }
    ])
  })

  it('keeps ordinary comparison text and unknown XML visible', () => {
    const text = '2 < 3 and <custom>value</custom>'
    expect(collect([text])).toEqual([{ kind: 'assistant_text_delta', text }])
    expect(collect(['literal <thinker']).map((delta) => delta.text).join('')).toBe('literal <thinker')
  })

  it('keeps nested recognized wrappers in the reasoning channel', () => {
    expect(collect(['before <think>outer <analysis>inner</analysis> tail</think> after'])).toEqual([
      { kind: 'assistant_text_delta', text: 'before ' },
      { kind: 'assistant_reasoning_delta', text: 'outer inner tail' },
      { kind: 'assistant_text_delta', text: ' after' }
    ])
  })

  it('drops a recognized wrapper fragment if the provider ends mid-marker', () => {
    expect(collect(['answer <think'])).toEqual([{ kind: 'assistant_text_delta', text: 'answer ' }])
    expect(collect(['answer </analysis'])).toEqual([{ kind: 'assistant_text_delta', text: 'answer ' }])
  })

  it('resets wrapper state after a flush boundary', () => {
    const normalizer = new TaggedReasoningNormalizer()
    expect(normalizer.push('<think>private')).toEqual([
      { kind: 'assistant_reasoning_delta', text: 'private' }
    ])
    expect(normalizer.flush()).toEqual([])
    expect(normalizer.push('visible')).toEqual([
      { kind: 'assistant_text_delta', text: 'visible' }
    ])
  })

  it('normalizes wrappers inside structured reasoning without exposing them as answer text', () => {
    const output = new TaggedReasoningTextAccumulator()
    output.appendReasoning('<think>private')
    output.appendReasoning('</think> more')
    output.flush()
    expect(output.text).toBe('')
    expect(output.reasoning).toBe('private more')
    expect(normalizeTaggedReasoningFragment('```xml\n<think>example</think>\n```'))
      .toBe('```xml\n<think>example</think>\n```')
  })
})
