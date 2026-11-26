# 客户端网关契约

本文件随客户端提供，用于不具备原上游源码的开发者核对兼容性。它描述当前客户端消费的最小接口，不代表所有 OpenAI 兼容服务都支持这些扩展，也不代表真实模型联调已经完成。

## 通用规则

- Base URL 为根地址或 `/v1`，客户端最终规范化为 `/v1`。
- 远程使用 HTTPS，本机 `localhost`、`127.0.0.1` 和 `[::1]` 可用 HTTP。
- 不接受 URL 中的账号密码、查询参数、片段或其他路径。
- 所有请求携带 `Authorization: Bearer <apiKey>` 和 JSON 内容类型。
- 不自动跟随重定向；请求不自动重试。

## 模型目录

`GET /v1/models`，成功响应须包含至少一个有效模型 ID：

```json
{
  "data": [
    { "id": "authorized-model", "owned_by": "gateway" }
  ]
}
```

客户端从实际响应构造模型选择器。空目录或格式错误会阻止连接成功。

## 实时额度（一加中台扩展）

`GET /v1/quota`。当前界面读取以下字段；数值按 tokens 展示：

```json
{
  "packageCode": "EXAMPLE",
  "packageName": "示例套餐（仅字段说明）",
  "status": "ACTIVE",
  "usageDimension": "TOKEN",
  "totalTokens": 10000,
  "usedTokens": 123,
  "remainingTokens": 9877,
  "allowedModels": ["authorized-model"]
}
```

此接口不是通用 OpenAI 标准接口。缺失时会显示额度读取错误，不代表聊天接口必然不可用；应分别测试。其他计量单位需要适配后再展示。

## 流式聊天

`POST /v1/chat/completions`：

```json
{
  "model": "authorized-model",
  "messages": [
    { "role": "system", "content": "你是一位中文助手。" },
    { "role": "user", "content": "你好" }
  ],
  "temperature": 0.7,
  "max_tokens": 2048,
  "stream": true,
  "stream_options": { "include_usage": true }
}
```

返回 `Content-Type: text/event-stream`。典型帧如下，空行用于分隔事件：

```text
data: {"choices":[{"index":0,"delta":{"content":"你好"}}]}

data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}}

data: [DONE]

```

客户端消费 index 为 0 的 choice 和文本 `delta.content`，不处理工具调用或多模态事件。支持 UTF-8 分块、LF / CRLF 和心跳。当前客户端要求正常结束以 `[DONE]` 收尾；`finish_reason=length` 允许输出上限终态。缺少结束信号会标记不完整，空流不会显示成功。

`x-request-id` 响应头用于问题定位。usage 只展示上游返回值，不依据字符数估算账单。

## 错误、限流与取消

HTTP 错误响应可使用：

```json
{
  "error": { "code": "invalid_api_key", "message": "Invalid API key" },
  "request_id": "example-request-id"
}
```

流中错误可放在 SSE 的 `data` JSON 中：

```text
data: {"error":{"code":"provider_error","message":"Upstream interrupted"}}

```

`Retry-After` 支持秒数或 HTTP 日期。停止生成会取消实际 HTTP 请求；上游已经生成的部分可能仍计量。客户端保留部分内容，不自动重试。

## 真实联调验收

须使用项目拥有者自行提供的网关和 Key，依次确认模型目录、额度、至少两轮真实聊天、中文输出、取消和可见错误，并在上游日志核对请求 ID、用量及实际模型渠道。不要把 Key、完整请求头或私人对话加入截图和验收材料。

完成后再更新 [验收记录](verification-record.md)；目前该步骤仍待执行。
