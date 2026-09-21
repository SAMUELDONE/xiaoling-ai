import { PRODUCT_NAME_EN } from '../../shared/product-identity'

export class KunOwnerVerificationError extends Error {
  readonly name = 'KunOwnerVerificationError'

  constructor(
    readonly ownerKind: 'runtime' | 'manager',
    readonly pid: number,
    detail: string
  ) {
    super(
      `${PRODUCT_NAME_EN} ${ownerKind === 'manager' ? 'Service Manager' : 'Runtime'} ${pid} ` +
      `could not be safely replaced after graceful shutdown failed: ${detail}`
    )
  }
}
