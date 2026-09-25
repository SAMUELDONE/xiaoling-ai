import {
  APP_LOCALE_OPTIONS,
  MODEL_ENDPOINT_FORMATS,
  DEFAULT_MODEL_PROVIDER_ID,
  kunToolPermissionModeSettings,
  normalizeAppSettings,
  type AppSettingsV1,
  type KunToolPermissionMode
} from '@shared/app-settings'
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  X
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { rendererRuntimeClient } from '../agent/runtime-client'
import { runTrustedUserActivation } from '../extensions/protected-user-activation'
import { applyTheme } from '../lib/apply-theme'
import { emitRendererSettingsChanged } from '../lib/keyboard-shortcut-settings'
import { useChatStore } from '../store/chat-store'
import {
  canCloseInitialSetup,
  commitInitialSetupRegistryCredentials,
  completeInitialSetupAfterSave,
  dismissInitialSetup,
  isUnreadableCredentialKeyError,
  keyHintKey,
  keyPageUrl,
  keyPlaceholder,
  PERMISSION_OPTIONS,
  PROVIDER_CARDS,
  themeOptions,
  type SetupFormPatch,
  type SetupProviderCard,
  type ThemePref
} from './initial-setup-dialog-support'
import { InitialSetupProviderShowcase } from './initial-setup-provider-showcase'
import {
  initialSetupProbeFailureState,
  initialSetupProbeFingerprint,
  initialSetupProbeProfile,
  initialSetupProbeRequest,
  initialSetupProbeSupport,
  normalizeInitialSetupModelIds,
  initialSetupSelectedModel,
  type InitialSetupProbeState
} from './initial-setup-provider-probe'
import {
  buildInitialSetupSettings,
  buildInitialSetupSettingsPatch,
  initialSetupAutoWirePlan,
  initialSetupDrafts,
  initialSetupProfileId,
  initialSetupProviderRequiresApiKey,
  initialSetupSelection,
  INITIAL_SETUP_CUSTOM_PROVIDER_ID,
  type InitialSetupDraft,
  type InitialSetupDrafts,
  type InitialSetupSelection
} from './initial-setup-save'

export {
  canCloseInitialSetup,
  commitInitialSetupRegistryCredentials,
  completeInitialSetupAfterSave,
  dismissInitialSetup,
  isUnreadableCredentialKeyError
} from './initial-setup-dialog-support'


export function InitialSetupDialog(): ReactElement {
  const { t } = useTranslation('settings')
  const initialSetupMode = useChatStore((s) => s.initialSetupMode)
  const closeInitialSetup = useChatStore((s) => s.closeInitialSetup)
  const applyI18n = useChatStore((s) => s.applyI18nFromSettings)
  const reloadUiSettings = useChatStore((s) => s.reloadUiSettings)
  const probeRuntime = useChatStore((s) => s.probeRuntime)
  const openCode = useChatStore((s) => s.openCode)

  const [form, setForm] = useState<AppSettingsV1 | null>(null)
  const [drafts, setDrafts] = useState<InitialSetupDrafts | null>(null)
  const [selection, setSelection] = useState<InitialSetupSelection>({
    presetId: DEFAULT_MODEL_PROVIDER_ID,
    mode: 'api',
    permissionMode: 'full-access',
    permissionTouched: false
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recoveringCredentials, setRecoveringCredentials] = useState(false)
  const [credentialRecoveryRequired, setCredentialRecoveryRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [probeState, setProbeState] = useState<InitialSetupProbeState>({ status: 'idle' })
  const formRef = useRef<AppSettingsV1 | null>(null)
  const probeGenerationRef = useRef(0)
  const isPreview = initialSetupMode === 'preview'
  const closeAllowed = canCloseInitialSetup(initialSetupMode)

  const invalidateProbe = (): void => {
    probeGenerationRef.current += 1
    setProbeState({ status: 'idle' })
  }

  const setCurrentForm = (next: AppSettingsV1 | null): void => {
    formRef.current = next
    setForm(next)
  }

  const reportSetupError = (setupError: unknown): void => {
    if (isUnreadableCredentialKeyError(setupError)) {
      setCredentialRecoveryRequired(true)
      setError(t('firstRunCredentialRecoveryError'))
      return
    }
    setError(setupError instanceof Error ? setupError.message : String(setupError))
  }

  useEffect(() => {
    let cancelled = false
    void rendererRuntimeClient
      .getSettings({ forceRefresh: true })
      .then((s) => {
        if (cancelled) return
        setCurrentForm(s)
        setDrafts(initialSetupDrafts(s))
        setSelection(initialSetupSelection(s))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => { cancelled = true }
  }, [])

  const updateForm = (patch: SetupFormPatch) => {
    const current = formRef.current
    if (!current) return
    const next = normalizeAppSettings({
      ...current,
      ...patch
    } as AppSettingsV1)
    setCurrentForm(next)
  }

  const handleThemeChange = (theme: ThemePref) => {
    if (!formRef.current) return
    updateForm({ theme })
    applyTheme(theme)
  }

  const handleClose = () => {
    if (!closeAllowed) return
    setSaving(true)
    setError(null)
    void dismissInitialSetup({
      mode: initialSetupMode,
      persistCompletion: async () => {
        const next = await rendererRuntimeClient.setSettings({ initialSetupCompleted: true })
        emitRendererSettingsChanged(next)
      },
      reloadUiSettings,
      probeRuntime,
      closeInitialSetup
    }).catch((e: unknown) => {
      reportSetupError(e)
    }).finally(() => {
      setSaving(false)
    })
  }

  const handleOpenKeyPage = (url: string) => {
    if (typeof window.kunGui?.openExternal !== 'function') return
    void window.kunGui.openExternal(url).catch(() => undefined)
  }

  const selectedCard = PROVIDER_CARDS.find((card) => card.presetId === selection.presetId) ?? PROVIDER_CARDS[0]
  const selectedProfileId = initialSetupProfileId(selection)
  const selectedDraft: InitialSetupDraft = drafts?.[selectedProfileId] ?? { apiKey: '', baseUrl: '' }
  const selectedRequiresApiKey = initialSetupProviderRequiresApiKey(selectedCard.preset, selection.mode)
  const selectedProbeProfile = form && drafts
    ? initialSetupProbeProfile(form, drafts, selection)
    : null
  const selectedProbeSupport = selectedProbeProfile
    ? initialSetupProbeSupport(selectedProbeProfile)
    : {
        supported: false as const,
        reason: selectedDraft.baseUrl.trim() ? 'invalid-base-url' as const : 'missing-base-url' as const
      }
  const selectedProbeFingerprint = selectedProbeProfile
    ? initialSetupProbeFingerprint(selectedProbeProfile)
    : ''
  const currentProbeState = probeState.status !== 'idle' && probeState.fingerprint === selectedProbeFingerprint
    ? probeState
    : !selectedProbeSupport.supported
      ? {
          status: 'unsupported' as const,
          fingerprint: selectedProbeFingerprint,
          reason: selectedProbeSupport.reason
        }
      : { status: 'idle' as const }

  const updateSelectedDraft = (patch: Partial<typeof selectedDraft>, invalidate = true): void => {
    if (invalidate) invalidateProbe()
    setDrafts((current) => current
      ? { ...current, [selectedProfileId]: { ...current[selectedProfileId], ...patch } }
      : current)
  }

  const selectCard = (presetId: string): void => {
    setError(null)
    invalidateProbe()
    setSelection((current) => (current.presetId === presetId ? current : { ...current, presetId, mode: 'api' }))
  }

  const selectMode = (mode: InitialSetupSelection['mode']): void => {
    setError(null)
    invalidateProbe()
    setSelection((current) => ({ ...current, mode }))
  }

  const handleProbe = async (): Promise<void> => {
    const current = formRef.current
    if (!current || !drafts) return
    if (selectedRequiresApiKey && !selectedDraft.apiKey.trim()) {
      setError(t('firstRunApiKeyValidation', { provider: selectedCard.name }))
      return
    }
    if (!selectedProbeProfile) {
      setProbeState({ status: 'unsupported', fingerprint: '', reason: 'missing-base-url' })
      return
    }
    const support = initialSetupProbeSupport(selectedProbeProfile)
    const fingerprint = initialSetupProbeFingerprint(selectedProbeProfile)
    if (!support.supported) {
      setProbeState({ status: 'unsupported', fingerprint, reason: support.reason })
      return
    }
    const probe = window.kunGui?.probeModelProvider
    if (typeof probe !== 'function') {
      setProbeState({
        status: 'error',
        fingerprint,
        message: 'Provider connection testing is unavailable in this desktop build.'
      })
      return
    }
    const generation = ++probeGenerationRef.current
    setError(null)
    setProbeState({ status: 'busy', fingerprint })
    let result: Awaited<ReturnType<typeof probe>>
    try {
      result = await probe(initialSetupProbeRequest(selectedProbeProfile))
    } catch (probeError) {
      result = {
        ok: false,
        message: probeError instanceof Error ? probeError.message : String(probeError)
      }
    }
    if (generation !== probeGenerationRef.current) return
    if (!result.ok) {
      setProbeState(initialSetupProbeFailureState(fingerprint, result))
      return
    }
    const modelIds = normalizeInitialSetupModelIds(result.modelIds)
    const selectedModel = initialSetupSelectedModel(selectedDraft.model, modelIds)
    if (selectedModel) {
      setDrafts((current) => current
        ? { ...current, [selectedProfileId]: { ...current[selectedProfileId], model: selectedModel } }
        : current)
    }
    setProbeState({
      status: 'ok',
      fingerprint,
      latencyMs: Math.max(0, Math.round(result.latencyMs)),
      modelIds
    })
  }

  const selectPermissionMode = (permissionMode: KunToolPermissionMode): void => {
    setError(null)
    setSelection((current) => ({ ...current, permissionMode, permissionTouched: true }))
    const current = formRef.current
    if (!current) return
    updateForm({
      agents: {
        ...current.agents,
        kun: {
          ...current.agents.kun,
          ...kunToolPermissionModeSettings(permissionMode)
        }
      }
    } as SetupFormPatch)
  }

  const cardFilled = (card: SetupProviderCard): boolean => {
    if (!drafts) return false
    if (card.isCustom) {
      const draft = drafts[INITIAL_SETUP_CUSTOM_PROVIDER_ID]
      return Boolean(draft?.apiKey.trim() && draft.baseUrl.trim() && draft.model?.trim())
    }
    const draft = drafts[card.presetId]
    const hasModel = Boolean(card.preset?.models.length || (draft?.baseUrl.trim() && draft.model?.trim()))
    if (hasModel && (!initialSetupProviderRequiresApiKey(card.preset, 'api') || draft?.apiKey.trim())) return true
    if (!card.preset?.tokenPlan) return false
    return Boolean(drafts[initialSetupProfileId({ presetId: card.presetId, mode: 'token-plan' })]?.apiKey.trim())
  }

  const handleSave = async () => {
    const current = formRef.current
    if (!current || !drafts) return
    if (selectedRequiresApiKey && !selectedDraft.apiKey.trim()) {
      setError(t('firstRunApiKeyValidation', { provider: selectedCard.name }))
      return
    }
    if (!selectedDraft.baseUrl.trim() && (selectedCard.isCustom || selectedCard.preset?.models.length === 0)) {
      setError(t('firstRunCustomProviderBaseUrlValidation'))
      return
    }
    if ((selectedCard.isCustom || selectedCard.preset?.models.length === 0) && !selectedDraft.model?.trim()) {
      setError(t('firstRunCustomProviderModelValidation'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const selectedModelOverride = currentProbeState.status === 'ok'
        ? initialSetupSelectedModel(selectedDraft.model, currentProbeState.modelIds)
        : undefined
      const intended = buildInitialSetupSettings(current, drafts, selection, selectedModelOverride)
      const selectedProviderId = initialSetupProfileId(selection)
      const selectedProvider = intended.provider.providers.find((provider) =>
        provider.id === selectedProviderId
      )
      if (!selectedProvider) throw new Error(`Provider ${selectedProviderId} is unavailable`)
      await commitInitialSetupRegistryCredentials(drafts, {
        profiles: intended.provider.providers,
        selectedProviderId,
        selectedModel: selectedModelOverride ?? selectedProvider.models[0] ?? intended.agents.kun.model
      })
      const next = await rendererRuntimeClient.setSettings(
        buildInitialSetupSettingsPatch(current, drafts, selection, selectedModelOverride)
      )
      setCredentialRecoveryRequired(false)
      setCurrentForm(next)
      setDrafts(initialSetupDrafts(next))
      emitRendererSettingsChanged(next)
      await applyI18n(next.locale)
      await completeInitialSetupAfterSave({
        mode: initialSetupMode,
        reloadUiSettings,
        probeRuntime,
        openCode,
        closeInitialSetup,
        getState: useChatStore.getState,
        setDialogError: setError,
        fallbackRuntimeError: t('common:runtimeFetchFailed')
      })
    } catch (e) {
      reportSetupError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleCredentialReset = async () => {
    setRecoveringCredentials(true)
    setError(null)
    try {
      const result = await rendererRuntimeClient.resetUnreadableCredentials()
      if (!result.reset) {
        setError(t('firstRunCredentialRecoveryError'))
        return
      }
      setCredentialRecoveryRequired(false)
      await handleSave()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRecoveringCredentials(false)
    }
  }

  if (!form || !drafts) {
    return (
      <div className="ds-no-drag fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-md dark:bg-black/70">
        <div className="rounded-xl border border-ds-border bg-ds-card/95 px-5 py-4 text-sm text-ds-muted shadow-panel backdrop-blur-xl">
          {t('loading')}
        </div>
      </div>
    )
  }

  const selectedTheme = form.theme
  const tokenPlan = selectedCard.preset?.tokenPlan ?? null
  const showTokenPlanMode = Boolean(tokenPlan)
  const regions = selection.mode === 'token-plan' ? tokenPlan?.regions ?? [] : []
  const wire = initialSetupAutoWirePlan(form, drafts)
  const wireNote = (() => {
    if (!selectedCard.capability) return null
    const wiredProfileId = selectedCard.capability === 'speech' ? wire.speechProviderId : wire.imageProviderId
    if (wiredProfileId && wiredProfileId === selectedProfileId) {
      return {
        tone: 'success' as const,
        text: t(selectedCard.capability === 'speech' ? 'firstRunAutoWireSpeech' : 'firstRunAutoWireImage')
      }
    }
    if (selection.mode === 'token-plan' && selectedDraft.apiKey.trim()) {
      const planServesCapability = selectedCard.capability === 'speech'
        ? Boolean(tokenPlan?.speech)
        : selectedCard.capability === 'image' && Boolean(tokenPlan?.image)
      if (!planServesCapability) {
        return {
          tone: 'warning' as const,
          text: t(selectedCard.capability === 'speech' ? 'firstRunTokenPlanNoSpeech' : 'firstRunTokenPlanNoImage')
        }
      }
    }
    return null
  })()

  const choiceButtonClass = (active: boolean): string =>
    [
      'flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 sm:min-h-11 sm:px-4',
      active
        ? 'border-[#1388ff] bg-[#1388ff]/[0.07] text-[#1377df] shadow-[0_0_0_1px_rgba(19,136,255,0.12),0_8px_18px_rgba(19,136,255,0.07)] dark:border-[#3aa0ff] dark:bg-[#3aa0ff]/[0.12] dark:text-[#88c8ff]'
        : 'border-slate-300/80 bg-white/72 text-slate-600 hover:border-slate-400/80 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-300 dark:hover:border-white/16 dark:hover:bg-white/[0.055]'
    ].join(' ')
  const fieldClass =
    'w-full rounded-xl border border-slate-300/75 bg-white/88 px-4 py-3 text-[15px] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] outline-none transition focus:border-[#1388ff]/70 focus:ring-2 focus:ring-[#1388ff]/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:shadow-none dark:focus:border-[#3aa0ff]/70 dark:focus:ring-[#3aa0ff]/15 dark:placeholder:text-slate-500'
  const labelClass = 'text-sm font-semibold text-slate-700 dark:text-slate-200'
  return (
    <div className="ds-no-drag fixed inset-0 z-50 overflow-y-auto bg-[#eef2fb]/45 p-3 backdrop-blur-[18px] dark:bg-black/62 dark:backdrop-blur-[22px] sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="initial-setup-title"
          className="flex h-[calc(100dvh-24px)] max-h-[calc(100dvh-24px)] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-white/75 bg-[rgba(255,255,255,0.94)] text-slate-900 shadow-[0_28px_86px_rgba(88,105,136,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(18,21,28,0.96)] dark:text-white dark:shadow-[0_28px_92px_rgba(0,0,0,0.55)] sm:h-auto sm:max-h-[calc(100dvh-48px)]"
        >
        <div className="shrink-0 border-b border-slate-200/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,253,0.9))] px-5 py-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(27,31,40,0.98),rgba(19,22,29,0.96))] sm:px-7 sm:py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-[#1388ff]/22 bg-[#1388ff]/[0.06] px-3 py-1.5 text-[12.5px] font-semibold text-[#1377df] dark:border-[#3aa0ff]/22 dark:bg-[#3aa0ff]/[0.12] dark:text-[#88c8ff]">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
              <span className="min-w-0 truncate">{t(isPreview ? 'firstRunPreviewBadge' : 'firstRunBadge')}</span>
            </div>
            {closeAllowed ? (
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                aria-label={t('firstRunClose')}
                title={t('firstRunClose')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300/80 bg-white/72 text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-white/18 dark:hover:text-slate-200"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
            ) : null}
          </div>
          <h1 id="initial-setup-title" className="mt-3 text-xl font-semibold leading-tight text-slate-900 dark:text-white sm:mt-4 sm:text-[22px]">
            {t('firstRunTitle')}
          </h1>
          <p className="mt-2.5 text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-[15px]">
            {t('firstRunSubtitle')}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:space-y-5 sm:px-7 sm:py-6">
          <div className="space-y-2.5 sm:space-y-3.5">
            <label className={labelClass}>
              {t('theme')}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:gap-2.5 sm:grid-cols-3">
              {themeOptions.map(({ value, icon: Icon, labelKey }) => {
                const isActive = selectedTheme === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleThemeChange(value)}
                    className={choiceButtonClass(isActive)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 text-center leading-tight">{t(labelKey)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2.5 sm:space-y-3.5">
            <label className={labelClass}>
              {t('language')}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:gap-2.5 min-[440px]:grid-cols-2 sm:grid-cols-3">
              {APP_LOCALE_OPTIONS.map((option) => {
                const isActive = form.locale === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      updateForm({ locale: option.value })
                      void applyI18n(option.value)
                    }}
                    className={choiceButtonClass(isActive)}
                  >
                    <span className="min-w-0 text-center leading-tight">{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2.5 sm:space-y-3.5">
            <label className={labelClass}>
              {t('firstRunProviderLabel')}
            </label>
            <InitialSetupProviderShowcase
              cards={PROVIDER_CARDS}
              selectedId={selection.presetId}
              onSelect={selectCard}
              isFilled={cardFilled}
              labels={{
                providerLabel: t('firstRunProviderLabel'), gallery: t('firstRunProviderGallery'), searchPlaceholder: t('firstRunProviderSearch'), noResults: t('firstRunProviderEmpty'),
                previous: t('firstRunProviderPrevious'), next: t('firstRunProviderNext'), showAll: t('firstRunProviderShowAll'), hideAll: t('firstRunProviderHideAll'),
                chosen: t('firstRunProviderChosen'), selected: t('firstRunProviderSelected'), custom: t('firstRunProviderCustom'), customName: t('firstRunProviderCustomName'),
                subscription: t('firstRunProviderSubscription'), free: t('firstRunProviderFree'), api: t('firstRunProviderApi'), description: (card) => t(card.descKey, { count: card.preset?.models.length ?? 0 }),
                modelCount: (count) => t('firstRunProviderModelCount', { count }), position: (current, total) => `${current} / ${total}`
              }}
            />
          </div>

          {showTokenPlanMode && (
            <div className="space-y-2.5 sm:space-y-3.5">
              <label className={labelClass}>
                {t('firstRunModeLabel')}
              </label>
              <div className="grid grid-cols-1 gap-2 sm:gap-2.5 min-[440px]:grid-cols-2">
                <button
                  type="button"
                  onClick={() => selectMode('api')}
                  className={choiceButtonClass(selection.mode === 'api')}
                >
                  <span className="min-w-0 text-center leading-tight">{t('firstRunModeApi')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => selectMode('token-plan')}
                  className={choiceButtonClass(selection.mode === 'token-plan')}
                >
                  <span className="min-w-0 text-center leading-tight">{t('firstRunModeTokenPlan')}</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2.5 sm:space-y-3.5">
            <label className={labelClass}>
              {t('firstRunPermissionLabel')}
            </label>
            <div
              role="radiogroup"
              aria-label={t('firstRunPermissionLabel')}
              className="grid grid-cols-1 gap-2 sm:gap-2.5 min-[520px]:grid-cols-2"
            >
              {PERMISSION_OPTIONS.map((option) => {
                const isActive = selection.permissionMode === option.value
                const Icon = option.Icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={(event) => runTrustedUserActivation(
                      event,
                      () => selectPermissionMode(option.value)
                    )}
                    className={choiceButtonClass(isActive)}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${option.iconClass}`}>
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0 truncate">{t(option.labelKey)}</span>
                    </span>
                    <span className="text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                      {t(option.descriptionKey)}
                    </span>
                  </button>
                )
              })}
            </div>
            {selection.permissionMode === 'full-access' ? (
              <div className="rounded-xl border border-orange-300/60 bg-orange-50/80 px-4 py-3 text-[12.5px] leading-5 text-orange-800 dark:border-orange-800/60 dark:bg-orange-950/30 dark:text-orange-200">
                {t('firstRunPermissionFullAccessRisk')}
              </div>
            ) : null}
          </div>

          {regions.length > 0 && (
            <div className="space-y-2.5 sm:space-y-3.5">
              <label className={labelClass}>
                {t('firstRunRegionLabel')}
              </label>
              <div className="grid grid-cols-1 gap-2 sm:gap-2.5 min-[440px]:grid-cols-3">
                {regions.map((region) => (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => updateSelectedDraft({ baseUrl: region.baseUrl })}
                    className={choiceButtonClass(selectedDraft.baseUrl.trim() === region.baseUrl)}
                  >
                    <span className="min-w-0 text-center leading-tight">
                      {t(`firstRunRegion_${region.id}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(selectedCard.isCustom || selectedCard.preset?.models.length === 0) && (
            <div className="space-y-2.5 sm:space-y-3.5">
              <label className={labelClass}>
                {t('firstRunModelLabel')}
              </label>
              <input
                type="text"
                value={selectedDraft.model ?? ''}
                onChange={(event) => updateSelectedDraft({ model: event.target.value })}
                placeholder={t('firstRunModelPlaceholder')}
                className={fieldClass}
              />
              {selectedCard.isCustom ? (
                <select
                  value={selectedDraft.endpointFormat ?? 'chat_completions'}
                  onChange={(event) => updateSelectedDraft({ endpointFormat: event.target.value as typeof MODEL_ENDPOINT_FORMATS[number] })}
                  className={fieldClass}
                >
                  {MODEL_ENDPOINT_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {t(format === 'chat_completions'
                        ? 'modelEndpointChatCompletions'
                        : format === 'responses'
                          ? 'modelEndpointResponses'
                          : format === 'messages'
                            ? 'modelEndpointMessages'
                            : 'modelEndpointCustomEndpoint')}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          )}

          <div className="space-y-2.5 sm:space-y-3.5">
            <label className={labelClass}>
              {t(selectedCard.preset?.category === 'subscription'
                ? 'firstRunCredentialLabel'
                : 'firstRunApiKeyLabel', { provider: selectedCard.name })}
            </label>
            {selectedRequiresApiKey ? <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={selectedDraft.apiKey}
                onChange={(e) => updateSelectedDraft({ apiKey: e.target.value })}
                placeholder={keyPlaceholder(selectedCard, selection.mode)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className={`${fieldClass} pr-12 font-mono placeholder:font-sans`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-300"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div> : null}
            <div className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/75 px-4 py-3 text-[13px] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400 min-[560px]:grid-cols-[1fr_auto] min-[560px]:items-center">
              <p className="min-w-0 leading-6">
                {selectedCard.isCustom
                  ? t('firstRunCustomProviderHint')
                  : t(keyHintKey(selectedCard, selection.mode))}
              </p>
              {!selectedCard.isCustom ? (
                <button
                  type="button"
                  onClick={() => handleOpenKeyPage(keyPageUrl(selectedCard, selection.mode))}
                  className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#1388ff]/24 bg-[#1388ff]/[0.06] px-3 py-1.5 text-[12.5px] font-semibold text-[#1377df] transition hover:bg-[#1388ff]/[0.1] dark:border-[#3aa0ff]/22 dark:bg-[#3aa0ff]/[0.12] dark:text-[#88c8ff] dark:hover:bg-[#3aa0ff]/[0.18]"
                >
                  <span className="min-w-0 text-center leading-tight">
                    {t(selectedCard.preset?.category === 'subscription' || !selectedRequiresApiKey
                      ? 'firstRunOpenProviderGuide'
                      : 'firstRunGetKeyAction')}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.9} />
                </button>
              ) : null}
            </div>
            {wireNote && (
              <div
                className={
                  wireNote.tone === 'success'
                    ? 'rounded-xl border border-emerald-300/60 bg-emerald-50/80 px-4 py-2.5 text-[12.5px] leading-5 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-2.5 text-[12.5px] leading-5 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300'
                }
              >
                {wireNote.text}
              </div>
            )}
          </div>

          <div className="space-y-2.5 sm:space-y-3.5">
            <label className={labelClass}>
              {t('baseUrl')}
            </label>
            <input
              type="text"
              value={selectedDraft.baseUrl}
              onChange={(e) => updateSelectedDraft({ baseUrl: e.target.value })}
              placeholder="https://"
              className={fieldClass}
            />
            <div className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/75 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
              <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
                <div
                  role="status"
                  aria-live="polite"
                  className={`min-w-0 text-[13px] leading-5 ${
                    currentProbeState.status === 'ok'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : currentProbeState.status === 'error'
                        ? 'text-red-700 dark:text-red-300'
                        : currentProbeState.status === 'unsupported'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {currentProbeState.status === 'busy'
                    ? t('firstRunTestingConnection')
                    : currentProbeState.status === 'ok'
                      ? currentProbeState.modelIds.length > 0
                        ? t('firstRunConnectionSuccess', {
                            latency: currentProbeState.latencyMs,
                            count: currentProbeState.modelIds.length
                          })
                        : t('firstRunConnectionSuccessNoModels', { latency: currentProbeState.latencyMs })
                      : currentProbeState.status === 'error'
                        ? t('firstRunConnectionFailure', { message: currentProbeState.message })
                        : currentProbeState.status === 'unsupported'
                          ? t(`firstRunConnectionUnsupported_${currentProbeState.reason}`)
                          : t('firstRunConnectionIdle')}
                </div>
                <button
                  type="button"
                  onClick={() => { void handleProbe() }}
                  disabled={saving || recoveringCredentials || currentProbeState.status === 'busy' || !selectedProbeSupport.supported}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#1388ff]/28 bg-[#1388ff]/[0.07] px-3 py-2 text-[13px] font-semibold text-[#1377df] transition hover:bg-[#1388ff]/[0.12] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3aa0ff]/25 dark:bg-[#3aa0ff]/[0.1] dark:text-[#88c8ff] dark:hover:bg-[#3aa0ff]/[0.16]"
                >
                  {currentProbeState.status === 'busy'
                    ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.9} />
                    : currentProbeState.status === 'ok'
                      ? <CheckCircle2 className="h-4 w-4" strokeWidth={1.9} />
                      : <ExternalLink className="h-4 w-4" strokeWidth={1.9} />}
                  <span>{currentProbeState.status === 'busy' ? t('firstRunTestingConnection') : t('firstRunTestConnection')}</span>
                </button>
              </div>
              {currentProbeState.status === 'ok' && currentProbeState.modelIds.length > 0 ? (
                <label className="grid gap-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>{t('firstRunDiscoveredModelLabel')}</span>
                  <select
                    value={selectedDraft.model ?? ''}
                    onChange={(event) => updateSelectedDraft({ model: event.target.value }, false)}
                    className={fieldClass}
                  >
                    {normalizeInitialSetupModelIds(currentProbeState.modelIds).map((modelId) => (
                      <option key={modelId} value={modelId}>{modelId}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {currentProbeState.status === 'error' && currentProbeState.suggestedProxyUrl ? (
                <p className="flex items-start gap-2 text-[12px] leading-5 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} />
                  <span>{t('firstRunConnectionProxySuggestion', { url: currentProbeState.suggestedProxyUrl })}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 space-y-3 border-t border-slate-200/72 bg-white/70 px-5 pb-4 pt-3.5 dark:border-white/10 dark:bg-white/[0.025] sm:space-y-4 sm:px-7 sm:pb-6 sm:pt-4">
          {(error || credentialRecoveryRequired) && (
            <div className="space-y-3 rounded-xl border border-red-500/18 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-700 dark:border-red-500/20 dark:bg-red-500/[0.12] dark:text-red-200">
              {error ? <p className="leading-5">{error}</p> : null}
              {credentialRecoveryRequired ? (
                <div className="space-y-3">
                  <p className="text-[12px] leading-5 text-red-600/90 dark:text-red-200/80">
                    {t('firstRunCredentialRecoveryDetail')}
                  </p>
                  <div className="grid gap-2 min-[440px]:grid-cols-2">
                    <button
                      type="button"
                      disabled={saving || recoveringCredentials}
                      onClick={handleSave}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-400/35 bg-white/75 px-3 py-2 font-semibold text-red-700 transition hover:bg-white disabled:opacity-50 dark:border-red-400/25 dark:bg-white/[0.05] dark:text-red-100 dark:hover:bg-white/[0.08]"
                    >
                      <RotateCcw className="h-4 w-4" strokeWidth={1.9} />
                      {t('firstRunCredentialRetry')}
                    </button>
                    <button
                      type="button"
                      disabled={saving || recoveringCredentials}
                      onClick={handleCredentialReset}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-500"
                    >
                      <ShieldAlert className="h-4 w-4" strokeWidth={1.9} />
                      {recoveringCredentials
                        ? t('firstRunCredentialResetting')
                        : t('firstRunCredentialReset')}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className={closeAllowed ? 'flex flex-col-reverse gap-3 sm:grid sm:grid-cols-[0.85fr_1fr]' : 'grid gap-3'}>
            {closeAllowed ? (
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="min-h-11 rounded-xl border border-slate-300/80 bg-white/75 px-4 py-2 text-[15px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/16 dark:hover:bg-white/[0.06]"
              >
                {t(isPreview ? 'firstRunClose' : 'firstRunSkip')}
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving || recoveringCredentials}
              onClick={handleSave}
              className="min-h-11 rounded-xl bg-[linear-gradient(180deg,#2392ff_0%,#0e7df0_100%)] px-4 py-2 text-[15px] font-semibold text-white shadow-[0_14px_30px_rgba(19,136,255,0.22)] transition hover:opacity-95 disabled:opacity-50 dark:bg-[linear-gradient(180deg,#2c9dff_0%,#1584f6_100%)] dark:shadow-[0_14px_30px_rgba(21,132,246,0.2)]"
            >
              {saving ? t('firstRunSaving') : t('firstRunSave')}
            </button>
          </div>

          <p className="text-center text-[12.5px] leading-6 text-slate-400 dark:text-slate-500">
            {t(isPreview ? 'firstRunPreviewHint' : 'firstRunChangeLater')}
          </p>
        </div>
        </section>
      </div>
    </div>
  )
}
