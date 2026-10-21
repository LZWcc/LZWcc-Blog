---
title: 远程用 Claude Code：断线、滚动和多 agent
description: 在 245 毫秒延迟的 VPS 上跑 Claude Code：为什么 herdr、aoe 滚动卡，怎么用 iTerm2 + tmux -CC 做到本地滚动，自己写的多 agent 侧栏 ag，以及完整的 iTerm2 设置清单。
publishDate: 2026-10-20 22:10:38
updatedDate: 2026-10-21 17:46:33
tags:
  - Claude
  - tmux
  - iTerm2
  - 终端
draft: false
comment: false
---

我平时在 Mac 上 `ssh lxc` 连到一台 VPS，在上面跑 Claude Code。用久了有两个地方一直不顺手：

1. **断线**：Wi-Fi 一抖，SSH 就断了，只能重新连上再 `claude -c`。
2. **滚动**：用 tmux 解决了断线，但每次往上翻都要先按 `Ctrl+b [`，再把光标挪到顶上才能滚，滚回来又要把光标挪到底。我不用 Claude Code 的全屏模式，因为那样复制出来的字符留在终端里，到不了 Mac 的剪贴板。

后来又想同时开几个 Claude、一眼看出哪个在等我。试过 herdr：不用前缀就能滚，多 agent 管理也很方便，但滚动非常卡，像是一行一行在画。于是我想干脆让 AI 帮我用 Rust 写一个类似的工具。下面是和 Claude 一起折腾的结果。

## 为什么不自己写一个 tmux

想要和本地一样的滚动，关键是**滚动历史存在哪里**，而不是再写一个更快的多路复用器。

tmux、herdr、zellij 都是"终端里的终端"：每个窗格的画面和滚动历史都在服务器上，往上翻要由它们在服务器上重画、再传回来。我到 VPS 的往返延迟约 245 毫秒（`ss -ti` 看 SSH 连接的 `rtt`），实测：

| 方式 | 滚动 | 断线后继续跑 |
|---|---|---|
| herdr、aoe | 明显卡，看得出一行一行在重画 | ✅ |
| tmux 开鼠标模式，触控板直接滚 | 一跳一跳的，改成一次滚 1 行也没用 | ✅ |
| tmux `Ctrl+b [` 后用触控板滚 | 好一些，但不算顺，还要按前缀 | ✅ |
| shpool / dtach | 原生，但重连后只恢复当前一屏 | ✅ |
| Eternal Terminal | 原生 | 只能扛短时间断线 |
| **iTerm2 + `tmux -CC`** | **和本地一样** | ✅ |

`tmux -CC` 是 tmux 的控制模式：tmux 不再画整屏，而是把每个窗格的原始输出原样转给 iTerm2，由 iTerm2 自己保存滚动历史。历史在 Mac 上，滚动、选中、复制就都是原生的，不经过网络。herdr、zellij 没有这样的协议，也没有终端配合它们，所以再成熟也做不到。

结论：**不自己写多路复用器。服务器用 tmux 保持会话，滚动交给 iTerm2。**

## iTerm2 + tmux -CC

和以前的 tmux 习惯一样，只是多加一个 `-CC`，要从普通的 ssh shell 里启动：

```bash
ssh lxc
tmux -CC new -A -s main   # 有就连，没有就建
```

iTerm2 需要改几项设置，汇总在[文末清单](#附iterm2-设置清单)。

测试结果：复制 ✅，滚动 ✅。还有一个问题：**改窗口宽度后，旧历史还是按原宽度换行，最近几条消息还会重复一遍。** 推测是 Claude Code 在非全屏模式下按当时的宽度自己插入换行，窗口一变就按新宽度重画一遍，旧的那份留在了历史里。规避办法是尽量别在对话中途调窗口大小。

## 多 agent 管理

一个 Claude 跑着长任务，另一个项目又想开一个，在几个标签页之间来回找"哪个在等我确认"很累。aoe（[Agent of Empires](https://github.com/agent-of-empires/agent-of-empires)）和 herdr 都是自己画一个全屏界面，把 agent 的输出画在里面，滚动一样卡。

所以选型标准是：**agent 的输出必须留在真正的 tmux pane 里**，让 iTerm2 画成原生分屏；管理工具只占一个小侧栏，不去画 agent 的内容。

### 自己写了一个：ag

让 Claude 写了一个 bash 脚本 `ag`（约 430 行）：

```
┌──────────────────────┬──────────────────────────────┐
│ AGENTS               │                              │
│ 1 ● 修复登录接口超时 │   当前 agent（claude）       │
│     api              │   iTerm2 原生分屏，本地滚动  │
│▶2 ◆ 首页改版         │                              │
│     web              │                              │
│                      │                              │
│ ＋ 新建              │                              │
└──────────────────────┴──────────────────────────────┘
```

- **布局**：左边侧栏，右边当前 agent。其余 agent 停在一个隐藏的 tmux 会话里，切换时用 `swap-pane` 换到右边，所以 iTerm2 里始终只有一个标签页。
- **状态**：Claude Code 的 hook 把状态写进 tmux pane 的属性，侧栏每秒读一次。● 运行中，◆ 等你确认，✓ 已完成。在终端里退出 Claude 后（`SessionEnd` hook），侧栏变回"终端"。
- **标题**：第一行是对话标题（`/rename` 起的名字 > Claude 自动生成的 `ai-title` > 第一句提问），第二行是目录。
- **新建**：先选目录，再选开什么：回车开一个普通终端（可以先 `mkdir`、`cd`，再自己跑 `claude`），`c` 直接开新的 Claude 对话，数字接回这个目录最近的某次对话（相当于 `claude -r <id>`）。
- **操作**：鼠标点标题切换，点"＋ 新建"开新的，点右边打字。

写之前搜过现成的，思路最接近的是 [tmux-agent-sidebar](https://github.com/hiroppy/tmux-agent-sidebar)。装上试了：滚动没问题，但它一个 agent 占一个 tmux 窗口，`-CC` 下就是一个标签页，点侧栏等于切标签页，和 `⌘T` 差不多。"一个标签页里点哪个换哪个"只有 `swap-pane` 能做到。

### 踩过的坑

基本都是"高延迟 + iTerm2 两个原生分屏"组合出来的，本地跑 tmux 遇不到：

| 现象 | 原因 | 解决 |
|---|---|---|
| tmux 前缀快捷键不生效 | `-CC` 下按键直接发给 pane | 所有操作放在侧栏里 |
| 侧栏被关掉就没了 | 关 iTerm2 分屏会 kill 掉 tmux pane | 每次执行 `ag` 都检查，丢了就补回来 |
| ⌘W 后 iTerm2 报 `can't find pane` 并断开 | ⌘W 关的是有焦点的那个分屏。单个分屏没法隐藏，只能被 kill | 离开时用 ⌥⌘W 关整个标签页；误关了就重新执行 `ag` |
| Claude 把自己杀掉了 | tmux 目标参数为空时会落到当前 pane，`swap-pane -t ""` 把正在跑的 Claude 换走，随后被当成测试会话清理掉 | 空目标一律拒绝；测试放到独立的 `tmux -L` 服务器里 |
| 输入框里冒出 `^[[<0;7;10m` | 鼠标"按下"时就切走了，245 毫秒后到的"松开"信号落进了输入框 | 改成"松开"时才执行 |
| 点切换后焦点闪一下又回到侧栏 | 脚本 `select-pane` 把焦点给右边，一个往返后 iTerm2 按鼠标位置抢回去 | 不抢焦点，要打字就点右边 |
| 标签页标题来回跳 | 标签页显示的是有焦点那个 pane 的标题 | 侧栏用 `\e]2;…\a` 把自己的标题设成和右边 agent 一样 |
| 往上翻有好几份 Claude 的开头 | 停放窗口和显示区尺寸不同，每次切换 Claude 都整屏重画 | 停放窗口始终 `resize-window` 成同样大小 |
| 在侧栏上滚动冒出 `^[[<65;…M` | 侧栏刷新时回显开着，滚轮信号被直接显示出来 | 侧栏全程 `stty -echo` |
| 关掉一个 agent 后侧栏叠成好几屏 | `\e[2J` 清屏时 tmux 把旧画面存进了历史（`scroll-on-clear`） | 改成原地覆盖，并关掉 `scroll-on-clear` |

调试方法：先在独立 tmux 服务器里用 `send-keys` 模拟鼠标信号，验证脚本逻辑；对不上时用 tmux hook 记录实际发生了什么，分清是脚本的问题还是 iTerm2 的行为。

### Mac 通知

Claude Code 能通过 iTerm2 弹 Mac 通知，提醒哪个 agent 在等你。在 tmux 里要多设置几处，见[文末清单](#附iterm2-设置清单)里带"通知"的几行。

通知**不是一回答完就弹**：Claude 弹出权限确认时会发；回答完后你 **60 秒**没理它，才会发一条 `Claude is waiting for your input`。通知长这样：

```
Alert
Session ✳ Claude Code #3: Claude is waiting for your input
        └─────┬─────┘ └┬┘ └──────────────┬──────────────┘
          pane 标题   编号      Claude 发来的正文
```

Claude 只发正文，前缀是 iTerm2 加的。中间的名字是 pane 标题，也就是 `✳ 对话标题`，新对话还没标题时是 `✳ Claude Code`。想一眼认出是哪个 agent，就用 `/rename` 起个名字。排查时可以在 tmux 里执行 `printf '\e]9;测试\a'`，再切到别的 App 看有没有弹。

### 怎么用

在 Mac 的 `~/.zshrc` 里加一个别名：

```bash
alias ag="ssh -o RemoteCommand=none -t lxc 'cd /home/lzwcc/workspace && exec ~/.local/bin/ag'"
```

我的 `~/.ssh/config` 里给 `lxc` 配了 `RemoteCommand`（登录后自动 `cd` 进 workspace），这时再在命令行上带命令，ssh 会报 *Cannot execute command-line and remote command*，所以要用 `-o RemoteCommand=none` 关掉它。

1. iTerm2 里 `⌘T` 开一个标签页，敲 `ag`。第一次进去时会在 workspace 自动开一个终端。
2. 点"＋ 新建"：选目录（第一项是执行 `ag` 时所在的目录），回车开终端，`c` 开新 Claude 对话，数字接回历史对话。
3. 点侧栏的标题切换 agent，点右边打字。◆ 表示在等你确认。
4. 暂时离开按 **⌥⌘W**（关整个标签页），agent 继续在服务器上跑，下次敲 `ag` 回来都在。**不要按 ⌘W**，它只关有焦点的那个分屏，会把侧栏或当前 agent 杀掉。
5. 用完的 agent 在侧栏按 `x` 关掉。侧栏不见了或者显示乱了，重新执行 `ag`（或 `ag fix`）。

注意：

- 不要用 iTerm2 分屏上的 ✕ 关 agent，那会直接 kill 掉 pane，用 `x`。
- 停放的 agent 是**还在运行**的 Claude 进程，每个约 300MB。这台 VPS 只有 4G 内存，同时开七八个就到头了，用完要关。关掉不会丢对话，可以从历史里接回来。
- 多个终端执行 `ag`，连的是同一个工作台：在一边切换，另一边也跟着换。

## 附：iTerm2 设置清单

`Cmd + ,` 打开 iTerm2 设置：

| 位置 | 设置 | 作用 |
|---|---|---|
| General → tmux | *Open tmux windows as*：*Tabs in the attaching window* | tmux 的窗口以标签页的形式开在当前窗口里 |
| General → tmux | 勾选 *Automatically bury the tmux client session after connecting* | 执行 `tmux -CC` 的那个标签页会变成只显示控制信息的"网关"，关掉就断开。勾上后它会自动藏起来，需要时从 *Session → Buried Sessions* 找回。执行 `ag` 时也一样，不勾就会多出一个没用的标签页 |
| General → Selection | 勾选 *Applications in terminal may access clipboard* | 服务器上的程序能写 Mac 剪贴板，远程的 `/copy` 能用 |
| Profiles → Keys → General | *Left Option key*：*Esc+* | Claude Code 的 Option 快捷键（如 Option+Enter 换行）能用 |
| Profiles → Window | 设好默认列数和行数 | 少拖窗口大小，避免 Claude 重画出重复内容 |
| Profiles → Terminal | 勾选 *Notification Center Alerts* | 通知：允许 iTerm2 弹 Mac 通知 |
| Appearance → Dimming | 取消 *Dim inactive split panes* | 侧栏和 agent 两个分屏颜色一致，切换时看不出焦点跳动 |
| Appearance → Panes | 取消 *Show per-pane title bar with split panes* | 去掉分屏标题栏，切换时不会先闪一下 `tmux` |
| Pointer | 不要开 *Focus follows mouse* | 不需要 |

iTerm2 之外还要配合的：

| 位置 | 设置 | 作用 |
|---|---|---|
| macOS 系统设置 → 通知 → iTerm2 | 允许通知 | 通知：不开的话 iTerm2 发了也看不到 |
| 服务器 `~/.tmux.conf` | `set -g history-limit 50000` | 每个 pane 的滚动历史，默认 2000 行不够，只对新建的 pane 生效 |
| 服务器 `~/.tmux.conf` | `set -g allow-passthrough on` | 通知：Claude 在 tmux 里会把通知包一层 tmux 转发格式，这个选项关着时会被丢掉 |
| 服务器 tmux | `mouse` 保持默认的 `off` | 打开后滚轮会被 tmux 接管，就不是 iTerm2 本地滚动了 |
| Claude Code | `/config notifChannel=iterm2` | 通知：默认的 `auto` 在 tmux 里认不出 iTerm2，要手动指定，已开的 Claude 重启后生效 |

`tmux -CC` 下几个容易困惑的现象：

- **`⌘T` 开的是普通标签页**，是 Mac 本地的 shell，不归 tmux 管。要开 tmux 窗口用菜单 Shell → tmux → New Tmux Tab，或者执行 `tmux new-window`。
- **tmux 的前缀快捷键不生效**，按键直接发给了程序。窗口、分屏的操作用 iTerm2 自己的快捷键和菜单。
- **关整个标签页和关单个分屏不一样**：关掉整个标签页（只有一个窗格时的 ⌘W，或者有分屏时的 ⌥⌘W），iTerm2 只是把这个 tmux 窗口藏起来，程序继续跑；关掉分屏里的一个窗格，这个窗格会被 kill，里面的程序也就结束了。
- **标签页标题显示的是有焦点那个 pane 的标题**，不是 tmux 窗口名，所以 `tmux rename-window` 在 iTerm2 上看不到效果。
- **鼠标点在哪个分屏，焦点就在哪**。服务器这边用 `select-pane` 改焦点，iTerm2 会在一个来回后改回去。
