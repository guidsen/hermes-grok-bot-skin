import { host, PALETTE_AREA, THEMES_AREA, TITLEBAR_AREAS } from '@hermes/plugin-sdk'
import { useEffect } from 'react'
import { jsx } from 'react/jsx-runtime'

const ID = 'grok-chat-look'
const STYLE_ID = `${ID}-styles`
const BUILD_ID = 'v0.1.0'

const CHAT_WIDTH_STORAGE_KEY = 'chat-width'
const PINNED_USER_MESSAGES_STORAGE_KEY = 'pinned-user-messages'

let pluginStorage = null

/* Grok Bot is a native macOS app: San Francisco at the system sizes. */
const SYSTEM_FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`
const SYSTEM_MONO = `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace`

/* Light values are measured from Grok Bot screenshots. The ring is a neutral
   gray on purpose: Hermes mixes it into hover, focus and selection fills, and a
   blue ring is what tinted the model menu and model button blue. Grok Bot's dark mode has
   Grok Bot's dark mode has not been captured yet, so the dark palette follows
   macOS system dark colors in the same roles. See docs/reference-spec.md. */
const GROK_THEME = {
  name: 'grok-chat',
  label: 'Grok Skin',
  description: 'Inspired by Grok Bot: white chat, gray sidebar and message pills',
  colors: {
    background: '#FFFFFF',
    foreground: '#1D1D1F',
    card: '#FFFFFF',
    cardForeground: '#1D1D1F',
    muted: '#F0F0F0',
    mutedForeground: '#86868B',
    popover: '#FFFFFF',
    popoverForeground: '#1D1D1F',
    primary: '#000000',
    primaryForeground: '#FFFFFF',
    secondary: '#F0F0F0',
    secondaryForeground: '#1D1D1F',
    accent: '#EDEDED',
    accentForeground: '#1D1D1F',
    border: '#E3E3E3',
    input: '#E3E3E3',
    ring: '#8E8E93',
    composerRing: '#E3E3E3',
    destructive: '#FF3B30',
    destructiveForeground: '#FFFFFF',
    sidebarBackground: '#F6F6F6',
    sidebarBorder: '#E5E5E5',
    userBubble: '#000000',
    userBubbleBorder: '#000000'
  },
  darkColors: {
    background: '#1C1C1E',
    foreground: '#F5F5F7',
    card: '#2F2F2F',
    cardForeground: '#F5F5F7',
    muted: '#2C2C2E',
    mutedForeground: '#98989D',
    popover: '#2C2C2E',
    popoverForeground: '#F5F5F7',
    primary: '#F5F5F7',
    primaryForeground: '#1C1C1E',
    secondary: '#2C2C2E',
    secondaryForeground: '#F5F5F7',
    accent: '#3A3A3C',
    accentForeground: '#F5F5F7',
    border: '#38383A',
    input: '#38383A',
    ring: '#98989D',
    composerRing: '#38383A',
    destructive: '#FF453A',
    destructiveForeground: '#1C1C1E',
    sidebarBackground: '#232325',
    sidebarBorder: '#2F2F31',
    userBubble: '#5F5F5F',
    userBubbleBorder: '#5F5F5F'
  },
  typography: {
    fontSans: SYSTEM_FONT,
    fontMono: SYSTEM_MONO
  }
}

/* English aria labels Hermes puts on the session status dot. The Bots rail
   reads busy and waiting state from these, since the dot carries no data
   attribute of its own. */
const BUSY_STATUS = `[role='status']:is([aria-label='Session running'], [aria-label='Background task running'])`
const WAITING_STATUS = `[role='status'][aria-label='Needs your input']`
const BOT_ROW = `button[data-roster-key]`

/* Session rows keep a status dot in a fixed lead cell before the title. That
   cell is also the drag handle on reorderable rows. */
const SESSION_ROW = `[data-slot='sidebar'] .row-hover`
const DOT_CELL = `[class~='size-3.5'][class~='place-items-center']:has(span[class~='rounded-full'])`
/* A dot worth showing: a session color the user or its project set, or a live
   state such as running, waiting or finished-unread. */
const LOUD_DOT = `span[class~='rounded-full']:is([style*='background-color'], [role='status'])`
/* Noise: the uncolored idle placeholder and the draft ring. */
const QUIET_DOT = `span[class~='rounded-full']:is([aria-hidden='true'][class~='size-1']:not([style*='background-color']), [aria-label='Draft — nothing sent yet'])`

/* Hermes rotates through these resting hints in the composer. They are replaced
   with Grok Bot's "Message <bot>". Status hints such as "Starting Hermes..."
   and "Reconnecting to Hermes…" are left alone, because they carry state. */
const ROTATING_PLACEHOLDERS = [
  'What are we building?',
  'Give Hermes a task',
  "What's on your mind?",
  'Describe what you need',
  'What should we tackle?',
  'Ask anything',
  'Start with a goal',
  'Send a follow-up',
  'Add more context',
  'Refine the request',
  "What's next?",
  'Keep it going',
  'Push it further',
  'Adjust or continue',
  'Send follow-up'
]

const cssString = value => `"${String(value).replace(/["\\]/g, '\\$&').replace(/\n/g, ' ')}"`

const RESTING_PLACEHOLDER = ROTATING_PLACEHOLDERS
  .map(text => `[data-placeholder=${cssString(text)}]`)
  .join(', ')

const PLACEHOLDER_VAR = '--grok-composer-placeholder'

const SECTION_LABEL = `span:has(> span.dither[aria-hidden='true'] + span[class~='truncate'])`

/* The absolutely positioned hover-action cluster Hermes puts over the prompt
   bubble's corner. */
const USER_ACTIONS = `[data-slot='aui_user-bubble-actions'] .composer-human-message ~ div[class~='absolute'][class~='bottom-2']`

/* Horizontal pane tabs (Sessions/Bots/Terminal, session tabs above the chat).
   A conversation tab is wrapped in a right-click menu whose trigger passes its
   own data-slot="context-menu-trigger" onto the tab, replacing "pane-tab". The
   tab strip also stamps every tab with data-tree-tab, which nothing overrides,
   so match either. Collapsed side rails render vertical tabs and are left
   alone. */
const PANE_TAB = `:is([data-slot='pane-tab'], [data-tree-tab]):not([data-vertical])`

/* Icon-only ghost buttons in the composer: not a toggle in its on state
   (text-primary) and not a solid filled button such as voice mode
   (bg-foreground), whose icon is deliberately colored against its fill. */
const ICON_SVG_BUTTON = `[data-slot='composer-surface'] button:not(:has(span)):not([class*='text-primary']):not([class*='bg-foreground'])`

/* The voice mode button: the solid primary button that is not Send/Stop. */
const VOICE_BUTTON = `[data-slot='composer-surface'] button[class*='bg-foreground']:not([type='submit'])`
const ICON_SVG = `${ICON_SVG_BUTTON} > svg[stroke]`

const SEARCH_INPUT = `input:is([aria-label='Search sessions'], [aria-label='Search bots and group chats'])`

/* The composer's + is found by its icon, not its aria-label. Hermes' label is
   plain text that can be translated; the codicon name is an internal id that
   stays the same in every language. The Send/Stop button is the composer's
   only submit button, so it needs no label either. */
const ADD_BUTTON = `button:has(> i.codicon-add)`

const PLUS_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 4.5v15M4.5 12h15' fill='none' stroke='black' stroke-width='2.1' stroke-linecap='round'/%3E%3C/svg%3E")`

const MENU_SURFACES = [
  `[data-slot='dropdown-menu-content']`,
  `[data-slot='dropdown-menu-sub-content']`,
  `[data-slot='context-menu-content']`,
  `[data-slot='context-menu-sub-content']`,
  `[data-slot='popover-content']`,
  `[data-slot='select-content']`
]

const MENU_ITEMS = [
  `[data-slot='dropdown-menu-item']`,
  `[data-slot='dropdown-menu-checkbox-item']`,
  `[data-slot='dropdown-menu-radio-item']`,
  `[data-slot='dropdown-menu-sub-trigger']`,
  `[data-slot='context-menu-item']`,
  `[data-slot='context-menu-checkbox-item']`,
  `[data-slot='context-menu-sub-trigger']`,
  `[data-slot='select-item']`,
  `[data-slot='command-item']`
]

const scoped = (selectors, suffix = '') =>
  selectors.map(selector => `html[data-grok-chat-look='true'] ${selector}${suffix}`).join(',\n')

const CSS = `
html[data-grok-chat-look='true'] {
  --grok-font-body: 13px;
  --grok-line-body: 1.35;
  --grok-font-meta: 12px;
  --grok-radius-pill: 18px;
  --grok-radius-card: 16px;
  --grok-radius-tool: 0.7rem;
  --grok-radius-row: 10px;
  --grok-radius-control: 8px;
  --grok-pill-max: 88%;

  /* Hermes scales every rounded-* utility by --radius-scalar, pinned at 0.2, so
     a "medium" corner renders at 2px and hover fills look square app-wide.
     0.8 gives Grok Bot's rounder corners everywhere at once: md 8px, lg 9.6px,
     xl 12.8px, 2xl 19.2px. Not a user setting in Hermes, so nothing is lost. */
  --radius-scalar: 0.8;

  /* Grok Bot uses the macOS body size Hermes already ships (13px). What changes
     is the rhythm: parts of one reply stack 4px apart as separate pills, and
     there is no text indent. */
  --conversation-text-font-size: var(--grok-font-body);
  --conversation-line-height: 18px;
  --conversation-tool-font-size: var(--grok-font-body);
  --conversation-turn-gap: 0.625rem;
  --turn-block-gap: 4px;
  --scaffold-block-gap: 4px;
  --tool-row-gap: 4px;
  --paragraph-gap: 0.6rem;
  --message-text-indent: 0px;
  --composer-surface-pad-x: 6px;
  --composer-surface-pad-y: 5px;
  --dt-font-sans: ${SYSTEM_FONT} !important;
  --font-sans: ${SYSTEM_FONT} !important;
  --dt-font-mono: ${SYSTEM_MONO} !important;
  --font-mono: ${SYSTEM_MONO} !important;

  /* Every surface resolves through Hermes' semantic tokens, so the layout works
     under any Hermes theme. The bundled theme re-seeds them exactly below. */
  --grok-color-chat: var(--ui-chat-surface-background);
  --grok-color-sidebar: var(--ui-sidebar-surface-background);
  --grok-color-elevated: var(--dt-card, var(--ui-editor-surface-background));
  --grok-color-text: var(--ui-text-primary);
  --grok-color-text-secondary: var(--ui-text-secondary);
  --grok-color-text-tertiary: var(--ui-text-tertiary);
  --grok-color-border: var(--dt-border, var(--ui-stroke-secondary));
  --grok-color-assistant-pill: color-mix(in srgb, var(--grok-color-text) 6%, var(--grok-color-chat));
  --grok-color-user-pill: var(--dt-user-bubble);
  --grok-color-user-pill-text: var(--grok-color-text);
  --grok-color-composer: var(--grok-color-elevated);
  --grok-color-add-button: color-mix(in srgb, var(--grok-color-text) 4%, var(--grok-color-composer));
  --grok-color-tab-active: color-mix(in srgb, var(--grok-color-text) 9%, var(--ui-sidebar-surface-background));
  --grok-color-hover-soft: color-mix(in srgb, var(--grok-color-text) 6%, transparent);
  --grok-color-row-hover: color-mix(in srgb, var(--grok-color-text) 5%, var(--grok-color-sidebar));
  --grok-color-row-active: color-mix(in srgb, var(--grok-color-text) 8%, var(--grok-color-sidebar));

  /* Status colors are semantic in Grok Bot, not theme colors: green while a bot
     is working, orange while it waits on you. */
  --grok-status-busy: #34C759;
  --grok-status-waiting: #FF9500;
  --grok-status-waiting-text: #A15C00;
  --grok-link: #0071E3;
}

html[data-grok-chat-look='true'].dark {
  --grok-status-busy: #30D158;
  --grok-status-waiting: #FF9F0A;
  --grok-status-waiting-text: #FFB340;
  --grok-link: #4A90E2;
}

/* Exact seeds when the bundled theme is active. Hermes blends card and bubble
   seeds with neutrals before exposing them, which is why the composer and pills
   came out tinted; read the seeds directly instead. Glass hands the chat and
   sidebar fields to the native material, so those stay untouched there. */
html[data-grok-chat-look='true'][data-hermes-theme='grok-chat'] {
  --grok-color-elevated: var(--theme-card-seed);
  --grok-color-assistant-pill: var(--dt-muted);
  --grok-color-user-pill: var(--theme-bubble-seed);
  --grok-color-user-pill-text: var(--dt-primary-foreground);
}

/* Dark mode prompts are a mid-gray pill with light text rather than an inverted
   white one, so the text follows the foreground instead of primaryForeground. */
html[data-grok-chat-look='true'][data-hermes-theme='grok-chat'].dark {
  --grok-color-user-pill-text: var(--theme-foreground, var(--grok-color-text));
  --grok-color-add-button: #3B3B3B;
  --grok-color-voice-button: #FAFAFA;
  --grok-color-voice-icon: #141414;
}

html[data-grok-chat-look='true'][data-hermes-theme='grok-chat']:not([data-hermes-glass]) {
  --grok-color-chat: var(--theme-background-seed);
  --grok-color-sidebar: var(--theme-sidebar-seed);
  --ui-chat-surface-background: var(--grok-color-chat);
}

html[data-grok-chat-look='true'][data-hermes-theme='grok-chat']:not([data-hermes-glass]),
html[data-grok-chat-look='true'][data-hermes-theme='grok-chat']:not([data-hermes-glass]) body {
  background-color: var(--grok-color-chat) !important;
}

/* Grok Bot runs the transcript and composer edge to edge, using Hermes' own
   1.5rem thread gutter. Centered keeps a readable column on wide windows. */
html[data-grok-chat-look='true'][data-grok-chat-width='centered'] {
  --composer-width: 760px;
}

html[data-grok-chat-look='true'] body,
html[data-grok-chat-look='true'] [contenteditable='true'] {
  font-family: ${SYSTEM_FONT} !important;
  -webkit-font-smoothing: antialiased;
}

/* ---------------------------------------------------------------- transcript */

html[data-grok-chat-look='true'] [data-slot='aui_thread-viewport'],
html[data-grok-chat-look='true'] [data-slot='aui_thread-content'] {
  background: var(--grok-color-chat) !important;
}

/* A little space above the first message. Hermes already pads the thread to
   clear the titlebar, with a different amount in secondary windows, so add a
   spacer before the first item instead of overriding that padding. Only while
   the thread has messages: the empty state reuses this slot as a two-row grid,
   where an extra item would take a row. */
html[data-grok-chat-look='true'] [data-slot='aui_thread-content']:has([data-slot='aui_message-group'])::before {
  content: '';
  display: block;
  flex-shrink: 0;
  height: 0.8rem;
}

html[data-grok-chat-look='true'] [data-slot='aui_assistant-message-root'],
html[data-grok-chat-look='true'] [data-slot='aui_assistant-message-content'] {
  background: transparent !important;
  color: var(--grok-color-text) !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_assistant-message-content'] {
  padding-left: 0 !important;
  line-height: var(--grok-line-body) !important;
}

/* Each prose part of a reply is its own gray pill. Only direct children are
   parts; markdown nested in reasoning or tool output stays unstyled. */
html[data-grok-chat-look='true'] [data-slot='aui_assistant-message-content'] > .aui-md {
  width: fit-content !important;
  max-width: var(--grok-pill-max) !important;
  padding: 11px 11px !important;
  border-radius: var(--grok-radius-pill) !important;
  background: var(--grok-color-assistant-pill) !important;
  color: var(--grok-color-text) !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_assistant-message-content'] > .aui-md + .aui-md {
  margin-top: 4px !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md,
html[data-grok-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md :where(p, li, blockquote, table) {
  font-family: ${SYSTEM_FONT} !important;
  font-size: var(--grok-font-body) !important;
  line-height: var(--grok-line-body) !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_assistant-message-content'] .aui-md :where(pre, code) {
  font-family: ${SYSTEM_MONO} !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_assistant-message-content'] img,
html[data-grok-chat-look='true'] [data-slot='aui_generated-image'],
html[data-grok-chat-look='true'] [data-slot='aui_embedded-images'] img {
  border-radius: 12px !important;
}

/* Hermes fades scaffolding to 67% until hover. Grok Bot prints tool and status
   cards at full strength. */
html[data-grok-chat-look='true'] [data-slot='aui_assistant-message-content'] [data-conversation-scaffold] {
  opacity: 1 !important;
}

/* ------------------------------------------------------------ user messages */

html[data-grok-chat-look='true'] [data-slot='aui_user-message-root'] {
  align-items: flex-end !important;
  background: transparent !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_user-bubble-actions'] {
  width: fit-content !important;
  min-width: 0 !important;
  max-width: var(--grok-pill-max) !important;
  align-self: flex-end !important;
}

/* The prompt is a solid inverted pill: black with white text in light mode. */
html[data-grok-chat-look='true'] [data-slot='aui_user-message-root'] .composer-human-message {
  width: 100% !important;
  max-width: 100% !important;
  padding: 7px 11px !important;
  border: 0 !important;
  border-radius: var(--grok-radius-pill) !important;
  background: var(--grok-color-user-pill) !important;
  color: var(--grok-color-user-pill-text) !important;
  line-height: var(--grok-line-body) !important;
  text-align: left !important;
  box-shadow: none !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_user-message-root'] .composer-human-message :where(span, p, code) {
  color: inherit !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_user-message-root'] .composer-human-message :where(a, .ref) {
  color: inherit !important;
  text-decoration-line: underline !important;
  text-underline-offset: 2px !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_user-message-root'] .composer-human-message .ref[data-ref='url'] > svg {
  display: none !important;
}

/* Hermes overlays the prompt's hover actions (Stop, Restore checkpoint) in the
   bubble's bottom-right corner and reserves 36px of right padding for them.
   The pill keeps Grok Bot's even padding, so move the actions just below the
   bubble instead, right-aligned. Still absolutely positioned: no layout shift
   on hover, and the reply below starts on the left so nothing is covered. */
html[data-grok-chat-look='true'] ${USER_ACTIONS} {
  top: calc(100% + 2px) !important;
  right: 0 !important;
  bottom: auto !important;
}

html[data-grok-chat-look='true'] ${USER_ACTIONS} button {
  width: 24px !important;
  height: 24px !important;
  border-radius: var(--grok-radius-control) !important;
  color: var(--grok-color-text-secondary) !important;
}

html[data-grok-chat-look='true'] ${USER_ACTIONS} button:hover {
  background: var(--grok-color-hover-soft) !important;
  color: var(--grok-color-text) !important;
}

html[data-grok-chat-look='true'] ${USER_ACTIONS} button svg {
  width: 16px !important;
  height: 16px !important;
}

html[data-grok-chat-look='true'] ${USER_ACTIONS} button .codicon {
  font-size: 16px !important;
}

html[data-grok-chat-look='true'][data-grok-pinned-user-messages='off'] [data-slot='aui_user-message-root'] {
  position: static !important;
  top: auto !important;
  z-index: auto !important;
}

/* Hermes floors the prompt text box at 1.25rem to match the edit composer's
   line box. The pill's line height is shorter, so the floor padded one-line
   prompts. Clicking into edit may now shift the bubble by a pixel or two. */
html[data-grok-chat-look='true'] div[class~='min-h-[1.25rem]']:has(> [data-slot='aui_user-message-text']) {
  min-height: 0 !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_user-message-root'] .sticky-human-clamp {
  -webkit-mask-image: none !important;
  mask-image: none !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_edit-composer-root'] .composer-human-message {
  padding: 7px 11px !important;
  border: 1px solid var(--grok-color-border) !important;
  border-radius: var(--grok-radius-pill) !important;
  background: var(--grok-color-elevated) !important;
  color: var(--grok-color-text) !important;
  box-shadow: none !important;
}

/* ----------------------------------------------------------- message actions */

/* Grok Bot keeps the hover actions next to the message and the time at the far
   right. Hermes stacks duration left and icons right, so swap the two ends and
   lead with the reaction button. */
html[data-grok-chat-look='true'] div:has(> [data-slot='aui_msg-actions']) {
  justify-content: flex-start !important;
  gap: 2px !important;
}

html[data-grok-chat-look='true'] div:has(> [data-slot='aui_msg-actions']) > [data-slot='aui_turn-duration'] {
  order: 3;
  margin-left: auto !important;
  margin-right: 0 !important;
  font-size: var(--grok-font-meta) !important;
  color: var(--grok-color-text-tertiary) !important;
}

html[data-grok-chat-look='true'] div:has(> [data-slot='aui_msg-actions']) > [data-slot='aui_msg-reactions'] {
  order: -1;
}

html[data-grok-chat-look='true'] [data-slot='aui_msg-actions'] {
  gap: 2px !important;
  padding-block: 2px !important;
}

/* Larger 18px icons on 28px rounded hit targets, gray at full strength, with a
   soft filled square on hover instead of Hermes' bare 14px dimmed glyphs. */
html[data-grok-chat-look='true'] [data-slot='aui_msg-actions'] button,
html[data-grok-chat-look='true'] button[data-slot='aui_msg-reactions'] {
  display: inline-grid !important;
  place-items: center !important;
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  border-radius: var(--grok-radius-control) !important;
  color: var(--grok-color-text-secondary) !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_msg-actions'] button {
  opacity: 1 !important;
}

html[data-grok-chat-look='true'] .group:hover button[data-slot='aui_msg-reactions']:not([data-reacted]) {
  opacity: 1 !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_msg-actions'] button:hover,
html[data-grok-chat-look='true'] button[data-slot='aui_msg-reactions']:hover,
html[data-grok-chat-look='true'] button[data-slot='aui_msg-reactions'][data-state='open'] {
  background: var(--grok-color-hover-soft) !important;
  color: var(--grok-color-text) !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_msg-actions'] button svg,
html[data-grok-chat-look='true'] button[data-slot='aui_msg-reactions'] svg {
  width: 18px !important;
  height: 18px !important;
  stroke-width: 1.75 !important;
}

/* ----------------------------------------------------------------- tooltips */

/* Hermes paints the tip as an inline marker: an inline span with
   box-decoration-break: clone, so every wrapped line gets its own background.
   With rounded corners that splits a two-line tip into two stacked pills.
   Make the chip one inline-block so it wraps inside a single rounded bubble.
   Hermes forces the chip's children inline, and that still holds inside an
   inline-block, so the empty-chip issue its comment warns about stays fixed. */
html[data-grok-chat-look='true'] [data-slot='tooltip-content'] > span {
  display: inline-block !important;
  max-width: 100% !important;
  padding: 5px 9px !important;
  border-radius: var(--grok-radius-control) !important;
  -webkit-box-decoration-break: slice !important;
  box-decoration-break: slice !important;
  font-family: ${SYSTEM_FONT} !important;
  font-size: var(--grok-font-meta) !important;
  font-weight: 500 !important;
  line-height: 1.35 !important;
  text-align: left !important;
} !important;
  font-size: var(--grok-font-meta) !important;
  font-weight: 500 !important;
}

/* ------------------------------------------------ tool calls and inline cards */

/* Tool calls are pills in the reply stack, the same fill as prose. */
html[data-grok-chat-look='true'] [data-slot='aui_assistant-message-content'] [data-slot='tool-block'][data-tool-row] {
  width: fit-content !important;
  min-width: 0 !important;
  max-width: var(--grok-pill-max) !important;
  padding: 7px 11px !important;
  border: 0 !important;
  border-radius: var(--grok-radius-tool) !important;
  background: var(--grok-color-assistant-pill) !important;
  color: var(--grok-color-text) !important;
}

/* Every tool block, including groups and tool calls rendered outside a reply
   (subagent transcripts), shares the same corner. */
html[data-grok-chat-look='true'] [data-slot='tool-block'] {
  border-radius: var(--grok-radius-tool) !important;
}

html[data-grok-chat-look='true'] [data-slot='tool-block'][data-tool-row] > div:first-child {
  border-bottom: 0 !important;
  padding: 0 !important;
}

/* The clickable header row of a tool call (name, glyph, caret). */
html[data-grok-chat-look='true'] [data-slot='tool-block'] [class~='group/disclosure-row'] {
  padding: 0.2rem 0.4rem !important;
}

html[data-grok-chat-look='true'] [data-tool-group],
html[data-grok-chat-look='true'] [data-tool-group] .tool-group-scroll {
  max-height: none !important;
  overflow: visible !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
}

html[data-grok-chat-look='true'] [data-slot='clarify-inline'],
html[data-grok-chat-look='true'] [data-slot='tool-approval-inline'],
html[data-grok-chat-look='true'] [data-slot='aui_changed-files'],
html[data-grok-chat-look='true'] [data-slot='aui_artifact-card'] {
  max-width: var(--grok-pill-max) !important;
  padding: 10px 11px !important;
  border: 0 !important;
  border-radius: var(--grok-radius-card) !important;
  background: var(--grok-color-assistant-pill) !important;
}

html[data-grok-chat-look='true'] [data-slot='clarify-inline'] button,
html[data-grok-chat-look='true'] [data-slot='tool-approval-inline'] button {
  border-radius: var(--grok-radius-control) !important;
}

/* ------------------------------------------------------------------ composer */

/* A white rounded field with a hairline border; the + and send controls sit
   inside it as circles. */
html[data-grok-chat-look='true'] [data-slot='composer-root'],
html[data-grok-chat-look='true'] [data-slot='composer-root'][data-thread-scrolled-up] {
  --composer-fill: var(--grok-color-composer);
}

html[data-grok-chat-look='true'] [data-slot='composer-root'],
html[data-grok-chat-look='true'] [data-slot='composer-root'] > div,
html[data-grok-chat-look='true'] [data-slot='composer-surface'],
html[data-grok-chat-look='true'] [data-slot='composer-surface'] > [aria-hidden] {
  border-radius: 20px !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] {
  border: 1px solid var(--grok-color-border) !important;
  border-color: var(--grok-color-border) !important;
  background: var(--grok-color-composer) !important;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--grok-color-text) 4%, transparent) !important;
  backdrop-filter: none !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] > [aria-hidden] {
  background: var(--grok-color-composer) !important;
  backdrop-filter: none !important;
}

/* The status stack card (todos, subagents) sits above the composer, inset
   with mx-2 so it reads narrower than the field. The skin's composer is much
   rounder, so inset it further to clear the curved corners below it. */
html[data-grok-chat-look='true'] [data-slot='composer-status-stack'] > div[class~='mx-2'] {
  margin-inline: calc(var(--spacing, 0.25rem) * 5) !important;
}

/* A pasted link becomes an atomic chip showing a shortened label and a link
   icon. The full URL is kept in data-ref-id, so collapse the chip's own content
   and print that instead, in plain link blue. Copy and send are unaffected:
   Hermes serializes the chip from data-ref-text, not from what is displayed. */
html[data-grok-chat-look='true'] [data-slot='composer-rich-input'] [data-ref-kind='url'] {
  color: var(--grok-link) !important;
  font-size: 0 !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-rich-input'] [data-ref-kind='url']::after {
  content: attr(data-ref-id);
  font-size: var(--grok-font-body);
  overflow-wrap: anywhere;
}

/* Larger, heavier composer icons. Most are codicon font glyphs sized by an
   inline font-size, so the size needs !important; the font has no stroke weight
   to raise, so a text stroke in the glyph's own color thickens the outline. The
   voice buttons use stroked SVG icons, which are resized and get a heavier
   stroke. Buttons that also hold text, like the model pill, keep their small
   chevron. */
html[data-grok-chat-look='true'] [data-slot='composer-surface'] button i.codicon {
  font-size: 18px !important;
  -webkit-text-stroke: 0.45px currentColor;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] button:not(:has(span)) > svg {
  width: 18px !important;
  height: 18px !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] button svg[stroke] {
  stroke-width: 2.3;
}

/* Hermes colors these icon buttons with a translucent tertiary color
   (the foreground at 54%). A Tabler icon is several strokes that meet and
   cross, and with a translucent stroke every overlap paints twice, leaving
   brighter spots at joins and crossings. Draw the strokes in the same
   foreground at full strength and apply the transparency to the whole icon
   with opacity, so overlaps can't build up: 54% at rest, 94% on hover like
   Hermes' hover text. Toggles that are on use Hermes' solid primary color and
   are left alone. */
html[data-grok-chat-look='true'] ${ICON_SVG} {
  color: var(--ui-base, currentColor) !important;
  opacity: 0.54;
  transition: opacity 120ms ease;
}

html[data-grok-chat-look='true'] ${ICON_SVG_BUTTON}:is(:hover, :focus-visible) > svg[stroke] {
  opacity: 0.94;
}

html[data-grok-chat-look='true'] ${ICON_SVG_BUTTON}:disabled > svg[stroke] {
  opacity: 0.36;
}

/* In dark mode the voice mode button is a near-white circle with a near-black
   icon. */
html[data-grok-chat-look='true'][data-hermes-theme='grok-chat'].dark ${VOICE_BUTTON} {
  background: var(--grok-color-voice-button) !important;
  color: var(--grok-color-voice-icon) !important;
}

html[data-grok-chat-look='true'][data-hermes-theme='grok-chat'].dark ${VOICE_BUTTON}:hover {
  background: color-mix(in srgb, var(--grok-color-voice-icon) 8%, var(--grok-color-voice-button)) !important;
}

/* Hermes gives the field a 2.375rem floor; let the controls and input set the
   height instead. */
html[data-grok-chat-look='true'] [data-slot='composer-fade'] {
  min-height: 0 !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-root'] > .pointer-events-none {
  background: transparent !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-rich-input'] {
  color: var(--grok-color-text) !important;
  font-family: ${SYSTEM_FONT} !important;
  font-size: var(--grok-font-body) !important;
  line-height: 18px !important;
}

/* Grok Bot's + is a light ringed circle with a rounded 1px cross. Hermes draws
   a thinner codicon glyph, so hide it and paint the cross from a mask; it
   still takes currentColor, so it follows the theme. */
/* The hint is painted from data-placeholder by a ::before, so the skin can swap
   its content. The runtime supplies the text; until it does, Hermes' own hint
   shows through the fallback. */
html[data-grok-chat-look='true'] [data-slot='composer-surface'] [data-slot='composer-rich-input']:is(:empty, [data-empty]):is(${RESTING_PLACEHOLDER})::before {
  content: var(${PLACEHOLDER_VAR}, attr(data-placeholder)) !important;
}

/* The + sits in the menu grid area. Size it like the send button so both ends
   of the field match. */
html[data-grok-chat-look='true'] [data-slot='composer-surface'] ${ADD_BUTTON} {
  position: relative !important;
  width: var(--composer-control-primary-size, var(--composer-control-size)) !important;
  height: var(--composer-control-primary-size, var(--composer-control-size)) !important;
  border: 1px solid color-mix(in srgb, var(--grok-color-text) 12%, transparent) !important;
  border-radius: 9999px !important;
  background: var(--grok-color-add-button) !important;
  color: var(--grok-color-text-secondary) !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] [class*='[grid-area:menu]'] {
  width: var(--composer-control-primary-size, var(--composer-control-size)) !important;
  height: var(--composer-control-primary-size, var(--composer-control-size)) !important;
  /* Hermes nudges this area down 3px with translate-y-[3px]; with the + sized
     like the send button it no longer needs the offset. */
  --tw-translate-y: 0 !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] [class*='[grid-area:input]'] {
  margin-left: 0.2rem !important;
}

/* Multi-line (stacked) layout: Hermes switches the grid to "input_input" over
   "menu_controls" and gives the input pl-3. Key off the grid template, the
   layout's own definition, rather than the padding class. */
html[data-grok-chat-look='true'] [data-slot='composer-surface'] [class*='"input_input"_"menu_controls"'] [data-slot='composer-rich-input'] {
  padding-left: calc(var(--spacing, 0.25rem) * 0.8) !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] ${ADD_BUTTON}:hover {
  background: color-mix(in srgb, var(--grok-color-text) 8%, var(--grok-color-composer)) !important;
  color: var(--grok-color-text) !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] ${ADD_BUTTON} > * {
  visibility: hidden !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] ${ADD_BUTTON}::before {
  content: '';
  position: absolute;
  inset: 0;
  width: 17px;
  height: 17px;
  margin: auto;
  background: currentColor;
  -webkit-mask: ${PLUS_MASK} center / contain no-repeat;
  mask: ${PLUS_MASK} center / contain no-repeat;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] :is(button[aria-label^='Model ·'], button[aria-label='Open model picker']) {
  border-radius: 9999px !important;
  background: transparent !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] :is(button[aria-label^='Model ·'], button[aria-label='Open model picker']):is(:hover, [data-state='open']) {
  background: var(--grok-color-hover-soft) !important;
}

html[data-grok-chat-look='true'] [data-slot='composer-surface'] button[type='submit'] {
  width: 26px !important;
  height: 26px !important;
  border-radius: 9999px !important;
}

/* ---------------------------------------------------------------- pane tabs */

/* Hermes' tabs are full-height cells with tiny spaced uppercase labels, divider
   lines and a primary-color underline on the active tab. Keep every tab's
   geometry exactly as it is, so clicking, dragging, dropping between zones and
   the titlebar drag regions behave the same, and only change the paint: no
   dividers or underline, sentence-case labels, and a soft pill drawn behind
   the active tab. The pill is a pseudo-element outside .pane-tab-content, so
   the close button's label mask never fades it. */
html[data-grok-chat-look='true'] ${PANE_TAB} {
  --pane-tab-active-accent: transparent;
  --pane-tab-active-bg: transparent;
  border-left-width: 0 !important;
  box-shadow: none !important;
  isolation: isolate;
}

html[data-grok-chat-look='true'] ${PANE_TAB}[data-active='true']::before {
  content: '';
  position: absolute;
  z-index: -1;
  top: 50%;
  right: 2px;
  left: 2px;
  height: 26px;
  margin-top: -13px;
  border-radius: 9999px;
  background: var(--grok-color-tab-active);
  pointer-events: none;
}

/* The label is always the last child of the tab content. Session tabs put a
   lead cell with their status dot in front of it, which keeps its own spacing. */
html[data-grok-chat-look='true'] ${PANE_TAB} .pane-tab-content > :where(span, button):last-child {
  padding-inline: 12px !important;
}

/* Hermes names built-in panes in lowercase ("sessions", "terminal") and relied
   on uppercase styling. Capitalize only the first letter, so conversation
   titles keep their own casing. The label text span is a block, so
   ::first-letter applies. */
html[data-grok-chat-look='true'] ${PANE_TAB} .pane-tab-content > :last-child > span::first-letter {
  text-transform: uppercase;
}

/* Conversation tabs follow the sidebar's dot rules: the uncolored idle dot and
   the draft ring are hidden, and the lead cell collapses to nothing. A session
   color or a live state keeps its dot, sitting close to the title. */
html[data-grok-chat-look='true'] ${PANE_TAB} .pane-tab-content > span:not(:last-child) ${QUIET_DOT} {
  display: none !important;
}

html[data-grok-chat-look='true'] ${PANE_TAB} .pane-tab-content > span:not(:last-child):not(:has(${LOUD_DOT})) {
  margin-inline: 0 !important;
}

html[data-grok-chat-look='true'] ${PANE_TAB} .pane-tab-content > span:not(:last-child):has(${LOUD_DOT}) {
  margin-left: 12px !important;
  margin-right: 2px !important;
}

html[data-grok-chat-look='true'] ${PANE_TAB} .pane-tab-content > span:has(${LOUD_DOT}) + :where(span, button):last-child {
  padding-left: 3px !important;
}

html[data-grok-chat-look='true'] ${PANE_TAB} .pane-tab-content span {
  font-family: ${SYSTEM_FONT} !important;
  font-size: var(--grok-font-meta) !important;
  font-weight: 500 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
}

/* Close button on closeable tabs. Hermes sizes it and fades the label under
   it with [data-slot='pane-tab'][data-closeable], which conversation tabs miss
   because their menu trigger replaced that data-slot, so their ✕ had no width
   and sat flush against the edge. Restore the width for every closeable tab,
   move the ✕ in by one spacing step, and extend the label fade by the same
   amount so no text shows beside the button. The wrapper is found by the
   close icon it holds, not by its utility classes. */
html[data-grok-chat-look='true'] ${PANE_TAB}[data-closeable] {
  --pane-tab-close-width: 1.5rem;
}

html[data-grok-chat-look='true'] ${PANE_TAB} > span:has(> button > i.codicon-close) {
  right: calc(var(--spacing, 0.25rem) * 1) !important;
}

html[data-grok-chat-look='true'] ${PANE_TAB}[data-closeable]:hover > .pane-tab-content {
  -webkit-mask-image: linear-gradient(
    to right,
    #000 calc(100% - var(--pane-tab-close-width) - var(--spacing, 0.25rem) - 1rem),
    transparent calc(100% - var(--pane-tab-close-width) - var(--spacing, 0.25rem))
  ) !important;
  mask-image: linear-gradient(
    to right,
    #000 calc(100% - var(--pane-tab-close-width) - var(--spacing, 0.25rem) - 1rem),
    transparent calc(100% - var(--pane-tab-close-width) - var(--spacing, 0.25rem))
  ) !important;
}

/* Inset the tab strip inside each panel header so the first pill does not sit
   against the zone edge. Descendant rather than child: a zone menu may wrap
   the strip. */
html[data-grok-chat-look='true'] [data-panel-header] [class~='group/pane-header'] {
  padding-inline: 0.5rem !important;
}

/* ------------------------------------------------------------------- popups */

/* Every menu, submenu and popover gets the same 14px card. The effort submenu
   is a separate sub-content surface, which is why it kept square corners. */
${scoped(MENU_SURFACES)},
html[data-grok-chat-look='true'] [data-slot='composer-completion-drawer'] {
  border-radius: 14px !important;
  border-color: var(--grok-color-border) !important;
  box-shadow:
    0 8px 24px color-mix(in srgb, var(--grok-color-text) 10%, transparent),
    0 1px 3px color-mix(in srgb, var(--grok-color-text) 6%, transparent) !important;
}

${scoped(MENU_ITEMS)} {
  border-radius: var(--grok-radius-control) !important;
}

/* A neutral gray fill for the pointed-at row, in every state Radix and cmdk use
   to mark it, instead of Hermes' tinted control fill. */
${scoped(MENU_ITEMS, ':focus')},
${scoped(MENU_ITEMS, '[data-highlighted]')},
${scoped(MENU_ITEMS, "[data-state='open']")},
${scoped(MENU_ITEMS, "[data-selected='true']")} {
  background: var(--grok-color-hover-soft) !important;
  color: var(--grok-color-text) !important;
}

/* The model menu runs its rows edge to edge with no padding. Inset them so the
   rounded hover fill has room to show its corners. */
${scoped(MENU_ITEMS.map(item => `[data-slot='dropdown-menu-content'][class~='p-0'] ${item}`))} {
  margin-inline: 6px !important;
}

/* Hermes' status bar is a 20px strip whose items sit 4px from the window edge.
   Give it breathing room and a hairline to separate it from the content. */
html[data-grok-chat-look='true'] [data-slot='statusbar'] {
  height: 26px !important;
  padding-inline: 10px !important;
  border-top: 1px solid var(--grok-color-border) !important;
}

html[data-grok-chat-look='true'] .coding-status-bar {
  display: none !important;
}

html[data-grok-chat-look='true'] [data-slot='aui_intro'] .wordmark {
  font-family: ${SYSTEM_FONT} !important;
  font-weight: 600 !important;
  letter-spacing: -0.01em !important;
  text-transform: none !important;
}

/* ---------------------------------------------------------- sessions sidebar */

html[data-grok-chat-look='true'] [data-slot='sidebar'],
html[data-grok-chat-look='true'] [data-slot='sidebar-content'],
html[data-grok-chat-look='true'] [data-slot='sidebar-group'],
html[data-grok-chat-look='true'] [data-slot='sidebar-group-content'] {
  background: var(--grok-color-sidebar) !important;
}

html[data-grok-chat-look='true'] [data-slot='sidebar'] .row-hover {
  min-height: 30px !important;
  border-radius: var(--grok-radius-row) !important;
}

/* Space between session rows. Only rows that are context-menu triggers, so
   other row-hover elements nested inside a row keep their spacing. */
html[data-grok-chat-look='true'] [data-slot='sidebar'] .row-hover[data-slot='context-menu-trigger'] {
  margin-bottom: 0.25rem !important;
}

/* No trailing gap after a group's last row. :not(:only-child) keeps this from
   matching every row of the virtualized list, which wraps each row alone; a
   group holding a single row is matched by the second selector instead. */
html[data-grok-chat-look='true'] [data-slot='sidebar'] .row-hover[data-slot='context-menu-trigger']:last-child:not(:only-child),
html[data-grok-chat-look='true'] [data-slot='sidebar'] [data-slot='sidebar-group-content'] > .row-hover[data-slot='context-menu-trigger']:only-child {
  margin-bottom: 0 !important;
}

html[data-grok-chat-look='true'] [data-slot='sidebar'] .row-hover:hover {
  background: var(--grok-color-row-hover) !important;
}

/* Selected rows keep Hermes' own selection fill; the skin only strips the
   border, outline and shadow around them. */
html[data-grok-chat-look='true'] [data-slot='sidebar'] .row-hover[class*='ui-row-active-background'],
html[data-grok-chat-look='true'] [data-slot='sidebar'] [data-active='true'],
html[data-grok-chat-look='true'] [data-slot='sidebar'] [aria-current='true'] {
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
}

html[data-grok-chat-look='true'] [data-slot='sidebar'] span[class*='text-[0.8125rem]'] {
  font-size: var(--grok-font-body) !important;
  color: var(--grok-color-text) !important;
}

/* The sessions list stacks right-side insets: the outer scroller reserves a
   stable scrollbar gutter, and the list and virtualized body inside it each
   draw their own scrollbar. Together they pull rows short of the edge that the
   nav rows and search reach. Drop the reserved gutter and the scrollbar width
   on every scroller in the list; wheel and trackpad scrolling still work, only
   the draggable thumb is gone. */
html[data-grok-chat-look='true'] [data-slot='sidebar-content'] [data-sessions-mode] {
  scrollbar-gutter: auto !important;
}

html[data-grok-chat-look='true'] [data-slot='sidebar-content'] [data-sessions-mode],
html[data-grok-chat-look='true'] [data-slot='sidebar-content'] [data-sessions-mode] :is(.scrollbar-fade, [class*='overflow-y-auto']) {
  scrollbar-width: none !important;
}

html[data-grok-chat-look='true'] [data-slot='sidebar-content'] [data-sessions-mode] :is([data-slot='sidebar-group'], [data-slot='sidebar-group-content']) {
  padding-inline: 0 !important;
  margin-inline: 0 !important;
}

/* The group keeps Hermes' bottom padding to separate sections; only the
   content inside it loses its own. */
html[data-grok-chat-look='true'] [data-slot='sidebar-content'] [data-sessions-mode] [data-slot='sidebar-group-content'] {
  padding-bottom: 0 !important;
}

/* Section labels (Pinned, Sessions, Cron jobs, messaging groups) lead with
   Hermes' dithered checkerboard square and set their text in spaced-out
   uppercase. Drop the marker and show the text as Hermes wrote it, in
   sentence case. Matched structurally, the marker followed by the label text,
   so the same .dither class used by loading indicators is left alone. */
html[data-grok-chat-look='true'] ${SECTION_LABEL} > .dither {
  display: none !important;
}

html[data-grok-chat-look='true'] ${SECTION_LABEL} {
  gap: 0 !important;
  color: var(--grok-color-text-secondary) !important;
  font-family: ${SYSTEM_FONT} !important;
  font-size: var(--grok-font-meta) !important;
  font-weight: 600 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
}

/* The label text is truncate (overflow: hidden) at leading-none, so its line
   box is exactly 1em and glyph ink past it gets clipped. Hermes' uppercase
   labels had no descenders to lose; in sentence case the tails of j, g and y
   were shaved. Give the clip box room with padding and take the space back
   with a matching negative margin, so the header height and the ellipsis stay
   exactly as they were. */
html[data-grok-chat-look='true'] ${SECTION_LABEL} > span[class~='truncate'] {
  padding-block: 0.2em !important;
  margin-block: -0.2em !important;
}

/* A section that brings its own icon, such as a messaging platform's logo,
   renders it before the label; Pinned and Sessions have no icon, so their
   label is the header's first child. Tighten the gap after the logo from
   Hermes' pl-2 to one spacing step. */
html[data-grok-chat-look='true'] ${SECTION_LABEL}:not(:first-child) {
  padding-left: calc(var(--spacing, 0.25rem) * 1) !important;
}

/* Hermes wraps each trailing item of a session row (the age, a profile or PR
   chip) in a bare span inside the row's actions cell. Center its contents so
   the age sits on the row's midline. Only class-less direct children match:
   the one wrapper Hermes gives classes to already carries inline-flex, and the
   spans inside each item are left alone. */
html[data-grok-chat-look='true'] [data-slot='sidebar-group-content'] [data-slot='context-menu-trigger'] [data-row-actions] > span:not([class]) {
  display: flex !important;
  align-items: center !important;
}

/* Date headings in the session list ("Done", "Today") trail a hairline rule.
   Keep the heading, drop the line. */
html[data-grok-chat-look='true'] [data-slot='sidebar-group-content'] [class*='bg-(--ui-stroke-tertiary)'] {
  display: none !important;
}

/* Cleaner session rows: uncolored and draft dots are hidden, a lead cell left
   with nothing to show collapses so the title starts flush, and a colored or
   live dot moves to the end of the row beside the age. Reorderable rows keep
   their cell, moved to the end with the dot, so the drag grip still appears
   there on hover. */
html[data-grok-chat-look='true'] ${SESSION_ROW} ${QUIET_DOT} {
  display: none !important;
}

html[data-grok-chat-look='true'] ${SESSION_ROW} ${DOT_CELL}:not([data-reorder-handle]):not(:has(${LOUD_DOT})) {
  display: none !important;
}

html[data-grok-chat-look='true'] ${SESSION_ROW} :is(${DOT_CELL}:has(${LOUD_DOT}), [data-reorder-handle]) {
  order: 3;
  margin-inline-start: 6px !important;
}

html[data-grok-chat-look='true'] ${SESSION_ROW} ${LOUD_DOT} {
  width: 7px !important;
  height: 7px !important;
  border-radius: 9999px !important;
}

/* Hermes paints the running dot with its accent, which this theme keeps
   neutral gray. Running is a live state, so use the busy green: the filled dot
   while working, and the ring Hermes draws when a run stalls. */
html[data-grok-chat-look='true'] [role='status'][aria-label='Session running'][class*='bg-(--ui-accent)'] {
  background-color: var(--grok-status-busy) !important;
}

html[data-grok-chat-look='true'] [role='status'][aria-label='Session running'][class~='border'] {
  border-color: var(--grok-status-busy) !important;
}

/* Search is a full-width filled field with a hairline border that stays
   visible, not Hermes' content-sized field fading from 30% opacity. */
/* Width only, never flex-grow: the sessions field sits in a vertical stack
   where growing would stretch it down the whole rail. The Bots toolbar row
   already gives its field flex-1. */
html[data-grok-chat-look='true'] div:has(> ${SEARCH_INPUT}) {
  display: flex !important;
  width: 100% !important;
  min-width: 0 !important;
  max-height: 28px !important;
  height: 28px !important;
  padding-inline: 7px !important;
  gap: 5px !important;
  border: 1px solid color-mix(in srgb, var(--grok-color-text) 9%, transparent) !important;
  border-radius: 9px !important;
  background: color-mix(in srgb, var(--grok-color-text) 6%, var(--grok-color-sidebar)) !important;
  opacity: 1 !important;
}

/* In the sessions sidebar the field is taller and runs to the content edges,
   so its wrapper drops Hermes' px-2 inset. */
html[data-grok-chat-look='true'] [data-slot='sidebar-content'] div:has(> ${SEARCH_INPUT}) {
  height: 34px !important;
  max-height: 34px !important;
}

html[data-grok-chat-look='true'] [data-slot='sidebar-content'] div[class~='px-2']:has(> div > ${SEARCH_INPUT}) {
  padding-inline: 0 !important;
}

html[data-grok-chat-look='true'] div:has(> ${SEARCH_INPUT}) > svg {
  width: 14px !important;
  height: 14px !important;
  color: var(--grok-color-text-secondary) !important;
  opacity: 1 !important;
}

html[data-grok-chat-look='true'] ${SEARCH_INPUT} {
  flex: 1 1 auto !important;
  width: 100% !important;
  height: 100% !important;
  field-sizing: fixed !important;
  color: var(--grok-color-text) !important;
  font-size: var(--grok-font-body) !important;
}

html[data-grok-chat-look='true'] ${SEARCH_INPUT}::placeholder {
  color: var(--grok-color-text-tertiary) !important;
}

/* ---------------------------------------------------------------- Bots rail */

/* Grok Bot rows: 30px avatar, 13px title and preview, 10px radius. */
html[data-grok-chat-look='true'] ${BOT_ROW} {
  --grok-row-ring: var(--grok-color-sidebar);
  position: relative !important;
  width: calc(100% - 8px) !important;
  min-height: 46px !important;
  margin-inline: 4px !important;
  gap: 12px !important;
  padding: 6px 12px 6px 8px !important;
  border-radius: var(--grok-radius-row) !important;
}

html[data-grok-chat-look='true'] ${BOT_ROW}:hover {
  --grok-row-ring: var(--grok-color-row-hover);
  background: var(--grok-color-row-hover) !important;
}

html[data-grok-chat-look='true'] ${BOT_ROW}[class*='ui-row-active-background'] {
  --grok-row-ring: var(--grok-color-row-active);
  background: var(--grok-color-row-active) !important;
}

/* Hermes draws the avatar at 34px. Scale the face rather than resizing it, so
   photo, pet and generated faces all shrink the same way. */
html[data-grok-chat-look='true'] ${BOT_ROW} > div:first-child {
  position: relative !important;
  width: 30px !important;
  height: 30px !important;
  flex: 0 0 30px !important;
}

html[data-grok-chat-look='true'] ${BOT_ROW} > div:first-child > * {
  transform: scale(0.8824);
  transform-origin: 0 0;
}

html[data-grok-chat-look='true'] ${BOT_ROW} span[class~='font-medium'] {
  font-size: var(--grok-font-body) !important;
  line-height: 17px !important;
  color: var(--grok-color-text) !important;
}

html[data-grok-chat-look='true'] ${BOT_ROW} [class~='justify-between'] > span[class~='shrink-0'] {
  font-size: var(--grok-font-body) !important;
  color: var(--grok-color-text-tertiary) !important;
}

html[data-grok-chat-look='true'] ${BOT_ROW} > div:last-child > div[class~='text-xs'] {
  font-size: var(--grok-font-body) !important;
  line-height: 17px !important;
  color: var(--grok-color-text-tertiary) !important;
}

/* The status dot moves off the name. The lead cell that held it collapses, so
   the title starts flush like Grok Bot's. */
html[data-grok-chat-look='true'] ${BOT_ROW} [class~='size-3.5'][class~='place-items-center'] {
  display: none !important;
}

/* Busy: a green dot on the avatar's lower right, ringed in the row color so it
   reads as cut out of the face. It exists only while the bot is working. */
html[data-grok-chat-look='true'] ${BOT_ROW}:has(${BUSY_STATUS}) > div:first-child::after {
  content: '';
  position: absolute;
  z-index: 1;
  top: 20px;
  left: 20px;
  width: 9px;
  height: 9px;
  border-radius: 9999px;
  background: var(--grok-status-busy);
  box-shadow: 0 0 0 2px var(--grok-row-ring);
}

/* Waiting on you: an orange dot at the row's end replaces the age, and the
   preview turns amber. */
html[data-grok-chat-look='true'] ${BOT_ROW}:has(${WAITING_STATUS})::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 14px;
  width: 8px;
  height: 8px;
  margin-top: -4px;
  border-radius: 9999px;
  background: var(--grok-status-waiting);
}

html[data-grok-chat-look='true'] ${BOT_ROW}:has(${WAITING_STATUS}) > div:last-child {
  padding-right: 18px !important;
}

html[data-grok-chat-look='true'] ${BOT_ROW}:has(${WAITING_STATUS}) [class~='justify-between'] > span[class~='shrink-0'] {
  display: none !important;
}

html[data-grok-chat-look='true'] ${BOT_ROW}:has(${WAITING_STATUS}) > div:last-child > div[class~='text-xs'] {
  color: var(--grok-status-waiting-text) !important;
}

/* --------------------------------------------------------------- scrollbars */

html[data-grok-chat-look='true'] [data-grok-scrollbar='true'] {
  scrollbar-width: thin !important;
  scrollbar-color: transparent transparent !important;
}

html[data-grok-chat-look='true'] [data-grok-scrollbar='true'][data-grok-scrolling='true'] {
  scrollbar-color: color-mix(in srgb, var(--grok-color-text) 22%, transparent) transparent !important;
}
`

function safeGet(key) {
  try {
    return pluginStorage?.get?.(key, null) ?? null
  } catch {
    return null
  }
}

function safeSet(key, value) {
  try {
    pluginStorage?.set?.(key, value)
  } catch {
    /* storage is best effort; the skin still renders without a saved choice */
  }
}

function readChatWidthMode() {
  return safeGet(CHAT_WIDTH_STORAGE_KEY) === 'centered' ? 'centered' : 'full'
}

function readPinnedUserMessagesMode() {
  return safeGet(PINNED_USER_MESSAGES_STORAGE_KEY) === 'hermes' ? 'hermes' : 'off'
}

function syncRoot() {
  const root = globalThis.document?.documentElement
  if (!root || root.dataset.grokChatLook !== 'true') return
  root.dataset.grokChatWidth = readChatWidthMode()
  root.dataset.grokPinnedUserMessages = readPinnedUserMessagesMode()
}

function clearRoot() {
  const root = globalThis.document?.documentElement
  if (!root) return
  delete root.dataset.grokChatLook
  root.style.removeProperty(PLACEHOLDER_VAR)
  root.removeAttribute('data-grok-chat-width')
  root.removeAttribute('data-grok-pinned-user-messages')
  if (root.dataset.grokChatLookBuild === BUILD_ID) delete root.dataset.grokChatLookBuild
}

function setChatWidthMode(mode) {
  safeSet(CHAT_WIDTH_STORAGE_KEY, mode === 'centered' ? 'centered' : 'full')
  syncRoot()
}

function setPinnedUserMessagesMode(mode) {
  safeSet(PINNED_USER_MESSAGES_STORAGE_KEY, mode === 'hermes' ? 'hermes' : 'off')
  syncRoot()
}

/* "Message Research Assistant" in the Bots view, where the active row names
   the bot whose chat is open. Elsewhere it names the focused profile, and the
   default profile is Hermes itself. */
function composerPlaceholderText(botName, profile) {
  const bot = String(botName || '').trim()
  if (bot) return `Message ${bot}`
  const name = String(profile || '').trim()
  return `Message ${!name || name === 'default' ? 'Hermes' : name}`
}

const ACTIVE_BOT_TITLE = `${BOT_ROW}[class*='ui-row-active-background'] span[class~='font-medium']`

function installPlaceholderRuntime() {
  const root = document.documentElement
  let last = null

  const update = () => {
    const botName = document.querySelector(ACTIVE_BOT_TITLE)?.textContent
    let profile = ''
    try {
      profile = host?.state?.focusedSessionProfile?.get?.() || host?.state?.profile?.get?.() || ''
    } catch {
      /* state atoms are best effort; fall back to Hermes */
    }
    const next = cssString(composerPlaceholderText(botName, profile))
    if (next === last) return
    last = next
    root.style.setProperty(PLACEHOLDER_VAR, next)
  }

  let frame = 0
  const schedule = () => {
    if (frame) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      update()
    })
  }

  // The active row is marked by a class, so watch class changes as well as
  // rows mounting. Work is coalesced to one query per frame.
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
  const offProfile = host?.state?.focusedSessionProfile?.subscribe?.(schedule)
  update()

  return () => {
    observer.disconnect()
    if (frame) window.cancelAnimationFrame(frame)
    offProfile?.()
    root.style.removeProperty(PLACEHOLDER_VAR)
  }
}

/* Overlay scrollbars: mark a scroll container while it is actively scrolling,
   then let the thumb fade. */
const SCROLL_SURFACES = `[data-slot='aui_thread-viewport'], [data-slot='sidebar-content'], [data-slot='composer-rich-input']`
const SCROLL_IDLE_MS = 700

function installScrollbarRuntime() {
  const timers = new WeakMap()
  const tracked = new Set()

  const onScroll = event => {
    const element = event.currentTarget
    element.setAttribute('data-grok-scrolling', 'true')
    window.clearTimeout(timers.get(element))
    timers.set(
      element,
      window.setTimeout(() => element.removeAttribute('data-grok-scrolling'), SCROLL_IDLE_MS)
    )
  }

  const track = element => {
    if (tracked.has(element)) return
    tracked.add(element)
    element.setAttribute('data-grok-scrollbar', 'true')
    element.addEventListener('scroll', onScroll, { passive: true })
  }

  const sweep = () => {
    for (const element of document.querySelectorAll(SCROLL_SURFACES)) track(element)
  }

  let frame = 0
  const schedule = () => {
    if (frame) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      sweep()
    })
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  sweep()

  return () => {
    observer.disconnect()
    if (frame) window.cancelAnimationFrame(frame)
    for (const element of tracked) {
      window.clearTimeout(timers.get(element))
      element.removeEventListener('scroll', onScroll)
      element.removeAttribute('data-grok-scrollbar')
      element.removeAttribute('data-grok-scrolling')
    }
    tracked.clear()
  }
}

/* The skin is all-or-nothing with its theme. Every rule is scoped behind
   data-grok-chat-look, and that attribute is only set while Hermes reports the
   Grok Skin theme as active (data-hermes-theme="grok-chat"). Pick any other
   theme in Appearance and Hermes' own look returns in full; pick Grok Skin
   again and the skin comes back, without a reload. */
function isGrokThemeActive(themeName) {
  return String(themeName || '') === GROK_THEME.name
}

function installThemeGate() {
  const root = document.documentElement
  let uninstallRuntimes = null

  const activate = () => {
    root.dataset.grokChatLook = 'true'
    root.dataset.grokChatLookBuild = BUILD_ID
    syncRoot()
    if (!uninstallRuntimes) {
      const uninstallScrollbars = installScrollbarRuntime()
      const uninstallPlaceholder = installPlaceholderRuntime()
      uninstallRuntimes = () => {
        uninstallScrollbars()
        uninstallPlaceholder()
      }
    }
  }

  const deactivate = () => {
    uninstallRuntimes?.()
    uninstallRuntimes = null
    clearRoot()
  }

  const reconcile = () => {
    const active = isGrokThemeActive(root.getAttribute('data-hermes-theme'))
    if (active && root.dataset.grokChatLook !== 'true') activate()
    else if (!active && (root.dataset.grokChatLook === 'true' || uninstallRuntimes)) deactivate()
  }

  const observer = new MutationObserver(reconcile)
  observer.observe(root, { attributes: true, attributeFilter: ['data-hermes-theme'] })
  reconcile()

  return () => {
    observer.disconnect()
    deactivate()
  }
}

function GrokChatStyleRuntime() {
  useEffect(() => {
    let style = document.getElementById(STYLE_ID)
    if (!style) {
      style = document.createElement('style')
      style.id = STYLE_ID
      document.head.appendChild(style)
    }
    style.textContent = CSS
    style.dataset.grokChatLookBuild = BUILD_ID

    // The stylesheet is inert until the gate sets the root attribute.
    const uninstallGate = installThemeGate()

    return () => {
      uninstallGate()
      style?.remove()
    }
  }, [])

  return null
}

export default {
  id: ID,
  name: 'Grok Skin',
  register(ctx) {
    pluginStorage = ctx.storage
    // The runtime removes the stylesheet when it unmounts, but a plugin can
    // also be disabled without unmounting it. Tear down here as well.
    ctx.onDispose?.(() => {
      globalThis.document?.getElementById(STYLE_ID)?.remove()
      clearRoot()
    })
    ctx.register({ id: 'theme', area: THEMES_AREA, data: GROK_THEME })
    ctx.register({
      id: 'toggle-chat-width',
      area: PALETTE_AREA,
      data: {
        id: `${ID}.toggle-chat-width`,
        label: 'Grok Skin: Chat width',
        detail: () => (readChatWidthMode() === 'full' ? 'Full' : 'Centered'),
        detailVariant: 'state',
        keepOpen: true,
        keywords: ['grok', 'skin', 'chat', 'composer', 'width', 'column', 'centered', 'full'],
        run: () => setChatWidthMode(readChatWidthMode() === 'full' ? 'centered' : 'full')
      }
    })
    ctx.register({
      id: 'toggle-pinned-user-messages',
      area: PALETTE_AREA,
      data: {
        id: `${ID}.toggle-pinned-user-messages`,
        label: 'Grok Skin: Pinned user messages',
        detail: () => (readPinnedUserMessagesMode() === 'hermes' ? 'Hermes' : 'Off'),
        detailVariant: 'state',
        keepOpen: true,
        keywords: ['grok', 'skin', 'pinned', 'sticky', 'user', 'message', 'prompt', 'hermes'],
        run: () => setPinnedUserMessagesMode(readPinnedUserMessagesMode() === 'hermes' ? 'off' : 'hermes')
      }
    })
    ctx.register({
      id: 'style-runtime',
      area: TITLEBAR_AREAS.center,
      order: 9999,
      render: () => jsx(GrokChatStyleRuntime, {})
    })
  }
}
