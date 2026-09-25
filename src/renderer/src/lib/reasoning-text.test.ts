import { describe, expect, it } from 'vitest'
import { displayReasoningText, splitReasoningText, stripReasoningText } from './reasoning-text'

describe('reasoning text compatibility parser', () => {
  it('removes multiple provider wrappers and keeps their contents as reasoning', () => {
    expect(splitReasoningText('before <thinking>one</thinking> middle <analysis>two</analysis> after'))
      .toEqual({ reasoning: 'onetwo', content: 'before  middle  after' })
  })

  it('drops empty wrappers without dropping the answer', () => {
    expect(stripReasoningText('<think> </think>Hello')).toBe('Hello')
  })

  it('preserves tags inside inline code and fenced code', () => {
    const text = '`<think>inline</think>`\n\n```xml\n<thinking>fenced</thinking>\n```'
    expect(splitReasoningText(text)).toEqual({ reasoning: '', content: text })
  })

  it('keeps unknown XML visible and handles an unclosed known wrapper', () => {
    expect(splitReasoningText('<custom>value</custom>')).toEqual({
      reasoning: '', content: '<custom>value</custom>'
    })
    expect(splitReasoningText('literal <thinker')).toEqual({
      reasoning: '', content: 'literal <thinker'
    })
    expect(splitReasoningText('<reasoning>partial')).toEqual({
      reasoning: 'partial', content: ''
    })
  })

  it('handles nested wrappers and drops a trailing partial marker', () => {
    expect(splitReasoningText('before <think>outer <analysis>inner</analysis></think> after')).toEqual({
      reasoning: 'outer inner', content: 'before  after'
    })
    expect(stripReasoningText('answer <thinking')).toBe('answer')
  })

  it('renders structured reasoning text without exposing wrapper markers', () => {
    expect(displayReasoningText('<thinking>private plan</thinking>')).toBe('private plan')
    expect(displayReasoningText('prefix <analysis>private</analysis> suffix')).toBe('prefix private suffix')
    expect(displayReasoningText('```xml\n<thinking>example</thinking>\n```')).toBe('```xml\n<thinking>example</thinking>\n```')
  })
})
