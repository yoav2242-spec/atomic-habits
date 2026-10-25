import { AnimatePresence, motion, type Transition } from 'motion/react'
import { createPortal } from 'react-dom'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { TIPS, type TipKey } from '../lib/tips'

/** The app's one spring: quick, with a soft clay-like overshoot. */
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 24, mass: 0.8 }
export const softSpring: Transition = { type: 'spring', stiffness: 220, damping: 22 }

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`clay rounded-[26px] p-4 ${className}`} style={style}>
      {children}
    </div>
  )
}

type Variant = 'primary' | 'lavender' | 'secondary' | 'ghost' | 'danger'
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

/** Button look, also used on links (a button inside a link doesn't tap reliably on phones). */
export function buttonClass(variant: Variant = 'primary', className = '') {
  const styles = {
    primary: 'btn-3d bg-sage text-on-pastel disabled:opacity-40',
    lavender: 'btn-3d bg-lavender text-on-pastel',
    secondary: 'clay-sm bouncy text-ink',
    ghost: 'bouncy text-muted',
    danger: 'btn-3d bg-rose text-on-pastel',
  }[variant]
  return `inline-flex min-h-12 items-center justify-center gap-2 text-center rounded-full px-5 py-3 text-[16px] font-extrabold ${styles} ${className}`
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={buttonClass(variant, className)} {...props} />
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-3 pt-1">
      <div>
        <h1 className="text-[30px] font-black leading-[1.05] tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="mt-2 text-[16px] font-semibold leading-snug text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 whitespace-nowrap">{action}</div>}
    </header>
  )
}

export function Field({ label, hint, tip, children }: { label: string; hint?: string; tip?: TipKey; children: ReactNode }) {
  return (
    <div className="block">
      <div className="mb-2 flex items-center gap-1.5 text-[16px] font-extrabold">
        {label}
        {tip && <InfoTip tip={tip} />}
      </div>
      {children}
      {hint && <span className="mt-1.5 block text-[14px] font-semibold leading-snug text-muted">{hint}</span>}
    </div>
  )
}

/** Options in a pressed-in tray; the chosen one is a puffy pill that slides over. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId()
  return (
    <div className="clay-in flex rounded-2xl p-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`relative min-h-11 flex-1 rounded-xl px-2 py-2 text-sm font-extrabold transition-colors ${value === o.value ? 'text-ink' : 'text-muted'}`}
        >
          {value === o.value && <motion.span layoutId={`seg-${id}`} transition={spring} className="clay-sm absolute inset-0 rounded-xl" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

const squish = { scaleX: 1.12, scaleY: 0.85 }

export function Stepper({ value, min, max, onChange, step = 1 }: { value: number; min: number; max: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div className="flex items-center gap-3">
      <motion.button whileTap={squish} transition={spring} type="button" className="clay-sm h-12 w-12 rounded-full text-xl font-black" onClick={() => onChange(Math.max(min, value - step))} aria-label="Less">−</motion.button>
      <motion.span key={value} initial={{ scale: 0.7, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className="min-w-12 text-center text-xl font-black tabular-nums">
        {value.toLocaleString()}
      </motion.span>
      <motion.button whileTap={squish} transition={spring} type="button" className="puffy h-12 w-12 rounded-full bg-sage text-xl font-black text-on-pastel" onClick={() => onChange(Math.min(max, value + step))} aria-label="More">+</motion.button>
    </div>
  )
}

/** A clay on/off switch. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-9 w-16 shrink-0 rounded-full p-1 transition-colors ${on ? 'puffy bg-sage' : 'clay-in'}`}>
      <motion.span layout transition={spring} className="clay-sm block h-7 w-7 rounded-full" style={{ marginLeft: on ? 'auto' : 0 }} />
    </button>
  )
}

/** Bottom sheet: springs up, and can be dragged down to close. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  // Drawn on <body>, so an animated screen around it can't trap it in a smaller box.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet"
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0d120f]/45 sm:items-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[30px] bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-12px_rgba(10,20,14,0.35)] sm:rounded-[30px]"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose() }}
            onClick={(e) => e.stopPropagation()}
          >
            <div aria-hidden className="mx-auto -mt-2 mb-5 h-1.5 w-10 rounded-full bg-muted/30" />
            {title && <h2 className="mb-3 text-[22px] font-black leading-tight tracking-[-0.01em]">{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
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
        className={`bouncy relative -m-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${className}`}
      >
        <span className="tray inline-flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-black text-muted">?</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={TIPS[tip].title}>
        <p className="mb-6 text-base font-semibold leading-relaxed">{TIPS[tip].body}</p>
        <Button className="w-full" onClick={() => setOpen(false)}>Got it</Button>
      </Modal>
    </>
  )
}

/** A clay donut: pressed-in track with a puffy colored arc that springs into place. */
export function ProgressRing({ value, size = 120, stroke = 12, color = 'var(--color-sage)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2 - 6
  const c = 2 * Math.PI * r
  return (
    <div className="clay relative shrink-0 rounded-full" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c * (1 - Math.min(1, value)) }} transition={softSpring}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

export function XPBar({ into, need, color = 'var(--color-lavender)' }: { into: number; need: number; color?: string }) {
  return (
    <div className="clay-in h-3 overflow-hidden rounded-full p-[2px]">
      <motion.div className="puffy h-full rounded-full" initial={false} animate={{ width: `${Math.max(4, (into / need) * 100)}%` }} transition={softSpring} style={{ background: color }} />
    </div>
  )
}

/** Tap-and-confirm modal used before deleting things. */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: string; action: () => void } | null>(null)
  const ask = (title: string, body: string, action: () => void) => setState({ title, body, action })
  const element = (
    <Modal open={!!state} onClose={() => setState(null)} title={state?.title ?? ''}>
      <p className="mb-5 font-semibold text-muted">{state?.body}</p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setState(null)}>Cancel</Button>
        <Button variant="danger" className="flex-1" onClick={() => { state?.action(); setState(null) }}>Yes</Button>
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
      <AnimatePresence>
        {msg && (
          <motion.div key={msg.key} className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4"
            initial={{ y: 40, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} transition={spring}>
            <div className="pointer-events-auto flex max-w-full items-center gap-4 rounded-full bg-ink py-2 pl-5 pr-2 text-sm font-bold text-bg shadow-[0_12px_30px_-10px_rgba(10,20,14,0.5)]">
              <span className="py-1.5">{msg.text}</span>
              {msg.action ? (
                <button className="min-h-11 rounded-full bg-sage px-4 font-black text-on-pastel" onClick={() => { msg.action!.onClick(); setMsg(null) }}>
                  {msg.action.label}
                </button>
              ) : <span className="w-2" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </DismissCtx.Provider>
    </ToastCtx.Provider>
  )
}
