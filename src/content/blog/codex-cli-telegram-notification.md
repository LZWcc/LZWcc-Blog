---
title: Codex CLI 任务结束后自动推送 Telegram 通知（零额外 Token）
description: 在 Mac 上通过 Codex CLI 的 notify 配置调用 Shell 脚本，将回合结束通知发送到 Telegram，并记录代理排查、已有通知回调兼容和验证边界。
publishDate: 2026-10-17
tags:
  - Codex
  - AI
  - Telegram
  - macOS
draft: false
comment: false
---

上一篇介绍了[服务器上的 Claude Code Telegram 通知方案](/blog/claude-code-telegram-notification/)。这次把 Mac 本机的 Codex CLI 也接入同一个 Telegram Bot。

Claude Code 使用 `Stop` Hook，Codex CLI 则可以通过用户级配置中的 `notify` 调用外部程序。通知过程只执行 Shell 和 HTTP 请求，无需 MCP，也不会为发送通知额外调用模型。

本文记录配置方法和本机测试结果。截至记录时，手动发送已成功，真实回合结束后的自动通知仍待验证。

## 一、实现原理

```text
Codex CLI 完成一轮回复
        ↓
触发 agent-turn-complete 事件
        ↓
执行 notify 指定的程序
        ↓
Shell 脚本调用 Telegram Bot API
        ↓
Telegram 收到固定通知
```

根据 [Codex 官方通知文档](https://developers.openai.com/codex/config-advanced/#notifications)，`notify` 会收到一个 JSON 参数，其中可能包含用户消息和最后一条回复。下面的 Telegram 脚本不读取这个参数，只发送固定文本。

这里的“完成”指一轮回复结束，不代表代码已经通过测试，也不代表整个开发目标已经完成。

## 二、准备 Telegram 配置

Bot Token 和 Chat ID 的获取方法见[上一篇文章](/blog/claude-code-telegram-notification/)。如果已经创建机器人，可以复用，不需要再创建一个。

在 Mac 本机创建配置文件：

```bash
mkdir -p ~/.config
nano ~/.config/agent-telegram.env
```

填入自己的配置：

```ini
TG_BOT_TOKEN="你的 Bot Token"
TG_CHAT_ID="你的 Chat ID"
```

限制文件权限：

```bash
chmod 600 ~/.config/agent-telegram.env
```

这里使用 `agent-telegram.env`，方便本机其他 Agent 通知脚本复用。上一篇服务器上的文件名是 `claude-telegram.env`，两者可以不同，但脚本读取的路径必须与实际文件一致。

Bot Token 不要写进博客、截图或项目仓库。

## 三、创建 Codex 通知脚本

```bash
mkdir -p ~/.local/bin
nano ~/.local/bin/codex-notify.sh
```

写入：

```bash
#!/usr/bin/env bash

set -euo pipefail

# 读取 Telegram 配置
source "$HOME/.config/agent-telegram.env"

MESSAGE="Codex 本轮任务已结束
设备：MacBook Air"

# 发送 Telegram 通知
curl -fsS \
  --connect-timeout 3 \
  --max-time 10 \
  -X POST \
  "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TG_CHAT_ID}" \
  --data-urlencode "text=${MESSAGE}" \
  > /dev/null
```

设备名称可以自行修改。添加执行权限并检查语法：

```bash
chmod 700 ~/.local/bin/codex-notify.sh
bash -n ~/.local/bin/codex-notify.sh
```

手动执行：

```bash
~/.local/bin/codex-notify.sh
```

预期收到：

```text
Codex 本轮任务已结束
设备：MacBook Air
```

## 四、本机踩坑：curl 没有自动使用系统代理

本机第一次测试时，curl 返回退出码 `35`，错误为：

```text
curl: (35) Recv failure: Connection reset by peer
```

检查发现，macOS 配置了本地代理 `127.0.0.1:7890`，但执行脚本的终端环境没有对应的代理环境变量。这个错误本身不能单独证明是代理问题；本机是在显式使用代理后，请求才成功。

可以先临时测试：

```bash
https_proxy=http://127.0.0.1:7890 ~/.local/bin/codex-notify.sh
```

确认自己的代理地址后，在脚本的 `curl` 命令之前加入：

```bash
# 优先使用已有环境变量，否则使用本机代理
export https_proxy="${https_proxy:-${HTTPS_PROXY:-http://127.0.0.1:7890}}"
```

`7890` 是我的本机端口，需要替换成自己的实际配置。如果可以直连 Telegram，就不需要这一行。使用固定本地代理时，代理程序也需要保持运行。

加入这一行后，本机直接执行脚本测试成功。

## 五、配置 Codex CLI 的 notify

先备份用户级配置：

```bash
cp ~/.codex/config.toml ~/.codex/config.toml.bak.$(date +%Y%m%d-%H%M%S)
nano ~/.codex/config.toml
```

如果原来没有 `notify`，在文件最顶部加入：

```toml
notify = ["/bin/bash", "/Users/你的用户名/.local/bin/codex-notify.sh"]
```

将路径替换成脚本的实际绝对路径。例如，我的用户名是 `lzwcc`，对应路径就是 `/Users/lzwcc/.local/bin/codex-notify.sh`。

注意这几点：

- `notify` 是顶层配置，需要放在 `[tui]`、`[features]` 等配置段之前。
- 已经存在 `notify` 时，修改原有项，不要重复添加。
- 保留其他配置。
- 写入用户级 `~/.codex/config.toml`；[官方配置参考](https://developers.openai.com/codex/config-reference/)说明，项目级配置中的 `notify` 不会生效。

## 六、已有通知回调时，先确认它的用途

`notify` 与 `tui.notifications` 是独立机制：前者运行外部程序，后者控制终端内置通知。因此，新增 Telegram 通知通常不需要修改 `[tui]`。

但如果原来就有 `notify`，直接覆盖仍然会移除原来的外部回调。本机已有一个 Computer Use 的回合结束回调，需要保留。

对于普通的、没有自行串联其他通知的回调，可以使用一个组合脚本。下面是结构示例，**需要将原命令和固定参数按自己的配置填写后再使用**：

```bash
#!/usr/bin/env bash

# 保留原命令及其固定参数，将事件 JSON 原样转发
/absolute/path/to/original-notifier original-argument "$@" \
  || printf 'Original Codex notify callback failed\n' >&2

# Telegram 仅发送固定文本
/bin/bash "$HOME/.local/bin/codex-notify.sh"
```

保存为 `~/.local/bin/codex-notify-all.sh`，设置权限：

```bash
chmod 700 ~/.local/bin/codex-notify-all.sh
bash -n ~/.local/bin/codex-notify-all.sh
```

再让顶层配置指向它：

```toml
notify = ["/bin/bash", "/Users/你的用户名/.local/bin/codex-notify-all.sh"]
```

这个示例没有启用 `set -e`，并显式处理了原回调的失败，避免原回调返回非零状态时直接跳过 Telegram。两个命令按顺序执行，因此原回调若迟迟不退出，也会延迟后续通知。

另外，桌面工具可能会管理或重新包装 `notify`。本机后续检查时，已发现配置带有 `--previous-notify` 转发参数。如果已有这种转发机制，应先核对调用链，避免再包装一次造成重复通知或循环调用。不要把本文中的 Computer Use 场景当作所有机器都需要的步骤。

## 七、验证自动触发

保存配置后，重新启动 Codex CLI：

```bash
codex
```

输入：

```text
只回复 ok，不要调用工具。
```

等待回复完成，再检查 Telegram。

手动测试和自动触发要分别验证：

| 验证项                               | 本次记录结果                     |
| ------------------------------------ | -------------------------------- |
| 脚本语法及执行权限                   | 已检查                           |
| 使用本机代理手动发送                 | 测试成功                         |
| TOML 解析及 CLI 读取配置             | 已通过                           |
| 真实回合结束后自动收到 Telegram 通知 | 待验证；测试会话请求超时，已退出 |

手动脚本成功说明发送链路可用，不能替代 CLI 自动触发测试。上面的 `ok` 测试会正常调用一次模型；“零额外 Token”指的是发送通知这个动作，不包含正常的 Codex 对话。

本文面向 Codex CLI。桌面 App 是否采用相同触发路径，需要单独验证。

## 八、后续扩展

现在，服务器 Claude Code 和本机 Codex CLI 都有了向 Telegram 发送通知的配置方案。

但通知只是单向提醒，不会自动把 Claude Code 的规划交给 Codex 执行。双 Agent 协作还需要另外设计任务交接、执行权限和结果反馈，后续再单独记录。

相关文档：

- [Codex 通知配置](https://developers.openai.com/codex/config-advanced/#notifications)
- [Codex 配置参考](https://developers.openai.com/codex/config-reference/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
