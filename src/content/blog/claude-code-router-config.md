---
title: Claude Code Router 使用 config.json 配置多模型路由
description: '使用 claude-code-router 统一管理 Anthropic 兼容中转站、OpenAI 兼容中转站和 DeepSeek，并通过 Router 配置默认、后台、推理和长上下文模型。'
publishDate: 2026-04-24 20:31:06
tags:
  - Claude
  - AI
---
`claude-code-router` 可以把 Claude Code 的请求转发到不同模型供应商。相比在每个项目里反复改 `.claude/settings.json`，它更适合同时使用 Anthropic 兼容中转站、OpenAI 兼容中转站、DeepSeek 等多个模型，并在 Claude Code 里通过 `/model provider,model` 快速切换。

官方配置文件位置：

```bash
~/.claude-code-router/config.json
```

## 1. 安装和检查

安装 Claude Code Router：

```bash
npm install -g @musistudio/claude-code-router
```

创建配置目录：

```bash
mkdir -p ~/.claude-code-router
```

## 2. 编写 config.json

编辑配置文件：

```bash
nano ~/.claude-code-router/config.json
```

我目前的配置如下。再把 `sk-` 换成自己的 key：

```json
{
  "LOG": true,
  "API_TIMEOUT_MS": 600000,
  "NON_INTERACTIVE_MODE": false,
  "Providers": [
    {
      "name": "packy-group-cc",
      "api_base_url": "https://www.packyapi.com/v1/messages",
      "api_key": "sk-",
      "models": [
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-5-20250929",
        "claude-sonnet-4-6",
        "claude-opus-4-5-20251101",
        "claude-opus-4-6"
      ],
      "transformer": {
        "use": ["Anthropic"]
      }
    },
    {
      "name": "packy-group-cc-sale",
      "api_base_url": "https://www.packyapi.com/v1/messages",
      "api_key": "sk-",
      "models": [
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-6",
        "claude-opus-4-6"
      ],
      "transformer": {
        "use": ["Anthropic"]
      }
    },
    {
      "name": "deepseek-anthropic",
      "api_base_url": "https://api.deepseek.com/anthropic/v1/messages",
      "api_key": "sk-",
      "models": ["deepseek-v4-flash", "deepseek-v4-pro"],
      "transformer": {
        "use": ["Anthropic"]
      }
    },
    {
      "name": "deepseek",
      "api_base_url": "https://api.deepseek.com/chat/completions",
      "api_key": "sk-",
      "models": ["deepseek-v4-flash", "deepseek-v4-pro"],
      "transformer": {
        "use": ["deepseek"]
      }
    },
    {
      "name": "ominiai",
      "api_base_url": "https://pro.ominiai.cn/v1/chat/completions",
      "api_key": "sk-",
      "models": [
        "gpt-5.5",
        "gpt-5.4-high",
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.4-openai-compact",
        "gpt-5.2",
        "gpt-5.2-high",
        "gpt-5.3-codex",
        "gpt-5.3-codex-high",
        "gpt-5.3-codex-medium"
      ],
      "transformer": {
        "use": ["openai"]
      }
    }
  ],
  "Router": {
    "default": "ominiai,gpt-5.4-mini",
    "background": "deepseek,deepseek-v4-flash",
    "think": "deepseek,deepseek-v4-pro",
    "longContext": "ominiai,gpt-5.4",
    "longContextThreshold": 60000,
    "webSearch": "ominiai,gpt-5.4-mini"
  }
}
```

如果你想进一步降低泄露 key 的风险，可以把 `api_key` 改成环境变量形式，例如：

```json
"api_key": "$DEEPSEEK_API_KEY"
```

然后在 `~/.zshrc` 中设置：

```bash
export DEEPSEEK_API_KEY="sk-"
```

## 3. 字段说明

`LOG` 控制是否写日志。排错阶段建议 `true`。

`API_TIMEOUT_MS` 是请求超时时间。`600000` 等于 10 分钟，适合代码生成、长上下文和推理模型。

`NON_INTERACTIVE_MODE` 主要给 CI、Docker、GitHub Actions 这类非交互环境使用。日常终端里使用 Claude Code，建议 `false`。

`Providers` 是模型供应商列表。每个供应商通常需要：

- `name`: 供应商名字，后面路由会用到。
- `api_base_url`: 真实请求接口地址。
- `api_key`: 供应商 API key。
- `models`: 这个供应商下允许使用的模型名。
- `transformer`: 请求和响应格式转换器，用来适配不同平台的 API 差异。

`Router` 是任务路由规则。格式固定是：

```text
供应商名称,模型名称
```

例如：

```json
"default": "ominiai,gpt-5.4-mini"
```

表示默认请求走 `Providers` 里 `name` 为 `ominiai` 的供应商，并使用 `gpt-5.4-mini` 模型。

## 4. 路由建议

`default` 是默认任务模型。当前配置使用：

```json
"default": "ominiai,gpt-5.4-mini"
```

`background` 是后台任务模型。当前配置使用较便宜的 DeepSeek flash：

```json
"background": "deepseek,deepseek-v4-flash"
```

`think` 是 Claude Code 判断需要更强推理时使用的模型。当前配置使用：

```json
"think": "deepseek,deepseek-v4-pro"
```

注意：实际使用中，即使看起来是简单小任务，Claude Code 也可能路由到 `think`。如果你更在意成本，可以把 `think` 配成和 `default` 一样：

```json
"think": "ominiai,gpt-5.4-mini"
```

或者配成便宜模型：

```json
"think": "deepseek,deepseek-v4-flash"
```

`longContext` 是长上下文任务模型。当前配置使用：

```json
"longContext": "ominiai,gpt-5.4"
```

`longContextThreshold` 是触发长上下文路由的阈值。`60000` 表示上下文较长时切到 `longContext` 指定模型。

`webSearch` 是需要联网搜索时使用的模型。当前配置使用：

```json
"webSearch": "ominiai,gpt-5.4-mini"
```

## 5. Transformer 怎么理解

不同平台虽然都声称兼容 OpenAI 或 Anthropic API，但细节经常不同，例如工具调用、reasoning 字段、max tokens 字段、流式响应格式等。`transformer` 就是用来做这些适配的。

Packy 这里作为 Anthropic 兼容中转站的配置示例。Anthropic 兼容中转站通常使用 Anthropic Messages 格式，因此配置为：

```json
"transformer": {
  "use": ["Anthropic"]
}
```

DeepSeek 有两种接法，两种目前都可以使用，实际效果基本一样。保留两个 Provider 的好处是：一个走 DeepSeek 的 Anthropic 兼容接口，一个走 Chat Completions 接口，排错或对比时更方便。

```json
{
  "name": "deepseek",
  "api_base_url": "https://api.deepseek.com/chat/completions",
  "transformer": {
    "use": ["deepseek"]
  }
}
```

这是走 DeepSeek 的 Chat Completions 接口：

```json
{
  "name": "deepseek-anthropic",
  "api_base_url": "https://api.deepseek.com/anthropic/v1/messages",
  "transformer": {
    "use": ["Anthropic"]
  }
}
```

这是走 DeepSeek 的 Anthropic 兼容接口：

DeepSeek 官方给 SDK 使用的 base URL 是 `https://api.deepseek.com/anthropic`，但在 CCR 当前行为下需要写到最终可 POST 的 messages endpoint：`https://api.deepseek.com/anthropic/v1/messages`。

如果只是日常使用，可以任选其一；当前观察下来两种效果一样。

Ominiai 这里作为只兼容 OpenAI 格式的中转站配置示例。OpenAI 兼容中转站通常使用 Chat Completions 格式，因此配置为：

```json
"transformer": {
  "use": ["openai"]
}
```

## 6. 启动和使用

```bash
# 启动 Router：
ccr start
# 用 Router 启动 Claude Code：
ccr code
# 修改 config.json 后重启：
ccr restart
# 查看状态：
ccr status
# 使用 Web UI 管理配置：
ccr ui
# 使用交互式模型管理：
ccr model
```

## 7. 常用模型切换

在 Claude Code 里可以直接切换：

```text
/model ominiai,gpt-5.4-mini
/model ominiai,gpt-5.3-codex-high
/model deepseek,deepseek-v4-flash
/model deepseek,deepseek-v4-pro
/model packy-group-cc,claude-opus-4-6
/model packy-group-cc-sale,claude-opus-4-6
/model auto
```

目前观察到一个疑似 bug 或兼容性问题：通过 CCR 调用 `packy-group-cc,claude-opus-4-7` 时，`/model` 可以成功设置为 Opus 4，但真实对话会返回上游 400；同一套 Packy 配置下，`packy-group-cc,claude-opus-4-6` 可以正常对话。因此日常使用建议优先选择 `claude-opus-4-6`，不要把 `claude-opus-4-7` 放进默认路由。

## 8. 常见问题

### 8.1 提示模型不存在

`Router` 或 `/model` 里的模型名必须同时出现在对应 Provider 的 `models` 数组里。

例如：

```json
"think": "deepseek,deepseek-v4-pro"
```

要求 `deepseek` Provider 里必须有：

```json
"models": ["deepseek-v4-flash", "deepseek-v4-pro"]
```

### 8.2 修改 config.json 后不生效

修改配置后重启 CCR：

```bash
ccr restart
```

如果仍然不生效，看当前服务状态：

```bash
ccr status
```

## 9. 与 Claude Code settings.json 的关系

使用 CCR 后，建议不要再在项目 `.claude/settings.json` 里写具体供应商的：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-",
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "ANTHROPIC_MODEL": "deepseek-chat"
  }
}
```

否则容易和 CCR 冲突，或者在不同供应商之间残留旧的模型映射。

项目 `.claude/settings.json` 更适合只放通用配置，例如：

```json
{
  "attribution": {
    "commit": "",
    "pr": ""
  },
  "env": {
    "API_TIMEOUT_MS": "600000"
  }
}
```

供应商、模型、路由统一放在：

```bash
~/.claude-code-router/config.json
```

## 10. 参考资料

- [官方 GitHub 仓库](https://github.com/musistudio/claude-code-router)
- [官方安装文档](https://musistudio.github.io/claude-code-router/docs/cli/installation/)
- [官方快速开始](https://musistudio.github.io/claude-code-router/docs/cli/quick-start/)
- [官方基础配置](https://musistudio.github.io/claude-code-router/docs/cli/config/basic/)
- [官方 Transformer 文档](https://musistudio.github.io/claude-code-router/docs/server/config/transformers/)
