import { Capacitor, registerPlugin } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

// The Android app is this same website inside a thin shell. These helpers talk to the shell for the few
// things a website can't do. In a browser (Chrome, a computer) they simply report "not the app".

/** True inside the Atomic Android app. */
export const isNativeApp = () => Capacitor.isNativePlatform()

interface AtomicNativePlugin {
  /** Opens the Clock app with an alarm filled in. days: 1 = Sunday ... 7 = Saturday; empty rings once. */
  setAlarm(o: { hour: number; minutes: number; message: string; days: number[] }): Promise<void>
  /** Opens the Calendar app's new-event screen, filled in. */
  addCalendarEvent(o: { title: string; startMillis: number; durationMinutes: number; rrule: string }): Promise<void>
}

export const AtomicNative = registerPlugin<AtomicNativePlugin>('AtomicNative')

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

/** Opens the phone's share sheet with a file (backup, picture). 'cancelled' when you close the sheet. */
export async function shareFileNative(file: File, opts: { title?: string; text?: string } = {}): Promise<'shared' | 'cancelled'> {
  const written = await Filesystem.writeFile({ path: file.name, data: await toBase64(file), directory: Directory.Cache })
  try {
    await Share.share({ title: opts.title, text: opts.text, files: [written.uri], dialogTitle: opts.title })
    return 'shared'
  } catch (e) {
    if (String((e as Error)?.message ?? e).toLowerCase().includes('cancel')) return 'cancelled'
    throw e
  }
}
