import { describe, expect, it } from 'vitest'
import { normalizeAppSettings, type AppSettingsV1 } from '@shared/app-settings'
import {
  initialSetupDrafts,
  INITIAL_SETUP_CUSTOM_PROVIDER_ID
} from './initial-setup-save'
import {
  initialSetupProbeFailureState,
  initialSetupProbeFingerprint,
  initialSetupProbeProfile,
  initialSetupProbeRequest,
  initialSetupProbeSupport,
  initialSetupSelectedModel,
  normalizeInitialSetupModelIds
} from './initial-setup-provider-probe'

function settings(): AppSettingsV1 {
  return normalizeAppSettings({} as AppSettingsV1)
}

function supportProfile(overrides: Partial<{
  id: string
  kind: 'agent-sdk' | 'antigravity-cli' | 'gemini-cli-api' | 'cursor-sdk'
  endpointFormat: 'chat_completions' | 'responses' | 'messages' | 'custom_endpoint'
  baseUrl: string
}> = {}) {
  return {
    id: 'provider',
    kind: undefined,
    endpointFormat: 'chat_completions' as const,
    baseUrl: 'https://api.example/v1',
    ...overrides
  }
}

describe('initialSetupProbeSupport', () => {
  it('allows the official ChatGPT subscription model catalog endpoint', () => {
    expect(initialSetupProbeSupport({
      id: 'codex',
      kind: undefined,
      endpointFormat: 'custom_endpoint',
      baseUrl: 'https://chatgpt.com/backend-api/codex/responses'
    })).toEqual({ supported: true })
  })

  it('keeps arbitrary full custom endpoints out of standard model probing', () => {
    expect(initialSetupProbeSupport({
      id: 'xiaoling-custom-provider',
      kind: undefined,
      endpointFormat: 'custom_endpoint',
      baseUrl: 'https://gateway.example/v1/chat/completions'
    })).toEqual({ supported: false, reason: 'custom-endpoint' })
  })

  it('does not allow another host or provider id to claim the Codex probe exception', () => {
    expect(initialSetupProbeSupport({
      id: 'codex',
      kind: undefined,
      endpointFormat: 'custom_endpoint',
      baseUrl: 'https://gateway.example/backend-api/codex/responses'
    })).toEqual({ supported: false, reason: 'custom-endpoint' })
    expect(initialSetupProbeSupport({
      id: 'other-provider',
      kind: undefined,
      endpointFormat: 'custom_endpoint',
      baseUrl: 'https://chatgpt.com/backend-api/codex/responses'
    })).toEqual({ supported: false, reason: 'custom-endpoint' })
  })

  it('keeps delegated transports out of HTTP model probing', () => {
    for (const kind of ['agent-sdk', 'antigravity-cli', 'gemini-cli-api', 'cursor-sdk'] as const) {
      expect(initialSetupProbeSupport(supportProfile({ kind })))
        .toEqual({ supported: false, reason: 'delegated-transport' })
    }
  })

  it('allows standard API and custom relay endpoint formats', () => {
    for (const endpointFormat of ['chat_completions', 'responses', 'messages'] as const) {
      expect(initialSetupProbeSupport(supportProfile({ endpointFormat }))).toEqual({ supported: true })
    }
  })

  it('reports missing and invalid service URLs', () => {
    expect(initialSetupProbeSupport(supportProfile({ baseUrl: '  ' })))
      .toEqual({ supported: false, reason: 'missing-base-url' })
    expect(initialSetupProbeSupport(supportProfile({ baseUrl: 'file:///tmp/provider' })))
      .toEqual({ supported: false, reason: 'invalid-base-url' })
    expect(initialSetupProbeSupport(supportProfile({ baseUrl: 'not a url' })))
      .toEqual({ supported: false, reason: 'invalid-base-url' })
  })
})

describe('initial setup probe data', () => {
  it('builds a token plan probe profile from the selected region and profile id', () => {
    const current = settings()
    const drafts = initialSetupDrafts(current)
    drafts['xiaomi-token-plan'] = {
      apiKey: 'tp-xiaomi-key',
      baseUrl: 'https://token-plan-sgp.xiaomimimo.com/v1',
      model: 'mimo-plan-model'
    }
    const profile = initialSetupProbeProfile(current, drafts, {
      presetId: 'xiaomi',
      mode: 'token-plan'
    })

    expect(profile).toMatchObject({
      id: 'xiaomi-token-plan',
      apiKey: 'tp-xiaomi-key',
      baseUrl: 'https://token-plan-sgp.xiaomimimo.com/v1',
      models: expect.arrayContaining(['mimo-plan-model'])
    })
  })

  it('builds a valid preset probe profile before a required API key is entered', () => {
    const current = settings()
    const drafts = initialSetupDrafts(current)
    const profile = initialSetupProbeProfile(current, drafts, {
      presetId: 'xiaomi',
      mode: 'api'
    })

    expect(profile).toMatchObject({
      id: 'xiaomi',
      baseUrl: 'https://api.xiaomimimo.com/v1',
      endpointFormat: 'chat_completions'
    })
    expect(initialSetupProbeSupport(profile!)).toEqual({ supported: true })
  })

  it('constructs the exact request fields from a provider profile', () => {
    expect(initialSetupProbeRequest({
      id: 'xiaoling-custom-provider',
      baseUrl: 'https://relay.example/v1',
      apiKey: 'relay-secret',
      endpointFormat: 'responses',
      useProxy: true
    })).toEqual({
      providerId: 'xiaoling-custom-provider',
      baseUrl: 'https://relay.example/v1',
      apiKey: 'relay-secret',
      endpointFormat: 'responses',
      useProxy: true
    })
  })

  it('normalizes discovered model IDs and preserves a matching current choice', () => {
    const models = normalizeInitialSetupModelIds([' gpt-5.5 ', 'GPT-5.5', '', 'gpt-5.4'])
    expect(models).toEqual(['gpt-5.5', 'gpt-5.4'])
    expect(initialSetupSelectedModel('GPT-5.4', models)).toBe('gpt-5.4')
    expect(initialSetupSelectedModel('removed-model', models)).toBe('gpt-5.5')
    expect(initialSetupSelectedModel('manual-model', [])).toBeUndefined()
  })

  it('fingerprints profile configuration without storing a readable API key', () => {
    const profile = {
      id: 'relay',
      baseUrl: 'https://relay.example/v1',
      apiKey: 'secret-value',
      endpointFormat: 'chat_completions' as const,
      useProxy: false,
      kind: undefined
    }
    const fingerprint = initialSetupProbeFingerprint(profile)
    expect(fingerprint).not.toContain('secret-value')
    expect(initialSetupProbeFingerprint({ ...profile, apiKey: 'new-secret' })).not.toBe(fingerprint)
    expect(initialSetupProbeFingerprint({ ...profile, baseUrl: 'https://other.example/v1' })).not.toBe(fingerprint)
  })

  it('preserves provider probe errors and proxy suggestions', () => {
    expect(initialSetupProbeFailureState('fingerprint', {
      ok: false,
      message: '401 Unauthorized',
      suggestedProxyUrl: 'http://127.0.0.1:7890'
    })).toEqual({
      status: 'error',
      fingerprint: 'fingerprint',
      message: '401 Unauthorized',
      suggestedProxyUrl: 'http://127.0.0.1:7890'
    })
  })

  it('constructs a standard probe profile for a custom relay with a standard endpoint', () => {
    const current = settings()
    const drafts = initialSetupDrafts(current)
    drafts[INITIAL_SETUP_CUSTOM_PROVIDER_ID] = {
      apiKey: 'relay-key',
      baseUrl: 'https://relay.example/v1',
      model: 'relay-model',
      endpointFormat: 'responses'
    }
    expect(initialSetupProbeProfile(current, drafts, {
      presetId: INITIAL_SETUP_CUSTOM_PROVIDER_ID,
      mode: 'api'
    })).toMatchObject({
      id: INITIAL_SETUP_CUSTOM_PROVIDER_ID,
      apiKey: 'relay-key',
      baseUrl: 'https://relay.example/v1',
      endpointFormat: 'responses',
      models: ['relay-model']
    })
  })
})
