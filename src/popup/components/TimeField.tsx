type TimeFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hasError?: boolean
  disabled?: boolean
}

const inputBase =
  'w-full rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:border-slate-200/60 disabled:bg-slate-100/80 disabled:text-slate-400 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-rose-300 dark:focus:ring-rose-400/40 dark:disabled:border-slate-700/40 dark:disabled:bg-slate-900/40 dark:disabled:text-slate-500'

export const TimeField = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  hasError,
  disabled,
}: TimeFieldProps) => {
  return (
    <label className="block space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="time"
        step={60}
        className={`${inputBase} ${hasError ? 'border-rose-300 ring-1 ring-rose-200' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  )
}
