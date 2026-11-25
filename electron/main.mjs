import { app, BrowserWindow, ipcMain, session, Menu, clipboard } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createGateway } from '../shared/gateway.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const indexPath = path.join(here, '../dist/index.html')
let win, gateway = null, active = null
app.setName('一加灵犀')
app.setAppUserModelId('cn.yijia.lingxi')
if (process.env.LINGXI_DATA_DIR && !app.isPackaged) app.setPath('userData', path.resolve(process.env.LINGXI_DATA_DIR))
const lock = app.requestSingleInstanceLock()
if (!lock) app.quit()
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus() } })
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    win = new BrowserWindow({
      width: 1420, height: 940, minWidth: 960, minHeight: 680, show: false,
      backgroundColor: '#f8f9fc', title: '一加灵犀 · AI 工作台', icon: path.join(here, '../assets/icon.png'),
      titleBarStyle: 'hidden', titleBarOverlay: { color: '#ffffff', symbolColor: '#858897', height: 45 },
      webPreferences: { preload: path.join(here, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false },
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', event => event.preventDefault())
    win.on('closed', () => { active?.controller.abort(); gateway = null; win = null })
    win.once('ready-to-show', () => win.show())
    win.loadFile(indexPath)
  })
}
app.on('window-all-closed', () => app.quit())

function trusted(event) {
  if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url.split('#')[0] !== pathToFileURL(indexPath).href) throw new Error('Untrusted IPC sender')
}
function serialize(error) {
  return { message: String(error?.message || '连接失败，请检查网关地址和服务状态。'), code: error?.code || 'network_error', status: error?.status || 0, requestId: error?.requestId, retryAfter: error?.retryAfter }
}
function handle(name, callback) {
  ipcMain.handle(name, async (event, value) => {
    trusted(event)
    try { return { ok: true, data: await callback(value) } } catch (error) { return { ok: false, error: serialize(error) } }
  })
}
handle('gateway:connect', async config => {
  if (active) throw new Error('请先停止当前生成。')
  const candidate = createGateway({ baseUrl: config?.baseUrl, apiKey: config?.apiKey })
  const models = await candidate.models()
  gateway = candidate
  return { baseUrl: candidate.baseUrl, models }
})
handle('gateway:disconnect', () => { active?.controller.abort(); gateway = null; return true })
handle('gateway:quota', () => {
  if (!gateway) throw new Error('请先连接网关。')
  return gateway.quota()
})
handle('gateway:chat', payload => {
  if (!gateway) throw new Error('请先连接网关。')
  if (active) throw new Error('当前已有生成任务。')
  if (typeof payload?.id !== 'string' || payload.id.length > 100) throw new Error('无效的请求标识。')
  const current = { id: payload.id, controller: new AbortController() }
  const client = gateway
  active = current
  const emit = event => { if (win && !win.isDestroyed()) win.webContents.send('gateway:event', { id: current.id, ...event }) }
  ;(async () => {
    try {
      for await (const event of client.chat(payload, current.controller.signal)) emit(event)
    } catch (error) {
      emit(current.controller.signal.aborted ? { type: 'cancelled' } : { type: 'error', error: serialize(error) })
    } finally { if (active === current) active = null }
  })()
  return { started: true }
})
handle('gateway:stop', id => { if (active?.id === id) active.controller.abort(); return true })
handle('desktop:copy', text => {
  if (typeof text !== 'string' || text.length > 500000) throw new Error('复制内容无效或过长。')
  clipboard.writeText(text)
  return true
})
