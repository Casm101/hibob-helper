export const STORAGE_KEYS = {
  clockIn: 'hibobHelperClockIn',
  clockOut: 'hibobHelperClockOut',
  randomizeEnabled: 'hibobHelperRandomizeEnabled',
  randomizeMinutes: 'hibobHelperRandomizeMinutes',
  breakEnabled: 'hibobHelperBreakEnabled',
  breakStart: 'hibobHelperBreakStart',
  breakDurationMinutes: 'hibobHelperBreakDurationMinutes',
}

export type StoredTimes = {
  clockIn: string
  clockOut: string
}

export type StoredSettings = {
  randomizeEnabled: boolean
  randomizeMinutes: number
  breakEnabled: boolean
  breakStart: string
  breakDurationMinutes: number
}

const DEFAULT_TIMES: StoredTimes = {
  clockIn: '09:00',
  clockOut: '17:00',
}

const DEFAULT_SETTINGS: StoredSettings = {
  randomizeEnabled: false,
  randomizeMinutes: 15,
  breakEnabled: false,
  breakStart: '12:00',
  breakDurationMinutes: 30,
}

export const getStoredTimes = () =>
  new Promise<StoredTimes>((resolve) => {
    chrome.storage.sync.get(
      {
        [STORAGE_KEYS.clockIn]: DEFAULT_TIMES.clockIn,
        [STORAGE_KEYS.clockOut]: DEFAULT_TIMES.clockOut,
      },
      (result) => {
        const values = result as Record<string, unknown>
        resolve({
          clockIn: (values[STORAGE_KEYS.clockIn] as string) ?? DEFAULT_TIMES.clockIn,
          clockOut: (values[STORAGE_KEYS.clockOut] as string) ?? DEFAULT_TIMES.clockOut,
        })
      }
    )
  })

export const setStoredTimes = (times: StoredTimes) =>
  new Promise<void>((resolve) => {
    chrome.storage.sync.set(
      {
        [STORAGE_KEYS.clockIn]: times.clockIn,
        [STORAGE_KEYS.clockOut]: times.clockOut,
      },
      () => resolve()
    )
  })

export const getStoredSettings = () =>
  new Promise<StoredSettings>((resolve) => {
    chrome.storage.sync.get(
      {
        [STORAGE_KEYS.randomizeEnabled]: DEFAULT_SETTINGS.randomizeEnabled,
        [STORAGE_KEYS.randomizeMinutes]: DEFAULT_SETTINGS.randomizeMinutes,
        [STORAGE_KEYS.breakEnabled]: DEFAULT_SETTINGS.breakEnabled,
        [STORAGE_KEYS.breakStart]: DEFAULT_SETTINGS.breakStart,
        [STORAGE_KEYS.breakDurationMinutes]: DEFAULT_SETTINGS.breakDurationMinutes,
      },
      (result) => {
        const values = result as Record<string, unknown>
        const rawEnabled = values[STORAGE_KEYS.randomizeEnabled]
        const rawMinutes = values[STORAGE_KEYS.randomizeMinutes]
        const rawBreakEnabled = values[STORAGE_KEYS.breakEnabled]
        const rawBreakStart = values[STORAGE_KEYS.breakStart]
        const rawBreakDuration = values[STORAGE_KEYS.breakDurationMinutes]
        const parsedMinutes =
          typeof rawMinutes === 'number'
            ? rawMinutes
            : Number.parseInt(String(rawMinutes ?? ''), 10)
        const parsedBreakDuration =
          typeof rawBreakDuration === 'number'
            ? rawBreakDuration
            : Number.parseInt(String(rawBreakDuration ?? ''), 10)
        const breakStart =
          typeof rawBreakStart === 'string' && rawBreakStart.trim()
            ? rawBreakStart
            : DEFAULT_SETTINGS.breakStart

        resolve({
          randomizeEnabled:
            typeof rawEnabled === 'boolean'
              ? rawEnabled
              : Boolean(rawEnabled ?? DEFAULT_SETTINGS.randomizeEnabled),
          randomizeMinutes: Number.isFinite(parsedMinutes)
            ? parsedMinutes
            : DEFAULT_SETTINGS.randomizeMinutes,
          breakEnabled:
            typeof rawBreakEnabled === 'boolean'
              ? rawBreakEnabled
              : Boolean(rawBreakEnabled ?? DEFAULT_SETTINGS.breakEnabled),
          breakStart,
          breakDurationMinutes: Number.isFinite(parsedBreakDuration)
            ? parsedBreakDuration
            : DEFAULT_SETTINGS.breakDurationMinutes,
        })
      }
    )
  })

export const setStoredSettings = (settings: StoredSettings) =>
  new Promise<void>((resolve) => {
    chrome.storage.sync.set(
      {
        [STORAGE_KEYS.randomizeEnabled]: settings.randomizeEnabled,
        [STORAGE_KEYS.randomizeMinutes]: settings.randomizeMinutes,
        [STORAGE_KEYS.breakEnabled]: settings.breakEnabled,
        [STORAGE_KEYS.breakStart]: settings.breakStart,
        [STORAGE_KEYS.breakDurationMinutes]: settings.breakDurationMinutes,
      },
      () => resolve()
    )
  })
