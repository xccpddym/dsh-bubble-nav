// Host half of dsh-bubble-nav.
//
// Serves the full outline + question list for a session over a web route so the
// browser bundle can fetch complete data without depending on the loaded window.
//
// Robustness contract: apply() must NEVER throw. In dsh, a plugin whose apply()
// throws fails its fiber and the whole Cordis tree goes down (fail-loud). Every
// service lookup and route registration below is defensive: a missing service
// or a duplicate route degrades to a warning + no-op instead of an exception.
//
// `inject` declares the services this plugin needs. Cordis holds the plugin's
// fiber until each declared service is provided, so apply() runs only after
// webServer and sessionQuery exist. Without this declaration apply() runs
// early (dependency-driven loading) and `ctx.get` returns undefined for both.

/** Services required before this plugin can mount its route. */
const inject = ["webServer", "sessionQuery"]

/** Flatten one message's content blocks into readable text. */
function textOf(blocks) {
  if (!Array.isArray(blocks)) return ''
  const parts = []
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue
    if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
      parts.push(b.text.trim())
    } else if (b.type === 'reasoning' && typeof b.text === 'string' && b.text.trim()) {
      parts.push('思考:' + b.text.trim())
    } else if (b.type === 'image') {
      parts.push('[图片]')
    } else if (b.type === 'tool-call' && typeof b.name === 'string') {
      parts.push('工具:' + b.name)
    } else if (typeof b.text === 'string' && b.text.trim()) {
      parts.push(b.text.trim())
    }
  }
  return parts.join(' ')
}

/** Collapse whitespace and clip a label to a display length. */
function clip(text, max) {
  const s = String(text).replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  return s.slice(0, max) + '…'
}

/** Build the full-session outline from raw session log events. */
function buildOutline(events) {
  const entries = []
  let contextCount = 0
  if (!Array.isArray(events)) return entries
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue
    const d = ev.data && typeof ev.data === 'object' ? ev.data : {}
    const seq = typeof ev.seq === 'number' ? ev.seq : null
    const time = typeof ev.time === 'number' ? ev.time : null
    switch (ev.type) {
      case 'user/message': {
        const src = d.source && typeof d.source === 'object' ? d.source : {}
        if (src.kind !== 'user') {
          contextCount++
          continue
        }
        const t = textOf(d.content)
        entries.push({ kind: 'user', seq, time, label: t ? clip(t, 60) : '(空消息)' })
        break
      }
      case 'assistant/message': {
        const msg = d.message && typeof d.message === 'object' ? d.message : {}
        const t = textOf(msg.content)
        entries.push({ kind: 'assistant-step', seq, time, label: t ? clip(t, 60) : '(助手回复)' })
        break
      }
      case 'tool/call': {
        entries.push({ kind: 'tool-call', seq, time, label: '工具: ' + (d.name || '?') })
        break
      }
      case 'tool/result': {
        entries.push({ kind: 'tool-call', seq, time, label: '工具结果' })
        break
      }
      case 'command/run': {
        entries.push({ kind: 'command', seq, time, label: '/' + (d.name || '命令') })
        break
      }
      default:
        break
    }
  }
  if (contextCount > 0) {
    entries.push({ kind: 'context-agg', seq: -1, time: null, label: '上下文注入 ×' + contextCount, disabled: true })
  }
  return entries
}

/** Build the numbered question list (user messages only). */
function buildQuestions(events) {
  const entries = []
  if (!Array.isArray(events)) return entries
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue
    if (ev.type !== 'user/message') continue
    const d = ev.data && typeof ev.data === 'object' ? ev.data : {}
    const src = d.source && typeof d.source === 'object' ? d.source : {}
    if (src.kind !== 'user') continue
    const seq = typeof ev.seq === 'number' ? ev.seq : null
    const time = typeof ev.time === 'number' ? ev.time : null
    const t = textOf(d.content)
    entries.push({ kind: 'user', seq, time, label: t ? clip(t, 80) : '(空消息)' })
  }
  return entries
}

function apply(ctx) {
  // 1) Resolve the injected services. With `inject` declared they are present
  //    when apply runs; the fallbacks keep a missing service from throwing.
  const webServer = ctx.webServer ?? ctx.get('webServer')
  const sessionQuery = ctx.sessionQuery ?? ctx.get('sessionQuery')
  const warn = (...args) => {
    try { ctx.logger.warn(...args) } catch { /* logger absent: stay silent */ }
  }
  if (webServer === undefined || sessionQuery === undefined) {
    warn('dsh-bubble-nav: webServer or sessionQuery service unavailable; web route disabled')
    return
  }

  // 2) Register the route. A duplicate (kind, path) throws in webServer;
  //    catch it so a re-registration can never take the tree down.
  let dispose
  try {
    dispose = webServer.register({
      kind: 'exact',
      path: '/dsh-bubble-nav',
      handler: async (req, res) => {
        let url
        try {
          url = new URL(req.url || '/', 'http://localhost')
        } catch {
          url = null
        }
        const sessionId = url ? url.searchParams.get('sessionId') : null
        const respond = (status, body) => {
          try {
            res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(body))
          } catch { /* client gone: ignore */ }
        }
        if (!sessionId) {
          respond(400, { outline: [], questions: [], error: 'missing sessionId' })
          return
        }
        try {
          const snap = await sessionQuery.readSession(sessionId)
          const events = snap && snap.events
          respond(200, {
            outline: buildOutline(events),
            questions: buildQuestions(events),
          })
        } catch (err) {
          respond(500, { outline: [], questions: [], error: String((err && err.message) || err) })
        }
      },
    })
  } catch (err) {
    warn(`dsh-bubble-nav: route registration failed (${String((err && err.message) || err)}); skipping`)
    return
  }

  // 3) Tie the route to the plugin fiber lifecycle. Without this, unload or
  //    hot-reload leaves the route registered and the next boot would collide.
  try {
    ctx.effect(() => dispose, 'dsh-bubble-nav:route')
  } catch (err) {
    warn(`dsh-bubble-nav: failed to attach route lifecycle (${String((err && err.message) || err)})`)
  }
}

export { apply, inject }
