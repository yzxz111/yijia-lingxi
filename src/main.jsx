import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Plus, ArrowUp, ArrowUpRight, ChevronDown, ChevronRight, MessageSquare, Sparkles, LayoutGrid, Bookmark, Settings2, Search, PanelLeftClose, PanelLeftOpen, Paperclip, X, Square, Copy, Check, Trash2, Download, Pencil, RefreshCw, ExternalLink, FileText, Code2, PenLine, Compass, Zap, Layers, ShieldCheck, CircleHelp, MoreHorizontal, Bot, Command, ArrowLeft, Circle, Cable, Activity, BookOpen, WandSparkles, SlidersHorizontal, LoaderCircle, RotateCcw } from 'lucide-react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { transport, explainError } from './lib/transport.mjs'
import { demoModels, streamDemo } from './lib/demo.mjs'
import './style.css'

const STORE = 'lingxi.workspace.v1', PREFS = 'lingxi.preferences.v1'
const defaults = { baseUrl: 'http://127.0.0.1:18081/v1', temperature: 0.7, maxTokens: 2048, enterSend: true }
const assistants = [
  { id: 'general', name: '灵犀通用助手', label: '日常灵感，一问即达', icon: Sparkles, color: 'purple', category: '通用', system: '你是灵犀，一位严谨、友好、清晰的中文 AI 助手。请如实说明不确定性，帮助用户解决问题。', prompt: '' },
  { id: 'write', name: '写作搭子', label: '让每一个想法，恰如其分', icon: PenLine, color: 'orange', category: '创作', system: '你是一位专业中文写作助手。根据用户的受众、目的和语气协助写作、润色，避免空话，保留原意。', prompt: '帮我润色下面这段文字，表达自然、简洁，保留原意：\n' },
  { id: 'code', name: '代码伙伴', label: '从一行代码，到完整思路', icon: Code2, color: 'blue', category: '效率', system: '你是一位经验丰富的编程助手。给出可验证的方案和清晰代码，说明假设及边界，不虚构运行结果。', prompt: '请帮我分析这段代码，解释逻辑并指出可改进的地方：\n' },
  { id: 'read', name: '阅读研究员', label: '读懂长文，发现关键线索', icon: BookOpen, color: 'green', category: '学习', system: '你是一位严谨的阅读研究助手。基于提供的材料总结观点和依据，区分事实、推断与缺失信息，不编造来源。', prompt: '请帮我提炼这份材料的核心观点、关键依据和待确认问题：\n' },
  { id: 'plan', name: '规划教练', label: '把远方的目标，放进日程', icon: Compass, color: 'pink', category: '效率', system: '你是一位务实的规划助手。帮助用户分解目标、识别约束、安排优先级，给出可以执行并检查进度的计划。', prompt: '我想制定一个切实可行的计划，请帮我拆解目标和行动步骤：\n' },
  { id: 'learn', name: '知识向导', label: '复杂的知识，也可以很简单', icon: Layers, color: 'yellow', category: '学习', system: '你是一位耐心的学习助手。使用直观例子解释概念，循序渐进，提供练习并说明不确定性。', prompt: '请用通俗易懂的语言和一个具体例子，帮我理解：' },
]
const starters = [
  { title: '让文字更有力量', desc: '润色文案 · 撰写邮件 · 自由创作', tag: '写作创作', icon: PenLine, color: 'orange', id: 'write', prompt: '帮我写一封简洁、得体的项目进度邮件，包含已完成事项、当前问题和下一步计划。' },
  { title: '和代码聊一聊', desc: '代码解释 · 问题排查 · 方案设计', tag: '编程开发', icon: Code2, color: 'blue', id: 'code', prompt: '请用 JavaScript 实现一个按指定字段去重的函数，并解释实现思路和边界情况。' },
  { title: '把知识串联起来', desc: '长文总结 · 信息提炼 · 深入理解', tag: '阅读学习', icon: BookOpen, color: 'green', id: 'read', prompt: '请给我一个高效阅读长文的方法，帮助我提炼核心观点、关键依据和待确认问题。' },
  { title: '给想法一张路线图', desc: '目标拆解 · 行动清单 · 计划安排', tag: '思考规划', icon: Compass, color: 'pink', id: 'plan', prompt: '帮我制定一份一周学习计划，包含目标拆解、每日安排和复盘方法。' },
]

function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } }
function loadChats() {
  const chats = readStorage(STORE, [])
  return Array.isArray(chats) ? chats.filter(c => typeof c?.id === 'string' && typeof c.title === 'string' && Array.isArray(c.messages)).slice(0, 100).map(c => ({ ...c, messages: c.messages.filter(m => ['assistant', 'user'].includes(m?.role) && typeof m.content === 'string').map(m => ({ ...m, status: m.status === 'streaming' ? 'stopped' : m.status })) })) : []
}
function uid() { return crypto.randomUUID() }
async function copyText(text) {
  if (!window.lingxi) return navigator.clipboard.writeText(text)
  const result = await window.lingxi.writeClipboard(text)
  if (!result.ok) throw new Error(result.error.message)
}
function shortDate(ts) { return new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) }
function download(filename, content, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function Logo({ small = false }) { return <div className={`logo-mark ${small ? 'small' : ''}`}><Plus strokeWidth={2.7}/><span>✦</span></div> }
function IconButton({ icon: Icon, title, onClick, className = '', disabled, ...rest }) { return <button className={`icon-button ${className}`} title={title} aria-label={title} onClick={onClick} disabled={disabled} {...rest}><Icon size={17}/></button> }
function Markdown({ text, notify }) {
  const html = DOMPurify.sanitize(marked.parse(text, { breaks: true, gfm: true }), { FORBID_TAGS: ['img', 'style', 'iframe'], FORBID_ATTR: ['style'] })
  return <div className="markdown" onClick={event => { const link = event.target.closest('a'); if (link) { event.preventDefault(); copyText(link.href).then(() => notify('链接已复制，可在浏览器打开')).catch(() => notify('无法访问剪贴板')) } }} dangerouslySetInnerHTML={{ __html: html }}/>
}

function App() {
  const [chats, setChats] = useState(loadChats)
  const [prefs, setPrefs] = useState(() => ({ ...defaults, ...readStorage(PREFS, {}) }))
  const [page, setPage] = useState('chat'), [activeId, setActiveId] = useState(null)
  const [draft, setDraft] = useState(''), [files, setFiles] = useState([]), [assistantId, setAssistantId] = useState('general')
  const [demo, setDemo] = useState(true), [connection, setConnection] = useState(null), [model, setModel] = useState(demoModels[0].id)
  const [quota, setQuota] = useState(null), [quotaError, setQuotaError] = useState(''), [quotaBusy, setQuotaBusy] = useState(false)
  const [busy, setBusy] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [help, setHelp] = useState(false)
  const [collapsed, setCollapsed] = useState(false), [search, setSearch] = useState(''), [searchOpen, setSearchOpen] = useState(false)
  const [toast, setToast] = useState(''), [filter, setFilter] = useState('全部'), [confirm, setConfirm] = useState(null)
  const [renaming, setRenaming] = useState(null), [renameValue, setRenameValue] = useState('')
  const [modelOpen, setModelOpen] = useState(false), [quickOpen, setQuickOpen] = useState(false)
  const abortRef = useRef(null), inputRef = useRef(null), fileRef = useRef(null), bottomRef = useRef(null), toastTimer = useRef(null)
  const active = chats.find(c => c.id === activeId)
  const assistant = assistants.find(a => a.id === (active?.assistant || assistantId)) || assistants[0]
  const models = demo ? demoModels : (connection?.models || [])
  const notify = message => { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 3300) }
  useEffect(() => {
    const timer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(chats)) } catch { notify('本地存储空间不足，请导出重要对话并清理历史。') } }, 250)
    return () => clearTimeout(timer)
  }, [chats])
  useEffect(() => { try { localStorage.setItem(PREFS, JSON.stringify(prefs)) } catch { /* Preference storage is optional. */ } }, [prefs])
  useEffect(() => { if (page === 'chat') bottomRef.current?.scrollIntoView({ behavior: busy ? 'instant' : 'smooth', block: 'end' }) }, [active?.messages, page])
  useLayoutEffect(() => { if (page === 'chat' && !activeId) document.querySelector('.conversation-scroll')?.scrollTo({ top: 0, behavior: 'instant' }) }, [page, activeId])
  useEffect(() => {
    const handler = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(open => !open) }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); newChat() }
      if (event.key === 'Escape') { setSettingsOpen(false); setSearchOpen(false); setHelp(false); setModelOpen(false); setQuickOpen(false); setConfirm(null); setRenaming(null) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [busy])
  useEffect(() => { const guard = e => { if (busy) { e.preventDefault(); e.returnValue = '' } }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard) }, [busy])

  function newChat() {
    if (busy) { notify('请先停止当前生成，再开启新对话'); return }
    setActiveId(null); setPage('chat'); setDraft(''); setFiles([]); setAssistantId('general'); setModelOpen(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }
  function openChat(id) { setActiveId(id); setPage('chat'); setSearchOpen(false); setSearch(''); setDraft(''); setFiles([]) }
  function chooseAssistant(id, prompt) {
    if (busy) { notify('请先停止当前生成'); return }
    setAssistantId(id); setActiveId(null); setPage('chat'); setDraft(prompt || ''); setFiles([])
    setTimeout(() => inputRef.current?.focus(), 50)
  }
  function patchMessage(chatId, messageId, update) { setChats(all => all.map(c => c.id !== chatId ? c : { ...c, updatedAt: Date.now(), messages: c.messages.map(m => m.id === messageId ? { ...m, ...update(m) } : m) })) }
  async function refreshQuota() {
    if (demo || !connection) return
    setQuotaBusy(true); setQuotaError('')
    try { setQuota(await transport.quota()) } catch (error) { setQuotaError(explainError(error)) }
    finally { setQuotaBusy(false) }
  }
  async function send(textOverride) {
    const text = (textOverride ?? draft).trim()
    if ((!text && !files.length) || busy) return
    if (!demo && !connection) { setSettingsOpen(true); return }
    if (chats.length >= 100 && !active) { notify('最多保留 100 个对话，请先导出并清理部分历史'); return }
    if ((active?.messages.length || 0) >= 200) { notify('本对话已达 200 条消息，请新建对话继续'); return }
    const combined = `${text}${files.map(f => `\n\n--- 附件：${f.name} ---\n${f.text}`).join('')}`
    if (combined.length > 200000) { notify('消息和附件内容过长，请精简后发送'); return }
    const chatId = active?.id || uid(), answerId = uid(), now = Date.now()
    const userMessage = { id: uid(), role: 'user', content: combined, display: text || '请阅读附件内容', files: files.map(f => f.name), createdAt: now }
    const answer = { id: answerId, role: 'assistant', content: '', model, demo, status: 'streaming', createdAt: now }
    const previous = active?.messages || []
    const currentAssistant = assistant
    const messages = [{ role: 'system', content: currentAssistant.system }, ...previous.filter(m => m.role === 'user' || m.status === 'complete').map(m => ({ role: m.role, content: m.content })), { role: 'user', content: combined }]
    if (active) setChats(all => all.map(c => c.id === chatId ? { ...c, messages: [...c.messages, userMessage, answer], updatedAt: now } : c))
    else setChats(all => [{ id: chatId, title: (text || files[0]?.name || '新对话').replace(/\s+/g, ' ').slice(0, 28), assistant: currentAssistant.id, createdAt: now, updatedAt: now, messages: [userMessage, answer] }, ...all])
    setActiveId(chatId); setPage('chat'); setDraft(''); setFiles([]); setBusy(true); setQuickOpen(false)
    const controller = new AbortController(); abortRef.current = controller
    let gotDone = false
    const onPacket = packet => {
      if (packet.type === 'delta') patchMessage(chatId, answerId, m => ({ content: m.content + packet.text, requestId: packet.requestId || m.requestId }))
      if (packet.type === 'usage') patchMessage(chatId, answerId, () => ({ usage: packet.usage }))
      if (packet.type === 'done') { gotDone = true; patchMessage(chatId, answerId, () => ({ status: 'complete', finishReason: packet.finishReason, requestId: packet.requestId, elapsed: Math.max(1, Math.round((Date.now() - now) / 1000)) })) }
      if (packet.type === 'cancelled') patchMessage(chatId, answerId, () => ({ status: 'stopped' }))
    }
    try {
      if (demo) await streamDemo(combined, currentAssistant.id, onPacket, controller.signal)
      else await transport.chat({ id: answerId, model, messages, temperature: prefs.temperature, max_tokens: prefs.maxTokens }, onPacket, controller.signal)
    } catch (error) {
      patchMessage(chatId, answerId, () => ({ status: controller.signal.aborted ? 'stopped' : 'error', error: controller.signal.aborted ? undefined : explainError(error) }))
    } finally {
      if (controller.signal.aborted && !gotDone) patchMessage(chatId, answerId, () => ({ status: 'stopped' }))
      abortRef.current = null; setBusy(false)
      if (!demo) refreshQuota()
      inputRef.current?.focus()
    }
  }
  async function attachFiles(event) {
    const picked = Array.from(event.target.files || []); event.target.value = ''
    const next = [...files]
    for (const file of picked) {
      if (next.length >= 3) { notify('每次最多添加 3 个文本附件'); break }
      if (file.size > 150 * 1024 || !/\.(txt|md|csv|json|js|jsx|ts|tsx|py|sol|log|html|css|yml|yaml)$/i.test(file.name)) { notify('支持 150 KB 以内的文本、Markdown 和代码文件'); continue }
      const content = await file.text()
      if (content.includes('\0')) { notify('文件似乎不是文本，请换一个文件'); continue }
      next.push({ id: uid(), name: file.name, text: content })
    }
    setFiles(next)
  }
  function exportChat(chat = active) {
    if (!chat) return
    const header = `# ${chat.title}\n\n导出自一加灵犀 · ${new Date().toLocaleString('zh-CN')}\n\n`
    const content = chat.messages.map(m => `## ${m.role === 'user' ? '我' : `灵犀${m.demo ? '（本地演示）' : ''}`}\n\n${m.content || '（无输出）'}${m.status && m.status !== 'complete' ? `\n\n[状态：${m.status === 'stopped' ? '已停止' : m.status === 'error' ? '失败/可能不完整' : '生成中'}]` : ''}${m.error ? `\n\n${m.error}` : ''}`).join('\n\n---\n\n')
    download(`${chat.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}.md`, header + content)
    notify('已导出 Markdown 对话')
  }
  function deleteChat(chat) {
    if (busy) { notify('请先停止当前生成'); return }
    setConfirm({ title: '删除这个对话？', description: `「${chat.title}」及其中的消息将从本机删除。建议先导出重要内容。`, action: () => { setChats(all => all.filter(c => c.id !== chat.id)); if (activeId === chat.id) setActiveId(null) } })
  }
  const history = [...chats].sort((a, b) => b.updatedAt - a.updatedAt).filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.messages.some(m => m.content.toLowerCase().includes(search.toLowerCase())))
  const favorites = chats.flatMap(c => c.messages.filter(m => m.saved).map(m => ({ ...m, chatId: c.id, title: c.title })))
  const allMessages = chats.flatMap(c => c.messages)
  const realOutputs = allMessages.filter(m => m.role === 'assistant' && !m.demo && m.status === 'complete')
  const knownTokens = realOutputs.reduce((sum, m) => sum + (m.usage?.total_tokens || 0), 0)

  return <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><Logo/><div className="brand-words"><strong>一加灵犀<span>DESKTOP</span></strong><small>让想法，自由生长</small></div></div>
      <button className="new-chat" onClick={newChat}><Plus size={19}/><span>开启新对话</span><kbd>Ctrl N</kbd></button>
      <nav className="navigation">
        {[['chat',MessageSquare,'对话工作台'],['assistants',LayoutGrid,'发现助手'],['favorites',Bookmark,'我的收藏']].map(([id,Icon,label]) => <button key={id} title={label} aria-label={label} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}><Icon size={18}/><span>{label}</span>{id === 'assistants' && <small className="nav-new">NEW</small>}{id === 'favorites' && favorites.length > 0 && <small>{favorites.length}</small>}</button>)}
      </nav>
      <div className="history-heading"><span>最近对话</span><IconButton icon={Search} title="搜索历史对话 (Ctrl K)" onClick={() => setSearchOpen(true)}/></div>
      <div className="history-list">{!history.length ? <div className="history-empty"><MessageSquare size={23}/><p>一个新想法，<br/>就是一段新对话。</p></div> : history.map(chat => <div className={`history-row ${activeId === chat.id && page === 'chat' ? 'selected' : ''}`} key={chat.id}><button onClick={() => openChat(chat.id)} title={chat.title}><MessageSquare size={14}/><span>{chat.title}</span></button><IconButton icon={Trash2} title={`删除对话：${chat.title}`} onClick={() => deleteChat(chat)}/></div>)}</div>
      <div className="sidebar-bottom">
        <button className="gateway-card" onClick={() => setPage('usage')} title="查看连接与用量" aria-label="查看连接与用量"><span className={`gateway-icon ${demo ? '' : 'connected'}`}><Zap size={17}/></span><div><strong>一加 AI 中台<ArrowUpRight size={13}/></strong><small><i className={demo ? 'amber' : 'green'}/>{demo ? '本地演示 · 未连接网关' : '网关已连接'}</small></div></button>
        <div className="sidebar-tools"><button className="profile-button" onClick={() => setSettingsOpen(true)}><span className="avatar">灵</span><span><strong>我的工作空间</strong><small>灵感，从此有了归处</small></span><Settings2 size={16}/></button></div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="topbar-left"><IconButton icon={collapsed ? PanelLeftOpen : PanelLeftClose} title={collapsed ? '展开侧边栏' : '收起侧边栏'} onClick={() => setCollapsed(!collapsed)}/><span className="header-divider"/><span className="breadcrumb">我的工作空间<ChevronRight size={13}/><strong>{{chat:'对话工作台',assistants:'发现助手',favorites:'我的收藏',usage:'连接与用量'}[page]}</strong></span></div><div className="topbar-right"><span className="status-pill"><i className={demo ? 'amber' : 'green'}/>{demo ? '演示模式' : '已连接中台'}</span><IconButton icon={CircleHelp} title="使用帮助" onClick={() => setHelp(true)}/><span className="topbar-avatar">灵</span></div></header>
      <main className={`workspace ${page === 'chat' ? 'chat-workspace' : ''}`}>
        {page === 'chat' && <>
          {active ? <div className="conversation-heading"><div><span className={`mini-assistant ${assistant.color}`}><assistant.icon size={17}/></span><h1>{active.title}</h1><IconButton icon={Pencil} title="重命名对话" disabled={busy} onClick={() => { setRenaming(active.id); setRenameValue(active.title) }}/></div><button className="text-button" onClick={() => exportChat()}><Download size={15}/>导出对话</button></div> : <div className="workspace-label"><span><i/>灵犀工作台</span><small>少一点繁琐，多一点可能。</small></div>}
          <div className={`conversation-scroll ${active ? '' : 'welcome-scroll'}`}>
            {!active ? <div className="welcome">
              <div className="greeting-eyebrow"><span className="eyebrow-line"/>YOUR EVERYDAY AI COMPANION</div>
              <h1>好想法，<br/><span>从这里开始。</span><span className="hero-spark">✦</span></h1>
              <p className="hero-description">写作、编程、探索未知。让灵犀接住你的每一个灵感，<br className="desktop-break"/>陪你把「想到」变成「做到」。</p>
              <div className="hero-orbit" aria-hidden="true"><div className="orbit-circle one"/><div className="orbit-circle two"/><div className="orbit-center">✦</div><span className="orbit-dot"/><span className="orbit-plus">+</span><span className="orbit-mini">✧</span></div>
              <div className="section-heading"><h2>从一件小事开始<span>为你的日常，加一点灵感</span></h2><span className="subtle-tag"><Sparkles size={13}/>灵感推荐</span></div>
              <div className="starter-grid">{starters.map(card => <button key={card.id} className={`starter-card ${card.color}`} onClick={() => chooseAssistant(card.id, card.prompt)}><div className="card-top"><span className={`feature-icon ${card.color}`}><card.icon size={22}/></span><ArrowUpRight size={17}/></div><span className="card-tag">{card.tag}</span><strong>{card.title}</strong><small>{card.desc}</small></button>)}</div>
              <div className="inspiration-strip"><span className="inspiration-icon"><WandSparkles size={17}/></span><p><strong>不确定从哪里开始？</strong>试试这些灵感</p><button onClick={() => chooseAssistant('plan','我最近有很多想做的事，请帮我理清优先级，找到最值得先开始的一件。')}>理清我的思路<ArrowUpRight size={13}/></button></div>
            </div> : <div className="messages">{active.messages.map(message => <article className={`message ${message.role}`} key={message.id}><div className="message-avatar">{message.role === 'user' ? <span>我</span> : <Logo small/>}</div><div className="message-body"><div className="message-label"><strong>{message.role === 'user' ? '你' : '一加灵犀'}</strong>{message.role === 'assistant' && <span>{message.model}{message.demo ? ' · 本地预设' : ''}</span>}{message.status === 'streaming' && <span className="thinking"><i/>正在思考</span>}</div>{message.role === 'user' ? <><div className="user-content">{message.display ?? message.content}</div>{message.files?.length > 0 && <div className="message-files">{message.files.map((name, i) => <span key={i}><FileText size={13}/>{name}</span>)}</div>}</> : <>{message.content ? <Markdown text={message.content} notify={notify}/> : message.status === 'streaming' ? <div className="loading-dots"><i/><i/><i/></div> : <p className="muted">{message.status === 'stopped' ? '已停止生成' : '未收到回复内容'}</p>}{message.error && <div className="inline-error">{message.error}</div>}{message.status === 'stopped' && <div className="message-note">已停止 · 部分输出可能已计入上游用量</div>}{message.finishReason === 'length' && <div className="message-note">已达到输出长度上限</div>}{message.finishReason === 'content_filter' && <div className="message-note">上游内容策略已截断此回复</div>}{message.status !== 'streaming' && <div className="message-actions"><IconButton icon={Copy} title="复制回复" disabled={!message.content} onClick={() => copyText(message.content).then(() => notify('回复已复制')).catch(() => notify('复制失败，请手动选择文字'))}/><IconButton icon={Bookmark} className={message.saved ? 'is-saved' : ''} title={message.saved ? '取消收藏' : '收藏回复'} disabled={!message.content} onClick={() => patchMessage(active.id, message.id, m => ({ saved: !m.saved }))}/><span>{message.demo ? '演示内容' : message.usage?.total_tokens != null ? `${Number(message.usage.total_tokens).toLocaleString()} tokens` : '用量以网关为准'}{message.elapsed ? ` · ${message.elapsed} 秒` : ''}</span>{message.requestId && <button className="request-id" title={message.requestId} onClick={() => copyText(message.requestId).then(() => notify('请求 ID 已复制')).catch(() => notify('复制失败'))}>请求 ID</button>}</div>}</>}</div></article>)}<div ref={bottomRef}/></div>}
          </div>
          <div className="composer-area"><div className="composer">
            {files.length > 0 && <div className="attachment-chips">{files.map(file => <span key={file.id}><FileText size={14}/>{file.name}<button title={`移除 ${file.name}`} onClick={() => setFiles(all => all.filter(f => f.id !== file.id))}><X size={12}/></button></span>)}</div>}
            {assistant.id !== 'general' && !active && <div className={`selected-assistant ${assistant.color}`}><assistant.icon size={13}/>{assistant.name}<button title="使用通用助手" onClick={() => setAssistantId('general')}><X size={12}/></button></div>}
            <textarea ref={inputRef} aria-label="输入消息" placeholder={active ? '继续聊聊，让想法再往前一步…' : '有什么想法，尽管和灵犀聊聊…'} value={draft} maxLength={60000} rows={2} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && (prefs.enterSend ? !event.shiftKey : event.ctrlKey || event.metaKey)) { event.preventDefault(); send() } }}/>
            <div className="composer-toolbar"><div className="composer-tools"><div className="model-control"><button className={`model-select ${modelOpen ? 'open' : ''}`} aria-expanded={modelOpen} onClick={() => setModelOpen(!modelOpen)} disabled={busy}><span className="model-glyph"><Sparkles size={12}/></span><span>{model || '选择模型'}</span><ChevronDown size={13}/></button>{modelOpen && <><div className="popover-dismiss" onClick={() => setModelOpen(false)}/><div className="model-menu"><small>{demo ? '本地界面演示，不调用真实模型' : '来自网关的授权模型'}</small>{models.map(item => <button key={item.id} onClick={() => { setModel(item.id); setModelOpen(false) }}><Sparkles size={15}/><span>{item.id}</span>{model === item.id && <Check size={15}/>}</button>)}<button className="model-config" onClick={() => { setModelOpen(false); setSettingsOpen(true) }}><Cable size={15}/>连接其他网关</button></div></>}</div><span className="toolbar-divider"/><IconButton icon={Paperclip} title="添加文本附件（最多 3 个，每个 150 KB）" disabled={busy} onClick={() => fileRef.current?.click()}/><div className="quick-control"><IconButton icon={SlidersHorizontal} title="生成参数" onClick={() => setQuickOpen(!quickOpen)}/>{quickOpen && <><div className="popover-dismiss" onClick={() => setQuickOpen(false)}/><div className="quick-menu"><strong>生成偏好</strong><label>创造性 <span>{prefs.temperature}</span></label><input aria-label="创造性" type="range" min="0" max="2" step="0.1" value={prefs.temperature} onChange={e => setPrefs(p => ({ ...p, temperature: Number(e.target.value) }))}/><label>最大输出长度</label><select aria-label="最大输出长度" value={prefs.maxTokens} onChange={e => setPrefs(p => ({ ...p, maxTokens: Number(e.target.value) }))}>{[512,1024,2048,4096,8192].map(n => <option key={n} value={n}>{n.toLocaleString()} tokens</option>)}</select></div></>}</div></div><div className="send-area"><small>{busy ? '灵感正在发生' : prefs.enterSend ? 'Enter 发送 · Shift Enter 换行' : 'Ctrl Enter 发送'}</small>{busy ? <button className="send-button stop" title="停止生成" aria-label="停止生成" onClick={() => abortRef.current?.abort()}><Square size={15} fill="currentColor"/></button> : <button className="send-button" title="发送消息" aria-label="发送消息" disabled={!draft.trim() && !files.length} onClick={() => send()}><ArrowUp size={20}/></button>}</div></div>
          </div><div className="composer-footnote"><span><ShieldCheck size={12}/>{demo ? '当前为本地预设演示，不调用真实模型' : '由一加 AI 中台提供模型能力'}</span><span>AI 也会犯错，请核实重要信息。</span></div></div>
        </>}

        {page === 'assistants' && <div className="page-content"><div className="page-eyebrow">A LITTLE HELP, A LOT OF POSSIBILITY</div><h1>每个想法，都有好搭档。</h1><p className="page-description">选一位专属助手，为你的日常打开新的可能。</p><div className="assistant-banner"><div><span><Sparkles size={14}/>灵犀精选</span><h2>各有所长，随时在场。</h2><p>同一个灵犀，不同的专业视角。找到适合当下的那一位。</p></div><div className="assistant-banner-art" aria-hidden="true"><Code2/><PenLine/><Sparkles/></div></div><div className="filter-tabs">{['全部','通用','创作','效率','学习'].map(item => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}<span>{assistants.filter(a => filter === '全部' || a.category === filter).length} 位助手</span></div><div className="assistants-grid">{assistants.filter(a => filter === '全部' || a.category === filter).map(item => <button className="assistant-card" key={item.id} onClick={() => chooseAssistant(item.id, item.prompt)}><span className={`feature-icon ${item.color}`}><item.icon size={24}/></span><span className="assistant-category">{item.category}</span><h3>{item.name}</h3><p>{item.label}</p><div>开始对话<ArrowUpRight size={15}/></div></button>)}</div><div className="page-note"><CircleHelp size={14}/>助手通过不同系统提示词提供专业视角，共享你当前选择的模型与网关。</div></div>}

        {page === 'favorites' && <div className="page-content"><div className="page-eyebrow">KEEP WHAT INSPIRES YOU</div><h1>把好灵感，留在手边。</h1><p className="page-description">收藏那些有用的回答，让每一次思考都能被再次找到。</p>{favorites.length ? <div className="favorites-list">{favorites.map(item => <article className="favorite-card" key={item.id}><div className="favorite-top"><span><Bookmark size={15}/>{item.title}</span><small>{shortDate(item.createdAt)}</small></div><Markdown text={item.content.length > 550 ? item.content.slice(0,550) + '\n\n…' : item.content} notify={notify}/><div className="favorite-actions"><button className="text-button" onClick={() => openChat(item.chatId)}>查看原对话<ArrowUpRight size={14}/></button><IconButton icon={Bookmark} title="取消收藏" className="is-saved" onClick={() => patchMessage(item.chatId,item.id,() => ({ saved: false }))}/></div></article>)}</div> : <div className="empty-state"><span><Bookmark size={30}/></span><h2>值得留下的，还在路上。</h2><p>点击回复下方的收藏图标，<br/>把有启发的内容收进这里。</p><button className="primary-button" onClick={newChat}>开启一次对话<ArrowUpRight size={15}/></button></div>}</div>}

        {page === 'usage' && <div className="page-content"><div className="page-eyebrow">YOUR SPACE, CONNECTED</div><h1>一个入口，连接更多可能。</h1><p className="page-description">一加灵犀负责交互，一加 AI 中台统一提供模型与网关能力。</p><div className="architecture-card"><span><Logo small/><strong>一加灵犀</strong><small>桌面前端 · 本地会话</small></span><div><i/><ArrowUpRight size={19}/><small>OpenAI 兼容接口</small></div><span><Cable size={25}/><strong>一加 AI 中台</strong><small>认证 · 模型 · 配额 · 计量</small></span></div><div className="usage-grid"><div className="metric-card"><small>本机对话</small><strong>{chats.length}<span>个</span></strong><p>保存在此设备</p></div><div className="metric-card"><small>真实生成完成</small><strong>{realOutputs.length}<span>次</span></strong><p>只统计本机成功完成的回复</p></div><div className="metric-card"><small>已记录用量</small><strong>{knownTokens.toLocaleString()}<span>tokens</span></strong><p>仅累计上游返回的 usage</p></div></div><div className="connection-panel"><div className="section-heading"><h2>网关连接</h2><span className="status-pill"><i className={demo ? 'amber' : 'green'}/>{demo ? '尚未连接' : '已连接'}</span></div><dl><div><dt>API Base URL</dt><dd>{connection?.baseUrl || prefs.baseUrl}</dd></div><div><dt>运行环境</dt><dd>{window.lingxi ? 'Electron 桌面客户端' : '浏览器预览'}</dd></div><div><dt>可用模型</dt><dd>{demo ? '连接后从网关获取' : connection?.models.map(m => m.id).join('、')}</dd></div></dl><button className="primary-button" onClick={() => setSettingsOpen(true)}><Settings2 size={15}/>管理连接</button></div><div className="connection-panel"><div className="section-heading"><h2>实时套餐额度</h2><button className="text-button" disabled={demo || quotaBusy} onClick={refreshQuota}><RefreshCw size={14} className={quotaBusy ? 'spin' : ''}/>刷新</button></div>{quotaError && <p className="inline-error">{quotaError}</p>}{demo ? <p className="muted">连接网关后，可读取 /v1/quota 的实时套餐额度。演示模式不显示虚构数据。</p> : quota ? <><dl><div><dt>当前套餐</dt><dd>{quota.packageName || quota.packageCode || '—'}</dd></div><div><dt>套餐状态 / 计量维度</dt><dd>{quota.status || '—'} / {quota.usageDimension || '—'}</dd></div><div><dt>已用 / 总额</dt><dd>{Number(quota.usedTokens || 0).toLocaleString()} / {Number(quota.totalTokens || 0).toLocaleString()}</dd></div><div><dt>剩余额度</dt><dd>{Number(quota.remainingTokens || 0).toLocaleString()}</dd></div></dl><p className="page-note">额度以中台实时响应为准，停止或失败的生成也可能已计量；本地统计不作为账单。</p></> : <p className="muted">点击刷新获取实时额度。</p>}</div></div>}
      </main>
    </div>
    <input ref={fileRef} type="file" multiple accept=".txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.sol,.log,.html,.css,.yml,.yaml" hidden onChange={attachFiles}/>
    {settingsOpen && <Settings prefs={prefs} setPrefs={setPrefs} demo={demo} busy={busy} connected={!!connection} onClose={() => setSettingsOpen(false)} notify={notify} onConnect={async config => { const result = await transport.connect(config); setConnection(result); setDemo(false); setModel(result.models[0].id); setPrefs(p => ({ ...p, baseUrl: result.baseUrl })); setQuota(null); setQuotaError(''); try { setQuota(await transport.quota()) } catch (error) { setQuotaError(explainError(error)) }; notify('网关已连接，模型目录已更新') }} onDemo={async () => { await transport.disconnect(); setConnection(null); setDemo(true); setModel(demoModels[0].id); setQuota(null); setQuotaError(''); notify('已切换到本地演示模式') }} onClear={() => setConfirm({ title:'清空本机所有对话？', description:'此操作会删除本机的对话和收藏，无法撤销。请先导出需要保留的对话。',action:() => { setChats([]); setActiveId(null); notify('本机对话已清空') } })}/>}
    {searchOpen && <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && setSearchOpen(false)}><div className="search-dialog" role="dialog" aria-modal="true" aria-label="搜索对话"><div className="search-input"><Search size={20}/><input autoFocus placeholder="搜索标题或对话内容…" value={search} onChange={e => setSearch(e.target.value)}/><button onClick={() => setSearchOpen(false)}>Esc</button></div><div className="search-results">{history.length ? history.map(chat => <button key={chat.id} onClick={() => openChat(chat.id)}><MessageSquare size={17}/><span><strong>{chat.title}</strong><small>{chat.messages.length} 条消息 · {shortDate(chat.updatedAt)}</small></span><ArrowUpRight size={16}/></button>) : <p>没有找到相关对话</p>}</div></div></div>}
    {renaming && <Modal title="给对话起个名字" onClose={() => setRenaming(null)}><form onSubmit={e => { e.preventDefault(); if (renameValue.trim()) { setChats(all => all.map(c => c.id === renaming ? { ...c,title:renameValue.trim() } : c)); setRenaming(null) } }}><input autoFocus className="field-input" aria-label="对话名称" maxLength={60} value={renameValue} onChange={e => setRenameValue(e.target.value)}/><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setRenaming(null)}>取消</button><button type="submit" className="primary-button" disabled={!renameValue.trim()}>保存名称</button></div></form></Modal>}
    {confirm && <Modal title={confirm.title} onClose={() => setConfirm(null)}><p className="modal-description">{confirm.description}</p><div className="modal-actions"><button className="secondary-button" onClick={() => setConfirm(null)}>取消</button><button className="danger-button" onClick={() => { confirm.action(); setConfirm(null) }}>确认删除</button></div></Modal>}
    {help && <Modal title="你好，这里是一加灵犀。" onClose={() => setHelp(false)} wide><div className="help-content"><p>一个轻盈的 AI 桌面工作台，把写作、编程和学习放进同一个空间。</p><div><strong>01 · 先体验，再连接</strong><p>默认是本地预设演示，不会调用真实模型。到「连接设置」填写中台提供的 API Base URL 和 API Key，即可获取真实模型目录。</p></div><div><strong>02 · 你的对话，保存在本机</strong><p>聊天与收藏存储在本地，可逐条导出 Markdown。真实接入时，当前消息、已完成的历史消息和文本附件会发送给配置的中台。</p></div><div><strong>03 · 更顺手的快捷键</strong><p>Ctrl N 新建对话 · Ctrl K 搜索历史 · Enter 发送 · Shift Enter 换行。发送方式可在设置中调整。</p></div><div><strong>04 · 关于密钥与用量</strong><p>API Key 只在本次运行内存中使用，关闭应用后需重新填写。模型生成不会自动重试；停止或失败也可能产生上游用量。</p></div><small>一加灵犀 v0.1.0 · Electron / React / Vite<br/>本地中台若使用 WireMock，其模型输出仍是模拟内容；网关连接成功不代表真实云模型已验收。</small></div></Modal>}
    {toast && <div className="toast" role="status"><Check size={16}/>{toast}</div>}
  </div>
}

function Modal({ title, children, onClose, wide = false }) {
  const panel = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const focusable = () => [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
    ;(panel.current.querySelector('[autofocus]') || focusable()[0])?.focus()
    const trap = e => { if (e.key !== 'Tab') return; const items = focusable(); const first = items[0], last = items.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() } }
    const element = panel.current; element.addEventListener('keydown',trap)
    return () => { element.removeEventListener('keydown',trap); previous?.focus?.() }
  }, [])
  return <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><section ref={panel} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><IconButton icon={X} title="关闭弹窗" onClick={onClose}/></header>{children}</section></div>
}

function Settings({ prefs, setPrefs, demo, busy, connected, onClose, onConnect, onDemo, onClear }) {
  const [baseUrl,setBaseUrl] = useState(prefs.baseUrl), [key,setKey] = useState(''), [connecting,setConnecting] = useState(false), [error,setError] = useState(''), [success,setSuccess] = useState(false)
  async function connect(event) {
    event.preventDefault(); setConnecting(true); setError(''); setSuccess(false)
    try { await onConnect({ baseUrl,apiKey:key }); setKey(''); setSuccess(true) } catch (error) { setError(explainError(error)) } finally { setConnecting(false) }
  }
  return <Modal title="连接设置" onClose={() => { if (!connecting) onClose() }} wide><div className="settings-body"><p className="modal-description">连接一加 AI 中台，让你的工作台拥有真正的模型能力。</p><div className="settings-mode"><span className={`feature-icon ${demo ? 'orange' : 'green'}`}><Cable size={20}/></span><div><strong>{demo ? '正在使用本地演示' : '已连接一加 AI 中台'}</strong><small>{demo ? '预设示例 · 无网络调用 · 无模型用量' : '模型与额度从网关实时获取'}</small></div>{!demo && <button className="text-button" disabled={busy || connecting} onClick={() => { onDemo(); setSuccess(false) }}>切换演示</button>}</div><form onSubmit={connect}><label className="field-label" htmlFor="base-url">API Base URL</label><input id="base-url" className="field-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://your-gateway.example/v1" disabled={connecting || busy} required spellCheck={false}/><small className="field-help">填写中台「API 密钥」页面提供的地址，自动补全 /v1。</small><label className="field-label" htmlFor="api-key">API Key<span>仅本次运行有效</span></label><input id="api-key" className="field-input" type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={connected ? '重新连接时请再次填写密钥' : '粘贴你在中台创建的 API Key'} autoComplete="off" disabled={connecting || busy} required spellCheck={false}/><small className="field-help"><ShieldCheck size={12}/>密钥仅保存在运行内存，不写入源码、磁盘或聊天记录。</small>{error && <p className="inline-error" role="alert">{error}</p>}{success && <p className="inline-success"><Check size={14}/>连接成功，已获取网关授权模型。</p>}<button type="submit" className="primary-button connect-button" disabled={connecting || busy || !key.trim() || !baseUrl.trim()}>{connecting ? <LoaderCircle size={16} className="spin"/> : <Zap size={16}/>}{connecting ? '正在验证连接…' : connected ? '更新连接并获取模型' : '连接网关并获取模型'}</button></form><div className="settings-separator"/><h3 className="settings-subtitle">使用偏好</h3><label className="preference-row"><span><strong>Enter 发送消息</strong><small>关闭后使用 Ctrl Enter 发送</small></span><button type="button" role="switch" aria-checked={prefs.enterSend} aria-label="Enter 发送消息" className={`switch ${prefs.enterSend ? 'checked' : ''}`} onClick={() => setPrefs(p => ({ ...p,enterSend:!p.enterSend }))}><i/></button></label><div className="preference-row"><span><strong>本地对话数据</strong><small>清空对话也会移除所有收藏</small></span><button className="danger-text" disabled={busy} onClick={onClear}>清空数据</button></div><div className="settings-tip"><CircleHelp size={15}/><p>真实对话会把所选上下文和附件发送给配置的网关。连接失败请先检查中台是否启动、API Key 是否有效，以及套餐是否可用。</p></div></div></Modal>
}

createRoot(document.getElementById('root')).render(<App/> )
