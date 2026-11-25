import { packager } from '@electron/packager'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
await build({ root })
const outputs = await packager({
  dir: root, name: '一加灵犀', platform: 'win32', arch: 'x64',
  out: path.join(root, 'release'), overwrite: true, asar: true,
  icon: path.join(root, 'assets/icon.ico'),
  ignore: [/^\/(release|tests|test-results|scripts|src|docs|artifacts|coverage|\.verification|\.github|\.git)(\/|$)/, /^\/(vite\.config\.mjs|\.gitignore|\.gitattributes|\.editorconfig|\.nvmrc)$/, /^\/\.env(\.|$)/],
  win32metadata: { FileDescription: '一加灵犀 · AI 工作台', ProductName: '一加灵犀', OriginalFilename: '一加灵犀.exe' },
})
for (const output of outputs) console.log(output)
