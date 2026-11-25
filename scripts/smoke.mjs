import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import assert from 'node:assert/strict'
import path from 'node:path'

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))), require=createRequire(import.meta.url)
const resultsDir=path.join(root,'test-results'), profile=path.join(resultsDir,`profile-${Date.now()}`)
await mkdir(profile,{recursive:true})
const fixtureKey='fixture-only-key-not-a-real-credential', checks=[], errors=[], requests=[]
let cancelled=false
const server=createServer(async (req,res)=>{
  requests.push({path:req.url,method:req.method})
  if(req.headers.authorization!==`Bearer ${fixtureKey}`){res.writeHead(401,{'content-type':'application/json'});res.end(JSON.stringify({error:{message:'Invalid test key',code:'invalid_api_key'}}));return}
  if(req.url==='/v1/models'){res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{id:'fixture-model'}]}));return}
  if(req.url==='/v1/quota'){res.setHeader('content-type','application/json');res.end(JSON.stringify({packageCode:'FIXTURE',status:'ACTIVE',totalTokens:10000,usedTokens:123,remainingTokens:9877,usageDimension:'TOKEN',allowedModels:['fixture-model']}));return}
  if(req.url==='/v1/chat/completions'){
    let raw='';for await(const chunk of req)raw+=chunk
    const payload=JSON.parse(raw);assert.equal(payload.stream,true);assert.equal(payload.model,'fixture-model')
    res.writeHead(200,{'content-type':'text/event-stream','x-request-id':'fixture-request-123'})
    const text=payload.messages.at(-1).content
    if(text.includes('测试流错误')){res.write('data: '+JSON.stringify({choices:[{delta:{content:'保留的部分回复'},index:0}]})+'\n\n');res.end('data: '+JSON.stringify({error:{code:'provider_error',message:'测试上游中断'}})+'\n\n');return}
    if(text.includes('测试取消')){res.write('data: '+JSON.stringify({choices:[{delta:{content:'等待取消'},index:0}]})+'\n\n');const timer=setInterval(()=>res.write(': keepalive\n\n'),250);res.on('close',()=>{cancelled=true;clearInterval(timer)});return}
    const bytes=Buffer.from('data: '+JSON.stringify({choices:[{index:0,delta:{content:'真实传输测试：你好，灵犀。'}}]})+'\r\n\r\ndata: '+JSON.stringify({usage:{total_tokens:123}})+'\r\n\r\ndata: [DONE]\r\n\r\n')
    for(let i=0;i<bytes.length;i+=3){res.write(bytes.subarray(i,i+3));await new Promise(r=>setTimeout(r,1))}res.end();return
  }
  res.writeHead(404);res.end()
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const port=server.address().port
let app, page
async function launch(){
  const env={...process.env,LINGXI_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE
  app=await electron.launch({executablePath:require('electron'),args:[root],env,timeout:30000})
  page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',err=>errors.push(err.message));await page.waitForSelector('.welcome h1')
}
async function check(name,fn){await fn();checks.push({name,passed:true});console.log(`PASS ${name}`)}
async function screenshot(name){await page.screenshot({path:path.join(resultsDir,`${name}.png`),fullPage:true})}
try{
  await launch()
  await check('Electron 安全隔离和首页加载',async()=>{assert.equal(await page.evaluate(()=>typeof window.require),'undefined');assert.equal(await page.evaluate(()=>typeof window.lingxi.connect),'function');assert.ok((await page.locator('h1').innerText()).includes('好想法'))})
  await screenshot('01-home')
  await check('发现助手和分类切换',async()=>{await page.getByRole('button',{name:'发现助手',exact:true}).click();await page.getByRole('button',{name:'效率',exact:true}).click();assert.equal(await page.locator('.assistant-card').count(),2);await screenshot('02-assistants');await page.getByRole('button',{name:'全部',exact:true}).click();assert.equal(await page.locator('.assistant-card').count(),6)})
  await check('演示流式对话与收藏',async()=>{await page.getByRole('button',{name:'开启新对话'}).click();await page.getByRole('textbox',{name:'输入消息'}).fill('请帮我写一封邮件');await page.getByRole('button',{name:'发送消息',exact:true}).click();await page.getByRole('button',{name:'收藏回复',exact:true}).waitFor();await page.getByRole('button',{name:'收藏回复',exact:true}).click();await page.getByRole('button',{name:'我的收藏',exact:true}).click();assert.equal(await page.locator('.favorite-card').count(),1);await screenshot('03-favorite');await page.getByRole('button',{name:/查看原对话/}).click();await screenshot('04-chat')})
  await check('对话重命名与搜索',async()=>{await page.getByRole('button',{name:'重命名对话'}).click();await page.getByRole('textbox',{name:'对话名称'}).fill('灵犀桌面验证');await page.getByRole('button',{name:'保存名称'}).click();await page.keyboard.press('Control+k');await page.getByPlaceholder('搜索标题或对话内容…').fill('桌面验证');await page.locator('.search-results>button').click();assert.equal(await page.locator('.conversation-heading h1').innerText(),'灵犀桌面验证')})
  await check('复制回复写入系统剪贴板',async()=>{await page.getByRole('button',{name:'复制回复',exact:true}).first().click();await page.getByRole('status').filter({hasText:'回复已复制'}).waitFor();const copied=await app.evaluate(({clipboard})=>clipboard.readText());assert.ok(copied.includes('本地预设演示'))})
  await check('Markdown 导出文件内容完整',async()=>{
    const output=path.join(resultsDir,'exported-chat.md')
    const saved=app.evaluate(({BrowserWindow},output)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Download timed out')),10000);BrowserWindow.getAllWindows()[0].webContents.session.once('will-download',(_event,item)=>{item.setSavePath(output);item.once('done',(_event,state)=>{clearTimeout(timer);state==='completed'?resolve(true):reject(new Error(state))})})}),output)
    await page.getByRole('button',{name:'导出对话',exact:true}).click();await saved;const markdown=await readFile(output,'utf8');assert.ok(markdown.includes('# 灵犀桌面验证'));assert.ok(markdown.includes('本地预设演示'))
  })
  await check('文本附件与停止演示生成',async()=>{await writeFile(path.join(resultsDir,'fixture.txt'),'附件测试：只含普通文本');await page.locator('input[type=file]').setInputFiles(path.join(resultsDir,'fixture.txt'));await page.locator('.attachment-chips').waitFor();await page.getByRole('textbox',{name:'输入消息'}).fill('请分析附件');await page.getByRole('button',{name:'发送消息',exact:true}).click();await page.getByRole('button',{name:'停止生成',exact:true}).click();await page.getByRole('button',{name:'发送消息',exact:true}).waitFor();assert.ok((await page.locator('.messages').innerText()).includes('已停止'))})
  await check('重启保留历史和收藏',async()=>{await page.waitForTimeout(350);await app.close();await launch();await page.locator('.history-row>button:first-child').first().click();assert.equal(await page.locator('.conversation-heading h1').innerText(),'灵犀桌面验证');assert.equal(await page.locator('.is-saved').count(),1)})
  await check('无效密钥错误可见',async()=>{await page.getByRole('button',{name:/我的工作空间/}).click();await page.locator('#base-url').fill(`http://127.0.0.1:${port}/v1`);await page.locator('#api-key').fill('wrong-fixture-key');await page.getByRole('button',{name:'连接网关并获取模型'}).click();await page.getByRole('alert').waitFor();assert.ok((await page.getByRole('alert').innerText()).includes('密钥无效'))})
  await check('真实 HTTP / IPC 链路获取模型与额度（受控桩）',async()=>{await page.locator('#api-key').fill(fixtureKey);await page.getByRole('button',{name:'连接网关并获取模型'}).click();await page.locator('.inline-success').waitFor();assert.ok(await page.locator('.settings-mode').getByText('已连接一加 AI 中台').isVisible());await page.getByRole('button',{name:'关闭弹窗'}).click();await page.getByRole('button',{name:'查看连接与用量'}).click();assert.ok((await page.locator('.connection-panel').last().innerText()).includes('9,877'));await screenshot('05-quota')})
  await check('真实传输分片 SSE 与用量显示（受控桩）',async()=>{await page.getByRole('button',{name:'开启新对话'}).click();await page.getByRole('textbox',{name:'输入消息'}).fill('测试中文流');await page.getByRole('button',{name:'发送消息',exact:true}).click();await page.getByRole('button',{name:'收藏回复',exact:true}).waitFor();assert.ok((await page.locator('.markdown').innerText()).includes('真实传输测试：你好，灵犀。'));assert.ok((await page.locator('.message-actions').innerText()).includes('123 tokens'))})
  await check('流中错误保留部分输出并显示失败',async()=>{await page.getByRole('textbox',{name:'输入消息'}).fill('测试流错误');await page.getByRole('button',{name:'发送消息',exact:true}).click();await page.locator('.inline-error').waitFor();assert.ok((await page.locator('.messages').innerText()).includes('保留的部分回复'));assert.ok((await page.locator('.inline-error').innerText()).includes('测试上游中断'))})
  await check('取消生成会真正关闭到网关的流',async()=>{await page.getByRole('textbox',{name:'输入消息'}).fill('测试取消');await page.getByRole('button',{name:'发送消息',exact:true}).click();await page.getByText('等待取消',{exact:true}).waitFor();await page.getByRole('button',{name:'停止生成',exact:true}).click();await page.getByRole('button',{name:'发送消息',exact:true}).waitFor();await page.waitForTimeout(200);assert.equal(cancelled,true)})
  await check('Key 不进入 localStorage，输出 HTML 经过净化',async()=>{const state=await page.evaluate(()=>JSON.stringify(localStorage));assert.ok(!state.includes(fixtureKey));assert.ok(!state.includes('wrong-fixture-key'));assert.equal(await page.locator('.markdown script').count(),0);assert.deepEqual(errors,[])})
  await check('窗口在最小桌面尺寸下无水平溢出',async()=>{await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].setSize(1000,740)});await page.getByRole('button',{name:'开启新对话'}).click();await screenshot('06-compact');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false)})
}catch(error){checks.push({name:'桌面集成测试',passed:false,error:error.stack});console.error(error);if(page)await screenshot('failure').catch(()=>{});process.exitCode=1}
finally{await writeFile(path.join(resultsDir,'desktop-results.json'),JSON.stringify({at:new Date().toISOString(),environment:'Windows Electron; controlled local HTTP fixture, not the real Yijia gateway or a real cloud model',checks,rendererErrors:errors,requestPaths:requests},null,2));await app?.close().catch(()=>{});server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
