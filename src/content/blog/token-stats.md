---
title: 汇总多台机器的 Claude Code 与 Codex 用量，生成 GitHub 主页卡片
description: 用量分散在笔记本和几台服务器上，Claude Code 30 天后还会清理日志。写了 token-stats：一台机器经 ssh 汇总、逐请求入库，生成 SVG 卡片推到自己的公开仓库，主页 README 直接引用。
publishDate: 2026-10-24 18:17:53
tags:
  - Claude Code
  - Codex
  - Python
  - GitHub
draft: false
comment: false
---

我同时用 Claude Code 和 Codex，分布在一台笔记本和两台服务器上。想知道一共用了多少 token、花在哪些模型上，并把它放到 GitHub 主页。Claude Code 默认还会删除 30 天前的会话日志，不及时收集就没了。

现成的工具不太合适。[ccusage](https://github.com/ccusage/ccusage) 每次运行时读本机日志出报表，只看一台机器，日志被清理后对应的统计也就没了。[tokscale](https://github.com/junhoyeo/tokscale) 支持的工具多，也有贡献图，但公开主页和排行榜要把用量提交到它的服务。我想要的是：多台机器汇总、永久保存、数据只放在自己的仓库里。

于是写了 [token-stats](https://github.com/LZWcc/token-stats)。下面是我自己的数据，每次同步后自动更新：

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/LZWcc/token-stats-data/main/token-stats/cards/overview-dark.svg">
  <img alt="Token 概览" src="https://raw.githubusercontent.com/LZWcc/token-stats-data/main/token-stats/cards/overview.svg">
</picture>

一共 9 张卡片可以挑：上面这张概览，全年和近半年热力图，统计，月度用量，模型占比，模型排行，Claude Code 与 Codex 的工具对比，以及一个 shields 风格的徽章。每张的样子和 README 片段见[卡片画廊](https://github.com/LZWcc/token-stats/blob/main/docs/cards.md)。

## 怎么做的

- **只在一台主机上安装**。同步时，笔记本把解析程序（`scan.py`，约 150 行 Python）和各日志文件的读取进度一起经 ssh 发给服务器上的 `python3 -I -B -` 执行，服务器只把新增的请求传回来。服务器上什么都不用装；扫描后查过，服务器上没有新增任何本项目的文件，只有 ssh 登录本身的系统日志。
- **逐请求记进本机的 SQLite**。每条请求有唯一键，跨机器去重，重复运行不会重复计数；同时记下每个日志文件读到哪里，之后只读新增的部分。日志被清理后，已经入库的数据不受影响。实测首次全量约 52 秒，之后每次约 6.5 秒，主要花在 ssh 连接上。
- **只用 Python 标准库**。macOS 自带的 `/usr/bin/python3`（3.9）就能运行，服务器上也只需要 Python ≥ 3.9。JSON 解析、SQLite、时区换算、文件锁、生成 SVG 卡片都用标准库完成，不依赖 Node，也不用 pip 装任何东西。
- **为什么不用 bash 或其他语言**。服务器零安装的前提是：服务器上本来就有解释器，并且能从 stdin 直接运行源码。Linux 发行版基本都自带 `python3`，`python3 -` 正好满足。纯 bash 解析嵌套的 JSON 要靠 `jq`，服务器上不一定有；bash 没有浮点运算，算不了卡片里的坐标和弧线；Windows 上也没有 bash。Node 在服务器上通常没装；Go、Rust 要按平台各编一份，还得先把程序拷到服务器上，就不再是零写入了。
- **卡片放在自己的公开仓库**。数据在自己的机器上，在线服务和 GitHub Actions 都读不到，只能本机生成，再推到公开仓库供 README 引用。程序只管理仓库里的 `token-stats/` 子目录；自动提交的作者是 `token-stats <token-stats@localhost>`，不关联任何 GitHub 账号，所以每天的提交不会让贡献图变绿。
- **安装脚本只装发布过的版本**。从最新 Release 下载源码包，生成的启动脚本里写死 Python 的绝对路径。macOS 上优先用 `/usr/bin/python3`：Homebrew 的 Python 路径带版本号，升级后就失效了。
- **三个平台的 CI**。每次推送都在 macOS、Linux、Windows 上，用 Python 3.9 和最新版跑单元测试（日志全是手写的合成数据），再用当前提交打出的源码包跑一遍安装、试用和卸载。我没有 Windows 机器，Windows 上只有 CI 测过，没在真实机器上用过。

## 怎么用

安装（macOS / Linux）：

```bash
curl -fsSL https://raw.githubusercontent.com/LZWcc/token-stats/main/install.sh | sh
```

Windows 用 PowerShell：

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://raw.githubusercontent.com/LZWcc/token-stats/main/install.ps1 | iex"
```

然后：

1. `token-stats`：试用，只统计本机，不写数据目录，在当前目录生成卡片并打开预览页。要扫完全部日志，我的笔记本上约 8 秒。
2. `token-stats init`：向导，依次问本机名、要加入的服务器（从 `~/.ssh/config` 里选，服务器需要能免密登录）、要自动合并的其他 usage.db、时区、卡片口径、发布仓库，检测到 CC Switch 时问是否导入，然后做首次采集，最后问是否装定时任务。发布仓库不存在且装了 gh 时，可以直接新建。
3. 从 `init` 最后打印的 README 片段里挑想要的卡片，贴进主页 README。每张卡片一个 `<picture>`，按访客的主题切换亮色和暗色。
4. 之后运行 `token-stats sync` 更新，`token-stats doctor` 检查各机器的连接和发布状态。

唯一的硬约束：每台机器至少每 30 天被 `sync` 一次，否则日志会在入库前被清理。超过 7 天没采集时，`sync` 和 `doctor` 会提醒。`init` 里可以装每天 12:00 运行的定时任务（launchd / systemd / crontab / 任务计划程序）；我没装，手动运行。

升级就重新运行安装命令，只替换程序，不动配置和数据。卸载用 `token-stats uninstall`，配置和数据默认保留。

## 踩过的坑

| 现象 | 原因 | 解决 |
|---|---|---|
| CC Switch 里较早的日期只剩每天的汇总，明细没了 | CC Switch 会把较早的逐请求记录汇总成日汇总，再删除明细 | 汇总行按一行记一条；库里已有 CC Switch 的数据就拒绝再导入，避免用新快照重复计数 |
| 远端改过 `token-stats/` 子目录后，每次发布都失败 | 原来用 `git pull --rebase`，冲突后一直卡住 | 子目录完全由本地数据生成，不需要合并：`fetch` 后 `reset --hard` 到远端，再复制，有变化才提交。子目录以外的文件不受影响 |
| 经 ssh 运行时 push 失败：`failed to get: -25308` | macOS 钥匙串只在本机登录会话中可用 | 本程序的 git 命令用 `-c credential.https://github.com.helper=…` 追加 `gh auth git-credential` 作为备用，不改 `~/.gitconfig` |
| 测试在本机通过、在 CI 失败：克隆空仓库后分支是 master | 克隆空仓库时本地分支跟随远端 HEAD，`-c init.defaultBranch=main` 不起作用；Xcode 自带的 git 配置把默认分支设成了 main，掩盖了问题 | 测试里模拟 `gh repo create` 时用 `git init --bare --initial-branch=main`，与 GitHub 新建的空仓库一致 |
| Windows 上输出重定向到文件时（如定时任务写日志），打印中文报 `UnicodeEncodeError` | 重定向时 Python 按本地编码（cp1252）输出 | `main()` 开头把 stdout、stderr `reconfigure(encoding='utf-8')` |
| Windows 上生成的批处理文件换行是 `\r\r\n` | 代码里写的是 `\r\n`，文本模式又把 `\n` 转成 `\r\n` | `open(..., newline='')`；同时按 `encoding='oem'` 写，cmd 按 OEM 代码页读批处理 |
| Windows 上读取 git 的中文输出报 `UnicodeDecodeError` | `subprocess` 文本模式默认按本地代码页解码 | 显式 `encoding='utf-8', errors='replace'` |
| 安装脚本取最新版本时卡住，或报 `Error in the HTTP2 framing layer` | 用 `curl -I`（HEAD）经 HTTP/2 访问 GitHub，在我的网络下会出错或卡住 | 改用 GET，从 `%{url_effective}` 里取 `/tag/` 后面的版本号 |
| macOS 上 `curl … \| sh` 安装后，最后几行提示没打印，退出码却是 0 | macOS 的 `/bin/sh`（bash 3.2）在 UTF-8 语言环境下，把紧跟变量的全角括号读进变量名（`$py）`），`set -u` 下脚本中止 | 写成 `${py}）`；CI 的 macOS 安装测试改用 `LC_ALL=en_US.UTF-8` |
| 自己画的徽章和其他项目的徽章放在一起不协调 | 只画了两个色块，用的是系统字体；shields.io 的默认样式还有一层渐变、文字阴影，字体是 Verdana | 照 img.shields.io 生成的 SVG 结构写；每段宽度按 shields 的算法（Verdana 11px 文字宽度取整 + 10），字宽表在 macOS 上用 AppKit 实测 |
| Windows 上 `uninstall` 删除正在运行的启动脚本 `token-stats.cmd` 后，cmd 报错 | cmd 执行完一行才回文件读下一行，文件已经不在了 | 在 CI 的 Windows 上试过：行尾加 `& exit /b`，退出码变成 0；加 `& call exit /b %%errorlevel%%`，删除后报找不到路径。最后改为启动一个独立的 cmd 进程，等约 2 秒再删 |

## 附录：文件位置

| 内容 | macOS / Linux | Windows |
|---|---|---|
| 程序 | `~/.local/share/token-stats/app/` | `%LOCALAPPDATA%\token-stats\app\` |
| 启动脚本 | `~/.local/bin/token-stats` | `%LOCALAPPDATA%\token-stats\bin\token-stats.cmd` |
| 配置 | `~/.config/token-stats/config.json` | `%APPDATA%\token-stats\config.json` |
| 数据 | `~/.local/share/token-stats/`：`usage.db`（逐请求账本）、`daily/`（日数据）、`cards/`（卡片和预览页）、`backups/`（每日备份，保留 7 份）、`publish/`（发布仓库的本地克隆） | `%LOCALAPPDATA%\token-stats\` 下同名 |
