import { describe, expect, it } from 'vitest'
import type { ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'
import { CompatModelClient } from './compat-model-client.js'

function request(overrides: Partial<ModelRequest> = {}): ModelRequest {
  return {
    threadId: 'thread-tag-leak',
    turnId: 'turn-tag-leak',
    model: 'test-model',
    prefix: [],
    history: [],
    tools: [],
    abortSignal: new AbortController().signal,
    ...overrides
  }
}

async function drain(iterable: AsyncIterable<ModelStreamChunk>): Promise<ModelStreamChunk[]> {
  const chunks: ModelStreamChunk[] = []
  for await (const chunk of iterable) chunks.push(chunk)
  return chunks
}

function client(fetchImpl: typeof fetch, nonStreaming = false): CompatModelClient {
  return new CompatModelClient({
    baseUrl: 'https://provider.example/v1',
    apiKey: 'test-key',
    model: 'test-model',
    endpointFormat: 'chat_completions',
    nonStreaming,
    fetchImpl
  })
}

function streamResponse(frames: string[]): Response {
  return new Response(frames.join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' }
  })
}

describe('CompatModelClient reasoning-tag leak protection', () => {
  it('normalizes tagged reasoning across streaming content fragments', async () => {
    const frames = [
      'data: {"choices":[{"delta":{"content":"before "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"<thi"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"nking>private"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"</thinking>after"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n'
    ]
    const chunks = await drain(client(async () => streamResponse(frames)).stream(request()))

    expect(chunks).toContainEqual({ kind: 'assistant_text_delta', text: 'before ' })
    expect(chunks).toContainEqual({ kind: 'assistant_reasoning_delta', text: 'private' })
    expect(chunks).toContainEqual({ kind: 'assistant_text_delta', text: 'after' })
    expect(chunks.map((chunk) => 'text' in chunk ? chunk.text : '')).not.toContain('<thinking>')
  })

  it('drops empty wrappers and preserves fenced code examples in non-streaming output', async () => {
    const response = new Response(JSON.stringify({
      choices: [{
        finish_reason: 'stop',
        message: {
          content: '<thinking> </thinking>```xml\n<think>keep</think>\n```'
        }
      }]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
    const chunks = await drain(client(async () => response, true).stream(request()))

    expect(chunks).toContainEqual({
      kind: 'assistant_text_delta',
      text: '```xml\n<think>keep</think>\n```'
    })
    expect(chunks.some((chunk) => chunk.kind === 'assistant_reasoning_delta')).toBe(false)
  })

  it('normalizes wrappers emitted in structured reasoning content', async () => {
    const response = new Response(JSON.stringify({
      choices: [{
        finish_reason: 'stop',
        message: {
          content: 'done',
          reasoning_content: '<thinking>private</thinking>plan'
        }
      }]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
    const chunks = await drain(client(async () => response, true).stream(request()))

    expect(chunks).toContainEqual({ kind: 'assistant_text_delta', text: 'done' })
    expect(chunks).toContainEqual({ kind: 'assistant_reasoning_delta', text: 'private' })
    expect(chunks).toContainEqual({ kind: 'assistant_reasoning_delta', text: 'plan' })
    expect(JSON.stringify(chunks)).not.toContain('<thinking>')
  })
})
