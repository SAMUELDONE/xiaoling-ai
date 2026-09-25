import type { UsageSnapshot } from '../contracts/usage.js'
import type { ToolCallProviderMetadata } from '../contracts/items.js'
import type { ModelStreamChunk } from '../ports/model-client.js'
import type { ToolCallLike } from '../ports/tool-host.js'
import type { ModelFailureMetadata } from '../contracts/model-route-pool.js'
import { repairDispatchToolArguments } from './tool-call-repair.js'
import { TaggedReasoningNormalizer } from '../shared/tagged-reasoning-normalizer.js'

export type ModelStreamStopReason = 'stop' | 'tool_calls' | 'length' | 'error'

export type ModelStreamToolMetadata = {
  providerId?: string
  toolKind?: ToolCallLike['toolKind']
}

export type ModelStreamCollectorConfig = {
  maxToolCallsPerStep: number
  /** Fast Context keeps the accepted batch useful when a model overshoots its bounded retrieval budget. */
  toolCallOverflowBehavior?: 'fail' | 'truncate'
  toolMetadata: ReadonlyMap<string, ModelStreamToolMetadata>
  /**
   * Provider call ids are not trusted as execution identity. Normalize each id
   * before persistence so separate model steps cannot collide when a compatible
   * provider omits or reuses it.
   */
  allocateRuntimeCallId: (providerCallId: string) => string
  maxToolArgumentStringBytes?: number
}

export type ModelStreamIntent =
  | { kind: 'assistant_text_delta'; text: string }
  | { kind: 'assistant_reasoning_delta'; text: string }
  | {
      kind: 'retrying'
      status?: number
      attempt: number
      maxAttempts: number
      delayMs: number
      reason?: 'network' | 'stream_transport'
      failureSummary?: string
    }
  | {
      kind: 'tool_call_ready'
      call: ToolCallLike
      repairNotes: readonly string[]
      providerMetadata?: ToolCallProviderMetadata
    }
  | { kind: 'generated_image'; imageBase64: string; mimeType: string }
  | { kind: 'usage'; usage: UsageSnapshot }
  | { kind: 'model_error'; message: string; code?: string; failure?: ModelFailureMetadata }

export type ModelStreamSnapshot = {
  text: string
  reasoning: string
  toolCalls: readonly ToolCallLike[]
  stopReason: ModelStreamStopReason
}

export type ModelStreamReduction = {
  intents: readonly ModelStreamIntent[]
  terminal?: { kind: 'tool_call_limit_exceeded'; message: string }
}

/**
 * Deterministic, no-I/O model stream reducer. It intentionally owns only
 * stream-local state; AgentLoop remains responsible for ID allocation,
 * runtime event order, image writes, usage accounting, and persistence.
 */
export class ModelStreamCollector {
  private readonly textAccumulator = new StreamTextAccumulator()
  private readonly reasoningAccumulator = new StreamTextAccumulator()
  private taggedReasoning = new TaggedReasoningNormalizer()
  private structuredReasoning = new TaggedReasoningNormalizer()
  private readonly toolCalls: ToolCallLike[] = []
  private truncatedToolCalls = 0
  private stopReason: ModelStreamStopReason = 'stop'

  constructor(private readonly config: ModelStreamCollectorConfig) {}

  reduce(chunk: ModelStreamChunk): ModelStreamReduction {
    switch (chunk.kind) {
      case 'assistant_text_delta':
        return {
          intents: [
            ...this.flushStructuredReasoning(),
            ...this.reduceTaggedText(chunk.text)
          ]
        }
      case 'assistant_reasoning_delta':
        return {
          intents: [
            ...this.flushTaggedText(),
            ...this.reduceStructuredReasoning(chunk.text)
          ]
        }
      case 'tool_call_delta':
        // Tool deltas are intentionally not persisted or surfaced until the
        // provider supplies a complete, parseable call.
        return { intents: [] }
      case 'retrying':
        return {
          intents: [{
            kind: 'retrying',
            ...(chunk.status !== undefined ? { status: chunk.status } : {}),
            attempt: chunk.attempt,
            maxAttempts: chunk.maxAttempts,
            delayMs: chunk.delayMs,
            ...(chunk.reason ? { reason: chunk.reason } : {}),
            ...(chunk.failureSummary ? { failureSummary: chunk.failureSummary } : {})
          }]
        }
      case 'tool_call_complete':
        {
          const reduction = this.reduceCompletedToolCall(chunk)
          return {
            intents: [
              ...this.flushTaggedText(),
              ...this.flushStructuredReasoning(),
              ...reduction.intents
            ],
            ...(reduction.terminal ? { terminal: reduction.terminal } : {})
          }
        }
      case 'image_generation_complete':
        return {
          intents: [
            ...this.flushTaggedText(),
            ...this.flushStructuredReasoning(),
            {
              kind: 'generated_image',
              imageBase64: chunk.imageBase64,
              mimeType: chunk.mimeType
            }
          ]
        }
      case 'usage':
        return { intents: [{ kind: 'usage', usage: chunk.usage }] }
      case 'completed':
        // Providers can emit usage after a completed marker. Keep draining
        // chunks, and do not let a later completed marker clear an error.
        if (this.stopReason !== 'error') this.stopReason = chunk.stopReason
        return {
          intents: [
            ...this.flushTaggedText(),
            ...this.flushStructuredReasoning()
          ]
        }
      case 'error':
        this.stopReason = 'error'
        return {
          intents: [
            ...this.flushTaggedText(),
            ...this.flushStructuredReasoning(),
            {
              kind: 'model_error',
              message: chunk.message,
              ...(chunk.code ? { code: chunk.code } : {}),
              ...(chunk.failure ? { failure: chunk.failure } : {})
            }
          ]
        }
    }
  }

  /** Add generated-image Markdown through the same text accumulation path. */
  appendAssistantText(text: string): Extract<ModelStreamIntent, { kind: 'assistant_text_delta' }> {
    this.textAccumulator.append(text)
    return { kind: 'assistant_text_delta', text }
  }

  get text(): string {
    return this.textAccumulator.value
  }

  get reasoning(): string {
    return this.reasoningAccumulator.value
  }

  get toolCallCount(): number {
    return this.toolCalls.length
  }

  get truncatedToolCallCount(): number {
    return this.truncatedToolCalls
  }

  /** Commits a trailing partial wrapper when a turn is aborted or persisted early. */
  flushPendingText(): void {
    this.flushTaggedText()
    this.flushStructuredReasoning()
  }

  snapshot(): ModelStreamSnapshot {
    this.flushPendingText()
    return {
      text: this.textAccumulator.value,
      reasoning: this.reasoningAccumulator.value,
      toolCalls: [...this.toolCalls],
      stopReason: this.stopReason
    }
  }

  private reduceCompletedToolCall(
    chunk: Extract<ModelStreamChunk, { kind: 'tool_call_complete' }>
  ): ModelStreamReduction {
    if (!chunk.toolName.trim()) {
      this.stopReason = 'error'
      return {
        intents: [{
          kind: 'model_error',
          message: 'model stream produced an incomplete tool call',
          code: 'stream_tool_call_protocol'
        }]
      }
    }
    if (this.toolCalls.length >= this.config.maxToolCallsPerStep) {
      if (this.config.toolCallOverflowBehavior === 'truncate') {
        this.truncatedToolCalls += 1
        return { intents: [] }
      }
      return {
        intents: [],
        terminal: {
          kind: 'tool_call_limit_exceeded',
          message: `model response exceeded ${this.config.maxToolCallsPerStep} tool calls`
        }
      }
    }
    const metadata = this.config.toolMetadata.get(chunk.toolName)
    const repaired = repairDispatchToolArguments(chunk.arguments, {
      toolName: chunk.toolName,
      ...(metadata?.toolKind ? { toolKind: metadata.toolKind } : {}),
      ...(this.config.maxToolArgumentStringBytes !== undefined
        ? { maxStringBytes: this.config.maxToolArgumentStringBytes }
        : {})
    })
    const call: ToolCallLike = {
      callId: this.config.allocateRuntimeCallId(chunk.callId),
      toolName: chunk.toolName,
      ...(metadata?.providerId ? { providerId: metadata.providerId } : {}),
      ...(metadata?.toolKind ? { toolKind: metadata.toolKind } : {}),
      arguments: repaired.arguments
    }
    this.toolCalls.push(call)
    return {
      intents: [{
        kind: 'tool_call_ready',
        call,
        repairNotes: repaired.notes,
        ...(chunk.providerMetadata ? { providerMetadata: chunk.providerMetadata } : {})
      }]
    }
  }

  private reduceTaggedText(text: string): Extract<ModelStreamIntent, { kind: 'assistant_text_delta' | 'assistant_reasoning_delta' }>[] {
    return this.taggedReasoning.push(text).map((delta) => {
      if (delta.kind === 'assistant_text_delta') this.textAccumulator.append(delta.text)
      else this.reasoningAccumulator.append(delta.text)
      return delta
    })
  }

  private flushTaggedText(): Extract<ModelStreamIntent, { kind: 'assistant_text_delta' | 'assistant_reasoning_delta' }>[] {
    const deltas = this.taggedReasoning.flush().map((delta) => {
      if (delta.kind === 'assistant_text_delta') this.textAccumulator.append(delta.text)
      else this.reasoningAccumulator.append(delta.text)
      return delta
    })
    this.taggedReasoning = new TaggedReasoningNormalizer()
    return deltas
  }

  private reduceStructuredReasoning(text: string): Extract<ModelStreamIntent, { kind: 'assistant_reasoning_delta' }>[] {
    return this.structuredReasoning.push(text).map((delta) => {
      this.reasoningAccumulator.append(delta.text)
      return { kind: 'assistant_reasoning_delta' as const, text: delta.text }
    })
  }

  private flushStructuredReasoning(): Extract<ModelStreamIntent, { kind: 'assistant_reasoning_delta' }>[] {
    const deltas = this.structuredReasoning.flush().map((delta) => {
      this.reasoningAccumulator.append(delta.text)
      return { kind: 'assistant_reasoning_delta' as const, text: delta.text }
    })
    this.structuredReasoning = new TaggedReasoningNormalizer()
    return deltas
  }
}

/** O(1)-append, lazily joined stream text accumulator. */
class StreamTextAccumulator {
  private readonly parts: string[] = []
  private joined: string | undefined

  append(text: string): void {
    if (!text) return
    this.parts.push(text)
    this.joined = undefined
  }

  get value(): string {
    if (this.joined === undefined) this.joined = this.parts.join('')
    return this.joined
  }
}
