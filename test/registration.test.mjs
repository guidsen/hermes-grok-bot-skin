import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPlugin, collectContributions } from './helpers/load-plugin.mjs'

test('the plugin registers a theme, two palette commands and the runtime', async () => {
  const { plugin } = await loadPlugin([])
  const areas = collectContributions(plugin).map(c => c.area)

  assert.equal(plugin.id, 'grok-chat-look')
  assert.equal(areas.filter(a => a === 'themes').length, 1)
  assert.equal(areas.filter(a => a === 'palette').length, 2)
  assert.equal(areas.filter(a => a === 'center').length, 1)
})

test('palette commands report their state and keep the palette open', async () => {
  const { plugin } = await loadPlugin([])
  for (const command of collectContributions(plugin).filter(c => c.area === 'palette' && c.data.detail)) {
    assert.equal(command.data.keepOpen, true)
    assert.equal(command.data.detailVariant, 'state')
    assert.equal(typeof command.data.detail(), 'string')
  }
})

test('chat width defaults to full, like Grok Bot, and persists a toggle', async () => {
  const { plugin } = await loadPlugin([])
  const storage = new Map()
  const width = collectContributions(plugin, storage).find(c => c.id === 'toggle-chat-width')

  assert.equal(width.data.detail(), 'Full')
  width.data.run()
  assert.equal(storage.get('chat-width'), 'centered')
  assert.equal(width.data.detail(), 'Centered')
  width.data.run()
  assert.equal(storage.get('chat-width'), 'full')
})

test('user messages are unpinned by default', async () => {
  const { plugin } = await loadPlugin([])
  const pinned = collectContributions(plugin).find(c => c.id === 'toggle-pinned-user-messages')
  assert.equal(pinned.data.detail(), 'Off')
})

test('the composer hint names the open bot, then the profile, then Hermes', async () => {
  const { internals } = await loadPlugin(['composerPlaceholderText'])
  const text = internals.composerPlaceholderText

  assert.equal(text('Research Assistant', 'research'), 'Message Research Assistant')
  assert.equal(text('', 'research'), 'Message research')
  assert.equal(text('  ', 'default'), 'Message Hermes')
  assert.equal(text(null, undefined), 'Message Hermes')
})

test('placeholder text is quoted safely for CSS content', async () => {
  const { internals } = await loadPlugin(['cssString'])
  assert.equal(internals.cssString('Bot "Q"\\x'), '"Bot \\"Q\\"\\\\x"')
})


test('the skin activates only for its own theme', async () => {
  const { internals } = await loadPlugin(['isGrokThemeActive'])
  assert.equal(internals.isGrokThemeActive('grok-chat'), true)
  assert.equal(internals.isGrokThemeActive('nous'), false)
  assert.equal(internals.isGrokThemeActive(null), false)
})
