import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/analytics.js', import.meta.url), 'utf8')
const { initializeAnalytics } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

function fixture(storage = new Map()) {
  const scripts = []
  const subscribers = []
  const browser = {
    document: {
      createElement: () => ({}),
      head: { appendChild: (script) => scripts.push(script) }
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    }
  }
  const store = { subscribe: (callback) => subscribers.push(callback) }
  return {
    browser,
    store,
    scripts,
    mutate: (type) => subscribers.forEach((callback) => callback({ type })),
    commands: () => (browser.dataLayer || []).map((command) => Array.from(command)),
    events: () => (browser.dataLayer || []).filter((command) => command[0] === 'event'),
    resolveSession(sessionId) {
      const request = this.commands().filter((command) => command[0] === 'get').at(-1)
      assert.ok(request, 'A GA session ID should be requested')
      request[3](sessionId)
    }
  }
}

function start(context, measurementId = 'G-TEST123') {
  return initializeAnalytics({ measurementId, store: context.store, browser: context.browser })
}

test('missing or invalid ID leaves analytics completely disabled', () => {
  for (const id of [undefined, '', 'not-a-measurement-id']) {
    const context = fixture()
    assert.equal(start(context, id === undefined ? '' : id), false)
    assert.equal(context.scripts.length, 0)
    assert.deepEqual(context.commands(), [])
  }
})

test('initializes one automatic page view configuration without a play event', () => {
  const context = fixture()
  assert.equal(start(context), true)
  assert.equal(context.scripts.length, 1)
  assert.equal(context.scripts[0].async, true)
  assert.equal(context.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-TEST123')
  assert.equal(context.commands().filter((command) => command[0] === 'config').length, 1)
  assert.equal(context.events().length, 0)
})

test('restoring, rotating, resetting and item metadata do not start a play', () => {
  const context = fixture()
  start(context)
  for (const type of ['SAVE_CHARACTER', 'SAVE_CHARACTER_POSITION', 'SAVE_CHARACTER_HEAD', 'SAVE_ACTION', 'RESET_CHARACTER', 'SAVE_HEADGEAR_TOP_ITEM']) {
    context.mutate(type)
  }
  assert.equal(context.commands().filter((command) => command[0] === 'get').length, 0)
  assert.equal(context.events().length, 0)
})

test('first dress-up action emits once even with pending and subsequent changes', () => {
  const context = fixture()
  start(context)
  context.mutate('SAVE_HEADGEAR_TOP')
  context.mutate('SAVE_HEADGEAR_MID')
  assert.equal(context.commands().filter((command) => command[0] === 'get').length, 1)
  context.resolveSession(123)
  context.mutate('SAVE_JOB')
  context.resolveSession(123)
  assert.equal(context.events().length, 1)
  assert.equal(context.events()[0][1], 'dress_up_started')
  assert.deepEqual(context.events()[0][2], { session_id: 123, interaction_type: 'SAVE_HEADGEAR_TOP' })
})

test('reload or another tab in the same GA session does not emit again', () => {
  const storage = new Map()
  for (let page = 0; page < 2; page++) {
    const context = fixture(storage)
    start(context)
    context.mutate('SAVE_HEAD')
    context.resolveSession(123)
    assert.equal(context.events().length, page === 0 ? 1 : 0)
  }
})

test('a new GA session can start another play', () => {
  const context = fixture()
  start(context)
  context.mutate('SAVE_JOB')
  context.resolveSession(123)
  context.mutate('SAVE_OUTFIT')
  context.resolveSession(456)
  assert.equal(context.events().length, 2)
})

test('blocked storage falls back to in-memory deduplication', () => {
  const context = fixture()
  Object.defineProperty(context.browser, 'localStorage', {
    get() { throw new Error('Storage blocked') }
  })
  start(context)
  context.mutate('SAVE_HAIR_COLOR')
  context.resolveSession(123)
  context.mutate('SAVE_BODY_PALETTE')
  context.resolveSession(123)
  assert.equal(context.events().length, 1)
})

test('missing session ID or a blocked script never emits a play', () => {
  const context = fixture()
  start(context)
  context.mutate('SAVE_GENDER')
  context.resolveSession(undefined)
  context.mutate('SAVE_GARMENT')
  assert.equal(context.events().length, 0)
})