# EnWord AI Config 说明

本项目通过根目录的 `ai-config.json` 连接大模型接口。

## 文件位置

- `ai-config.json`（项目根目录）

## 快速模板

> 请不要把真实 `apiKey` 提交到 Git。

```json
{
  "provider": "openai-compatible",
  "baseUrl": "https://your-api-host/v1",
  "endpoint": "chat/completions",
  "model": "qwen-3.8-27b",
  "apiKey": "YOUR_API_KEY_HERE",
  "reasoningEffort": "low",
  "temperature": 0.3,
  "maxTokens": 500,
  "maxTokensPrompt": 320,
  "maxTokensWordDetail": 1200,
  "timeoutMs": 20000,
  "contextWindow": 262144
}
```

## 参数说明

### 必填参数

- `baseUrl`
  - 含义：模型服务基地址。
  - 示例：`https://your-api-host/v1`

- `apiKey`
  - 含义：接口密钥。
  - 注意：不要写进公开仓库。

### 常用参数

- `endpoint`
  - 含义：chat completions 路径。
  - 默认：`chat/completions`

- `model`
  - 含义：模型名称。
  - 默认：`qwen-3.8-27b`

- `temperature`
  - 含义：采样随机度，越大越发散。
  - 默认：`0.3`
  - 建议：`0.2 ~ 0.7`

- `maxTokens`
  - 含义：通用请求最大输出 token。
  - 默认：`500`

- `timeoutMs`
  - 含义：单次请求超时（毫秒）。
  - 默认：`30000`
  - 说明：代码里会在超时后自动重试一次（更长超时）。

- `reasoningEffort`
  - 含义：推理强度（若服务商支持）。
  - 常见值：`low` / `medium` / `high`

### 句子练习相关可选参数

- `maxTokensPrompt`
  - 含义：句子出题请求的最大输出 token。
  - 默认：回退到 `maxTokens`，再回退 `320`。

- `sentenceSystemPrompt`
  - 含义：覆盖内置的句子出题 system prompt。
  - 类型：字符串。

- `sentenceUserPromptTemplate`
  - 含义：覆盖内置 user prompt 模板。
  - 类型：字符串。
  - 可用占位符：
    - `{{difficulty}}`
    - `{{difficultySpec}}`
    - `{{targetWord}}`
    - `{{targetMeaning}}`

### 词详情相关可选参数

- `maxTokensWordDetail`
  - 含义：单词详情请求最大输出 token。
  - 默认：回退到 `maxTokens`，再回退 `1200`。

### 兼容字段

- `provider`
  - 当前代码不强依赖该字段（可保留为说明用途）。

- `contextWindow`
  - 当前代码不直接读取该字段（可作为文档用途保留）。

## 常见问题

- 启动后提示 `ai-config.json not found`
  - 检查文件是否在项目根目录。

- 提示 `apiKey is not configured`
  - 确认 `apiKey` 不是空字符串，也不是 `YOUR_API_KEY_HERE`。

- 提示 `baseUrl is not configured`
  - 确认 `baseUrl` 已填写且不是空字符串。

- 提示 API 4xx/5xx
  - 检查 `baseUrl`、`endpoint`、`model`、`apiKey` 是否匹配服务商要求。

## 安全建议

- 使用环境差异化密钥（开发/生产分离）。
- 不要把真实密钥提交到 Git。
- 如密钥已经泄露，请立即在服务商后台轮换。
