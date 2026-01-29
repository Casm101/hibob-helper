export const STORAGE_KEYS = {
  clockIn: 'hibobHelperClockIn',
  clockOut: 'hibobHelperClockOut',
  randomizeEnabled: 'hibobHelperRandomizeEnabled',
  randomizeMinutes: 'hibobHelperRandomizeMinutes',
}

export type StoredTimes = {
  clockIn: string
  clockOut: string
}

export type StoredSettings = {
  randomizeEnabled: boolean
  randomizeMinutes: number
}

const DEFAULT_TIMES: StoredTimes = {
  clockIn: '09:00',
  clockOut: '17:00',
}

const DEFAULT_SETTINGS: StoredSettings = {
  randomizeEnabled: false,
  randomizeMinutes: 15,
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
      },
      (result) => {
        const values = result as Record<string, unknown>
        const rawEnabled = values[STORAGE_KEYS.randomizeEnabled]
        const rawMinutes = values[STORAGE_KEYS.randomizeMinutes]
        const parsedMinutes =
          typeof rawMinutes === 'number'
            ? rawMinutes
            : Number.parseInt(String(rawMinutes ?? ''), 10)

        resolve({
          randomizeEnabled:
            typeof rawEnabled === 'boolean'
              ? rawEnabled
              : Boolean(rawEnabled ?? DEFAULT_SETTINGS.randomizeEnabled),
          randomizeMinutes: Number.isFinite(parsedMinutes)
            ? parsedMinutes
            : DEFAULT_SETTINGS.randomizeMinutes,
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
      },
      () => resolve()
    )
  })
