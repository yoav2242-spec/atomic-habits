import { formatDay, weekday } from './dates'
import { dateOf, dayRates, recapLink, type RecapData } from './recap'

// Draws the recap as a picture (a 1080px-wide card) so a shared month looks like the app, not a line of text.

const C = {
  ground: '#e7ebe7', card: '#f5f7f4', soft: '#dde2dd', ink: '#1f2420', muted: '#5b655e',
  sage: [140, 196, 166], well: [221, 226, 221], flame: '#b0531f', level: '#6457a6',
}
const FONT = "'Nunito Variable', ui-rounded, system-ui, sans-serif"
const W = 1080
const PAD = 110 // left edge of the text inside the card

const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`

function font(ctx: CanvasRenderingContext2D, size: number, weight = 900) {
  ctx.font = `${weight} ${size}px ${FONT}`
}

/** A clay pebble: a soft blob with a highlight on top, pressed in when nothing was done. */
function pebble(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rate: number | null) {
  const r = Math.min(w, h) / 2
  if (rate === null) {
    ctx.fillStyle = 'rgba(31,36,32,0.05)'
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
    return
  }
  ctx.save()
  if (rate > 0) {
    ctx.shadowColor = 'rgba(60,90,70,0.28)'
    ctx.shadowBlur = h * 0.35
    ctx.shadowOffsetY = h * 0.12
  }
  ctx.fillStyle = rate > 0 ? mix(C.well, C.sage, 0.35 + rate * 0.65) : mix(C.well, C.well, 0)
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill()
  ctx.restore()
  // Highlight (raised) or inner shade (pressed in).
  ctx.save()
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip()
  ctx.fillStyle = rate > 0 ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.05)'
  ctx.beginPath(); ctx.ellipse(x + w * 0.38, y + h * (rate > 0 ? 0.22 : 0.05), w * 0.34, h * 0.22, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

/** The month as a calendar of pebbles, Monday first. Returns the height used. */
function monthGrid(ctx: CanvasRenderingContext2D, data: RecapData, top: number, width: number) {
  const rates = dayRates(data)
  const offset = (weekday(data.start) + 6) % 7
  const gap = 16
  const pw = (width - gap * 6) / 7
  const ph = pw * 0.62
  const rows = Math.ceil((offset + rates.length) / 7)
  rates.forEach((r, i) => {
    const slot = offset + i
    pebble(ctx, PAD + (slot % 7) * (pw + gap), top + Math.floor(slot / 7) * (ph + gap), pw, ph, r)
  })
  return rows * (ph + gap) - gap
}

/** The year as twelve little months of dots. Returns the height used. */
function yearGrid(ctx: CanvasRenderingContext2D, data: RecapData, top: number, width: number) {
  const rates = dayRates(data)
  const cols = 4
  const gapX = 34
  const bw = (width - gapX * (cols - 1)) / cols
  const cell = bw / 7
  const blockH = 40 + cell * 6
  for (let m = 0; m < 12; m++) {
    const bx = PAD + (m % cols) * (bw + gapX)
    const by = top + Math.floor(m / cols) * (blockH + 26)
    const first = `${data.start.slice(0, 4)}-${String(m + 1).padStart(2, '0')}-01`
    font(ctx, 26, 800)
    ctx.fillStyle = C.muted
    ctx.fillText(formatDay(first, { month: 'short' }), bx, by + 24)
    const offset = (weekday(first) + 6) % 7
    rates.forEach((r, i) => {
      const d = dateOf(data, i)
      if (d.slice(5, 7) !== first.slice(5, 7)) return
      const slot = offset + Number(d.slice(8)) - 1
      pebble(ctx, bx + (slot % 7) * cell + 2, by + 38 + Math.floor(slot / 7) * cell + 2, cell - 4, cell - 4, r)
    })
  }
  return 3 * (blockH + 26) - 26
}

export async function drawRecapImage(data: RecapData): Promise<Blob> {
  await Promise.all([document.fonts.load(`900 40px 'Nunito Variable'`), document.fonts.load(`700 40px 'Nunito Variable'`)]).catch(() => {})
  const inner = W - PAD * 2
  const gridH = data.kind === 'month' ? Math.ceil(((weekday(data.start) + 6) % 7 + data.days.length) / 7) * ((inner - 96) / 7 * 0.62 + 16) : 3 * (40 + (inner - 102) / 4 / 7 * 6 + 26)
  const H = Math.round(Math.max(1350, 640 + gridH + 400))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  // Ground and the raised card.
  ctx.fillStyle = C.ground
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.shadowColor = 'rgba(60,80,65,0.25)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 24
  ctx.fillStyle = C.card
  ctx.beginPath(); ctx.roundRect(56, 56, W - 112, H - 112, 64); ctx.fill()
  ctx.restore()

  let y = 196
  font(ctx, 36, 800)
  ctx.fillStyle = C.muted
  ctx.fillText(data.kind === 'month' ? 'My month in Atomic' : 'My year in Atomic', PAD, y)
  y += 96
  font(ctx, 92)
  ctx.fillStyle = C.ink
  ctx.fillText(data.title, PAD, y)

  // The big number.
  y += 210
  font(ctx, 200)
  const n = data.checkIns.toLocaleString()
  ctx.fillText(n, PAD - 6, y)
  const nw = ctx.measureText(n).width
  font(ctx, 46, 800)
  ctx.fillStyle = C.muted
  ctx.fillText('habits done', PAD + nw + 24, y - 14)

  y += 70
  y += data.kind === 'month' ? monthGrid(ctx, data, y, inner) : yearGrid(ctx, data, y, inner)

  // Three numbers in a row.
  y += 120
  const stats: [string, string, string?][] = [
    [String(data.perfect), data.perfect === 1 ? 'perfect day' : 'perfect days'],
    [`+${data.points.toLocaleString()}`, 'points', C.level],
    [data.run ? String(data.run.days) : '–', 'days in a row', C.flame],
  ]
  stats.forEach(([value, label, color], i) => {
    const x = PAD + i * (inner / 3)
    // Shrink big numbers so they never run into the next column.
    let size = 72
    font(ctx, size)
    while (size > 40 && ctx.measureText(value).width > inner / 3 - 28) font(ctx, (size -= 4))
    ctx.fillStyle = color ?? C.ink
    ctx.fillText(value, x, y)
    font(ctx, 32, 800)
    ctx.fillStyle = C.muted
    ctx.fillText(label, x, y + 46)
  })

  if (data.star) {
    y += 130
    font(ctx, 38, 800)
    ctx.fillStyle = C.ink
    const line = `Star habit: ${data.star.emoji} ${data.star.name} · ${Math.round(data.star.rate * 100)}%`
    ctx.fillText(line.length > 44 ? `${line.slice(0, 43)}…` : line, PAD, y)
  }

  font(ctx, 30, 700)
  ctx.fillStyle = C.muted
  ctx.fillText('Made with Atomic · open the link to watch it come alive', PAD, H - 108)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the picture'))), 'image/png'))
}

/** Shares the picture with a link that opens the animated recap in the app. Falls back to saving the picture. */
export async function shareRecapImage(data: RecapData, blob: Blob): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], `atomic-${data.title.toLowerCase().replace(/\s+/g, '-')}.png`, { type: 'image/png' })
  const url = recapLink(data)
  const text = `My ${data.title} in Atomic, small habits adding up. See it move: ${url}`
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share({ text, url })
      return 'shared'
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
  }
  // No share sheet (a computer): save the picture and copy the link.
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  await navigator.clipboard?.writeText(url).catch(() => {})
  return 'saved'
}
