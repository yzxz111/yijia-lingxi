import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBase, createGateway, sseFrames, retrySeconds } from '../shared/gateway.mjs'

const encode = new TextEncoder()
function body(chunks) { return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? encode.encode(chunk) : chunk); controller.close() } }) }
function event(data) { return `data: ${JSON.stringify(data)}\r\n\r\n` }
const delta = text => ({ choices: [{ index: 0, delta: { content: text } }] })
function fake(chunks) { return createGateway({ baseUrl:'http://127.0.0.1:18081', apiKey:'test-key', fetchImpl:async () => new Response(body(chunks),{ headers: { 'content-type':'text/event-stream','x-request-id':'test-request' } }) }) }
const input = { model:'chat-standard',messages:[{ role:'user',content:'你好' }] }
async function collect(stream) { const results=[]; for await (const item of stream) results.push(item); return results }

test('规范化地址且禁止远程明文、凭据、查询参数和错误路径', () => {
  assert.equal(normalizeBase('http://127.0.0.1:18081/'),'http://127.0.0.1:18081/v1')
  assert.equal(normalizeBase('https://example.com/v1/'),'https://example.com/v1')
  assert.equal(normalizeBase('http://[::1]:8080'),'http://[::1]:8080/v1')
  for (const url of ['http://remote.example','https://u:p@example.com','file:///etc/passwd','https://example.com/v1?key=a','https://example.com/v1#fragment','https://example.com/admin']) assert.throws(() => normalizeBase(url))
})
test('密钥不能为空或携带换行', () => {
  for (const key of ['', ' ', 'a\r\nb']) assert.throws(() => createGateway({ baseUrl:'https://example.com', apiKey:key }))
})
test('中文 UTF-8 与 CRLF 按单字节分片仍完整解析', async () => {
  const bytes = encode.encode(': heartbeat\r\n\r\n' + event(delta('你好，世界')) + 'data: [DONE]\r\n\r\n')
  const packets=await collect(fake([...bytes].map(byte=>new Uint8Array([byte]))).chat(input))
  assert.equal(packets.find(p=>p.type==='delta').text,'你好，世界')
  assert.equal(packets.at(-1).type,'done')
  assert.equal(packets.at(-1).requestId,'test-request')
})
test('保留 usage 帧与输出达到上限的终态', async () => {
  const packets=await collect(fake([event(delta('内容')),event({usage:{total_tokens:123}}),event({choices:[{index:0,delta:{},finish_reason:'length'}]})]).chat(input))
  assert.equal(packets.find(p=>p.type==='usage').usage.total_tokens,123)
  assert.equal(packets.at(-1).finishReason,'length')
})
test('空 DONE 不被误判成功', async () => { await assert.rejects(()=>collect(fake(['data: [DONE]\n\n']).chat(input)), {code:'incomplete_stream'}) })
test('内容后无终态断流标为不完整', async () => { await assert.rejects(()=>collect(fake([event(delta('部分'))]).chat(input)),{code:'incomplete_stream'}) })
test('不信任未用空行结束的 SSE 尾帧', async () => { const values=await collect(sseFrames(body(['data: {"secret":1}\n']))); assert.deepEqual(values,[]) })
test('流中结构化错误保留错误码及请求 ID', async () => {
  await assert.rejects(()=>collect(fake([event(delta('部分')),event({error:{message:'quota exhausted',code:'package_unavailable'},request_id:'trace-123'})]).chat(input)), {code:'package_unavailable',requestId:'trace-123'})
})
test('损坏的 JSON 与超大帧会被拒绝', async () => {
  await assert.rejects(()=>collect(fake(['data: bad json\n\n']).chat(input)),{code:'invalid_stream'})
  await assert.rejects(()=>collect(sseFrames(body(['data: '+ 'a'.repeat(200)]),128)),{code:'invalid_stream'})
})
test('401 / 429 / 503 及生成请求均不会自动重试', async () => {
  for (const status of [401,429,503]) {
    let calls=0
    const client=createGateway({baseUrl:'https://example.com',apiKey:'test',fetchImpl:async (_url, options)=>{
      calls++; assert.equal(options.redirect,'error')
      return new Response(JSON.stringify({error:{message:'blocked',code:status===429?'rate_limit_exceeded':'error'}}),{status,headers:{'content-type':'application/json','retry-after':'60','x-request-id':'test-429'}})
    }})
    await assert.rejects(()=>collect(client.chat(input)),{status,requestId:'test-429',retryAfter:60})
    assert.equal(calls,1)
  }
})
test('客户端取消会传递到 fetch', async () => {
  const abort=new AbortController(); let received
  const client=createGateway({baseUrl:'https://example.com',apiKey:'test',fetchImpl:async (_url, options)=>{ received=options.signal; return new Response(body([event(delta('ok')),'data: [DONE]\n\n']),{headers:{'content-type':'text/event-stream'}}) }})
  await collect(client.chat(input,abort.signal)); abort.abort(); assert.equal(received.aborted,true)
})
test('模型目录来自真实响应，不混入演示模型', async () => {
  const client=createGateway({baseUrl:'https://example.com',apiKey:'test',fetchImpl:async ()=>Response.json({data:[{id:'real-model'},{bad:true}]})})
  assert.deepEqual(await client.models(),[{id:'real-model',owned_by:undefined}])
})
test('Retry-After 日期和秒值解析', () => { assert.equal(retrySeconds('60'),60); assert.equal(retrySeconds('bogus'),undefined); assert.ok(retrySeconds(new Date(Date.now()+60000).toUTCString())>=59) })
