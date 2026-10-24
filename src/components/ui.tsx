import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 ${className}`}>
      {children}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

/** Button look, also used on links (a button inside a link doesn't tap reliably on phones). */
export function buttonClass(variant: Variant = 'primary', className = '') {
  const styles = {
    primary: 'bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-40',
    secondary: 'bg-stone-200 text-stone-900 hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700',
    ghost: 'text-stone-600 hover:bg-stone-200/60 dark:text-stone-300 dark:hover:bg-stone-800',
    danger: 'bg-red-600 text-white hover:bg-red-500',
  }[variant]
  return `inline-block text-center rounded-xl px-4 py-2.5 font-medium transition active:scale-[0.98] ${styles} ${className}`
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={buttonClass(variant, className)} {...props} />
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">{hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-stone-200 p-1 dark:bg-stone-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition ${
            value === o.value ? 'bg-white shadow-sm dark:bg-stone-950' : 'text-stone-600 dark:text-stone-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="secondary" className="h-11 w-11 !p-0 text-xl" onClick={() => onChange(Math.max(min, value - 1))}>−</Button>
      <span className="w-8 text-center text-xl font-semibold tabular-nums">{value}</span>
      <Button type="button" variant="secondary" className="h-11 w-11 !p-0 text-xl" onClick={() => onChange(Math.min(max, value + 1))}>+</Button>
    </div>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="animate-toast w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:bg-stone-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** Tap-and-confirm modal used before deleting things. */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: string; action: () => void; danger: boolean } | null>(null)
  const ask = (title: string, body: string, action: () => void, danger = true) => setState({ title, body, action, danger })
  const element = (
    <Modal open={!!state} onClose={() => setState(null)} title={state?.title ?? ''}>
      <p className="mb-5 text-stone-600 dark:text-stone-300">{state?.body}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setState(null)}>Cancel</Button>
        <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => { state?.action(); setState(null) }}>
          Yes
        </Button>
      </div>
    </Modal>
  )
  return { ask, element }
}

// --- Toast: a short message that slides up from the bottom ---

const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const show = useCallback((text: string) => {
    setMsg({ text, key: Date.now() })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 2600)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div key={msg.key} className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="animate-toast rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white shadow-lg dark:bg-stone-100 dark:text-stone-900">
            {msg.text}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  )
}
