import {
  DEFAULT_MODEL_ENDPOINT_FORMAT,
  DEFAULT_MODEL_PROVIDER_ID,
  KUN_TOOL_PERMISSION_MODES,
  MODEL_PROVIDER_PRESETS,
  kunToolPermissionModeFromSettings,
  kunToolPermissionModeSettings,
  modelProviderRequiresApiKey,
  modelProviderPresetProfile,
  modelProviderTokenPlanProfile,
  normalizeAppSettings,
  tokenPlanProviderId,
  type AppSettingsPatch,
  type AppSettingsV1,
  type KunToolPermissionMode,
  type KunRuntimeSettingsPatchV1,
  type ModelEndpointFormat,
  type ModelProviderPreset,
  type ModelProviderProfileV1
} from '@shared/app-settings'
import { normalizeModelProviderProfile } from '@shared/app-settings-provider-profiles'
import { getKunRuntimeSettings } from '@shared/app-settings-kun-defaults'
import { applyKunRuntimePatch } from '@shared/app-settings-kun-migration'
import { getModelProviderSettings } from '@shared/app-settings-provider-core'
import { diffSettingsPatch } from './settings-utils'

export type InitialSetupAccessMode = 'api' | 'token-plan'

export type InitialSetupDraft = {
  apiKey: string
  baseUrl: string
  model?: string
  endpointFormat?: ModelEndpointFormat
}

/** Keyed by provider profile id (deepseek, xiaomi, xiaomi-token-plan, ...). */
export type InitialSetupDrafts = Record<string, InitialSetupDraft>

export type InitialSetupSelection = {
  presetId: string
  mode: InitialSetupAccessMode
  permissionMode: KunToolPermissionMode
  /** True only after the user deliberately chooses a permission card. */
  permissionTouched: boolean
}

export const INITIAL_SETUP_CUSTOM_PROVIDER_ID = 'xiaoling-custom-provider'

export const INITIAL_SETUP_PROVIDER_PRESETS = MODEL_PROVIDER_PRESETS

export function initialSetupProviderRequiresApiKey(
  preset: ModelProviderPreset | null,
  mode: InitialSetupAccessMode
): boolean {
  if (!preset) return true
  const profile = mode === 'token-plan'
    ? modelProviderTokenPlanProfile(preset)
    : modelProviderPresetProfile(preset)
  return !profile || modelProviderRequiresApiKey(profile)
}

export function initialSetupProfileId(selection: Pick<InitialSetupSelection, 'presetId' | 'mode'>): string {
  if (
    selection.presetId === DEFAULT_MODEL_PROVIDER_ID ||
    selection.presetId === INITIAL_SETUP_CUSTOM_PROVIDER_ID
  ) return selection.presetId
  return selection.mode === 'token-plan' ? tokenPlanProviderId(selection.presetId) : selection.presetId
}

/** Seed per-profile drafts from saved settings so existing keys show up. */
export function initialSetupDrafts(settings: AppSettingsV1): InitialSetupDrafts {
  const provider = getModelProviderSettings(settings)
  const byId = new Map(provider.providers.map((profile) => [profile.id, profile]))
  const drafts: InitialSetupDrafts = {
    [DEFAULT_MODEL_PROVIDER_ID]: {
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl
    },
    [INITIAL_SETUP_CUSTOM_PROVIDER_ID]: {
      apiKey: '',
      baseUrl: '',
      model: '',
      endpointFormat: DEFAULT_MODEL_ENDPOINT_FORMAT
    }
  }
  for (const preset of INITIAL_SETUP_PROVIDER_PRESETS) {
    const existing = byId.get(preset.id)
    const model = existing?.models[0] ?? preset.models[0]
    drafts[preset.id] = {
      apiKey: existing?.apiKey ?? '',
      baseUrl: existing?.baseUrl ?? preset.baseUrl,
      ...(model ? { model } : {})
    }
    if (!preset.tokenPlan) continue
    const tokenPlanId = tokenPlanProviderId(preset.id)
    const existingTokenPlan = byId.get(tokenPlanId)
    const tokenModel = existingTokenPlan?.models[0] ?? preset.tokenPlan.models[0]
    drafts[tokenPlanId] = {
      apiKey: existingTokenPlan?.apiKey ?? '',
      baseUrl: existingTokenPlan?.baseUrl ?? preset.tokenPlan.baseUrl,
      ...(tokenModel ? { model: tokenModel } : {})
    }
  }
  const custom = byId.get(INITIAL_SETUP_CUSTOM_PROVIDER_ID)
  if (custom) {
    drafts[INITIAL_SETUP_CUSTOM_PROVIDER_ID] = {
      apiKey: custom.apiKey,
      baseUrl: custom.baseUrl,
      model: custom.models[0] ?? '',
      endpointFormat: custom.endpointFormat
    }
  }
  return drafts
}

/** Card and mode to preselect: the active provider when it is one of ours, DeepSeek otherwise. */
export function initialSetupSelection(settings: AppSettingsV1): InitialSetupSelection {
  const runtime = getKunRuntimeSettings(settings)
  const activeId = runtime.providerId.trim()
  const permissionMode = kunToolPermissionModeFromSettings(runtime)
  if (activeId === INITIAL_SETUP_CUSTOM_PROVIDER_ID) {
    return {
      presetId: INITIAL_SETUP_CUSTOM_PROVIDER_ID,
      mode: 'api',
      permissionMode,
      permissionTouched: false
    }
  }
  for (const preset of INITIAL_SETUP_PROVIDER_PRESETS) {
    if (activeId === preset.id) {
      return { presetId: preset.id, mode: 'api', permissionMode, permissionTouched: false }
    }
    if (preset.tokenPlan && activeId === tokenPlanProviderId(preset.id)) {
      return {
        presetId: preset.id,
        mode: 'token-plan',
        permissionMode,
        permissionTouched: false
      }
    }
  }
  return {
    presetId: DEFAULT_MODEL_PROVIDER_ID,
    mode: 'api',
    permissionMode,
    permissionTouched: false
  }
}

export type InitialSetupAutoWirePlan = {
  speechProviderId: string
  imageProviderId: string
}

/**
 * Capabilities to point at a just-configured profile. Only fires while the
 * capability is still unconfigured — never overrides a user choice. Speech and
 * image generation can come from a pay-as-you-go profile or a token plan when
 * the provider exposes that capability to subscription keys.
 */
export function initialSetupAutoWirePlan(
  settings: AppSettingsV1,
  drafts: InitialSetupDrafts
): InitialSetupAutoWirePlan {
  const runtime = getKunRuntimeSettings(settings)
  const speechUnconfigured = !runtime.speechToText.enabled && !runtime.speechToText.providerId.trim()
  const imageUnconfigured = !runtime.imageGeneration.enabled && !runtime.imageGeneration.providerId.trim()
  const plan: InitialSetupAutoWirePlan = { speechProviderId: '', imageProviderId: '' }
  for (const preset of INITIAL_SETUP_PROVIDER_PRESETS) {
    const apiKeyFilled = Boolean(drafts[preset.id]?.apiKey.trim())
    const tokenPlanKeyFilled = Boolean(
      preset.tokenPlan && drafts[tokenPlanProviderId(preset.id)]?.apiKey.trim()
    )
    if (speechUnconfigured && !plan.speechProviderId) {
      if (preset.speech && apiKeyFilled) {
        plan.speechProviderId = preset.id
      } else if (preset.tokenPlan?.speech && tokenPlanKeyFilled) {
        plan.speechProviderId = tokenPlanProviderId(preset.id)
      }
    }
    if (imageUnconfigured && !plan.imageProviderId) {
      if (preset.image && apiKeyFilled) {
        plan.imageProviderId = preset.id
      } else if (preset.tokenPlan?.image && tokenPlanKeyFilled) {
        plan.imageProviderId = tokenPlanProviderId(preset.id)
      }
    }
  }
  return plan
}

/**
 * Fold the onboarding drafts into settings: upsert one profile per filled
 * draft, activate the selected profile, and auto-wire speech/image to filled
 * pay-as-you-go profiles. The caller must ensure the selected draft has a key.
 */
export function buildInitialSetupSettings(
  settings: AppSettingsV1,
  drafts: InitialSetupDrafts,
  selection: Pick<InitialSetupSelection, 'presetId' | 'mode'> &
    Partial<Pick<InitialSetupSelection, 'permissionMode' | 'permissionTouched'>>,
  modelOverride?: string
): AppSettingsV1 {
  const provider = getModelProviderSettings(settings)
  const profiles = new Map(provider.providers.map((profile) => [profile.id, profile]))

  const deepseekDraft = drafts[DEFAULT_MODEL_PROVIDER_ID]
  const nextApiKey = deepseekDraft ? deepseekDraft.apiKey.trim() : provider.apiKey
  const nextBaseUrl = deepseekDraft?.baseUrl.trim() ? deepseekDraft.baseUrl.trim() : provider.baseUrl
  const defaultProfile = profiles.get(DEFAULT_MODEL_PROVIDER_ID)
  if (defaultProfile) {
    profiles.set(DEFAULT_MODEL_PROVIDER_ID, {
      ...defaultProfile,
      apiKey: nextApiKey,
      baseUrl: nextBaseUrl
    })
  }

  for (const preset of INITIAL_SETUP_PROVIDER_PRESETS) {
    const selectedApiProfileNeedsKey = selection.presetId === preset.id &&
      selection.mode === 'api' &&
      initialSetupProviderRequiresApiKey(preset, 'api')
    const selectedTokenPlanNeedsKey = selection.presetId === preset.id &&
      selection.mode === 'token-plan' &&
      initialSetupProviderRequiresApiKey(preset, 'token-plan')
    upsertPresetProfile(profiles, preset.id, drafts[preset.id], (apiKey, baseUrl) => ({
      ...modelProviderPresetProfile(preset, apiKey),
      ...(baseUrl ? { baseUrl } : {})
    }), preset.category === 'free' || (
      selection.presetId === preset.id &&
      selection.mode === 'api' &&
      !selectedApiProfileNeedsKey
    ))
    if (!preset.tokenPlan) continue
    upsertPresetProfile(profiles, tokenPlanProviderId(preset.id), drafts[tokenPlanProviderId(preset.id)], (apiKey, baseUrl) =>
      modelProviderTokenPlanProfile(preset, apiKey, baseUrl)
    , selection.presetId === preset.id && selection.mode === 'token-plan' && !selectedTokenPlanNeedsKey)
  }

  const customDraft = drafts[INITIAL_SETUP_CUSTOM_PROVIDER_ID]
  if (customDraft?.apiKey.trim() && customDraft.baseUrl.trim() && customDraft.model?.trim()) {
    const customProfile = normalizeModelProviderProfile({
      id: INITIAL_SETUP_CUSTOM_PROVIDER_ID,
      name: '自定义中转',
      apiKey: customDraft.apiKey.trim(),
      baseUrl: customDraft.baseUrl.trim(),
      endpointFormat: customDraft.endpointFormat ?? DEFAULT_MODEL_ENDPOINT_FORMAT,
      models: [customDraft.model.trim()]
    })
    if (customProfile) profiles.set(INITIAL_SETUP_CUSTOM_PROVIDER_ID, customProfile)
  }

  const next = normalizeAppSettings({
    ...settings,
    initialSetupCompleted: true,
    provider: {
      apiKey: nextApiKey,
      baseUrl: nextBaseUrl,
      providers: [...profiles.values()]
    }
  } as AppSettingsV1)

  const runtime = getKunRuntimeSettings(next)
  const selectedId = initialSetupProfileId(selection)
  const selectedProfile = getModelProviderSettings(next).providers.find(
    (profile) => profile.id === selectedId
  )
  const selectedModelOverride = modelOverride?.trim()
  if (selectedModelOverride && selectedProfile) {
    const selectedIndex = profiles.get(selectedId)
    if (selectedIndex) {
      profiles.set(selectedId, {
        ...selectedIndex,
        models: mergeModelIds([selectedModelOverride], selectedIndex.models)
      })
    }
  }
  const normalizedWithModelOverride = selectedModelOverride
    ? normalizeAppSettings({
        ...next,
        provider: {
          ...next.provider,
          providers: [...profiles.values()]
        }
      } as AppSettingsV1)
    : next
  const selectedProfileWithModelOverride = getModelProviderSettings(normalizedWithModelOverride).providers.find(
    (profile) => profile.id === selectedId
  )
  const switchingProvider = (runtime.providerId.trim() || DEFAULT_MODEL_PROVIDER_ID) !== selectedId
  const wire = initialSetupAutoWirePlan(settings, drafts)
  // Only rewrite the complete authority snapshot when the user actually moved
  // the permission selector. The three-mode projection is intentionally lossy,
  // so emitting it while the selector is untouched would silently broaden or
  // otherwise rewrite a valid legacy approval/sandbox combination.
  const currentPermissionMode = kunToolPermissionModeFromSettings(runtime)
  const selectedPermissionMode = selection.permissionMode && KUN_TOOL_PERMISSION_MODES.includes(selection.permissionMode)
    ? selection.permissionMode
    : currentPermissionMode
  const permissionChanged =
    selection.permissionTouched === true ||
    selectedPermissionMode !== currentPermissionMode
  const kunPatch: KunRuntimeSettingsPatchV1 = {
    providerId: selectedId,
    apiKey: '',
    baseUrl: '',
    ...(permissionChanged ? kunToolPermissionModeSettings(selectedPermissionMode) : {}),
    ...((switchingProvider || Boolean(selectedModelOverride)) && selectedProfileWithModelOverride?.models[0]
      ? { model: selectedProfileWithModelOverride.models[0] }
      : {}),
    ...(wire.speechProviderId
      ? { speechToText: { enabled: true, providerId: wire.speechProviderId } }
      : {}),
    ...(wire.imageProviderId
      ? { imageGeneration: { enabled: true, providerId: wire.imageProviderId } }
      : {})
  }
  return applyKunRuntimePatch(normalizedWithModelOverride, kunPatch)
}

export function buildInitialSetupSettingsPatch(
  settings: AppSettingsV1,
  drafts: InitialSetupDrafts,
  selection: Pick<InitialSetupSelection, 'presetId' | 'mode'> &
    Partial<Pick<InitialSetupSelection, 'permissionMode' | 'permissionTouched'>>,
  modelOverride?: string
): AppSettingsPatch {
  const next = buildInitialSetupSettings(settings, drafts, selection, modelOverride)
  const providers = next.provider.providers.map((provider) => ({ ...provider, apiKey: '' }))
  return diffSettingsPatch(settings, {
    ...next,
    provider: {
      ...next.provider,
      apiKey: '',
      providers
    },
    agents: {
      ...next.agents,
      kun: { ...next.agents.kun, apiKey: '' }
    }
  })
}

function upsertPresetProfile(
  profiles: Map<string, ModelProviderProfileV1>,
  id: string,
  draft: InitialSetupDraft | undefined,
  build: (apiKey: string, baseUrl: string) => ModelProviderProfileV1 | null,
  allowEmptyCredential = false
): void {
  const apiKey = draft?.apiKey.trim() ?? ''
  if (!apiKey && !allowEmptyCredential) return
  const built = build(apiKey, draft?.baseUrl.trim() ?? '')
  if (!built) return
  const customModel = draft?.model?.trim()
  const models = customModel && !built.models.includes(customModel)
    ? [customModel, ...built.models]
    : built.models
  const existing = profiles.get(id)
  profiles.set(id, existing
    ? {
        ...built,
        name: existing.name.trim() || built.name,
        models: mergeModelIds(models, existing.models)
      }
    : { ...built, models })
}

function mergeModelIds(primary: readonly string[], secondary: readonly string[]): string[] {
  const ids = new Set<string>()
  for (const model of [...primary, ...secondary]) {
    const trimmed = model.trim()
    if (trimmed) ids.add(trimmed)
  }
  return [...ids]
}

export function presetForInitialSetup(presetId: string): ModelProviderPreset | null {
  return INITIAL_SETUP_PROVIDER_PRESETS.find((preset) => preset.id === presetId) ?? null
}
