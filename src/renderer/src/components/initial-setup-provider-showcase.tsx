import {
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  Search,
  Sparkles
} from 'lucide-react'
import {
  useMemo,
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement
} from 'react'
import { ProviderIcon } from './provider-icon'
import type { SetupProviderCard } from './initial-setup-dialog-support'

export type InitialSetupProviderShowcaseLabels = {
  providerLabel: string
  gallery: string
  searchPlaceholder: string
  noResults: string
  previous: string
  next: string
  showAll: string
  hideAll: string
  chosen: string
  selected: string
  custom: string
  customName: string
  subscription: string
  free: string
  api: string
  description: (card: SetupProviderCard) => string
  modelCount: (count: number) => string
  position: (current: number, total: number) => string
}

type InitialSetupProviderShowcaseProps = {
  cards: readonly SetupProviderCard[]
  selectedId: string
  onSelect: (presetId: string) => void
  isFilled: (card: SetupProviderCard) => boolean
  labels: InitialSetupProviderShowcaseLabels
}

const MAX_PEEK_DISTANCE = 3

export function InitialSetupProviderShowcase({
  cards,
  selectedId,
  onSelect,
  isFilled,
  labels
}: InitialSetupProviderShowcaseProps): ReactElement {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const dragStartX = useRef<number | null>(null)
  const cardName = useCallback(
    (card: SetupProviderCard): string => card.isCustom ? labels.customName : card.name,
    [labels.customName]
  )

  const filteredCards = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return [...cards]
    return cards.filter((card) => {
      const haystack = [
        cardName(card),
        labels.description(card),
        card.preset?.models.join(' '),
        card.preset?.category,
        card.preset?.kind
      ].filter(Boolean).join(' ').toLocaleLowerCase()
      return haystack.includes(normalized)
    })
  }, [cardName, cards, labels, query])

  const selectedIndex = filteredCards.findIndex((card) => card.presetId === selectedId)
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0
  const activeCard = filteredCards[activeIndex]

  const selectIndex = (index: number): void => {
    const card = filteredCards[index]
    if (card) onSelect(card.presetId)
  }

  const move = (delta: number): void => {
    if (filteredCards.length === 0) return
    const next = (activeIndex + delta + filteredCards.length) % filteredCards.length
    selectIndex(next)
  }

  const handleSearch = (value: string): void => {
    setQuery(value)
    const normalized = value.trim().toLocaleLowerCase()
    if (!normalized) return
    const firstMatch = cards.find((card) => {
      const haystack = [
        cardName(card),
        labels.description(card),
        card.preset?.models.join(' '),
        card.preset?.category,
        card.preset?.kind
      ].filter(Boolean).join(' ').toLocaleLowerCase()
      return haystack.includes(normalized)
    })
    if (firstMatch) onSelect(firstMatch.presetId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.target instanceof HTMLInputElement) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      selectIndex(filteredCards.length - 1)
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    dragStartX.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const start = dragStartX.current
    dragStartX.current = null
    if (start === null) return
    const distance = event.clientX - start
    if (Math.abs(distance) < 28) return
    move(distance > 0 ? -1 : 1)
  }

  const accessLabel = (card: SetupProviderCard): string => {
    if (card.isCustom) return labels.custom
    if (card.preset?.category === 'subscription') return labels.subscription
    if (card.preset?.category === 'free') return labels.free
    return labels.api
  }

  return (
    <div className="space-y-3" onKeyDown={handleKeyDown}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" strokeWidth={1.8} />
        <input
          type="search"
          value={query}
          onChange={(event) => handleSearch(event.target.value)}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
          className="w-full rounded-xl border border-slate-300/75 bg-white/80 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#1388ff]/65 focus:ring-2 focus:ring-[#1388ff]/15 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      {activeCard ? (
        <div
          role="radiogroup"
          aria-label={labels.providerLabel}
          className="relative h-[248px] overflow-hidden rounded-2xl border border-slate-200/80 bg-[radial-gradient(circle_at_50%_20%,rgba(19,136,255,0.12),transparent_58%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(239,245,255,0.72))] [perspective:1100px] dark:border-white/10 dark:bg-[radial-gradient(circle_at_50%_20%,rgba(58,160,255,0.18),transparent_58%),linear-gradient(135deg,rgba(27,32,43,0.96),rgba(17,21,29,0.96))]"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { dragStartX.current = null }}
          onWheel={(event) => {
            if (Math.abs(event.deltaX) + Math.abs(event.deltaY) < 12) return
            event.preventDefault()
            const direction = event.deltaX !== 0 ? event.deltaX : event.deltaY
            move(direction > 0 ? 1 : -1)
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400/80 dark:text-slate-500/80">
            {labels.gallery}
          </div>
          {filteredCards.map((card, index) => {
            const offset = index - activeIndex
            const distance = Math.abs(offset)
            const active = index === activeIndex
            const hidden = distance > MAX_PEEK_DISTANCE
            const scale = active ? 1 : Math.max(0.72, 0.91 - distance * 0.08)
            const rotate = Math.max(-15, Math.min(15, offset * -9))
            const translateX = offset * 154
            return (
              <button
                key={card.presetId}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${cardName(card)}, ${labels.position(index + 1, filteredCards.length)}`}
                tabIndex={active ? 0 : -1}
                onClick={() => selectIndex(index)}
                className="absolute left-1/2 top-1/2 flex h-[188px] w-[min(72vw,270px)] -translate-x-1/2 -translate-y-1/2 flex-col items-start rounded-2xl border px-5 py-4 text-left shadow-[0_22px_46px_rgba(69,91,125,0.16)] outline-none transition-[transform,opacity,filter,box-shadow] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-[#1388ff] dark:shadow-[0_24px_52px_rgba(0,0,0,0.36)]"
                style={{
                  transform: `translate3d(calc(-50% + ${translateX}px), calc(-50% + ${distance * 6}px), ${-distance * 74}px) rotateY(${rotate}deg) scale(${scale})`,
                  zIndex: 20 - distance,
                  opacity: hidden ? 0 : active ? 1 : Math.max(0.28, 0.74 - distance * 0.12),
                  pointerEvents: hidden ? 'none' : 'auto',
                  filter: active ? 'saturate(1)' : 'saturate(.62) brightness(.94)',
                  borderColor: active ? 'rgba(19,136,255,.5)' : 'rgba(148,163,184,.28)',
                  background: active
                    ? 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(241,247,255,.9))'
                    : 'rgba(255,255,255,.78)'
                }}
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${active ? 'border-[#1388ff]/20 bg-[#1388ff]/[0.09] text-[#1388ff]' : 'border-slate-200 bg-slate-50 text-slate-500'} dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200`}>
                    {card.isCustom
                      ? <Sparkles className="h-5 w-5" strokeWidth={1.8} />
                      : <ProviderIcon presetId={card.presetId} label={cardName(card)} size={24} />}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/90 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:bg-white/[0.08] dark:text-slate-300">
                    {isFilled(card) ? <Check className="h-3 w-3 text-emerald-500" strokeWidth={2.5} /> : null}
                    {accessLabel(card)}
                  </span>
                </span>
                <span className="mt-4 line-clamp-1 text-[19px] font-semibold tracking-tight text-slate-900 dark:text-white">
                  {cardName(card)}
                </span>
                <span className="mt-1 line-clamp-2 min-h-8 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                  {labels.description(card)}
                </span>
                <span className="mt-auto flex items-center gap-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  <span>{card.preset?.models.length ? labels.modelCount(card.preset.models.length) : labels.chosen}</span>
                  {active ? <span className="h-1 w-1 rounded-full bg-[#1388ff]" /> : null}
                  {active ? <span className="text-[#1388ff]">{labels.selected}</span> : null}
                </span>
              </button>
            )
          })}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {labels.position(activeIndex + 1, filteredCards.length)}
          </div>
        </div>
      ) : (
        <div className="grid h-[248px] place-items-center rounded-2xl border border-dashed border-slate-300/80 text-sm text-slate-400 dark:border-white/10 dark:text-slate-500">
          {labels.noResults}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={!activeCard}
          aria-label={labels.previous}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300/80 bg-white/80 text-slate-600 transition hover:border-[#1388ff]/45 hover:text-[#1388ff] disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.9} />
        </button>
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
        >
          <List className="h-3.5 w-3.5" strokeWidth={1.8} />
          {showAll ? labels.hideAll : labels.showAll}
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={!activeCard}
          aria-label={labels.next}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300/80 bg-white/80 text-slate-600 transition hover:border-[#1388ff]/45 hover:text-[#1388ff] disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.9} />
        </button>
      </div>

      {showAll ? (
        <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/70 p-2 sm:grid-cols-3 dark:border-white/10 dark:bg-white/[0.025]">
          {filteredCards.map((card, index) => {
            const active = card.presetId === selectedId
            return (
              <button
                key={card.presetId}
                type="button"
                onClick={() => {
                  onSelect(card.presetId)
                  setShowAll(false)
                }}
                className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition ${active ? 'border-[#1388ff]/45 bg-[#1388ff]/[0.08] text-[#1377df]' : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/[0.05]'}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/80 text-slate-500 dark:bg-white/[0.08] dark:text-slate-200">
                  {card.isCustom ? <Sparkles className="h-3.5 w-3.5" /> : <ProviderIcon presetId={card.presetId} size={15} />}
                </span>
                <span className="min-w-0 truncate">{index + 1}. {cardName(card)}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {activeCard
          ? `${cardName(activeCard)}, ${labels.position(activeIndex + 1, filteredCards.length)}`
          : labels.noResults}
      </p>
    </div>
  )
}
