import { useEffect, useMemo, useState } from 'react'
import { TimeField } from './components/TimeField'
import { TARGET_URL_HINT, isSupportedUrl } from '../shared/config'
import type { AutomationResultMessage, RunAutomationMessage } from '../shared/messaging'
import { isValidTime } from '../shared/validation'

const statusStyles: Record<string, string> = {
  idle: 'bg-slate-100 text-slate-600',
  running: 'bg-amber-100 text-amber-700',
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-rose-100 text-rose-700',
}

type StatusState = {
  state: 'idle' | 'running' | 'success' | 'error'
  message: string
}

const initialStatus: StatusState = {
  state: 'idle',
  message: 'Ready to fill missing attendance rows.',
}

const sendMessage = (message: RunAutomationMessage) =>
  new Promise<AutomationResultMessage | undefined>((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          type: 'AUTOMATION_RESULT',
          requestId: message.requestId,
          success: false,
          error: chrome.runtime.lastError.message,
        })
        return
      }
      resolve(response)
    })
  })

export const App = () => {
  const [clockIn, setClockIn] = useState('09:00')
  const [clockOut, setClockOut] = useState('17:00')
  const [supported, setSupported] = useState(false)
  const [status, setStatus] = useState<StatusState>(initialStatus)

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? null
      setSupported(isSupportedUrl(url))
    })
  }, [])

  const timesValid = useMemo(() => {
    return isValidTime(clockIn) && isValidTime(clockOut)
  }, [clockIn, clockOut])

  const canRun = supported && timesValid && status.state !== 'running'

  const handleRun = async () => {
    if (!canRun) return

    setStatus({ state: 'running', message: 'Running automation...' })
    const requestId = crypto.randomUUID()
    const response = await sendMessage({
      type: 'RUN_AUTOMATION',
      requestId,
      payload: { clockIn, clockOut },
    })

    if (!response || response.type !== 'AUTOMATION_RESULT') {
      setStatus({ state: 'error', message: 'No response from content script.' })
      return
    }

    if (!response.success) {
      setStatus({
        state: 'error',
        message: response.error ?? 'Automation failed. Check the console for details.',
      })
      return
    }

    const processed = response.processed ?? 0
    setStatus({
      state: 'success',
      message: `Automation complete. Updated ${processed} row${processed === 1 ? '' : 's'}.`,
    })
  }

  return (
    <div className="flex min-h-[360px] w-[360px] flex-col bg-gradient-to-br from-rose-50 via-slate-50 to-amber-50 p-4 text-slate-900">
      <div className="flex-1 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-panel backdrop-blur">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1 animate-fade-up">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500">
              HiBob Helper
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              Attendance Auto-Fill
            </h1>
            <p className="text-xs text-slate-500">
              Apply your default time entry to flagged rows.
            </p>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
              supported ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {supported ? 'Supported' : 'Unsupported'}
          </div>
        </header>

        <div className="mt-4 space-y-3 animate-fade-in">
          <TimeField
            id="clock-in"
            label="Clock In Time"
            value={clockIn}
            onChange={setClockIn}
            hasError={!isValidTime(clockIn)}
          />
          <TimeField
            id="clock-out"
            label="Clock Out Time"
            value={clockOut}
            onChange={setClockOut}
            hasError={!isValidTime(clockOut)}
          />
        </div>

        {!supported ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            Site not supported. Open {TARGET_URL_HINT} and try again.
          </div>
        ) : null}

        {!timesValid ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            Enter valid 24-hour times (HH:MM).
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleRun}
          disabled={!canRun}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {status.state === 'running' ? 'Running Automation…' : 'Run Automation'}
        </button>

        <div
          className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${statusStyles[status.state]}`}
        >
          {status.message}
        </div>
      </div>

      <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
        Target: {TARGET_URL_HINT}
      </p>
    </div>
  )
}
