export class GatewayError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'GatewayError'
    Object.assign(this, { code: 'network_error', status: 0, ...details })
  }
  toJSON() { return { message: this.message, code: this.code, status: this.status, requestId: this.requestId, retryAfter: this.retryAfter } }
}

export function normalizeBase(value) {
  let url
  try { url = new URL(value.trim()) } catch { throw new GatewayError('请输入完整的网关地址，例如 http://127.0.0.1:18081/v1', { code: 'invalid_url' }) }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (!['http:', 'https:'].includes(url.protocol) || (url.protocol === 'http:' && !local) || url.username || url.password || url.search || url.hash) {
    throw new GatewayError('远程网关须使用 HTTPS；本机可使用 HTTP。地址不能含账号、查询参数或片段。', { code: 'invalid_url' })
  }
  const path = url.pathname.replace(/\/+$/, '')
  if (path && path !== '/v1') throw new GatewayError('请输入网关根地址，或以 /v1 结尾的地址。', { code: 'invalid_url' })
  return `${url.origin}/v1`
}

export function retrySeconds(value) {
  if (!value) return undefined
  if (/^\d+$/.test(value)) return Number(value)
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? Math.max(1, Math.ceil((timestamp - Date.now()) / 1000)) : undefined
}

export async function checkedResponse(response) {
  if (response.ok) return response
  let data
  try { data = await response.json() } catch { /* A proxy may return a non-JSON error. */ }
  throw new GatewayError(data?.error?.message || data?.message || `网关请求失败（HTTP ${response.status}）`, {
    status: response.status, code: data?.error?.code || data?.code || 'http_error',
    requestId: response.headers.get('x-request-id') || data?.request_id,
    retryAfter: retrySeconds(response.headers.get('retry-after')),
  })
}

export async function* sseFrames(body, maxBytes = 1024 * 1024) {
  if (!body) throw new GatewayError('网关没有返回数据流。', { code: 'invalid_stream' })
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const encoder = new TextEncoder()
  let pending = '', data = [], size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      pending += decoder.decode(value, { stream: !done })
      let end
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end).replace(/\r$/, '')
        pending = pending.slice(end + 1)
        size += encoder.encode(line).length
        if (size > maxBytes) throw new GatewayError('数据帧超过大小限制。', { code: 'invalid_stream' })
        if (!line) {
          if (data.length) yield data.join('\n')
          data = []; size = 0
        } else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      }
      if (encoder.encode(pending).length + size > maxBytes) throw new GatewayError('数据帧超过大小限制。', { code: 'invalid_stream' })
      if (done) break
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export function createGateway({ baseUrl, apiKey, fetchImpl = fetch }) {
  const base = normalizeBase(baseUrl)
  if (typeof apiKey !== 'string' || !apiKey.trim() || /[\r\n]/.test(apiKey)) throw new GatewayError('请输入有效的 API Key。', { code: 'invalid_key' })
  const key = apiKey.trim()
  async function request(path, { signal, body } = {}) {
    const timeout = AbortSignal.timeout(body ? 310000 : 15000)
    return checkedResponse(await fetchImpl(`${base}${path}`, {
      method: body ? 'POST' : 'GET', redirect: 'error', cache: 'no-store',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    }))
  }
  return {
    baseUrl: base,
    async models() {
      const body = await (await request('/models')).json()
      if (!Array.isArray(body.data)) throw new GatewayError('模型目录格式不符合接口约定。', { code: 'invalid_response' })
      const list = body.data.filter(model => typeof model?.id === 'string' && model.id.trim()).map(model => ({ id: model.id, owned_by: model.owned_by }))
      if (!list.length) throw new GatewayError('此密钥暂时没有可用模型，请检查套餐和模型授权。', { code: 'empty_models' })
      return list
    },
    async quota() { return (await request('/quota')).json() },
    async *chat({ model, messages, temperature = 0.7, max_tokens = 2048 }, signal) {
      if (!model || !Array.isArray(messages) || !messages.length || messages.some(m => !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string') || JSON.stringify(messages).length > 500000) {
        throw new GatewayError('消息内容无效或超出大小限制。', { code: 'invalid_request' })
      }
      const response = await request('/chat/completions', { signal, body: {
        model, messages, temperature: Math.max(0, Math.min(2, Number(temperature) || 0)),
        max_tokens: Math.max(128, Math.min(16384, Number(max_tokens) || 2048)), stream: true, stream_options: { include_usage: true },
      } })
      const requestId = response.headers.get('x-request-id')
      if (!response.headers.get('content-type')?.includes('text/event-stream')) {
        await response.body?.cancel()
        throw new GatewayError('网关没有返回 SSE 流式响应。', { code: 'invalid_stream', requestId })
      }
      let contentSeen = false, finishReason = null
      for await (const raw of sseFrames(response.body)) {
        if (raw === '[DONE]') {
          if (!contentSeen && !finishReason) throw new GatewayError('模型返回了空数据流。', { code: 'incomplete_stream', requestId })
          yield { type: 'done', requestId, finishReason: finishReason || 'stop' }
          return
        }
        let event
        try { event = JSON.parse(raw) } catch { throw new GatewayError('流式响应含无效 JSON。', { code: 'invalid_stream', requestId }) }
        if (event.error) throw new GatewayError(event.error.message || '生成中断。', { code: event.error.code || 'stream_error', requestId: event.request_id || requestId })
        const choice = event.choices?.find(item => (item.index ?? 0) === 0)
        const delta = choice?.delta?.content
        if (typeof delta === 'string' && delta) { contentSeen = true; yield { type: 'delta', text: delta, requestId } }
        if (choice?.finish_reason) finishReason = choice.finish_reason
        if (event.usage) yield { type: 'usage', usage: event.usage, requestId }
      }
      if (finishReason === 'length') { yield { type: 'done', finishReason, requestId }; return }
      throw new GatewayError('连接提前结束，回复可能不完整；未自动重试。', { code: 'incomplete_stream', requestId })
    },
  }
}
