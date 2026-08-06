import { describe, expect, it } from 'vitest'
import { addMinutes, applyOffset, fromMinutes, getRandomOffset, parseTime, toMinutes } from './time'
import { MINUTES_IN_DAY } from './timing'

describe('parseTime', () => {
  it('splits and zero-pads hours and minutes', () => {
    expect(parseTime('9:5')).toEqual({ hours: '09', minutes: '05' })
    expect(parseTime('09:00')).toEqual({ hours: '09', minutes: '00' })
    expect(parseTime('23:59')).toEqual({ hours: '23', minutes: '59' })
  })

  it('defaults missing parts to 00', () => {
    expect(parseTime('')).toEqual({ hours: '00', minutes: '00' })
    expect(parseTime('12')).toEqual({ hours: '12', minutes: '00' })
  })
})

describe('toMinutes / fromMinutes', () => {
  it('round-trips valid times', () => {
    for (const value of ['00:00', '09:00', '12:30', '17:45', '23:59']) {
      expect(fromMinutes(toMinutes(value))).toBe(value)
    }
  })

  it('clamps below zero to 00:00', () => {
    expect(fromMinutes(-120)).toBe('00:00')
  })

  it('clamps above the end of the day to 23:59', () => {
    expect(fromMinutes(MINUTES_IN_DAY + 500)).toBe('23:59')
    expect(toMinutes('99:99')).toBe(MINUTES_IN_DAY)
  })

  it('treats non-numeric input as 00:00', () => {
    expect(toMinutes('abc:def')).toBe(0)
  })
})

describe('applyOffset', () => {
  it('returns the input unchanged for a zero offset', () => {
    expect(applyOffset('09:00', 0)).toBe('09:00')
  })

  it('adds a positive offset', () => {
    expect(applyOffset('09:00', 15)).toBe('09:15')
  })

  it('subtracts a negative offset', () => {
    expect(applyOffset('09:00', -30)).toBe('08:30')
  })

  it('clamps underflow past midnight to 00:00', () => {
    expect(applyOffset('00:10', -30)).toBe('00:00')
  })
})

describe('addMinutes', () => {
  it('returns the input unchanged for a zero or non-finite delta', () => {
    expect(addMinutes('12:00', 0)).toBe('12:00')
    expect(addMinutes('12:00', Number.NaN)).toBe('12:00')
  })

  it('adds minutes with hour rollover', () => {
    expect(addMinutes('12:00', 30)).toBe('12:30')
    expect(addMinutes('12:45', 30)).toBe('13:15')
  })

  it('clamps overflow to 23:59', () => {
    expect(addMinutes('23:50', 30)).toBe('23:59')
  })
})

describe('getRandomOffset', () => {
  it('returns 0 for non-positive or non-finite max', () => {
    expect(getRandomOffset(0)).toBe(0)
    expect(getRandomOffset(-5)).toBe(0)
    expect(getRandomOffset(Number.NaN)).toBe(0)
  })

  it('stays within [-max, max] across the RNG range', () => {
    const max = 15
    for (const r of [0, 0.25, 0.49, 0.5, 0.75, 0.999]) {
      const offset = getRandomOffset(max, () => r)
      expect(offset).toBeGreaterThanOrEqual(-max)
      expect(offset).toBeLessThanOrEqual(max)
    }
  })

  it('uses the injected RNG for magnitude and direction', () => {
    // random() < 0.5 → negative direction; magnitude = floor(random * (max+1)).
    expect(getRandomOffset(10, () => 0)).toBe(0)
    // First call feeds magnitude (0.99 → 10), second feeds direction (0.9 ≥ 0.5 → +).
    let calls = 0
    const rng = () => (calls++ === 0 ? 0.99 : 0.9)
    expect(getRandomOffset(10, rng)).toBe(10)
  })
})
