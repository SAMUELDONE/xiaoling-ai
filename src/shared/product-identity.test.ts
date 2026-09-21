import { describe, expect, it } from 'vitest'
import {
  PRODUCT_AUTHOR,
  PRODUCT_DEVELOPMENT_NAME,
  PRODUCT_DEVELOPMENT_SLUG,
  PRODUCT_HOMEPAGE_URL,
  PRODUCT_NAME,
  PRODUCT_NAME_EN,
  PRODUCT_REPOSITORY_URL,
  PRODUCT_SLUG
} from './product-identity'

describe('Xiaoling AI product identity', () => {
  it('keeps product metadata independent from Kun runtime compatibility names', () => {
    expect({
      name: PRODUCT_NAME,
      nameEn: PRODUCT_NAME_EN,
      slug: PRODUCT_SLUG,
      developmentName: PRODUCT_DEVELOPMENT_NAME,
      developmentSlug: PRODUCT_DEVELOPMENT_SLUG,
      author: PRODUCT_AUTHOR,
      repository: PRODUCT_REPOSITORY_URL,
      homepage: PRODUCT_HOMEPAGE_URL
    }).toEqual({
      name: '小灵 AI',
      nameEn: 'Xiaoling AI',
      slug: 'xiaoling-ai',
      developmentName: '小灵 AI Dev',
      developmentSlug: 'xiaoling-ai-dv',
      author: 'SAMUELDONE',
      repository: 'https://github.com/SAMUELDONE/xiaoling-ai',
      homepage: 'https://github.com/SAMUELDONE/xiaoling-ai'
    })
  })
})
