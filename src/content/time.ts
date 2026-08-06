// Pure time math for the automation engine. No DOM access — unit-tested in
// time.test.ts.

import { MINUTES_IN_DAY } from './timing'

export const parseTime = (value: string) => {
  const [hours = '00', minutes = '00'] = value.split(':')
  return {
    hours: hours.padStart(2, '0'),
    minutes: minutes.padStart(2, '0'),
  }
}

export const toMinutes = (value: string) => {
  const [hours = '0', minutes = '0'] = value.split(':')
  const hoursValue = Number.parseInt(hours, 10)
  const minutesValue = Number.parseInt(minutes, 10)
  const total =
    Number.isFinite(hoursValue) && Number.isFinite(minutesValue)
      ? hoursValue * 60 + minutesValue
      : 0
  return Math.min(MINUTES_IN_DAY, Math.max(0, total))
}

export const fromMinutes = (totalMinutes: number) => {
  const safeMinutes = Math.min(MINUTES_IN_DAY, Math.max(0, totalMinutes))
  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Random offset in `[-maxMinutes, maxMinutes]`. `random` is injectable so tests
 * can make it deterministic; it defaults to `Math.random`.
 */
export const getRandomOffset = (maxMinutes: number, random: () => number = Math.random) => {
  if (!Number.isFinite(maxMinutes) || maxMinutes <= 0) return 0
  const magnitude = Math.floor(random() * (maxMinutes + 1))
  if (magnitude === 0) return 0
  const direction = random() < 0.5 ? -1 : 1
  return magnitude * direction
}

export const applyOffset = (timeValue: string, offsetMinutes: number) => {
  if (!offsetMinutes) return timeValue
  const base = toMinutes(timeValue)
  return fromMinutes(base + offsetMinutes)
}

export const addMinutes = (timeValue: string, minutes: number) => {
  if (!Number.isFinite(minutes) || minutes === 0) return timeValue
  return fromMinutes(toMinutes(timeValue) + minutes)
}
