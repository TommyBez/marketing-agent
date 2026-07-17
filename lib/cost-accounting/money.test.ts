import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  microusdToUsd,
  PILOT_GRANT_MICROUSD,
  pricingFloorForMargin,
  sumUsd,
  usdDecimal,
  usdToMicrousd,
} from './money'

describe('USD helpers', () => {
  it('rounds USD to the nearest integer microUSD', () => {
    assert.equal(usdToMicrousd(1), BigInt(1_000_000))
    assert.equal(usdToMicrousd('0.000001'), BigInt(1))
    assert.equal(usdToMicrousd(0.00000049), BigInt(0))
    assert.equal(usdToMicrousd(0.0000005), BigInt(1))
    assert.equal(usdToMicrousd(1.2345678), BigInt(1_234_568))
  })

  it('converts microUSD back to USD and fixes persisted decimal precision', () => {
    assert.equal(microusdToUsd(BigInt(1_234_568)), 1.234568)
    assert.equal(usdDecimal(1.2345678), '1.234567800000')
    assert.equal(PILOT_GRANT_MICROUSD, BigInt(25_000_000))
  })

  it('sums valid USD values and ignores absent or non-finite values', () => {
    assert.equal(sumUsd([1, '2.5', null, undefined, 'invalid', Number.NaN]), 3.5)
  })

  it('computes a pricing floor and rejects invalid numeric inputs', () => {
    assert.equal(pricingFloorForMargin(7.5, 0.25), 10)
    assert.throws(() => pricingFloorForMargin(1, 1), /target margin/i)
    assert.throws(() => usdToMicrousd(Number.POSITIVE_INFINITY), /invalid USD amount/i)
    assert.throws(() => usdDecimal(Number.NaN), /invalid USD amount/i)
  })
})
