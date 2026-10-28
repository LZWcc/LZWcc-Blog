---
title: Claude Code 任务结束后自动推送 Telegram 通知（零额外 Token）
description: 利用 Claude Code 原生 Stop Hook、Shell 脚本和 Telegram Bot API，在远程开发完成一轮回复后自动发送通知，无需 MCP 或额外模型调用。
publishDate: '2026-10-17T10:51:33+08:00'
tags:
  - Claude
  - AI
  - Telegram
  - SSH
draft: false
comment: false
authorship:
  mode: generated
  models: [Claude Opus 5.5]
category: tooling
---

平时我会通过 SSH 在远程服务器上使用 Claude Code 进行开发。但有一个问题：Claude Code 完成任务后，我无法像使用本机 Codex CLI 一样及时收到系统通知，需要反复切回终端查看。

于是我利用 Claude Code 原生的 **Hooks + Telegram Bot API** 实现了一套自动通知方案。

整个方案不需要安装 MCP、不需要部署额外服务，也不会消耗额外的模型 Token。

## 一、实现原理

Claude Code 提供了 Hooks 机制，可以在特定事件发生时自动执行 Shell 命令。

这里使用的是 `Stop` 事件，在 Claude Code 完成一轮回复后触发。

流程非常简单：

```text
Claude Code 完成回复
        ↓
触发 Stop Hook
        ↓
执行 Shell 脚本
        ↓
curl 请求 Telegram Bot API
        ↓
Telegram 收到通知
```

服务器只需要能访问 Telegram API，无需向公网开放端口。

## 二、创建 Telegram Bot

首先打开 Telegram，找到 [@BotFather](https://t.me/BotFather)，发送：

```text
/newbot
```

按照提示设置机器人名称和用户名，创建完成后会获得一个 Bot Token。

然后进入刚创建的机器人，发送 `/start` 或 `hello`。即使机器人没有回复也是正常的。

在终端执行：

```bash
curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
```

返回的 JSON 中，找到：

```json
"chat": {
  "id": 123456789,
  "type": "private"
}
```

其中 `id` 就是自己的 Chat ID。

注意：Bot Token 相当于密码，不要上传到公开仓库或写进博客。

## 三、服务器保存 Telegram 配置

我的环境是 Ubuntu 24.04，运行 Claude Code 2.1.302，服务器已安装 `curl`。

先创建配置文件：

```bash
mkdir -p ~/.config
nano ~/.config/claude-telegram.env
```

填入：

```ini
TG_BOT_TOKEN="你的 Bot Token"
TG_CHAT_ID="你的 Chat ID"
```

限制文件权限：

```bash
chmod 600 ~/.config/claude-telegram.env
```

## 四、编写通知脚本

创建脚本：

```bash
mkdir -p ~/.local/bin
nano ~/.local/bin/claude-notify.sh
```

内容如下：

```bash
#!/usr/bin/env bash

set -euo pipefail

source "$HOME/.config/claude-telegram.env"

PROJECT=$(basename "${CLAUDE_PROJECT_DIR:-$PWD}")

MESSAGE="Claude Code 本轮回复已结束
服务器：$(hostname)
项目：${PROJECT}"

curl -fsS \
  --connect-timeout 3 \
  --max-time 10 \
  -X POST \
  "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TG_CHAT_ID}" \
  --data-urlencode "text=${MESSAGE}" \
  > /dev/null
```

添加执行权限：

```bash
chmod 700 ~/.local/bin/claude-notify.sh
```

手动测试：

```bash
~/.local/bin/claude-notify.sh
```

如果 Telegram 成功收到通知，就说明脚本正常。

## 五、配置 Claude Code Hook

打开 Claude Code 的用户级配置：

```bash
nano ~/.claude/settings.json
```

添加以下内容（已有其他配置时，只需合并 `hooks` 字段）：

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/home/ubuntu/.local/bin/claude-notify.sh"
          }
        ]
      }
    ]
  }
}
```

注意将脚本路径替换成自己的实际路径。

重新启动 Claude Code，输入：

```text
/hooks
```

如果能够看到 `Stop` 事件及刚才的脚本路径，就说明 Hook 已被识别。

之后每当 Claude Code 完成一轮回复，便会自动调用 Telegram Bot API 发送通知。

## 六、注意事项

- **零额外 Token：** 通知过程只执行 Shell 脚本，不会再次调用 Claude 模型。
- **无需 MCP：** 直接使用原生 Hooks，配置简单，依赖少。
- **不是任务成功验证：** `Stop` 代表 Claude 完成一轮回复，不代表代码一定通过测试。
- **用户级配置：** Hook 保存在 `~/.claude/settings.json`，不需要写入项目仓库。
- **避免敏感信息泄露：** 默认只发送项目名、服务器名和结束状态，不上传对话正文。

## 七、总结

这套方案的核心只有三个部分：

**Claude Code Hooks + Shell + Telegram Bot API。**

不需要复杂的 Agent 框架，也不需要额外的模型调用，就能解决远程开发时无法及时知道任务结束的问题。

后续还可以扩展权限请求提醒、错误通知，以及 Codex CLI 和 Claude Code 的双 Agent 协作。

相关文档：

- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [Telegram Bot API](https://core.telegram.org/bots/api)
