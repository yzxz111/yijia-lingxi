import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'))
const runtime = Object.entries(lock.packages).filter(([folder, info]) => folder && !info.dev && !info.link)
const sections = [
  '# 第三方许可说明',
  '',
  '应用自有代码使用根目录 MIT License。下列内容按 package-lock.json 中的生产依赖及本机安装包中的许可文件生成；依赖不因应用许可而改变其自身许可。更新依赖后运行 `npm run notices`。',
  '',
  'Windows 分发目录另外保留 Electron 自带的 LICENSE 和 LICENSES.chromium.html，应用许可另存为 APP-LICENSE.txt。构建工具依赖不等同于应用运行依赖，其许可保存在各自安装包中。',
  '',
]
for (const [folder, info] of runtime.sort(([a], [b]) => a.localeCompare(b))) {
  const directory = path.join(root, folder)
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
  assert.equal(pkg.version, info.version, `${pkg.name}: installed version differs from lock`)
  const files = (await readdir(directory)).filter(name => /^(?:licen[cs]e|copying)(?:[._-]|$)/i.test(name)).sort()
  assert.ok(files.length, `No license text found for ${pkg.name}`)
  sections.push(`## ${pkg.name} ${pkg.version}`, '', `许可标记：${pkg.license || info.license || '见下文许可原文'}。`, '')
  for (const filename of files) sections.push(`### ${filename}`, '', '```text', (await readFile(path.join(directory, filename), 'utf8')).trim(), '```', '')
}
await writeFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), sections.join('\n'), 'utf8')
console.log(`Wrote production dependency license texts for ${runtime.length} installed packages.`)
