---
title: 远程 Claude Code 里用 Control+V 贴 Mac 截图
description: Claude Code 跑在 VPS 上时，Control+V 读的是服务器的剪贴板。放一个假的 xclip，按 Control+V 时通过 ssh 取 Mac 剪贴板里的图片，转成 WebP 传过来，一次 1.3～2.5 秒；Finder 里复制的文件也能贴。
publishDate: 2026-10-21 20:11:35
tags:
  - Claude
  - 终端
  - SSH
  - macOS
draft: false
comment: false
---

我在 Mac 上 ssh 到 VPS 跑 Claude Code（做法见[远程用 Claude Code：断线、滚动和多 agent](/blog/claude-code-remote-terminal/)）。剩下最不顺手的是贴图：Claude Code 贴图时读的是它所在机器的剪贴板，也就是 VPS 的，而截图在 Mac 上。之前只能用自己写的 `/clip` 命令一次传一张。

想要的效果：在 Mac 上截图，回到 Claude Code 按 Control+V 就贴进去，能连续贴多张。

## 先分清三个键

| 键 | 作用 |
|---|---|
| ⌃V（Control） | Claude Code 自己去读剪贴板里的图片 |
| ⌘V（Command） | iTerm2 的粘贴，把文字打进终端 |
| ⌥V（Option） | 默认打出 `√`。Claude Code 只在 Windows / WSL 上用 Alt+V 贴图 |

我原来一直记成 Option+V。Claude Code 程序里是这样写的：

```js
Le = (windows || wsl) ? "alt+v" : "ctrl+v"   // 绑定到 chat:imagePaste
```

所以 Mac 和 Linux 上都是 Control+V，也就是键盘左下角 fn 旁边那个键，不是 Command。

这里判断的是 **Claude Code 运行在哪个系统**，而不是我从哪台电脑连过来。Claude Code 跑在 Linux 服务器上，所以不管从 Mac 还是 Windows 连过去，贴图键都是 Control+V。

## Claude Code 在 Linux 上怎么读剪贴板

xclip 是 Linux 图形桌面（X11）上读写剪贴板的命令行工具：

| 命令 | 作用 |
|---|---|
| `xclip -selection clipboard -t TARGETS -o` | 列出剪贴板里有哪些格式，比如 `text/plain`、`image/png` |
| `xclip -selection clipboard -t image/png -o` | 输出剪贴板里的 PNG 图片 |
| `xclip -selection clipboard -o` | 输出剪贴板里的文字 |
| `xclip -selection clipboard -i` | 把输入的内容写进剪贴板 |

Claude Code 不自己读剪贴板，在 Linux 上就是调用 xclip（没有的话再试 Wayland 的 `wl-paste`）。从 Claude Code（2.1.306）的程序里找到，按 ⌃V 后会依次执行两条 shell 命令：

```sh
# 1. 剪贴板里有没有图片
xclip -selection clipboard -t TARGETS -o | grep -E "image/(png|jpeg|jpg|gif|webp|bmp)" || wl-paste -l | grep ...
# 2. 取出图片，写到临时文件
xclip -selection clipboard -t image/png -o > 临时文件 || wl-paste --type image/png > 临时文件 || ...
```

读到的文件会按字节识别真实格式，压缩后贴进输入框，所以给它 WebP 也可以。

服务器上没有图形桌面，也就没有剪贴板可读，xclip 一般也不会装。我这台 VPS 上 `xclip`、`wl-paste`、`xsel` 都没有。这两条命令又都不检查 `DISPLAY`，所以只要放一个叫 xclip 的脚本，按同样的格式回答这两个问题，Claude Code 就会照常贴图。它不在乎回答的是不是真的 xclip。

## 方案：一个假的 xclip

`~/.local/bin/xclip` 是一个 bash 脚本。`~/.local/bin` 在 `PATH` 里排在 `/usr/bin` 前面，Claude Code 执行 `xclip` 时找到的就是它。没有改动任何系统文件，只对当前用户生效；以后就算装了真的 xclip，也还是先找到这个脚本。

按一次 ⌃V 的过程：

1. 第一次被调用（问有没有图）时，ssh 到 Mac 执行一段脚本，把剪贴板内容打成 tar 传回来，解包到 `~/.cache/clip-bridge/`。
2. 有图片就输出 `image/webp`，Claude Code 接着来取图时，直接给它缓存里的文件。几秒内的后续调用都用这份缓存，**一次 ⌃V 只访问 Mac 一次**。
3. 没有图片时，Claude Code 本来会退回去读剪贴板里的文字，但它发现自己在 SSH 会话里就直接跳过：

   ```js
   function b(){ return eu()?.ssh ?? !!a.SSH_CONNECTION }   // 是否在 SSH 会话里
   async function E0t(){ if (b()) return ""; ... }           // 读剪贴板文字
   ```

   结果只是闪一下 *No image found in clipboard. You're SSH'd; try scp?*。所以剪贴板里是文件时，由脚本自己用 `tmux paste-buffer -p` 把路径作为一次粘贴，送进 Claude Code 所在的 tmux 窗格（`$TMUX_PANE`）。对 Claude Code 来说，这和在本地按 ⌘V 粘贴路径一样。

Mac 上不用装新东西：取剪贴板的脚本作为 ssh 命令参数发过去，用的是系统自带的 `osascript`、`sips`，以及 Homebrew 里已有的 `cwebp`。读剪贴板用 JXA，核心是这几行：

```js
ObjC.import('AppKit');
const pb = $.NSPasteboard.generalPasteboard;
// Finder 里复制的文件
const urls = pb.readObjectsForClassesOptions($([$.NSURL]),
  $({NSPasteboardURLReadingFileURLsOnlyKey: true}));
// 截图等图片数据
const data = pb.dataForType('public.png');   // 没有再试 public.tiff
```

判断顺序是**先看文件，再看图片**。在 Finder 里复制文件时，剪贴板里还带着这个文件的图标（`public.tiff`）。如果先看图片，就会把图标当成截图贴进去。

Finder 里复制的是图片文件时，读出原文件，压缩后传过来。其他文件（PDF 之类）不传，只贴 `lzwcc:<Mac 上的路径>`：传输太慢（见下一节），而且我的项目代码本来就在 Mac 上，Claude 需要时通过 ssh 去读就行。

Claude Code 调用 xclip 时没有设超时，所以脚本自己限时：ssh 连接 3 秒，整体 10 秒，超时就按剪贴板为空处理。

## 速度

Mac 到 VPS 的传输实测只有约 0.33 MB/s（10 MB 要 34 秒）。所以快慢基本取决于两件事：ssh 建连，以及传多少字节。

### ssh 复用连接

每次 `ssh` 都要重新握手，约 2.3 秒。在 `~/.ssh/config` 里给这台主机打开 ControlMaster（配置见[附录](#附录)），第一次建连后在后台留一条主连接，之后的 ssh 直接复用：

| | 耗时 |
|---|---|
| 不复用 | 约 2.3 秒 |
| 复用，第一次 | 2.4 秒 |
| 复用，之后 | 约 0.4 秒 |

这对所有 `ssh` 都生效。Claude Code 通过 ssh 读写我 Mac 上的代码，也跟着快了。

### 图片转 WebP

用一张 Retina 截图（2080×1170）实测：

| 格式 | 大小 | 取一次剪贴板 |
|---|---|---|
| 剪贴板里的原图（PNG） | 390 KB | — |
| `sips` 缩到 2000px，存 PNG | 801 KB | 5.3 秒 |
| `cwebp -q 90 -sharp_yuv`，缩到 2000px | 136 KB | 1.3～2.5 秒 |

sips 重新编码出来的 PNG 比原图还大一倍。改成 WebP 后，截图里的中文小字和原图看不出区别。

规则：长边超过 2000px 先缩小；原图不超过 2000px、又比转出来的小，就直接用原图。Mac 上没有 cwebp 时改用 sips 转 JPEG，这个分支我没测过。

## 怎么用

| 要贴的东西 | 按键 | 结果 |
|---|---|---|
| 截图、复制的图片 | ⌃V | 出现 `[Image #N]`，可以连续贴多张 |
| Finder 里复制的一个图片文件 | ⌃V | 作为图片贴入 |
| Finder 里的其他文件（PDF 等，可以一次复制多个） | ⌃V | 贴入 `lzwcc:/Users/...` 路径，Claude 通过 ssh 去读 |
| 文字 | ⌘V | 和平时一样 |

其他文件用 ⌘V 也行，iTerm2 会贴入完整的 Mac 路径，只是没有 `lzwcc:` 前缀。图片文件和其他文件混在一起复制时会怎样，我没测过。

## 限制

- **只取 Mac 的剪贴板**。脚本里固定执行 `ssh lzwcc`，所以从别的电脑连上服务器按 ⌃V，取到的还是 Mac 的剪贴板；Mac 连不上时，3 秒后按没有图片处理。要支持 Windows，服务器得能 ssh 到那台电脑，再换一套 PowerShell 取剪贴板的命令。我主要在 Mac 上开发，所以没有做。
- **服务器要能 ssh 到 Mac**。我的 Mac 有一个服务器能访问的地址，所以可以这样做。
- **贴文件要在 tmux 里**。文件路径是通过 tmux 粘贴进去的，Claude Code 不在 tmux 里时只能贴图片。我平时都在 tmux 里用，所以没问题。
- 从 Windows 连上来时，Windows Terminal 默认把 Ctrl+V 当成自己的粘贴，按键可能到不了 Claude Code（没测过）。

## 踩过的坑

| 现象 | 原因 | 解决 |
|---|---|---|
| ⌃V 贴 PDF 没反应，只闪一下提示 | Claude Code 在 SSH 会话里不读剪贴板文字（见[方案](#方案一个假的-xclip)第 3 步） | 脚本用 tmux 把路径粘贴进去 |
| 一张截图要 5.3 秒 | sips 重新编码 PNG 后比原图大一倍，传输又只有 0.33 MB/s | 改用 cwebp 转 WebP，136 KB |
| 一次 ⌃V 访问了三次 Mac | 用解包目录的修改时间判断缓存新旧，tar 会把它恢复成 Mac 上的时间，而 Mac 的时钟比 VPS 慢 17 秒 | 在 VPS 上单独记录取用时间 |
| 每次多出 0.3～1.5 秒 | Mac 端的脚本通过 stdin 发给 `bash -s` | 改成作为 ssh 的命令参数发送 |
| 删掉图片再贴，序号还在往上涨 | Claude Code 在一个会话内不回收图片编号，免得前面提到的 `Image #2` 指错图 | 不用处理，删掉的图片不会发出去；新会话从 1 开始 |

## 附录

### ssh 配置

```
Host lzwcc
    HostName ...
    ControlMaster auto
    ControlPath ~/.ssh/cm-%r@%h:%p
    ControlPersist 30m
    ServerAliveInterval 30
```

`ControlPersist 30m` 表示最后一次使用后，主连接在后台再保留 30 分钟。网络断了而主连接还没发现时，ssh 会卡住，执行 `ssh -O exit lzwcc` 关掉主连接，下次会自动重建。

### 文件位置

| 路径 | 内容 |
|---|---|
| `~/.local/bin/xclip` | 脚本，Mac 端的脚本也嵌在里面 |
| `~/.cache/clip-bridge/` | 每次取到的剪贴板内容。每次按 ⌃V 时顺带删掉超过 7 天的；贴完不立刻删，因为 Claude 可能过一会儿才去读 |
| `~/.cache/clip-bridge/log` | 每次取剪贴板的类型、耗时、大小，只保留最近 1000 行 |

Mac 上的临时文件在脚本退出时就删掉了。

删掉 `~/.local/bin/xclip` 就恢复原样。
