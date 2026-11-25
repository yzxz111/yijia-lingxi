import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

if (process.platform !== 'win32') throw new Error('Create the Windows distribution on Windows.')
const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const source = path.join(root, 'release', `${pkg.productName}-win32-x64`)
for (const file of [`${pkg.productName}.exe`, 'resources/app.asar', 'LICENSE', 'LICENSES.chromium.html']) await access(path.join(source, file))
await copyFile(path.join(root, 'LICENSE'), path.join(source, 'APP-LICENSE.txt'))
await copyFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(source, 'THIRD_PARTY_NOTICES.txt'))
await writeFile(path.join(source, '使用说明.txt'), [
  `${pkg.productName} v${pkg.version} — Windows x64 免安装版`,
  '',
  `解压整个目录后，双击 ${pkg.productName}.exe。不要只复制 EXE。无需安装 Node.js。`,
  '默认使用明确标记的本地预设演示，不调用真实模型。',
  '真实对话需要在连接设置中填写兼容网关地址和自己的有效 API Key。',
  'API Key 只在本次运行内存使用；聊天历史与偏好保存在本机。',
  '本版本完成本地协议、受控服务桌面集成与打包启动验证；真实中台和云模型仍待联调。',
  '本包未进行 Windows 代码签名。请从你信任的发布来源取得文件，并核对 SHA-256。',
  'APP-LICENSE.txt 是应用许可；LICENSE 和 LICENSES.chromium.html 属于 Electron/Chromium。',
  '',
].join('\r\n'), 'utf8')
const filename = `${pkg.name}-${pkg.version}-windows-x64.zip`
const archive = path.join(root, 'release', filename)
const temporary = `${archive}.partial`
await rm(temporary, { force: true })
const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
  "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression,System.IO.Compression.FileSystem; $source=[IO.Path]::GetFullPath($env:LINGXI_ZIP_SOURCE); $prefix=(Split-Path -Leaf $source)+'/'; $zip=[IO.Compression.ZipFile]::Open($env:LINGXI_ZIP_TARGET,[IO.Compression.ZipArchiveMode]::Create); try { Get-ChildItem -LiteralPath $source -File -Recurse -Force | ForEach-Object { $entry=$prefix+$_.FullName.Substring($source.Length+1).Replace('\\','/'); [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$_.FullName,$entry,[IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $zip.Dispose() }"], {
  cwd: root, windowsHide: true, stdio: 'inherit',
  env: { ...process.env, LINGXI_ZIP_SOURCE: source, LINGXI_ZIP_TARGET: temporary },
})
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`ZIP creation failed (${result.status})`)
const hash = createHash('sha256')
for await (const chunk of createReadStream(temporary)) hash.update(chunk)
const checksum = `${hash.digest('hex')}  ${filename}\n`
await rename(temporary, archive)
await writeFile(path.join(root, 'release', 'SHA256SUMS.txt'), checksum, 'utf8')
console.log(checksum.trim())
console.log(archive)
