import { _electron as electron } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
await mkdir(path.join(root, 'test-results'), { recursive: true })
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'release/一加灵犀-win32-x64/一加灵犀.exe')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const desktop = await electron.launch({ executablePath, env, timeout: 30000 })
try {
  const page = await desktop.firstWindow()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.waitForSelector('.welcome h1')
  const info = await desktop.evaluate(({ app, BrowserWindow }) => ({
    isPackaged: app.isPackaged, version: app.getVersion(), appPath: app.getAppPath(),
    title: BrowserWindow.getAllWindows()[0].getTitle(),
    nodeIntegration: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().nodeIntegration,
    contextIsolation: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().contextIsolation,
    sandbox: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox,
  }))
  assert.equal(info.isPackaged, true)
  assert.equal(info.version, pkg.version)
  assert.equal(info.nodeIntegration, false)
  assert.equal(info.contextIsolation, true)
  assert.equal(info.sandbox, true)
  assert.ok(info.appPath.endsWith('app.asar'))
  assert.equal(await page.locator('.starter-card').count(), 4)
  assert.equal(await page.evaluate(() => typeof window.lingxi.writeClipboard), 'function')
  assert.deepEqual(errors, [])
  await page.screenshot({ path: path.join(root, 'test-results/07-packaged-home.png'), scale: 'css' })
  await writeFile(path.join(root, 'test-results/package-results.json'), JSON.stringify({ at: new Date().toISOString(), passed: true, ...info, rendererErrors: errors }, null, 2))
  console.log(JSON.stringify({ passed: true, ...info }, null, 2))
} finally {
  await desktop.close()
}
