import { createGateway, GatewayError } from '../../shared/gateway.mjs'

let browserClient = null
function unwrap(result) {
  if (!result.ok) throw new GatewayError(result.error.message, result.error)
  return result.data
}
export const transport = {
  async connect(config) {
    if (window.lingxi) return unwrap(await window.lingxi.connect(config))
    const client = createGateway(config)
    const models = await client.models()
    browserClient = client
    return { baseUrl: client.baseUrl, models }
  },
  async disconnect() {
    if (window.lingxi) unwrap(await window.lingxi.disconnect())
    browserClient = null
  },
  async quota() {
    if (window.lingxi) return unwrap(await window.lingxi.quota())
    if (!browserClient) throw new Error('请先连接网关。')
    return browserClient.quota()
  },
  async chat(payload, onPacket, signal) {
    if (!window.lingxi) {
      if (!browserClient) throw new Error('请先连接网关。')
      for await (const packet of browserClient.chat(payload, signal)) onPacket(packet)
      return
    }
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = error => {
        if (settled) return
        settled = true
        unsubscribe()
        signal.removeEventListener('abort', abort)
        error ? reject(error) : resolve()
      }
      const abort = () => { window.lingxi.stopChat(payload.id).catch(finish) }
      const unsubscribe = window.lingxi.onChat(packet => {
        if (packet.id !== payload.id) return
        if (packet.type === 'error') { finish(new GatewayError(packet.error.message, packet.error)); return }
        onPacket(packet)
        if (['done', 'cancelled'].includes(packet.type)) finish()
      })
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) { finish(new DOMException('已停止', 'AbortError')); return }
      window.lingxi.startChat(payload).then(result => { unwrap(result); if (signal.aborted) abort() }).catch(finish)
    })
  },
}

export function explainError(error) {
  const hints = {
    invalid_api_key: '密钥无效或已停用，请到连接设置中重新填写。',
    model_not_allowed: '此密钥未获该模型授权，请重新连接并选择可用模型。',
    package_unavailable: '套餐不可用，请在一加中台查看套餐状态。',
    daily_request_limit_exceeded: '当日请求次数已用完，请等待北京时间次日后再试。',
    incomplete_stream: '连接提前结束，已保留部分回复。请核对用量后决定是否重新发送。',
  }
  const message = hints[error.code] || (error.name === 'TimeoutError' ? '网关响应超时，已保留部分内容。请核对用量后决定是否重发。' : error.message === 'Failed to fetch' || error.message === 'fetch failed' ? '无法连接网关，请检查服务是否启动及地址是否正确；浏览器预览还需要上游允许跨域。' : error.message)
  return `${message || '请求失败，请检查网关连接。'}${error.retryAfter != null ? ` 建议 ${error.retryAfter} 秒后重试。` : ''}${error.requestId ? ` 请求 ID：${error.requestId}` : ''}`
}
