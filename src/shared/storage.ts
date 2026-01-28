export const STORAGE_KEYS = {
  clockIn: 'hibobHelperClockIn',
  clockOut: 'hibobHelperClockOut',
}

export type StoredTimes = {
  clockIn: string
  clockOut: string
}

const DEFAULT_TIMES: StoredTimes = {
  clockIn: '09:00',
  clockOut: '17:00',
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
