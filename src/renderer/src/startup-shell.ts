import type { DesktopStartupPhase } from '@shared/desktop-startup-state'
import { PRODUCT_NAME_EN } from '@shared/product-identity'

const STARTUP_PHASE_RANK: Record<DesktopStartupPhase, number> = {
  bootstrapping: 0,
  shell_ready: 1,
  services_starting: 2,
  data_migrating: 3,
  manager_starting: 4,
  runtime_handoff: 5,
  runtime_starting: 6,
  ready: 7,
  recovery_required: 7
}

export function mergeStartupPhase(
  current: DesktopStartupPhase,
  next: DesktopStartupPhase
): DesktopStartupPhase {
  if (current === 'ready' || current === 'recovery_required') return current
  return STARTUP_PHASE_RANK[next] >= STARTUP_PHASE_RANK[current] ? next : current
}

export function startupPhaseLabel(phase: DesktopStartupPhase): string {
  switch (phase) {
    case 'bootstrapping':
      return `Preparing ${PRODUCT_NAME_EN} desktop...`
    case 'shell_ready':
      return `${PRODUCT_NAME_EN} window is ready. Starting background services...`
    case 'services_starting':
      return 'Starting background services...'
    case 'data_migrating':
      return `Migrating ${PRODUCT_NAME_EN} data...`
    case 'manager_starting':
      return `Connecting to the ${PRODUCT_NAME_EN} service manager...`
    case 'runtime_handoff':
      return `Updating the bundled ${PRODUCT_NAME_EN} runtime...`
    case 'runtime_starting':
      return `Starting ${PRODUCT_NAME_EN} runtime...`
    case 'recovery_required':
      return `${PRODUCT_NAME_EN} startup requires recovery.`
    case 'ready':
      return `${PRODUCT_NAME_EN} is ready.`
  }
}

/**
 * The workbench shell (window chrome, non-runtime views) may mount as soon as
 * the desktop shell exists; runtime-dependent features stay gated by the
 * startup state asserts in the IPC layer until `ready`.
 */
export function startupShellAllowsWorkbench(phase: DesktopStartupPhase): boolean {
  return phase === 'ready'
}
