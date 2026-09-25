import {
  isCustomModelEndpointFormat,
  type ModelEndpointFormat,
  type ModelProviderProfileV1
} from '@shared/app-settings'
import type {
  ModelProviderProbeRequest,
  ModelProviderProbeResult
} from '@shared/kun-gui-api'
import type { AppSettingsV1 } from '@shared/app-settings'
import {
  modelProviderPresetProfile,
  modelProviderTokenPlanProfile
} from '@shared/model-provider-presets'
import { CHATGPT_SUBSCRIPTION_PROVIDER_ID } from '@shared/model-provider-presets'
import { normalizeModelProviderProfile } from '@shared/app-settings-provider-profiles'
import {
  buildInitialSetupSettings,
  initialSetupProfileId,
  presetForInitialSetup,
  type InitialSetupDrafts,
  type InitialSetupSelection
} from './initial-setup-save'

export type InitialSetupProbeSupportReason =
  | 'delegated-transport'
  | 'custom-endpoint'
  | 'missing-base-url'
  | 'invalid-base-url'

export type InitialSetupProbeSupport =
  | { supported: true }
  | { supported: false; reason: InitialSetupProbeSupportReason }

export type InitialSetupProbeState =
  | { status: 'idle' }
  | { status: 'busy'; fingerprint: string }
  | {
      status: 'ok'
      fingerprint: string
      latencyMs: number
      modelIds: string[]
    }
  | {
      status: 'error'
      fingerprint: string
      message: string
      suggestedProxyUrl?: string
    }
  | {
      status: 'unsupported'
      fingerprint: string
      reason: InitialSetupProbeSupportReason
    }

const DELEGATED_PROVIDER_KINDS = new Set([
  'agent-sdk',
  'antigravity-cli',
  'gemini-cli-api',
  'cursor-sdk'
])

export function initialSetupProbeSupport(
  profile: Pick<ModelProviderProfileV1, 'id' | 'kind' | 'endpointFormat' | 'baseUrl'>
): InitialSetupProbeSupport {
  if (profile.kind && DELEGATED_PROVIDER_KINDS.has(profile.kind)) {
    return { supported: false, reason: 'delegated-transport' }
  }
  if (
    isCustomModelEndpointFormat(profile.endpointFormat) &&
    !isCodexModelCatalogProfile(profile)
  ) {
    return { supported: false, reason: 'custom-endpoint' }
  }
  const baseUrl = profile.baseUrl.trim()
  if (!baseUrl) return { supported: false, reason: 'missing-base-url' }
  try {
    const parsed = new URL(baseUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { supported: false, reason: 'invalid-base-url' }
    }
  } catch {
    return { supported: false, reason: 'invalid-base-url' }
  }
  return { supported: true }
}

function isCodexModelCatalogProfile(
  profile: Pick<ModelProviderProfileV1, 'id' | 'baseUrl'>
): boolean {
  if (profile.id !== CHATGPT_SUBSCRIPTION_PROVIDER_ID) return false
  try {
    const parsed = new URL(profile.baseUrl.trim())
    return parsed.protocol === 'https:' &&
      parsed.hostname === 'chatgpt.com' &&
      parsed.pathname.startsWith('/backend-api/codex')
  } catch {
    return false
  }
}

/** Build the request from the normalized profile that would actually be saved. */
export function initialSetupProbeProfile(
  settings: AppSettingsV1,
  drafts: InitialSetupDrafts,
  selection: Pick<InitialSetupSelection, 'presetId' | 'mode'>
): ModelProviderProfileV1 | null {
  const intended = buildInitialSetupSettings(settings, drafts, selection)
  const providerId = initialSetupProfileId(selection)
  const draft = drafts[providerId]
  const preset = presetForInitialSetup(selection.presetId)
  const presetProfile = preset
    ? selection.mode === 'token-plan'
      ? modelProviderTokenPlanProfile(preset, draft?.apiKey ?? '', draft?.baseUrl ?? '')
      : modelProviderPresetProfile(preset, draft?.apiKey ?? '')
    : null
  const profile = providerId === 'xiaoling-custom-provider' && draft
      ? normalizeModelProviderProfile({
          id: providerId,
          name: '自定义中转',
          apiKey: draft.apiKey.trim(),
          baseUrl: draft.baseUrl.trim(),
          endpointFormat: draft.endpointFormat ?? 'chat_completions',
          models: draft.model?.trim() ? [draft.model.trim()] : []
        })
      : intended.provider.providers.find((provider) => provider.id === providerId)
        ?? presetProfile
  if (!profile) return null
  const model = draft?.model?.trim()
  return {
    ...profile,
    apiKey: draft ? draft.apiKey.trim() : profile.apiKey,
    baseUrl: draft?.baseUrl.trim() || profile.baseUrl,
    ...(draft?.endpointFormat ? { endpointFormat: draft.endpointFormat as ModelEndpointFormat } : {}),
    models: model
      ? [model, ...profile.models.filter((candidate) => candidate !== model)]
      : profile.models
  }
}

export function initialSetupProbeRequest(
  profile: Pick<ModelProviderProfileV1, 'id' | 'baseUrl' | 'apiKey' | 'endpointFormat' | 'useProxy'>
): ModelProviderProbeRequest {
  return {
    providerId: profile.id,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    endpointFormat: profile.endpointFormat,
    useProxy: profile.useProxy
  }
}

/** Avoid retaining a raw API key in React state while still invalidating changed credentials. */
function fingerprintSecret(secret: string): string {
  let hash = 2_166_136_261
  for (const character of secret) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16_777_619)
  }
  return `${secret.length}:${hash >>> 0}`
}

export function initialSetupProbeFingerprint(
  profile: Pick<ModelProviderProfileV1, 'id' | 'baseUrl' | 'apiKey' | 'endpointFormat' | 'useProxy' | 'kind'>
): string {
  return JSON.stringify([
    profile.id,
    profile.baseUrl.trim(),
    fingerprintSecret(profile.apiKey),
    profile.endpointFormat,
    profile.useProxy,
    profile.kind ?? ''
  ])
}

export function normalizeInitialSetupModelIds(modelIds: readonly string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const raw of modelIds) {
    const modelId = raw.trim()
    const key = modelId.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    normalized.push(modelId)
  }
  return normalized
}

export function initialSetupSelectedModel(
  currentModel: string | undefined,
  modelIds: readonly string[]
): string | undefined {
  const normalized = normalizeInitialSetupModelIds(modelIds)
  const current = currentModel?.trim() ?? ''
  if (current) {
    const matchingModel = normalized.find((modelId) => modelId.toLowerCase() === current.toLowerCase())
    if (matchingModel) return matchingModel
  }
  return normalized[0]
}

export function initialSetupProbeFailureState(
  fingerprint: string,
  result: Extract<ModelProviderProbeResult, { ok: false }>
): Extract<InitialSetupProbeState, { status: 'error' }> {
  return {
    status: 'error',
    fingerprint,
    message: result.message,
    ...(result.suggestedProxyUrl ? { suggestedProxyUrl: result.suggestedProxyUrl } : {})
  }
}
