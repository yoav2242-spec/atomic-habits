import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RecapStory } from '../components/RecapStory'
import { buttonClass } from '../components/ui'
import { bigCelebration } from '../lib/celebrate'
import { decodeRecap } from '../lib/recap'

/** What a friend sees when they open a shared recap link: the recap, animated, then an invitation to start. */
export default function SharedRecap() {
  const { data: packed = '' } = useParams()
  const data = decodeRecap(packed)

  useEffect(() => {
    scrollTo(0, 0)
    if (!data) return
    const t = setTimeout(bigCelebration, 600)
    return () => clearTimeout(t)
  }, [packed]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <p className="mb-4 text-[17px] font-black text-sage-deep">Atomic</p>
      {data ? (
        <>
          <RecapStory data={data} />
          <div className="clay mt-2 rounded-[28px] p-6 text-center">
            <h2 className="text-[24px] font-black leading-tight">Start your own</h2>
            <p className="mb-5 mt-2 text-[17px] font-semibold leading-snug text-muted">Atomic is a free habit tracker based on Atomic Habits. Your habits stay on your phone.</p>
            <Link to="/" className={buttonClass('primary', 'w-full text-[18px]')}>Make my first habit</Link>
          </div>
        </>
      ) : (
        <div className="clay rounded-[28px] p-6 text-center">
          <h1 className="text-[24px] font-black">This link didn't open</h1>
          <p className="mb-5 mt-2 text-[17px] font-semibold text-muted">It may have been cut short when it was sent. Ask for it again.</p>
          <Link to="/" className={buttonClass('primary', 'w-full')}>Open Atomic</Link>
        </div>
      )}
    </div>
  )
}
