import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
if (!existsSync(new URL('../dist/index.html', import.meta.url))) {
  const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js')
  const result = spawnSync(process.execPath, [vite, 'build'], { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(require('electron'), ['.', ...process.argv.slice(2)], { cwd: root, env, stdio: 'inherit', windowsHide: false })
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code || 0 })
