// Host half of dsh-bubble-nav.
// Serves the full outline + question list for a session over a web route so the
// browser bundle can fetch complete data without depending on the loaded window.
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

function clip(text, max) {
  const s = String(text).replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  return s.slice(0, max) + '…'
}

function buildOutline(events) {
  const entries = []
  let contextCount = 0
  if (!Array.isArray(events)) return entries
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue
    const d = ev.data && typeof ev.data === 'object' ? ev.data : {}
    const seq = typeof ev.seq === 'number' ? ev.seq : null
    const time = typeof ev.time === 'number' ? ev.time : null
    if (ev.type === 'user/message') {
      const src = d.source && typeof d.source === 'object' ? d.source : {}
      if (src.kind !== 'user') {
        contextCount++
        continue
      }
      const t = textOf(d.content)
      entries.push({ kind: 'user', seq, time, label: t ? clip(t, 60) : '(空消息)' })
    } else if (ev.type === 'assistant/message') {
      const msg = d.message && typeof d.message === 'object' ? d.message : {}
      const t = textOf(msg.content)
      entries.push({ kind: 'assistant-step', seq, time, label: t ? clip(t, 60) : '(助手回复)' })
    } else if (ev.type === 'tool/call') {
      entries.push({ kind: 'tool-call', seq, time, label: '工具: ' + (d.name || '?') })
    } else if (ev.type === 'command/run') {
      entries.push({ kind: 'command', seq, time, label: '/' + (d.name || '命令') })
    }
  }
  if (contextCount > 0) {
    entries.push({ kind: 'context-agg', seq: -1, time: null, label: '上下文注入 ×' + contextCount, disabled: true })
  }
  return entries
}

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
  const webServer = ctx.get('webServer')
  if (webServer === undefined) return
  webServer.register({
    kind: 'exact',
    path: '/dsh-bubble-nav',
    handler: async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const sessionId = url.searchParams.get('sessionId')
      if (!sessionId) {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ outline: [], questions: [], error: 'missing sessionId' }))
        return
      }
      const sq = ctx.get('sessionQuery')
      if (!sq) {
        res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ outline: [], questions: [], error: 'sessionQuery unavailable' }))
        return
      }
      try {
        const snap = await sq.readSession(sessionId)
        const events = snap && snap.events
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({
          outline: buildOutline(events),
          questions: buildQuestions(events),
        }))
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ outline: [], questions: [], error: String((err && err.message) || err) }))
      }
    },
  })
}

export { apply }
