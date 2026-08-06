import { beforeEach, describe, expect, it } from 'vitest'
import { findInputByLabel, isRedish } from './dom'

const mount = (html: string) => {
  document.body.innerHTML = html
  return document.body
}

beforeEach(() => {
  document.body.innerHTML = ''
})

// Note: findButtonByText is intentionally not unit-tested here — it filters on
// isElementVisible (offsetWidth/getClientRects), which jsdom cannot compute, so
// every element reads as invisible. It is exercised in live/manual verification.

describe('findInputByLabel', () => {
  it('resolves an input via label[for]', () => {
    const root = mount('<label for="ci">Clock in</label><input id="ci" />')
    expect(findInputByLabel(root, 'Clock in')?.id).toBe('ci')
  })

  it('resolves a nested input inside the label', () => {
    const root = mount('<label>Clock out<input name="co" /></label>')
    expect(findInputByLabel(root, 'Clock out')?.getAttribute('name')).toBe('co')
  })

  it('falls back to placeholder / aria-label / name matching', () => {
    const root = mount('<input placeholder="Clock in time" />')
    expect(findInputByLabel(root, 'Clock in')).not.toBeNull()
  })

  it('returns null when no input matches', () => {
    const root = mount('<label>Notes</label><input id="notes" />')
    expect(findInputByLabel(root, 'Clock in')).toBeNull()
  })
})

describe('isRedish', () => {
  it('detects red rgb / rgba colors', () => {
    expect(isRedish('rgb(220, 40, 40)')).toBe(true)
    expect(isRedish('rgba(255, 0, 0, 0.9)')).toBe(true)
  })

  it('detects red hex colors (short and long)', () => {
    expect(isRedish('#e00')).toBe(true)
    expect(isRedish('#cc2222')).toBe(true)
  })

  it('rejects non-red and empty colors', () => {
    expect(isRedish('rgb(20, 200, 20)')).toBe(false)
    expect(isRedish('#3366cc')).toBe(false)
    expect(isRedish('transparent')).toBe(false)
    expect(isRedish('')).toBe(false)
  })
})
