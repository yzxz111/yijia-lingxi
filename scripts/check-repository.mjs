import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = name => readFile(path.join(root, name), 'utf8')
const pkg = JSON.parse(await read('package.json'))
const lock = JSON.parse(await read('package-lock.json'))
assert.equal(pkg.version, lock.version, 'package-lock version is stale')
assert.equal(pkg.license, lock.packages[''].license, 'package-lock license is stale')
assert.deepEqual(pkg.dependencies, lock.packages[''].dependencies, 'dependency lock is stale')
assert.deepEqual(pkg.devDependencies, lock.packages[''].devDependencies, 'development dependency lock is stale')
assert.ok((await read('LICENSE')).startsWith('MIT License'))

let markdownCount = 0, checkedFiles = 0
const ignored = new Set(['.git', 'node_modules', 'dist', 'release', 'test-results', '.verification', 'artifacts', 'coverage'])
const credential = /(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!ignored.has(entry.name)) await inspect(path.join(directory, entry.name)); continue }
    if (!entry.isFile()) continue
    const absolute = path.join(directory, entry.name)
    const relative = path.relative(root, absolute)
    assert.ok(!/^\.env(?:\.|$)/.test(entry.name) || entry.name === '.env.example', `Private environment file: ${relative}`)
    assert.ok(!/\.(?:pem|key|p12|pfx)$/i.test(entry.name), `Private key file: ${relative}`)
    if (!/\.(?:md|json|mjs|cjs|jsx|css|html|svg|yml|yaml|cmd|txt)$/.test(entry.name) && !['LICENSE', '.gitignore', '.gitattributes'].includes(entry.name)) continue
    const content = await readFile(absolute, 'utf8')
    assert.ok(!credential.test(content), `Possible embedded credential in ${relative}; value omitted`)
    checkedFiles++
    if (!entry.name.endsWith('.md')) continue
    markdownCount++
    assert.ok(!/[A-Z]:\\(?:Users|deep)\\/i.test(content), `Machine-specific path in ${relative}`)
    for (const match of content.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
      const link = match[1].split(/\s+"/)[0]
      if (/^(?:https?:|mailto:|#)/.test(link)) continue
      const target = path.resolve(directory, decodeURIComponent(link.split('#')[0]))
      assert.ok(target.startsWith(root), `Link outside repository in ${relative}`)
      assert.ok(await stat(target).then(() => true, () => false), `Broken link in ${relative}: ${link}`)
    }
  }
}
await inspect(root)
console.log(`Repository checks passed: ${checkedFiles} text files, ${markdownCount} Markdown files; links, lock metadata and common credential patterns checked.`)
