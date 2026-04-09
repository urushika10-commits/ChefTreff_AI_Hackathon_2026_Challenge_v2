import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json({ limit: '4mb' }))

// Detect provider from key prefix
function detectProvider(apiKey) {
  if (apiKey.startsWith('sk-ant-')) return 'anthropic'
  if (apiKey.startsWith('xai-'))    return 'xai'      // Grok (xAI)
  if (apiKey.startsWith('AIza'))    return 'gemini'   // Google Gemini
  if (apiKey.startsWith('sk-') || apiKey.startsWith('sess-')) return 'openai'
  return 'anthropic'
}

// Config for OpenAI-compatible providers
const COMPAT_PROVIDERS = {
  openai:  { baseURL: null,                                                                 model: 'gpt-4o' },
  xai:     { baseURL: 'https://api.x.ai/v1',                                               model: 'grok-3' },
  gemini:  { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',           model: 'gemini-2.0-flash' },
}

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Main chat endpoint — streams SSE back to the client
app.post('/api/chat', async (req, res) => {
  const { messages, systemPrompt, apiKey } = req.body

  if (!apiKey) {
    return res.status(400).json({ error: 'API key required. Set it in Settings.' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const provider = detectProvider(apiKey)

  try {
    if (provider === 'anthropic') {
      // ── Anthropic / Claude ──────────────────────────────────────────────
      const client = new Anthropic({ apiKey })

      const stream = client.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: systemPrompt,
        messages,
      })

      let isInThinkingBlock = false

      stream.on('streamEvent', (event) => {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'thinking') {
            isInThinkingBlock = true
            sendEvent({ type: 'thinking_start' })
          } else if (event.content_block.type === 'text') {
            isInThinkingBlock = false
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'thinking_delta') {
            sendEvent({ type: 'thinking', text: event.delta.thinking })
          } else if (event.delta.type === 'text_delta') {
            sendEvent({ type: 'text', text: event.delta.text })
          }
        } else if (event.type === 'content_block_stop') {
          if (isInThinkingBlock) {
            sendEvent({ type: 'thinking_end' })
            isInThinkingBlock = false
          }
        }
      })

      stream.on('finalMessage', (message) => {
        sendEvent({
          type: 'done',
          usage: {
            input: message.usage.input_tokens,
            output: message.usage.output_tokens,
          },
        })
        res.end()
      })

      stream.on('error', (err) => {
        sendEvent({ type: 'error', message: err.message })
        res.end()
      })
    } else {
      // ── OpenAI-compatible (OpenAI / Grok / Gemini) ──────────────────────
      const cfg = COMPAT_PROVIDERS[provider]
      const clientOpts = { apiKey }
      if (cfg.baseURL) clientOpts.baseURL = cfg.baseURL
      const client = new OpenAI(clientOpts)

      const openaiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ]

      const stream = await client.chat.completions.create({
        model: cfg.model,
        stream: true,
        messages: openaiMessages,
      })

      let inputTokens = 0
      let outputTokens = 0

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
          sendEvent({ type: 'text', text: delta.content })
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0
          outputTokens = chunk.usage.completion_tokens ?? 0
        }
      }

      sendEvent({ type: 'done', usage: { input: inputTokens, output: outputTokens } })
      res.end()
    }
  } catch (err) {
    sendEvent({ type: 'error', message: err.message || 'Unknown error' })
    res.end()
  }
})

// GitHub proxy — avoids CORS issues and keeps token server-side optional
app.get('/api/github/repo', async (req, res) => {
  const { owner, repo, path = '', githubToken } = req.query
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' })

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'DualMind-AI-App',
  }
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`

  try {
    const response = await fetch(url, { headers })
    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({ error: text })
    }
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Fetch a single file's content from GitHub
app.get('/api/github/file', async (req, res) => {
  const { owner, repo, path, githubToken } = req.query
  if (!owner || !repo || !path) return res.status(400).json({ error: 'owner, repo and path required' })

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
  const headers = {
    Accept: 'application/vnd.github.v3.raw',
    'User-Agent': 'DualMind-AI-App',
  }
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`

  try {
    const response = await fetch(url, { headers })
    if (!response.ok) return res.status(response.status).json({ error: 'File not found' })
    const text = await response.text()
    res.json({ content: text, path })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 DualMind AI server running on http://localhost:${PORT}`)
})
