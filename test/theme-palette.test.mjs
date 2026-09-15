import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPlugin } from './helpers/load-plugin.mjs'

const HEX = /^#[0-9A-F]{6}$/

test('the bundled theme ships a complete light and dark palette', async () => {
  const { internals } = await loadPlugin(['GROK_THEME'])
  const theme = internals.GROK_THEME

  assert.equal(theme.name, 'grok-chat')

  const required = [
    'background', 'foreground', 'card', 'cardForeground', 'muted', 'mutedForeground',
    'popover', 'popoverForeground', 'primary', 'primaryForeground', 'secondary',
    'secondaryForeground', 'accent', 'accentForeground', 'border', 'input', 'ring',
    'destructive', 'destructiveForeground', 'sidebarBackground', 'sidebarBorder',
    'userBubble', 'userBubbleBorder', 'composerRing'
  ]

  for (const key of required) {
    assert.ok(HEX.test(theme.colors[key]), `light ${key} must be an uppercase hex color`)
    assert.ok(HEX.test(theme.darkColors[key]), `dark ${key} must be an uppercase hex color`)
  }
})

test('light mode matches the Grok Bot screenshots', async () => {
  const { internals } = await loadPlugin(['GROK_THEME'])
  const { colors } = internals.GROK_THEME

  assert.equal(colors.background, '#FFFFFF', 'chat surface is white')
  assert.equal(colors.card, '#FFFFFF', 'composer is white')
  assert.equal(colors.muted, '#F0F0F0', 'assistant pills are light gray')
  assert.equal(colors.userBubble, '#000000', 'user pills are black')
  assert.equal(colors.primaryForeground, '#FFFFFF', 'user pill text is white')
  assert.notEqual(colors.sidebarBackground, colors.background, 'sidebar is tinted, not flat')
})

test('the prompt pill is inverted in light mode and gray in dark mode', async () => {
  const { internals } = await loadPlugin(['GROK_THEME'])
  const { colors, darkColors } = internals.GROK_THEME

  // Light: black pill with primaryForeground text, so they must agree.
  assert.equal(colors.userBubble, colors.primary)
  // Dark: a mid-gray pill with light foreground text, and a #2F2F2F composer.
  assert.equal(darkColors.userBubble, '#5F5F5F')
  assert.equal(darkColors.card, '#2F2F2F')
})

test('typography uses the macOS system stack', async () => {
  const { internals } = await loadPlugin(['GROK_THEME'])
  assert.match(internals.GROK_THEME.typography.fontSans, /^-apple-system,/)
})
