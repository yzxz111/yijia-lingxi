export const demoModels = [{ id: '灵犀 · 标准演示' }, { id: '灵犀 · 深度演示' }]

export function demoReply(prompt, assistant) {
  const intro = '> 本条为本地预设演示，未调用 AI 模型，也不产生网关用量。\n\n'
  if (/代码|函数|编程|javascript|python|程序|开发/i.test(prompt) || assistant === 'code') return intro + `## 把想法拆成可以执行的步骤\n\n如果要做一个稳定、好维护的小工具，可以从这三个部分开始：\n\n1. **定义输入**：先写清输入格式、边界和失败情况。\n2. **实现核心逻辑**：把业务函数与界面分开，便于复用。\n3. **验证输出**：覆盖正常输入、空数据和异常分支。\n\n以 JavaScript 的去重函数为例：\n\n\`\`\`javascript\nfunction uniqueBy(items, key) {\n  const seen = new Map();\n  for (const item of items) {\n    if (!seen.has(item[key])) seen.set(item[key], item);\n  }\n  return [...seen.values()];\n}\n\`\`\`\n\n**下一步**：提供具体需求或代码后，接入真实网关的模型可以继续帮你实现和调试。`
  if (/总结|摘要|阅读|提炼|分析|文档/.test(prompt) || assistant === 'read') return intro + `## 先抓重点，再建立联系\n\n阅读一份材料时，可以用下面这张框架整理信息：\n\n| 关注点 | 要回答的问题 |\n| --- | --- |\n| 核心观点 | 作者最想说明什么？ |\n| 关键依据 | 哪些数据或案例支撑结论？ |\n| 实际影响 | 这些信息对当前任务有什么帮助？ |\n| 待确认项 | 哪些地方还需要补充证据？ |\n\n建议把原文拆成 **背景 → 问题 → 证据 → 结论**，再压缩成三个要点。\n\n你可以通过输入框旁的附件按钮加入文本文件；真实接入后，模型会基于发送的内容进行分析。`
  if (/计划|规划|安排|学习|目标|方案/.test(prompt) || assistant === 'plan') return intro + `## 让目标落到今天的行动上\n\n建议用一周做一个小周期，先完成最小成果，再逐步优化。\n\n### 第一阶段 · 明确方向\n- 写下一个可验证的目标。\n- 列出已有资源和当前限制。\n- 确定本周最重要的一项产出。\n\n### 第二阶段 · 集中推进\n每天留出一段完整时间，只处理一个关键任务。把大任务拆成 **30–60 分钟**可以完成的小步骤。\n\n### 第三阶段 · 回顾调整\n对照目标检查成果，记录卡点，并决定下一周期保留、停止或新增的行动。\n\n**小建议**：计划留出弹性，先做到持续推进，再追求一次做得完美。`
  if (/写|文案|邮件|润色|表达|创作/.test(prompt) || assistant === 'write') return intro + `## 好的表达，从说清楚开始\n\n可以先用一个自然的开头交代背景，再用简短段落传达重点，最后明确希望对方采取的行动。\n\n### 一个通用的表达框架\n**背景**：我们为什么讨论这件事？\n\n**重点**：最值得关注的变化是什么？\n\n**行动**：接下来具体要做什么？\n\n> 把复杂的想法写简单，让每句话都向前走一步。\n\n如果是邮件，建议主题直接写明事项；如果是文案，先说读者能得到什么。连接一加中台后，模型可以按你给的语气和受众生成具体版本。`
  return intro + `## 很高兴和你一起，把想法变成可能。\n\n这里是 **一加灵犀**，一加 AI 中台的桌面下游工作台。\n\n你可以从这些事情开始：\n\n- **写作与表达**：整理思路、起草邮件、润色文字。\n- **阅读与分析**：提炼文档要点，构建清晰的知识框架。\n- **编程与开发**：解释代码、设计方案、分析报错。\n- **学习与规划**：拆解目标，制定可执行的行动计划。\n\n当前处于本地演示模式，你正在看到预设示例。点击左下角的 **连接设置**，填写一加中台的网关地址和 API Key，即可开始真实对话。`
}

export async function streamDemo(prompt, assistant, onPacket, signal) {
  const value = demoReply(prompt, assistant)
  for (let i = 0; i < value.length; i += 8) {
    if (signal.aborted) throw new DOMException('已停止', 'AbortError')
    await new Promise(resolve => setTimeout(resolve, 13))
    onPacket({ type: 'delta', text: value.slice(i, i + 8) })
  }
  onPacket({ type: 'done', finishReason: 'stop' })
}
