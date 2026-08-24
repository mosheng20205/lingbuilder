本页总览

# 首次调用 API

DeepSeek API 使用与 OpenAI/Anthropic 兼容的 API 格式，通过修改配置，您可以使用 OpenAI/Anthropic SDK 来访问 DeepSeek API，或使用与 OpenAI/Anthropic API 兼容的软件。

PARAM

VALUE

base\_url (OpenAI)

`https://api.deepseek.com`

base\_url (Anthropic)

`https://api.deepseek.com/anthropic`

api\_key

申请一个 [API key](https://platform.deepseek.com/api_keys)

model(1)

`deepseek-v4-flash`  
`deepseek-v4-pro`  
`deepseek-v4-flash-vision-exp`

(1) `deepseek-v4-flash` 模型版本已更新为 DeepSeek-V4-Flash-0731，`deepseek-v4-pro` 模型版本已更新为 DeepSeek-V4-Pro-0813，调用方法不变，使用 `deepseek-v4-flash`、`deepseek-v4-pro` 即可调用最新版本。新上线的 `deepseek-v4-flash-vision-exp` 为实验性模型，额外支持图片输入，将模型名设为 `deepseek-v4-flash-vision-exp` 即可调用，详见[图像理解](https://api-docs.deepseek.com/zh-cn/guides/vision)。

## 接入 Agent 工具[​](#接入-agent-工具 "接入 Agent 工具的直接链接")

DeepSeek Harness 开发者预览版面向全球 Harness 开发者开放测试。详见 [DeepSeek Harness 入门](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart)。

DeepSeek API 已接入多种主流 AI Agent 与编程助手工具。如果你使用 Claude Code、GitHub Copilot、OpenCode 等工具，可以直接将 DeepSeek 作为后端模型，无需编写代码即可开始使用。

详见 [Agent 工具接入指南](https://api-docs.deepseek.com/zh-cn/quick_start/agent_integrations/claude_code)。

## 调用对话 API[​](#调用对话-api "调用对话 API的直接链接")

在创建 API key 之后，你可以使用以下样例脚本，通过 OpenAI API 格式来访问 DeepSeek 模型。样例为非流式输出，您可以将 stream 设置为 true 来使用流式输出。

Anthropic API 格式的访问样例，请参考[Anthropic API](https://api-docs.deepseek.com/zh-cn/guides/anthropic_api)。

-   curl
-   python
-   nodejs

```
curl https://api.deepseek.com/chat/completions \  -H "Content-Type: application/json" \  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \  -d '{        "model": "deepseek-v4-pro",        "messages": [          {"role": "system", "content": "You are a helpful assistant."},          {"role": "user", "content": "Hello!"}        ],        "thinking": {"type": "enabled"},        "reasoning_effort": "high",        "stream": false      }'
```

```
# Please install OpenAI SDK first: `pip3 install openai`import osfrom openai import OpenAIclient = OpenAI(    api_key=os.environ.get('DEEPSEEK_API_KEY'),    base_url="https://api.deepseek.com")response = client.chat.completions.create(    model="deepseek-v4-pro",    messages=[        {"role": "system", "content": "You are a helpful assistant"},        {"role": "user", "content": "Hello"},    ],    stream=False,    reasoning_effort="high",    extra_body={"thinking": {"type": "enabled"}})print(response.choices[0].message.content)
```

```
// Please install OpenAI SDK first: `npm install openai`import OpenAI from "openai";const openai = new OpenAI({        baseURL: 'https://api.deepseek.com',        apiKey: process.env.DEEPSEEK_API_KEY,});async function main() {  const completion = await openai.chat.completions.create({    messages: [{ role: "system", content: "You are a helpful assistant." }],    model: "deepseek-v4-pro",    thinking: {"type": "enabled"},    reasoning_effort: "high",    stream: false,  });  console.log(completion.choices[0].message.content);}main();
```