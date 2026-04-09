import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json({ limit: '20mb' })) // larger limit for base64 images

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
  openai:  { baseURL: null,                                                       model: 'gpt-4o' },
  xai:     { baseURL: 'https://api.x.ai/v1',                                     model: 'grok-3' },
  gemini:  { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-2.0-flash' },
}

// Append uploaded text files to system prompt as a context block
function appendFilesToSystem(systemPrompt, textFiles) {
  if (!textFiles || textFiles.length === 0) return systemPrompt
  const ctx = textFiles
    .map((f) => `### ${f.name}\n\`\`\`\n${f.content.slice(0, 60_000)}\n\`\`\``)
    .join('\n\n')
  return `${systemPrompt}\n\n## Uploaded Files Context\n${ctx}`
}

// Build content for the last user message with images attached
function buildLastUserContent(text, images, provider) {
  if (!images || images.length === 0) return text

  if (provider === 'anthropic') {
    const blocks = images.map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
    }))
    blocks.push({ type: 'text', text })
    return blocks
  }

  // OpenAI-compatible format (OpenAI, xAI, Gemini compat)
  const blocks = images.map((img) => ({
    type: 'image_url',
    image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
  }))
  blocks.push({ type: 'text', text })
  return blocks
}

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Main chat endpoint — streams SSE back to the client
app.post('/api/chat', async (req, res) => {
  const {
    messages,
    systemPrompt: rawSystem,
    apiKey,
    textFiles = [],
    images    = [],
  } = req.body

  if (!apiKey) {
    return res.status(400).json({ error: 'API key required. Set it in Settings.' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  const provider = detectProvider(apiKey)
  const systemPrompt = appendFilesToSystem(rawSystem, textFiles)

  // Attach images to the last user message
  const apiMessages = messages.map((m, i) => {
    if (i === messages.length - 1 && m.role === 'user') {
      return { role: 'user', content: buildLastUserContent(m.content, images, provider) }
    }
    return m
  })

  try {
    if (provider === 'anthropic') {
      // ── Anthropic / Claude ──────────────────────────────────────────────
      const client = new Anthropic({ apiKey })

      const stream = client.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: systemPrompt,
        messages: apiMessages,
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
        ...apiMessages,
      ]

      const stream = await client.chat.completions.create({
        model: cfg.model,
        stream: true,
        stream_options: { include_usage: true },
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

// Git Trees API — returns the full recursive file tree in one request
app.get('/api/github/tree', async (req, res) => {
  const { owner, repo, githubToken } = req.query
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required' })

  const ghHeaders = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'DualMind-AI-App',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (githubToken) ghHeaders['Authorization'] = `Bearer ${githubToken}`

  try {
    // Step 1: get default branch
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders })
    if (!repoRes.ok) {
      const text = await repoRes.text()
      let msg = text
      try { msg = JSON.parse(text).message || text } catch {}
      return res.status(repoRes.status).json({ error: `GitHub ${repoRes.status}: ${msg}` })
    }
    const repoData = await repoRes.json()
    const branch = repoData.default_branch || 'main'

    // Step 2: get full recursive tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers: ghHeaders },
    )
    if (!treeRes.ok) {
      const text = await treeRes.text()
      let msg = text
      try { msg = JSON.parse(text).message || text } catch {}
      return res.status(treeRes.status).json({ error: `GitHub ${treeRes.status}: ${msg}` })
    }
    const treeData = await treeRes.json()
    res.json({ tree: treeData.tree || [], branch, truncated: treeData.truncated })
  } catch (err) {
    console.error('[github/tree] fetch threw:', err.message)
    res.status(500).json({ error: `Server error: ${err.message}` })
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
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`

  try {
    const response = await fetch(url, { headers })
    const text = await response.text()
    console.log(`[github/repo] ${response.status} ${url}`)
    if (!response.ok) {
      // Try to extract a clean message from GitHub's JSON error body
      let message = text
      try {
        const parsed = JSON.parse(text)
        message = parsed.message || text
      } catch {}
      console.error(`[github/repo] error body: ${message}`)
      return res.status(response.status).json({ error: `GitHub ${response.status}: ${message}` })
    }
    res.json(JSON.parse(text))
  } catch (err) {
    console.error('[github/repo] fetch threw:', err.message)
    res.status(500).json({ error: `Server fetch error: ${err.message}` })
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
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`

  try {
    const response = await fetch(url, { headers })
    console.log(`[github/file] ${response.status} ${path}`)
    if (!response.ok) {
      const text = await response.text()
      let message = text
      try { message = JSON.parse(text).message || text } catch {}
      return res.status(response.status).json({ error: `GitHub ${response.status}: ${message}` })
    }
    const text = await response.text()
    res.json({ content: text, path })
  } catch (err) {
    console.error('[github/file] fetch threw:', err.message)
    res.status(500).json({ error: `Server fetch error: ${err.message}` })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 DualMind AI server running on http://localhost:${PORT}`)
})
