import { beforeEach, describe, expect, it } from 'vitest'
import {
  extractRowLabel,
  findRowById,
  getEntryBlocks,
  getEntryInputs,
  isWarningRow,
  resolveTimes,
} from './steps'

const mount = (html: string) => {
  document.body.innerHTML = html
  return document.body
}

beforeEach(() => {
  document.body.innerHTML = ''
})

const timepicker = (label: string) => `
  <b-timepicker>
    <label>${label}</label>
    <input class="btmpckr-input-hours" />
    <input class="btmpckr-input-minutes" />
  </b-timepicker>
`

describe('resolveTimes', () => {
  it('produces a single entry when break is disabled', () => {
    const times = resolveTimes('09:00', '17:00', {})
    expect(times).toEqual({ first: { clockIn: '09:00', clockOut: '17:00' } })
  })

  it('splits into two entries around a break, pushing clock-out later', () => {
    const times = resolveTimes('09:00', '17:00', {
      breakEnabled: true,
      breakStart: '12:00',
      breakDurationMinutes: 30,
    })
    expect(times.first).toEqual({ clockIn: '09:00', clockOut: '12:00' })
    expect(times.second).toEqual({ clockIn: '12:30', clockOut: '17:30' })
  })

  it('applies a deterministic randomize offset via the injected RNG', () => {
    // magnitude = floor(0.99 * 16) = 15; direction: 0.99 ≥ 0.5 → +15
    const times = resolveTimes('09:00', '17:00', { randomizeEnabled: true, randomizeMinutes: 15 }, () => 0.99)
    expect(times.first).toEqual({ clockIn: '09:15', clockOut: '17:15' })
  })
})

describe('isWarningRow', () => {
  it('detects a row with a warning selector', () => {
    const root = mount('<div id="row"><span data-qa="missing-entry"></span></div>')
    expect(isWarningRow(root.querySelector('#row')!)).toBe(true)
  })

  it('detects a row with a legacy .error child', () => {
    const root = mount('<div id="row"><i class="error"></i></div>')
    expect(isWarningRow(root.querySelector('#row')!)).toBe(true)
  })

  it('returns false for a clean row', () => {
    const root = mount('<div id="row"><span>09:00</span></div>')
    expect(isWarningRow(root.querySelector('#row')!)).toBe(false)
  })
})

describe('extractRowLabel', () => {
  it('prefers the date cell value', () => {
    const root = mount(
      '<div id="row"><div col-id="date"><span class="ag-cell-value">Mon 1 Jul</span></div></div>'
    )
    expect(extractRowLabel(root.querySelector('#row')!)).toBe('Mon 1 Jul')
  })

  it('falls back to the first meaningful grid cell, skipping badge glyphs', () => {
    const root = mount(
      '<div id="row"><div role="gridcell">!</div><div role="gridcell">Tuesday</div></div>'
    )
    expect(extractRowLabel(root.querySelector('#row')!)).toBe('Tuesday')
  })
})

describe('findRowById', () => {
  it('resolves a row by row-id within the pinned container', () => {
    mount(
      '<div class="ag-pinned-left-cols-container"><div role="row" row-id="abc:123"></div></div>'
    )
    expect(findRowById('abc:123')).not.toBeNull()
  })

  it('returns null for an unknown row-id', () => {
    mount('<div class="ag-center-cols-container"><div role="row" row-id="x"></div></div>')
    expect(findRowById('missing')).toBeNull()
  })
})

describe('getEntryBlocks / getEntryInputs', () => {
  it('finds app-attendance-entry blocks', () => {
    const root = mount('<div id="sb"><app-attendance-entry></app-attendance-entry></div>')
    expect(getEntryBlocks(root.querySelector('#sb')!)).toHaveLength(1)
  })

  it('resolves clock-in and clock-out inputs inside a timepicker', () => {
    const root = mount(
      `<app-attendance-entry>${timepicker('Clock in')}${timepicker('Clock out')}</app-attendance-entry>`
    )
    const inputs = getEntryInputs(root.querySelector('app-attendance-entry')!)
    expect(inputs).not.toBeNull()
    expect(inputs?.clockIn.hours.className).toContain('btmpckr-input-hours')
    expect(inputs?.clockOut.minutes.className).toContain('btmpckr-input-minutes')
  })

  it('returns null when a timepicker is missing', () => {
    const root = mount(`<app-attendance-entry>${timepicker('Clock in')}</app-attendance-entry>`)
    expect(getEntryInputs(root.querySelector('app-attendance-entry')!)).toBeNull()
  })
})
