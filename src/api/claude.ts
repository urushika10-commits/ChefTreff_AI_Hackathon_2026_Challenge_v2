import type { Message } from '../lib/types'

export interface StreamCallbacks {
  onText: (text: string) => void
  onThinkingStart?: () => void
  onThinking?: (text: string) => void
  onThinkingEnd?: () => void
  onDone?: (usage: { input: number; output: number }) => void
  onError?: (message: string) => void
}

export async function streamChat(
  messages: Message[],
  systemPrompt: string,
  apiKey: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }))
    callbacks.onError?.(err.error || 'Request failed')
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    callbacks.onError?.('No response stream')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data) continue

      try {
        const event = JSON.parse(data)
        switch (event.type) {
          case 'text':
            callbacks.onText(event.text)
            break
          case 'thinking_start':
            callbacks.onThinkingStart?.()
            break
          case 'thinking':
            callbacks.onThinking?.(event.text)
            break
          case 'thinking_end':
            callbacks.onThinkingEnd?.()
            break
          case 'done':
            callbacks.onDone?.(event.usage)
            break
          case 'error':
            callbacks.onError?.(event.message)
            break
        }
      } catch {
        // ignore malformed events
      }
    }
  }
}
