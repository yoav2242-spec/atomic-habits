import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { TIPS, type TipKey } from '../lib/tips'

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-3xl border border-line bg-card p-4 shadow-[0_2px_10px_-4px_rgba(60,60,90,0.12)] ${className}`} style={style}>
      {children}
    </div>
  )
}

type Variant = 'primary' | 'lavender' | 'secondary' | 'ghost' | 'danger'
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

/** Button look, also used on links (a button inside a link doesn't tap reliably on phones). */
export function buttonClass(variant: Variant = 'primary', className = '') {
  const styles = {
    primary: 'btn-3d bg-sage text-white [--shadow:var(--color-sage-deep)] disabled:opacity-40',
    lavender: 'btn-3d bg-lavender text-white [--shadow:var(--color-lavender-deep)]',
    secondary: 'btn-3d bg-soft text-ink [--shadow:var(--line)]',
    ghost: 'bouncy text-muted',
    danger: 'btn-3d bg-rose text-white [--shadow:#b86c82]',
  }[variant]
  return `inline-block text-center rounded-2xl px-5 py-3 font-extrabold tracking-wide ${styles} ${className}`
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={buttonClass(variant, className)} {...props} />
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm font-semibold text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Field({ label, hint, tip, children }: { label: string; hint?: string; tip?: TipKey; children: ReactNode }) {
  return (
    <div className="block">
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
        {label}
        {tip && <InfoTip tip={tip} />}
      </div>
      {children}
      {hint && <span className="mt-1 block text-xs font-semibold text-muted">{hint}</span>}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-2xl bg-soft p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`bouncy flex-1 rounded-xl px-2 py-2.5 text-sm font-bold ${value === o.value ? 'bg-card text-ink shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, min, max, onChange, step = 1 }: { value: number; min: number; max: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" className="bouncy h-11 w-11 rounded-full bg-soft text-xl font-bold" onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span className="min-w-10 text-center text-xl font-black tabular-nums">{value}</span>
      <button type="button" className="bouncy h-11 w-11 rounded-full bg-sage text-xl font-bold text-white" onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        className="animate-rise max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <h2 className="mb-4 text-xl font-black">{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** A little "?" that explains an idea in plain words. */
export function InfoTip({ tip, className = '' }: { tip: TipKey; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        aria-label={`What is ${TIPS[tip].title}?`}
        className={`bouncy inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-soft text-[11px] font-black text-muted ${className}`}
      >
        ?
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={TIPS[tip].title}>
        <p className="mb-5 leading-relaxed text-muted">{TIPS[tip].body}</p>
        <Button className="w-full" onClick={() => setOpen(false)}>Got it</Button>
      </Modal>
    </>
  )
}

export function ProgressRing({ value, size = 120, stroke = 12, color = 'var(--color-sage)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

export function XPBar({ into, need, color = 'var(--color-lavender)' }: { into: number; need: number; color?: string }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-soft">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(3, (into / need) * 100)}%`, background: color }} />
    </div>
  )
}

/** Tap-and-confirm modal used before deleting things. */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: string; action: () => void } | null>(null)
  const ask = (title: string, body: string, action: () => void) => setState({ title, body, action })
  const element = (
    <Modal open={!!state} onClose={() => setState(null)} title={state?.title ?? ''}>
      <p className="mb-5 text-muted">{state?.body}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setState(null)}>Cancel</Button>
        <Button variant="danger" onClick={() => { state?.action(); setState(null) }}>Yes</Button>
      </div>
    </Modal>
  )
  return { ask, element }
}

// --- Toast: a short message that slides up from the bottom, optionally with an Undo ---

type ToastAction = { label: string; onClick: () => void }
const ToastCtx = createContext<(msg: string, action?: ToastAction) => void>(() => {})
const DismissCtx = createContext<(holdUntilReleased?: boolean) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
/** Hides the current toast, e.g. when a big celebration opens so the two don't overlap.
 *  dismiss(true) also holds new toasts back until dismiss(false) releases them. */
export const useDismissToast = () => useContext(DismissCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; key: number; action?: ToastAction } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const held = useRef<{ text: string; action?: ToastAction }[] | null>(null)
  const show = useCallback((text: string, action?: ToastAction) => {
    if (held.current) {
      held.current.push({ text, action })
      return
    }
    setMsg({ text, key: Date.now(), action })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), action ? 4500 : 2600)
  }, [])
  const dismiss = useCallback((hold?: boolean) => {
    if (hold === false) {
      // Released: show the last message that waited (without its Undo, which is stale by now).
      const waiting = held.current?.at(-1)
      held.current = null
      if (waiting) show(waiting.text)
      return
    }
    clearTimeout(timer.current)
    setMsg(null)
    if (hold) held.current = []
  }, [show])
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <ToastCtx.Provider value={show}>
      <DismissCtx.Provider value={dismiss}>
      {children}
      {msg && (
        <div key={msg.key} className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4">
          <div className="animate-rise pointer-events-auto flex items-center gap-4 rounded-full bg-ink px-5 py-3 text-sm font-bold text-bg shadow-xl">
            <span>{msg.text}</span>
            {msg.action && (
              <button className="font-black text-sage" onClick={() => { msg.action!.onClick(); setMsg(null) }}>
                {msg.action.label}
              </button>
            )}
          </div>
        </div>
      )}
      </DismissCtx.Provider>
    </ToastCtx.Provider>
  )
}
