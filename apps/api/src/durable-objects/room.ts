import type { Env } from '../types'

export class RoomDurableObject implements DurableObject {
  private state: DurableObjectState
  private env: Env
  private sessions: Map<WebSocket, string>

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
}
