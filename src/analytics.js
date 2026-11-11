const dressUpMutations = new Set([
  'SAVE_GENDER',
  'SAVE_HAIR_COLOR',
  'SAVE_HEAD',
  'SAVE_BODY_PALETTE',
  'SAVE_JOB',
  'SAVE_HEADGEAR_TOP',
  'SAVE_HEADGEAR_MID',
  'SAVE_HEADGEAR_BOTTOM',
  'SAVE_GARMENT',
  'SAVE_EFFECT_HEADGEAR_ITEM',
  'SAVE_OUTFIT',
  'SAVE_CASH_MOUNT',
  'SAVE_REGULAR_MOUNT'
])

export function initializeAnalytics({ measurementId, store, browser = window }) {
  if (!/^G-[A-Z0-9]+$/.test(measurementId || '')) return false

  browser.dataLayer = browser.dataLayer || []
  browser.gtag = browser.gtag || function () {
    browser.dataLayer.push(arguments)
  }
  browser.gtag('js', new Date())
  browser.gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  })

  const script = browser.document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  browser.document.head.appendChild(script)

  const storageKey = `ga4:${measurementId}:dress_up_session`
  const trackedSessions = new Set()
  let pendingSession = false

  store.subscribe((mutation) => {
    if (!dressUpMutations.has(mutation.type) || pendingSession) return

    pendingSession = true
    browser.gtag('get', measurementId, 'session_id', (sessionId) => {
      pendingSession = false
      if (sessionId === undefined || sessionId === null) return

      const session = String(sessionId)
      if (trackedSessions.has(session)) return

      try {
        if (browser.localStorage.getItem(storageKey) === session) return
      } catch {}

      browser.gtag('event', 'dress_up_started', {
        session_id: sessionId,
        interaction_type: mutation.type
      })
      trackedSessions.add(session)

      try {
        browser.localStorage.setItem(storageKey, session)
      } catch {}
    })
  })

  return true
}