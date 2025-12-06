import type { Env } from '../types'

export class RoomDurableObject implements DurableObject {
  private state: DurableObjectState
  private env: Env
  private sessions: Map<WebSocket, string>
  private alarmSet = false

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.sessions = new Map()
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    if (url.pathname === '/connect') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      await this.handleSession(server)
      return new Response(null, { status: 101, webSocket: client })
    }
    if (url.pathname === '/schedule') {
      // Set an alarm to run due date checks; default in 5 minutes
      const when = Date.now() + 5 * 60 * 1000
      await this.state.storage.put('alarm-when', when)
      await this.state.storage.setAlarm(when)
      return new Response(JSON.stringify({ scheduled: when }), { headers: { 'content-type': 'application/json' } })
    }
    return new Response('Not found', { status: 404 })
  }

  private async handleSession(ws: WebSocket) {
    ws.accept()
    this.sessions.set(ws, 'connected')
    ws.addEventListener('message', (evt: MessageEvent) => {
      const data = typeof evt.data === 'string' ? evt.data : ''
      for (const client of this.sessions.keys()) {
        try { client.send(data) } catch {}
      }
    })
    ws.addEventListener('close', () => {
      this.sessions.delete(ws)
    })
  }

  async alarm() {
    // Run due date checks: fire task.due_soon and task.overdue
    try {
      const now = Date.now()
      // In absence of direct DB access in DO, call API to process due tasks
      await fetch('http://internal/process-due', { method: 'POST' })
    } catch {}
    // Reschedule next alarm in 15 minutes
    const next = Date.now() + 15 * 60 * 1000
    await this.state.storage.put('alarm-when', next)
    await this.state.storage.setAlarm(next)
  }
}
