import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RecapStory } from '../components/RecapStory'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BackButton, Button, Modal, useToast } from '../components/ui'
import { db } from '../lib/db'
import { addDays, formatDay } from '../lib/dates'
import { usePrefs } from '../lib/prefs'
import { useProgress } from '../lib/progress'
import { buildRecap, type RecapData } from '../lib/recap'
import { drawRecapImage, shareRecapImage } from '../lib/recapImage'

/** "Share" turns the recap into a picture, previews it, then sends it with a link that opens it animated in the app. */
function ShareRecap({ data }: { data: RecapData }) {
  const toast = useToast()
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url) }, [image])

  const open = async () => {
    setBusy(true)
    try {
      const blob = await drawRecapImage(data)
      setImage({ blob, url: URL.createObjectURL(blob) })
    } catch {
      toast("Couldn't make the picture")
    } finally {
      setBusy(false)
    }
  }
  const send = async () => {
    if (!image) return
    const result = await shareRecapImage(data, image.blob)
    if (result === 'saved') toast('Picture saved and link copied')
    if (result !== 'cancelled') setImage(null)
  }

  return (
    <>
      <Button variant="lavender" className="mt-2 w-full text-[18px]" disabled={busy} onClick={open}>
        {busy ? 'Making your picture…' : `Share my ${data.kind}`}
      </Button>
      <Modal open={!!image} onClose={() => setImage(null)} title={`Share your ${data.kind}`}>
        {image && <img src={image.url} alt={`Your ${data.title} recap as a picture`} className="puffy mb-4 w-full rounded-[22px]" />}
        <p className="mb-4 text-[15px] font-semibold leading-snug text-muted">
          Friends get this picture and a link that plays your recap, animated, in Atomic. It shows these numbers and habit names, nothing else.
        </p>
        <Button className="w-full text-[18px]" onClick={send}>Share</Button>
      </Modal>
    </>
  )
}

function Header({ onPrev, onNext, nextDisabled, label }: { onPrev: () => void; onNext: () => void; nextDisabled: boolean; label: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <BackButton />
      <div className="flex gap-1.5">
        <button onClick={onPrev} className="clay-sm bouncy flex h-11 w-11 items-center justify-center rounded-full" aria-label={`Previous ${label}`}><ChevronLeft size={22} strokeWidth={2.4} /></button>
        <button onClick={onNext} disabled={nextDisabled} className="clay-sm bouncy flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30" aria-label={`Next ${label}`}><ChevronRight size={22} strokeWidth={2.4} /></button>
      </div>
    </div>
  )
}

/** A Wrapped-style look back at one month. */
export default function Recap() {
  const { ym = '' } = useParams()
  const progress = useProgress()
  const prefs = usePrefs()
  const navigate = useNavigate()

  useEffect(() => {
    if (ym) db.meta.put({ key: `recap_seen:${ym}`, value: '1' })
  }, [ym])

  const first = `${ym}-01`
  const last = addDays(`${addDays(first, 32).slice(0, 7)}-01`, -1)
  const data = useMemo(() => (progress ? buildRecap(progress, 'month', first, last, formatDay(first, { month: 'long', year: 'numeric' })) : null), [progress, first, last])
  if (!progress || !data) return null

  const prevYm = addDays(first, -1).slice(0, 7)
  const nextYm = addDays(last, 1).slice(0, 7)
  return (
    <div>
      <Header label="month" onPrev={() => navigate(`/recap/${prevYm}`, { replace: true })} onNext={() => navigate(`/recap/${nextYm}`, { replace: true })} nextDisabled={nextYm > progress.today.slice(0, 7)} />
      <RecapStory key={ym} data={data} name={prefs.name || undefined} />
      {data.checkIns > 0 && <ShareRecap data={data} />}
    </div>
  )
}

/** The whole year, as one recap. A first version, reachable from the test workspace for now. */
export function YearRecap() {
  const { y = '' } = useParams()
  const progress = useProgress()
  const prefs = usePrefs()
  const navigate = useNavigate()
  const data = useMemo(() => (progress ? buildRecap(progress, 'year', `${y}-01-01`, `${y}-12-31`, y) : null), [progress, y])
  if (!progress || !data) return null
  return (
    <div>
      <Header label="year" onPrev={() => navigate(`/recap/year/${Number(y) - 1}`, { replace: true })} onNext={() => navigate(`/recap/year/${Number(y) + 1}`, { replace: true })} nextDisabled={Number(y) >= Number(progress.today.slice(0, 4))} />
      <RecapStory key={y} data={data} name={prefs.name || undefined} />
      {data.checkIns > 0 && <ShareRecap data={data} />}
    </div>
  )
}
