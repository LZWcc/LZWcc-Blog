---
title: Claude Code 使用 settings.json 配置第三方模型供应商
description: '从 Claude Code 1.0.61 开始，原生支持通过 settings.json 切换 DeepSeek、Kimi、智谱 GLM 等第三方模型供应商，本文详细介绍配置方法和注意事项。'
publishDate: 2026-04-24 15:24:00
tags:
  - Claude
  - AI
---

Claude Code 从 `1.0.61` 及以上版本开始支持原生 `--settings` 选项，可以通过额外的 settings JSON 文件切换不同的自定义模型供应商，例如 DeepSeek、Kimi、智谱 GLM，以及各种 Anthropic API 兼容中转站。

```bash
claude --settings ~/.claude/settings-deepseek.json
```

## 1. 前置检查

先确认 Claude Code 版本：

```bash
claude --version
```

如果版本低于 `1.0.61`，先更新：

```bash
claude update
```

创建用户级配置目录：

```bash
mkdir -p ~/.claude
```

如果已经有主配置文件，先备份：

```bash
cp ~/.claude/settings.json ~/.claude/settings.json.bak.$(date +%Y%m%d-%H%M%S)
```

## 2. 主配置：settings.json

`~/.claude/settings.json` 放通用配置，不放具体供应商的 key。

```json
{
  "env": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "attribution": {
    "commit": "",
    "pr": ""
  }
}
```

含义：

- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`: 关闭非必要流量。
- `attribution.commit`: Git commit 信息末尾追加的归属文本。设为空字符串表示不追加。
- `attribution.pr`: PR 描述末尾追加的归属文本。设为空字符串表示不追加。

旧字段 `includeCoAuthoredBy` 已弃用，应改用 `attribution`。

## 3. settings.json 的继承和覆盖关系

Claude Code 的 settings 是分层加载的，不是项目里的 `.claude/settings.json` 一出现就把用户级 `~/.claude/settings.json` 整个覆盖掉。

常见优先级从高到低是：

1. 命令行参数，例如 `--settings`、`--model`
2. 项目本地配置：`.claude/settings.local.json`
3. 项目共享配置：`.claude/settings.json`
4. 用户全局配置：`~/.claude/settings.json`

可以理解为：

- 用户级配置是默认值。
- 项目级配置会覆盖同名配置。
- 项目级没有写的配置，会继续继承用户级配置。
- 数组类配置通常会合并去重，例如部分权限列表。

例如用户级配置是：

```json
{
  "env": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "attribution": {
    "commit": "",
    "pr": ""
  }
}
```

项目下的 `.claude/settings.json` 只有：

```json
{
  "permissions": {
    "deny": ["Read(./.env)", "Read(./secrets/**)"]
  }
}
```

那么用户级的 `env` 和 `attribution` 仍然会生效，项目只是额外增加了这个项目专属的权限限制。

如果项目也写了同名字段，例如：

```json
{
  "attribution": {
    "commit": "Generated with AI",
    "pr": ""
  }
}
```

那么这个项目里的 `attribution` 会优先于用户级 `attribution`。为了避免部分嵌套字段的合并行为造成误解，同一个功能建议在同一层里写完整，例如 `attribution` 里同时写 `commit` 和 `pr`。

## 4. DeepSeek 配置

新建文件：

```bash
vim ~/.claude/settings-deepseek.json
```

内容：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "API_TIMEOUT_MS": "600000",
    "ANTHROPIC_MODEL": "deepseek-chat",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro"
  }
}
```

启动：

```bash
claude --settings ~/.claude/settings-deepseek.json
```

推荐映射：

- `haiku` -> `deepseek-v4-flash`
- `sonnet` -> `deepseek-v4(~也许?可以正常调用, 账单上显示是flash~)`
- `opus` -> `deepseek-v4-pro`
- 默认模型 `ANTHROPIC_MODEL` -> `deepseek-chat`

> 勘误：DeepSeek 官方文档指出，当给 DeepSeek 的 Anthropic API 传入不支持的模型名时，API 后端会自动将其映射到 `deepseek-v4-flash` 模型。

## 5. Kimi 配置

新建文件：

```bash
vim ~/.claude/settings-kimi.json
```

内容：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "ANTHROPIC_BASE_URL": "https://api.moonshot.cn/anthropic",
    "API_TIMEOUT_MS": "600000",
    "ANTHROPIC_MODEL": "kimi-k2-turbo-preview",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "kimi-k2-turbo-preview"
  }
}
```

启动：

```bash
claude --settings ~/.claude/settings-kimi.json
```

如果希望 `sonnet`、`opus` 也走 Kimi，可以补上：

```json
{
  "env": {
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "kimi-k2-turbo-preview",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "kimi-k2-turbo-preview"
  }
}
```

## 6. 智谱 GLM 配置

新建文件：

```bash
vim ~/.claude/settings-glm.json
```

内容：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "API_TIMEOUT_MS": "3000000",
    "ANTHROPIC_MODEL": "glm-4.5",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air"
  }
}
```

启动：

```bash
claude --settings ~/.claude/settings-glm.json
```

如果需要更完整的模型别名，也可以继续补充：

```json
{
  "env": {
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.5",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.5"
  }
}
```

## 7. 中转站通用模板

如果某个中转站兼容 Anthropic API，一般只需要替换 `ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_BASE_URL` 和模型名。

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "ANTHROPIC_BASE_URL": "https://your-proxy.example.com/anthropic",
    "API_TIMEOUT_MS": "600000",
    "ANTHROPIC_MODEL": "your-default-model",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "your-fast-model",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "your-balanced-model",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "your-reasoning-model"
  }
}
```

> `BASE_URL` 后是否加上 `/anthropic` 取决于中转站的具体实现。

## 8. 常用启动命令

使用 DeepSeek：

```bash
claude --settings ~/.claude/settings-deepseek.json
```

使用 Kimi：

```bash
claude --settings ~/.claude/settings-kimi.json
```

使用智谱 GLM：

```bash
claude --settings ~/.claude/settings-glm.json
```

如果只想临时指定模型，也可以叠加 `--model`：

```bash
claude --settings ~/.claude/settings-deepseek.json --model opus
```

这里的 `opus` 会根据配置映射到 `ANTHROPIC_DEFAULT_OPUS_MODEL`。

## 9. DeepSeek 思考模式配置

DeepSeek 官方 Anthropic 兼容接口已经支持思考模式，而且默认思考开关是启用的。对于 Claude Code、OpenCode 这类复杂 Agent 请求，DeepSeek 文档说明 `effort` 会自动设置为 `max`。

所以最简配置里通常不需要额外写能力声明，基础配置可以保持简单：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "API_TIMEOUT_MS": "600000",
    "ANTHROPIC_MODEL": "deepseek-chat",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro"
  },
  "attribution": {
    "commit": "",
    "pr": ""
  }
}
```

这样日常默认走 `deepseek-chat`，需要推理时切到：

```bash
claude --settings ~/.claude/settings-deepseek.json --model opus
```

也就是走 `deepseek-reasoner`。

DeepSeek 官方给 Claude Code 的示例里还会设置环境变量：

```bash
export CLAUDE_CODE_EFFORT_LEVEL=max
```

如果你想在 settings 文件里等价配置，可以写到 `env` 里：

```json
{
  "env": {
    "CLAUDE_CODE_EFFORT_LEVEL": "max"
  }
}
```

不过这属于"显式指定强度"，不是开启思考模式的必要条件。

### 什么时候才需要 SUPPORTED_CAPABILITIES

`*_SUPPORTED_CAPABILITIES` 更像是 Claude Code 侧的能力声明，用来告诉 Claude Code：这个第三方模型支持 `/effort`、`thinking`、`max effort` 等功能。

它适合这些情况：

- `/effort` 在 Claude Code 里不可用或不显示。
- `/model` 里的自定义模型没有显示 effort 控制。
- 你接入的不是 DeepSeek 官方接口，而是某个中转站或网关，Claude Code 不知道模型能力。
- 你希望 Claude Code 明确按能力发送对应字段。

这时可以加：

```json
{
  "env": {
    "ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES": "effort,max_effort,thinking,adaptive_thinking,interleaved_thinking"
  },
  "effortLevel": "high"
}
```

但对 DeepSeek 官方接口而言，它不是必需项。

## 10. 添加自定义模型选项

`ANTHROPIC_CUSTOM_MODEL_OPTION` 的作用是：在 Claude Code 的 `/model` 选择器底部额外添加一个自定义模型选项。

它不会替换 `haiku`、`sonnet`、`opus` 这些内置别名，只是额外加一个入口。适合这些场景：

- 中转站支持某个模型，但 Claude Code 默认模型列表里没有。
- DeepSeek、Kimi、GLM 发布了新模型名，你想直接测试。
- 你想在 `/model` 里手动选择某个完整模型 ID。

示例：给 DeepSeek 添加一个 `deepseek-v4-pro` 自定义选项：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "API_TIMEOUT_MS": "600000",
    "ANTHROPIC_MODEL": "deepseek-chat",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-chat",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-chat",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-reasoner",
    "ANTHROPIC_CUSTOM_MODEL_OPTION": "deepseek-v4-pro",
    "ANTHROPIC_CUSTOM_MODEL_OPTION_NAME": "DeepSeek V4 Pro",
    "ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION": "Custom DeepSeek reasoning model",
    "ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES": "effort,max_effort,thinking,adaptive_thinking,interleaved_thinking"
  },
  "effortLevel": "high",
  "attribution": {
    "commit": "",
    "pr": ""
  }
}
```

配置后运行：

```bash
claude --settings ~/.claude/settings-deepseek.json
```

再输入 `/model`，选择器底部会出现类似 `DeepSeek V4 Pro` 的选项。

> 注意：`ANTHROPIC_CUSTOM_MODEL_OPTION` 只支持添加单个自定义模型选项。如果要配置多个常用模型，更适合用 `haiku`、`sonnet`、`opus` 三个别名分别映射，或者为不同模型准备多份 settings 文件。

## 11. 配置字段速查

| 字段                                                   | 作用                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `ANTHROPIC_AUTH_TOKEN`                                 | 第三方平台或中转站的 API Key                               |
| `ANTHROPIC_BASE_URL`                                   | Anthropic 兼容接口地址                                     |
| `API_TIMEOUT_MS`                                       | API 超时时间，单位是毫秒                                   |
| `ANTHROPIC_MODEL`                                      | Claude Code 默认使用的模型                                 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL`                        | 当选择 `haiku` 时映射到的模型                              |
| `ANTHROPIC_DEFAULT_SONNET_MODEL`                       | 当选择 `sonnet` 时映射到的模型                             |
| `ANTHROPIC_DEFAULT_OPUS_MODEL`                         | 当选择 `opus` 时映射到的模型                               |
| `ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES`  | 声明 `opus` 映射模型支持的能力                             |
| `ANTHROPIC_CUSTOM_MODEL_OPTION`                        | 在 `/model` 选择器底部添加一个自定义模型                   |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_NAME`                   | 自定义模型在 `/model` 中显示的名称                         |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION`            | 自定义模型在 `/model` 中显示的描述                         |
| `ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES` | 声明自定义模型支持的能力                                   |
| `effortLevel`                                          | Claude Code 的默认思考强度 (`low`/`medium`/`high`/`xhigh`) |
| `CLAUDE_CODE_EFFORT_LEVEL`                             | 通过环境变量设置思考强度，优先级更高                       |

## 12. 注意事项

- API Key 不要提交到 Git 仓库，也不要同步到公开笔记库。
- 不同平台的模型名可能会变，配置失败时优先检查模型名和 base url。
- 如果某个平台不支持 Claude Code 需要的完整 Anthropic 接口，可能会出现工具调用、流式输出或长上下文异常。
- `API_TIMEOUT_MS` 可以适当调大，推理模型和中转站响应慢时尤其有用。
- 如果某个别名没有配置，例如缺少 `ANTHROPIC_DEFAULT_OPUS_MODEL`，使用 `--model opus` 时可能无法按预期切换到对应模型。

## 13. 参考资料

- [Claude Code 使用原生 settings 选项配置多个自定义模型供应商](https://linux.do/t/topic/957691)
- [Claude Code 官方设置文档](https://code.claude.com/docs/zh-CN/settings)
- [Claude Code 官方模型配置文档](https://code.claude.com/docs/zh-CN/model-config)
- [Claude Code 如何删除git提交时的AI署名](https://jishuzhan.net/article/2024339917648756738)
- [如何隐藏你使用 AI 编程助手的事实](https://learnku.com/articles/91621)
- [DeepSeek 思考模式官方指南](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode)
- [DeepSeek Anthropic API 文档](https://api-docs.deepseek.com/zh-cn/guides/anthropic_api)
