import type {
  ModelProviderModelProfileV1,
  ModelReasoningEffort,
  ModelServiceTier
} from '../shared/app-settings'
import { normalizeModelReasoningTier } from '../shared/app-settings'

/**
 * The GUI/runtime keeps the backwards-compatible `max` value internally.
 * Codex catalogs use the more expressive native `xhigh`/`ultra` names, so
 * normalize those names at the catalog boundary instead of dropping them.
 */
function normalizeCatalogReasoningEffort(value: unknown): ModelReasoningEffort | undefined {
  switch (normalizeModelReasoningTier(value)) {
    case 'minimal':
    case 'low':
      return 'low'
    case 'medium':
      return 'medium'
    case 'high':
      return 'high'
    case 'xhigh':
      return 'max'
    default:
      return undefined
  }
}

/** Codex uses slugs and picker visibility rather than the public API's data[].id. */
export function parseCodexModelCatalog(body: string): {
  modelIds: string[]
  modelProfiles: Record<string, ModelProviderModelProfileV1>
} {
  const catalog = JSON.parse(body)
  if (!catalog || !Array.isArray(catalog.models)) throw new Error('Invalid Codex catalog')
  const profiles = new Map<string, ModelProviderModelProfileV1>()
  for (const row of catalog.models.slice(0, 2_000)) {
    if (!row || typeof row.slug !== 'string' || row.visibility !== 'list') continue
    const id = row.slug.trim()
    if (!id || id.length > 512 || profiles.has(id)) continue
    // supported_in_api is not an entitlement filter for ChatGPT subscription models (e.g. Spark).
    const vision = Array.isArray(row.input_modalities) && row.input_modalities.includes('image')
    const efforts: ModelReasoningEffort[] = Array.isArray(row.supported_reasoning_levels)
      ? [...new Set<ModelReasoningEffort>(row.supported_reasoning_levels.flatMap((level: { effort?: string } | null) => {
          const effort = normalizeCatalogReasoningEffort(level?.effort)
          return effort ? [effort] : []
        }))]
      : []
    const catalogDefaultEffort = normalizeCatalogReasoningEffort(row.default_reasoning_level)
    const defaultEffort = catalogDefaultEffort && efforts.includes(catalogDefaultEffort)
      ? catalogDefaultEffort : efforts[0]
    // A missing service_tiers field means the catalog never declared tiers
    // (unknown); a present array is authoritative, so an empty array or one
    // without priority stays an explicit "no supported tier" answer.
    const serviceTiers = Array.isArray(row.service_tiers)
      ? [...new Set<ModelServiceTier>(row.service_tiers.flatMap((tier: { id?: string } | null) => {
          const tierId = tier?.id
          return tierId === 'priority' || tierId === 'flex' ? [tierId] : []
        }))]
      : undefined
    profiles.set(id, {
      inputModalities: vision ? ['text', 'image'] : ['text'],
      outputModalities: ['text'],
      messageParts: vision ? ['text', 'image_url'] : ['text'],
      supportsToolCalling: true,
      ...(Number.isSafeInteger(row.context_window) && row.context_window > 0
        ? { contextWindowTokens: row.context_window } : {}),
      ...(row.use_responses_lite === true ? { responsesMode: 'lite' as const } : {}),
      ...(serviceTiers ? { serviceTiers } : {}),
      ...(defaultEffort ? { reasoning: {
        supportedEfforts: efforts, defaultEffort, requestProtocol: 'openai-responses' as const
      } } : {})
    })
  }
  return { modelIds: [...profiles.keys()], modelProfiles: Object.fromEntries(profiles) }
}
