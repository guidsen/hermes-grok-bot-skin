import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const pluginUrl = new URL('../../grok-chat-look/plugin.js', import.meta.url)

export async function readPluginSource() {
  return readFile(pluginUrl, 'utf8')
}

/**
 * Evaluate plugin.js outside Hermes and hand back the named internals plus the
 * default export. Imports are stripped and the SDK surface is stubbed, so the
 * tests exercise the real source rather than a copy of it.
 */
export async function loadPlugin(names = [], overrides = {}) {
  let source = await readPluginSource()
  source = source
    .replace(/^import .*$/gm, '')
    .replace(/export default\s*\{/, 'globalThis.__pluginDefault = {')

  const exposed = names
    .map(name => `${JSON.stringify(name)}: typeof ${name} === 'undefined' ? null : ${name}`)
    .join(',')
  source += `\nglobalThis.__pluginInternals = {${exposed}};`

  const state = value => ({ get: () => value, subscribe: () => () => {} })
  const context = vm.createContext({
    host: {
      state: {
        activeSessionId: state('grok-test'),
        gateway: state('open'),
        profile: state('default')
      },
      onEvent: () => () => {}
    },
    jsx: () => null,
    useEffect: () => {},
    THEMES_AREA: 'themes',
    PALETTE_AREA: 'palette',
    TITLEBAR_AREAS: { center: 'center' },
    window: { location: { hash: '#/grok-test' } },
    console,
    ...overrides
  })
  context.globalThis = context
  vm.runInContext(source, context, { filename: pluginUrl.pathname })

  return { internals: context.__pluginInternals, plugin: context.__pluginDefault }
}

/** Collect the contributions a plugin registers, with a stubbed PluginContext. */
export function collectContributions(plugin, storage = new Map()) {
  const contributions = []
  plugin.register({
    storage: {
      get: (key, fallback = null) => (storage.has(key) ? storage.get(key) : fallback),
      set: (key, value) => storage.set(key, value),
      remove: key => storage.delete(key)
    },
    register: contribution => {
      contributions.push(contribution)
      return () => {}
    },
    registerMany: list => list.forEach(item => contributions.push(item))
  })
  return contributions
}

/**
 * Parse the skin's stylesheet into rules. Comments are stripped first so the
 * fidelity tests see selectors only.
 */
export function parseRules(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = []
  for (const chunk of stripped.split('}')) {
    const [selector, body] = chunk.split('{')
    if (!body) continue
    rules.push({ selectors: splitSelectorList(selector), body: body.trim() })
  }
  return rules
}

/** Split a selector list on top-level commas, so `:where(p, li)` stays intact. */
function splitSelectorList(selector) {
  const parts = []
  let depth = 0
  let current = ''
  for (const char of selector) {
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)
  return parts.map(part => part.trim()).filter(Boolean)
}

/** Find the rule whose selector list is exactly the one given. */
export function findRule(rules, ...selectors) {
  const wanted = selectors.join('|')
  const match = rules.find(rule => rule.selectors.join('|') === wanted)
  if (!match) throw new Error(`no rule for: ${wanted}`)
  return match.body
}
