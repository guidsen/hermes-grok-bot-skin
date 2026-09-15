import test from 'node:test'
import assert from 'node:assert/strict'
import { loadPlugin, parseRules, findRule } from './helpers/load-plugin.mjs'

const S = "html[data-grok-chat-look='true']"
const css = async () => (await loadPlugin(['CSS'])).internals.CSS
const rule = async (...selectors) => findRule(parseRules(await css()), ...selectors)

test('every rule is scoped behind the skin root attribute', async () => {
  for (const { selectors } of parseRules(await css())) {
    for (const selector of selectors) {
      assert.ok(selector.startsWith(S), `unscoped selector leaks outside the skin: ${selector}`)
    }
  }
})

test('colors resolve through tokens; only semantic status colors are literal', async () => {
  for (const { body } of parseRules(await css())) {
    for (const declaration of body.split(';')) {
      if (!/#[0-9a-fA-F]{3,8}\b/.test(declaration)) continue
      if (/url\("data:/.test(declaration)) continue
      assert.match(declaration.trim(), /^--grok-(status-|link:|color-add-button:)/, `hardcoded color outside an allowed token: ${declaration.trim()}`)
    }
  }
})

test('each prose part of a reply is a gray pill', async () => {
  const body = await rule(`${S} [data-slot='aui_assistant-message-content'] > .aui-md`)
  assert.match(body, /background: var\(--grok-color-assistant-pill\)/)
  assert.match(body, /border-radius: var\(--grok-radius-pill\)/)
  assert.match(body, /width: fit-content/)
})

test('the user pill is a solid inverted fill', async () => {
  const body = await rule(`${S} [data-slot='aui_user-message-root'] .composer-human-message`)
  assert.match(body, /background: var\(--grok-color-user-pill\)/)
  assert.match(body, /color: var\(--grok-color-user-pill-text\)/)
  assert.match(body, /border: 0 !important/)
})

test('the bundled theme reads the unblended seeds for pills and composer', async () => {
  const body = await rule(`${S}[data-hermes-theme='grok-chat']`)
  assert.match(body, /--grok-color-elevated: var\(--theme-card-seed\)/)
  assert.match(body, /--grok-color-user-pill: var\(--theme-bubble-seed\)/)
  assert.match(body, /--grok-color-assistant-pill: var\(--dt-muted\)/)
})

test('the composer fill stays white in both scroll states', async () => {
  const body = await rule(
    `${S} [data-slot='composer-root']`,
    `${S} [data-slot='composer-root'][data-thread-scrolled-up]`
  )
  assert.match(body, /--composer-fill: var\(--grok-color-composer\)/)
})

test('message actions use 18px icons on 28px rounded targets with a hover fill', async () => {
  const source = await css()
  const target = await rule(
    `${S} [data-slot='aui_msg-actions'] button`,
    `${S} button[data-slot='aui_msg-reactions']`
  )
  assert.match(target, /width: 28px/)
  assert.match(target, /border-radius: var\(--grok-radius-control\)/)
  assert.match(source, /svg \{\s*width: 18px !important;\s*height: 18px/)
  assert.match(source, /button:hover,[\s\S]*?background: var\(--grok-color-hover-soft\)/)
})

test('the empty reaction slot still hides until the message is hovered', async () => {
  const target = await rule(
    `${S} [data-slot='aui_msg-actions'] button`,
    `${S} button[data-slot='aui_msg-reactions']`
  )
  assert.doesNotMatch(target, /opacity/, 'a shared opacity would pin the empty slot visible')
})

test('tooltips are one rounded bubble, even when they wrap', async () => {
  const body = await rule(`${S} [data-slot='tooltip-content'] > span`)
  assert.match(body, /border-radius: var\(--grok-radius-control\)/)
  assert.match(body, /display: inline-block !important/)
  assert.match(body, /box-decoration-break: slice !important/)
})

test('the busy dot is drawn only while the bot row carries a running status', async () => {
  const source = await css()
  const busy = parseRules(source).find(({ selectors }) =>
    selectors.some(selector => selector.endsWith('> div:first-child::after'))
  )

  assert.ok(busy, 'expected an avatar dot rule')
  for (const selector of busy.selectors) {
    assert.match(selector, /button\[data-roster-key\]:has\(\[role='status'\]:is\(\[aria-label='Session running'\]/)
  }
  assert.match(busy.body, /background: var\(--grok-status-busy\)/)
  assert.match(busy.body, /box-shadow: 0 0 0 2px var\(--grok-row-ring\)/)
})

test('bot rows follow Grok Bot geometry', async () => {
  const body = await rule(`${S} button[data-roster-key]`)
  assert.match(body, /min-height: 46px/)
  assert.match(body, /gap: 12px !important/)
  assert.match(body, /border-radius: var\(--grok-radius-row\)/)
  assert.match(await css(), /--grok-radius-row: 10px/)
})

test('streaming rules never key off the code-card attribute', async () => {
  assert.doesNotMatch(await css(), /\[data-streaming='true'\]/)
})

test('prose pills use 11px padding on every side', async () => {
  const body = await rule(`${S} [data-slot='aui_assistant-message-content'] > .aui-md`)
  assert.match(body, /padding: 11px 11px !important/)
})

test('submenus and popovers get the same rounded card as menus', async () => {
  const source = await css()
  for (const slot of ['dropdown-menu-sub-content', 'context-menu-sub-content', 'popover-content']) {
    assert.ok(
      parseRules(source).some(({ selectors, body }) =>
        selectors.includes(`${S} [data-slot='${slot}']`) && /border-radius: 14px/.test(body)
      ),
      `${slot} must be rounded`
    )
  }
})

test('menu rows hover in neutral gray with rounded corners', async () => {
  const rules = parseRules(await css())
  const hover = rules.find(({ selectors }) => selectors.includes(`${S} [data-slot='dropdown-menu-item'][data-highlighted]`))
  assert.ok(hover, 'expected a highlighted-row rule')
  assert.match(hover.body, /background: var\(--grok-color-hover-soft\)/)
  assert.ok(
    rules.some(({ selectors }) => selectors.includes(`${S} [data-slot='dropdown-menu-content'][class~='p-0'] [data-slot='dropdown-menu-item']`)),
    'edge-to-edge menus must inset their rows so the rounded fill shows'
  )
})

test('the theme ring is neutral so Hermes does not tint hovers blue', async () => {
  const { internals } = await loadPlugin(['GROK_THEME'])
  for (const palette of [internals.GROK_THEME.colors, internals.GROK_THEME.darkColors]) {
    const [r, g, b] = palette.ring.match(/[0-9A-F]{2}/g).map(hex => parseInt(hex, 16))
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 8, `ring ${palette.ring} must be gray`)
  }
})

test('sidebar search fills its row', async () => {
  const body = parseRules(await css()).find(({ selectors }) => selectors.some(s => s.includes('div:has(> input:is('))).body
  assert.match(body, /width: 100% !important/)
  assert.match(body, /opacity: 1 !important/)
})

test('sidebar search never grows along a vertical stack', async () => {
  const body = parseRules(await css()).find(({ selectors }) => selectors.some(s => s.includes('div:has(> input:is('))).body
  assert.doesNotMatch(body, /flex: 1/, 'flex-grow stretches the field down a column parent')
})

test('session rows hide uncolored dots and move colored or live ones to the end', async () => {
  const rules = parseRules(await css())
  const hidden = rules.find(({ selectors }) => selectors.some(s => s.includes(":not([style*='background-color'])") && s.endsWith("'Draft — nothing sent yet'])")))
  assert.ok(hidden, 'expected a rule hiding quiet dots')
  assert.match(hidden.body, /display: none/)

  const moved = rules.find(({ selectors, body }) => /order: 3/.test(body) && selectors[0].includes('row-hover'))
  assert.ok(moved, 'expected a rule moving the dot cell to the row end')
  assert.ok(moved.selectors[0].includes("[style*='background-color'], [role='status']"))
  assert.ok(moved.selectors[0].includes('[data-reorder-handle]'), 'drag handles must travel with the dot')
})

test('session rows that trigger a context menu get a 0.25rem bottom margin', async () => {
  const body = await rule(`${S} [data-slot='sidebar'] .row-hover[data-slot='context-menu-trigger']`)
  assert.match(body, /margin-bottom: 0\.25rem !important/)
})

test('only rotating composer hints are replaced, never status hints', async () => {
  const { internals } = await loadPlugin(['CSS', 'ROTATING_PLACEHOLDERS'])
  const target = parseRules(internals.CSS).find(({ body }) => body.includes('--grok-composer-placeholder'))
  assert.ok(target, 'expected the placeholder override rule')

  for (const hint of ['Adjust or continue', 'Ask anything', 'Send follow-up']) {
    assert.ok(target.selectors[0].includes(`[data-placeholder="${hint}"]`), `${hint} should be replaced`)
  }
  for (const status of ['Starting Hermes...', 'Reconnecting to Hermes…']) {
    assert.ok(!target.selectors[0].includes(status), `${status} carries state and must stay`)
  }
  assert.match(target.body, /content: var\(--grok-composer-placeholder, attr\(data-placeholder\)\)/)
})

test('rounded utilities are scaled up app-wide', async () => {
  const body = await rule(S)
  assert.match(body, /--radius-scalar: 0\.8/)
})

test('the + and its grid area match the primary control size', async () => {
  const size = /width: var\(--composer-control-primary-size, var\(--composer-control-size\)\) !important;\s*height: var\(--composer-control-primary-size, var\(--composer-control-size\)\)/
  assert.match(await rule(`${S} [data-slot='composer-surface'] button:has(> i.codicon-add)`), size)
  assert.match(await rule(`${S} [data-slot='composer-surface'] [class*='[grid-area:menu]']`), size)
  assert.match(await rule(`${S} [data-slot='composer-surface'] [class*='[grid-area:menu]']`), /--tw-translate-y: 0 !important/)
  assert.match(await rule(`${S} [data-slot='composer-surface'] [class*='[grid-area:input]']`), /margin-left: 0\.2rem/)
})

test('the sessions sidebar search is 34px tall with no wrapper inset', async () => {
  const rules = parseRules(await css())
  const field = rules.find(({ selectors }) => selectors[0].startsWith(`${S} [data-slot='sidebar-content'] div:has(> input`))
  assert.match(field.body, /height: 34px !important;\s*max-height: 34px/)
  const wrapper = rules.find(({ selectors }) => selectors[0].includes("div[class~='px-2']:has(> div > input"))
  assert.match(wrapper.body, /padding-inline: 0 !important/)
})

test('the sessions list drops its reserved gutter and nested scrollbar widths', async () => {
  const source = await css()
  assert.match(await rule(`${S} [data-slot='sidebar-content'] [data-sessions-mode]`), /scrollbar-gutter: auto !important/)
  const widths = parseRules(source).find(({ body }) => /scrollbar-width: none/.test(body))
  assert.ok(widths.selectors.some(s => s.endsWith(":is(.scrollbar-fade, [class*='overflow-y-auto'])")))
})

test('the composer fade has no minimum height', async () => {
  assert.match(await rule(`${S} [data-slot='composer-fade']`), /min-height: 0 !important/)
})

test('section labels drop the dither marker and render in sentence case', async () => {
  const rules = parseRules(await css())
  const label = "span:has(> span.dither[aria-hidden='true'] + span[class~='truncate'])"
  assert.match(await rule(`${S} ${label} > .dither`), /display: none/)
  const text = await rule(`${S} ${label}`)
  assert.match(text, /text-transform: none/)
  assert.match(text, /letter-spacing: normal/)
  assert.ok(!rules.some(({ selectors }) => selectors.includes(`${S} .dither`)), 'must not hide every .dither, loading indicators use it too')
})


test('date headings in the session list lose their hairline rule', async () => {
  const body = await rule(`${S} [data-slot='sidebar-group-content'] [class*='bg-(--ui-stroke-tertiary)']`)
  assert.match(body, /display: none !important/)
})

test('session row trailing wrappers are centered without touching classed spans', async () => {
  const body = await rule(`${S} [data-slot='sidebar-group-content'] [data-slot='context-menu-trigger'] [data-row-actions] > span:not([class])`)
  assert.match(body, /display: flex !important;\s*align-items: center !important/)
})

test('labels that follow their own icon get one spacing step of left padding', async () => {
  const body = await rule(`${S} span:has(> span.dither[aria-hidden='true'] + span[class~='truncate']):not(:first-child)`)
  assert.match(body, /padding-left: calc\(var\(--spacing, 0\.25rem\) \* 1\) !important/)
})

test('the last row of a group drops its bottom margin', async () => {
  const body = await rule(
    `${S} [data-slot='sidebar'] .row-hover[data-slot='context-menu-trigger']:last-child:not(:only-child)`,
    `${S} [data-slot='sidebar'] [data-slot='sidebar-group-content'] > .row-hover[data-slot='context-menu-trigger']:only-child`
  )
  assert.match(body, /margin-bottom: 0 !important/)
})

test('sessions group content has no bottom padding, but the group keeps its own', async () => {
  const shared = await rule(`${S} [data-slot='sidebar-content'] [data-sessions-mode] :is([data-slot='sidebar-group'], [data-slot='sidebar-group-content'])`)
  assert.doesNotMatch(shared, /padding-bottom/)
  const content = await rule(`${S} [data-slot='sidebar-content'] [data-sessions-mode] [data-slot='sidebar-group-content']`)
  assert.match(content, /padding-bottom: 0 !important/)
})

test('selected sidebar rows keep Hermes’ own selection fill', async () => {
  const body = await rule(
    `${S} [data-slot='sidebar'] .row-hover[class*='ui-row-active-background']`,
    `${S} [data-slot='sidebar'] [data-active='true']`,
    `${S} [data-slot='sidebar'] [aria-current='true']`
  )
  assert.doesNotMatch(body, /background/)
  assert.match(body, /outline: 0 !important/)
})

test('the stacked composer input gets 0.8 spacing steps of left padding', async () => {
  const body = await rule(`${S} [data-slot='composer-surface'] [class*='"input_input"_"menu_controls"'] [data-slot='composer-rich-input']`)
  assert.match(body, /padding-left: calc\(var\(--spacing, 0\.25rem\) \* 0\.8\) !important/)
})

test('the thread keeps Hermes’ own side padding', async () => {
  const touchesPadding = parseRules(await css()).some(({ selectors, body }) =>
    selectors.includes(`${S} [data-slot='aui_thread-content']`) && /padding-inline/.test(body)
  )
  assert.equal(touchesPadding, false)
})

test('section label text gets clip room without changing its height', async () => {
  const body = await rule(`${S} span:has(> span.dither[aria-hidden='true'] + span[class~='truncate']) > span[class~='truncate']`)
  assert.match(body, /padding-block: 0\.2em !important;\s*margin-block: -0\.2em !important/)
})

test('prompt hover actions sit below the bubble instead of inside it', async () => {
  const body = await rule(`${S} [data-slot='aui_user-bubble-actions'] .composer-human-message ~ div[class~='absolute'][class~='bottom-2']`)
  assert.match(body, /top: calc\(100% \+ 2px\) !important/)
  assert.match(body, /bottom: auto !important/)
})

test('a running session dot is green, filled or stalled ring', async () => {
  assert.match(await rule(`${S} [role='status'][aria-label='Session running'][class*='bg-(--ui-accent)']`), /background-color: var\(--grok-status-busy\)/)
  assert.match(await rule(`${S} [role='status'][aria-label='Session running'][class~='border']`), /border-color: var\(--grok-status-busy\)/)
})

test('tool call disclosure rows get padding', async () => {
  assert.match(await rule(`${S} [data-slot='tool-block'] [class~='group/disclosure-row']`), /padding: 0\.2rem 0\.4rem !important/)
  assert.ok(!(await css()).includes("[data-slot='aui_user-message-root'] [class~='group/disclosure-row']"))
})

test('the status stack card is inset five spacing steps', async () => {
  const body = await rule(`${S} [data-slot='composer-status-stack'] > div[class~='mx-2']`)
  assert.match(body, /margin-inline: calc\(var\(--spacing, 0\.25rem\) \* 5\) !important/)
})

test('tool blocks use a 0.7rem corner', async () => {
  const source = await css()
  assert.match(source, /--grok-radius-tool: 0\.7rem/)
  assert.match(await rule(`${S} [data-slot='tool-block']`), /border-radius: var\(--grok-radius-tool\) !important/)
  assert.match(await rule(`${S} [data-slot='aui_assistant-message-content'] [data-slot='tool-block'][data-tool-row]`), /border-radius: var\(--grok-radius-tool\)/)
})

test('the prompt text wrapper has no minimum height', async () => {
  assert.match(await rule(`${S} div[class~='min-h-[1.25rem]']:has(> [data-slot='aui_user-message-text'])`), /min-height: 0 !important/)
})

test('dark prompt pills use light text', async () => {
  assert.match(await rule(`${S}[data-hermes-theme='grok-chat'].dark`), /--grok-color-user-pill-text: var\(--theme-foreground/)
})

test('composer links show the full URL in link blue without the chip icon', async () => {
  assert.match(await rule(`${S} [data-slot='composer-rich-input'] [data-ref-kind='url']`), /font-size: 0 !important/)
  assert.match(await rule(`${S} [data-slot='composer-rich-input'] [data-ref-kind='url']::after`), /content: attr\(data-ref-id\)/)
})

test('composer buttons are matched without translatable labels', async () => {
  const source = await css()
  assert.doesNotMatch(source, /aria-label='(Add context|Send|Stop)'/)
  assert.match(source, /button:has\(> i\.codicon-add\)/)
  assert.match(source, /\[data-slot='composer-surface'\] button\[type='submit'\]/)
})

test('the dark + button is #3B3B3B', async () => {
  assert.match(await rule(`${S}[data-hermes-theme='grok-chat'].dark`), /--grok-color-add-button: #3B3B3B/)
})

test('composer icons are drawn larger and heavier', async () => {
  const glyph = await rule(`${S} [data-slot='composer-surface'] button i.codicon`)
  assert.match(glyph, /font-size: 18px !important/)
  assert.match(glyph, /-webkit-text-stroke: 0\.45px currentColor/)
  assert.match(await rule(`${S} [data-slot='composer-surface'] button:not(:has(span)) > svg`), /width: 18px !important/)
})

test('the chat surface has 2rem of top padding', async () => {
  assert.match(await rule(`${S} [data-chat-surface]`), /padding-top: 2rem !important/)
})

test('pane tabs keep their geometry and gain a pill behind the active tab', async () => {
  const tab = `:is([data-slot='pane-tab'], [data-tree-tab]):not([data-vertical])`
  const base = await rule(`${S} ${tab}`)
  assert.match(base, /border-left-width: 0 !important/)
  assert.match(base, /--pane-tab-active-accent: transparent/)
  assert.doesNotMatch(base, /(^|\s)(height|width|margin[a-z-]*):/, 'the tab box itself must not change size or position')

  const pill = await rule(`${S} ${tab}[data-active='true']::before`)
  assert.match(pill, /border-radius: 9999px/)
  assert.match(pill, /pointer-events: none/)

  assert.match(await rule(`${S} ${tab} .pane-tab-content span`), /text-transform: none !important/)
})

test('pane tab labels capitalize their first letter only', async () => {
  const body = await rule(`${S} :is([data-slot='pane-tab'], [data-tree-tab]):not([data-vertical]) .pane-tab-content > :last-child > span::first-letter`)
  assert.match(body, /text-transform: uppercase/)
})

test('conversation tab dots follow the sidebar rules without padding the lead cell', async () => {
  const rules = parseRules(await css())
  const tab = `${S} :is([data-slot='pane-tab'], [data-tree-tab]):not([data-vertical]) .pane-tab-content`
  assert.ok(rules.some(({ selectors }) => selectors[0] === `${tab} > :where(span, button):last-child`), 'label padding must target only the last child')
  assert.ok(!rules.some(({ selectors }) => selectors[0] === `${tab} > :where(span, button)`), 'the lead cell must not get label padding')
  const hidden = rules.find(({ selectors }) => selectors[0].startsWith(`${tab} > span:not(:last-child) span[class~='rounded-full']`))
  assert.match(hidden.body, /display: none/)
})

test('conversation tabs match even when a context menu replaces their data-slot', async () => {
  const pill = parseRules(await css()).find(({ selectors }) => selectors[0].endsWith("[data-active='true']::before"))
  assert.ok(pill.selectors[0].includes(":is([data-slot='pane-tab'], [data-tree-tab])"))
})

test('panel header tab strips get 0.5rem inline padding', async () => {
  assert.match(await rule(`${S} [data-panel-header] [class~='group/pane-header']`), /padding-inline: 0\.5rem !important/)
})

test('the composer + cross is 17px', async () => {
  assert.match(await rule(`${S} [data-slot='composer-surface'] button:has(> i.codicon-add)::before`), /width: 17px;\s*height: 17px/)
})
