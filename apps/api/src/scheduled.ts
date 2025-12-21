import type { Env } from './types'

// Scheduled handler for recurring tasks
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Process recurring tasks
    try {
      const response = await fetch('https://your-worker-url.workers.dev/recurring/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        console.error('Failed to process recurring tasks:', await response.text())
      } else {
        const result = await response.json()
        console.log(`Processed ${result.processed} recurring tasks`)
      }
    } catch (error) {
      console.error('Error processing recurring tasks:', error)
    }
  }
}
