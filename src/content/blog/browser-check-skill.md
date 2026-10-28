---
title: 让 Claude Code 自己看网页：截图对比、加载和卡顿测量
description: Claude Code 跑在远程机器上，没有浏览器。用 Node 自带的 WebSocket 走 Chrome 调试协议遥控 Mac 上的 Edge，整理成一个 skill：截图并逐像素对比、测首次加载、找长任务、统计动画掉帧。记录用法和靠它查出的问题。
publishDate: 2026-10-27 17:37:09
tags:
  - Claude Code
  - 前端
  - 性能
draft: false
comment: false
authorship:
  mode: generated
  models: [Claude Opus 5.5]
category: project
---

我的 Claude Code 跑在一台远程 Linux 机器上，代码和浏览器都在我的 Mac 上。改前端时它看不到页面：外观对不对、深色模式有没有问题、动画卡不卡，都要我打开浏览器看完再告诉它。一来一回很慢，而且"有点卡"这种描述，它没法定位。

重做个人作品站 [lab.lzwcc.xyz](https://lab.lzwcc.xyz) 时，我让它写了一组脚本遥控 Mac 上的 Edge，改完先自己截图、量数据，再交给我看。后来整理成一个 Claude Code skill（`browser-check`），别的项目也能用。

## 做法

- Chrome 和 Edge 都支持 Chrome 调试协议（CDP）。启动时加 `--remote-debugging-port`，就能通过 WebSocket 发命令：打开页面、设置视口、模拟深色模式和减弱动效、截图、执行 JS、抓性能 trace。
- 脚本只用 Node 22 自带的 `fetch` 和 `WebSocket`，不装 Puppeteer、Playwright，复制过去就能跑。
- 做成 skill：脚本放在 `~/.claude/skills/browser-check/scripts/`，`SKILL.md` 写什么时候用、每个工具怎么用、判断时注意什么。在任何项目里说"截个图看看""测一下卡不卡"，Claude Code 都会把脚本同步到 Mac 的 `/tmp/cdp-kit` 再运行。

最小的例子：连上已经启动的浏览器，用手机尺寸、深色模式打开页面，截一张图。

```js
import { writeFileSync } from "node:fs"
const list = await (await fetch("http://localhost:9333/json/list")).json()
const page = list.find((t) => t.type === "page")
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener("open", r, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data)
  pending.get(m.id)?.(m)
})
const send = (method, params = {}) =>
  new Promise((r) => {
    pending.set(++id, r)
    ws.send(JSON.stringify({ id, method, params }))
  })
// 手机尺寸、深色模式
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true })
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] })
await send("Page.navigate", { url: "https://lab.lzwcc.xyz/" })
await new Promise((r) => setTimeout(r, 3000)) // 按真实时间等，动画照常推进
const shot = await send("Page.captureScreenshot", { format: "png" })
writeFileSync("home-dark.png", Buffer.from(shot.result.data, "base64"))
ws.close()
```

浏览器先用 `--remote-debugging-port=9333` 启动，再 `node` 运行这个文件，得到一张 1170×2532 的截图。

## 工具

命令见[附录](#附录常用命令)。

| 想知道什么 | 工具 | 输出 |
|---|---|---|
| 页面长什么样 | `shot.mjs` | 按 JSON 配置批量截图：宽高、深浅色、减弱动效、截图前执行脚本；顺带打印控制台报错和 hydration 警告 |
| 改动前后外观变没变 | `rundiff.mjs`、`diff.html`、`crop.html` | 两组截图逐像素比较，给出不同的像素数和范围；同一块区域并排放大 |
| 页面里的某个数值 | `evalpage.mjs` | 打开页面执行一段 JS，返回结果 |
| 首次加载每一步在什么时候 | `phases.mjs` | HTML、DOMContentLoaded、hydration 和自定义节点的时间点，每个资源的下载时段；可以禁用缓存、模拟 4G |
| 长任务从哪来 | `trace.mjs` | 主线程超过 30ms 的任务和里面最耗时的部分；大任务里样式重算涉及多少元素、是什么触发的 |
| 动画顺不顺 | `frames.mjs` | 合成帧里完整呈现、部分呈现、丢帧各多少，有哪些停顿；哪些动画没进合成线程 |
| 文章配图 | `secshot.mjs` | 按标题文字找到页面里的区块，单独截下来 |
| 启动和清理 | `browser.sh` | 无头和有窗口的 Edge、给对比页用的 http 服务；`stop` 时删掉临时的浏览器配置 |

## 这次查出来的问题

每一条都是先有我的体感或疑问，再用工具找原因。

**开场卡一下**。`trace.mjs` 在 4 倍降速下，头像开始聚合时抓到一个约 440ms 的任务：整页 1004 个元素重算样式、全部重新布局，触发原因写的是 "Fonts changed"。网站并没有用网页字体。再看运行时插进页面的样式表，原来是顶栏的深浅色按钮包在 `<ClientOnly>` 里，图标在浏览器端才渲染，那一刻插入了一张图标样式表。按钮改成服务端渲染后，这个任务没了。

**波纹扩散时一顿一顿**。无头浏览器里几乎不丢帧，我却觉得卡。换成有窗口的 Edge，用 `frames.mjs` 测才看到丢帧。对照实验：去掉波纹圈，丢帧数不变；去掉卡片淡入里的 `filter: blur()`，11 个卡片动画全部进了合成线程。带着我平时装的扩展测，丢帧从每次 9–18 帧降到 3–10 帧。

**线上第一次打开慢**。`phases.mjs` 测到线上要 1.88–2.16 秒才完成 hydration，本地只要 0.25 秒。列出资源的下载时段后找到三个原因：首页卡片的样式文件要等脚本运行后才开始下载；12 张卡片图片一开始就下载，和脚本抢带宽；图标在运行时请求外部的 api.iconify.design。三处都改完，hydration 提前到 0.84–1.13 秒。

**手机上看不出开场动画**。模拟手机打开，记录每张卡片的亮起延迟：第一屏 5 张在 67–154ms 之间，几乎同时出现。把手机上的波纹放慢后，拉开到 208–478ms。

**"外观没变"要有证据**。每次改写法之后，跳过开场动画截图，逐像素比较改前改后：除了像素头像顶上那几十个每次都随机的像素，没有别的差异。有差异时就放大并排看，比如抗锯齿的变化，肉眼看不出。

**简介里的标签和正文没对齐**。`evalpage.mjs` 量出标签文字和两边正文的竖直中心差了 2.9px；标签改成 `inline-block` 后，差值是 0.0px。

## 判断时注意

- 动画卡不卡，要用有窗口的浏览器测，无头浏览器的合成和真实窗口不一样。`requestAnimationFrame` 只能看到主线程，看不到合成帧。刚启动的头两次 GPU 在预热，结果不算数。
- 只改 `opacity`、`transform` 的动画能交给合成线程；带 `filter` 的不行，页面一忙就跟不上。
- 数字只在同一台浏览器、同样的参数下前后对照着看。开 4 倍降速是为了把问题放大，绝对值不代表真机。
- 扩展会干扰结果：带着我装的一个翻译扩展测，开场时 GPU 进程上会出现 150–180ms 的大任务，停用它之后就没有了。所以先在不带扩展的浏览器里测网页本身。
- 顺不顺、快不快，以我自己的体感为准；测量是用来找原因的。

## 踩过的坑

| 现象 | 原因 | 解决 |
|---|---|---|
| 截到的动画停在第一帧 | 标签页不在前台，`requestAnimationFrame` 不跑 | 先 `Page.bringToFront`，再开 `Emulation.setFocusEmulationEnabled` |
| 截不到动画的中间帧 | 用 `--virtual-time-budget` 时，虚拟时间下定时器照走，`requestAnimationFrame` 和 CSS 过渡几乎不动 | 用 CDP 按真实时间等待再截 |
| 整页截图里首屏被拉得很长 | 首屏用了 `min-height: 100vh`，视口拉成了整页高度 | 不截整页，按区块逐个截 |
| 截图右边缘有个小圆点 | 开发时 Nuxt DevTools 注入的悬浮按钮 | 截图前隐藏 |
| 截图前冻结动画，元素反而不见了 | 播完停在最后一帧的动画也在 `getAnimations()` 里，被拨回了第 0 帧 | 只暂停 `playState === 'running'` 的 |
| 按名字找不到 CSS 动画 | Vue 的 scoped 样式会给 `@keyframes` 名字加后缀 | 用 `startsWith` 匹配 |
| 通过 ssh 启动浏览器后，ssh 一直不返回 | 后台进程继承了 ssh 的输入输出；`(cd 目录 && nohup 命令 &)` 放到后台的是整个子 shell | 后台命令加 `</dev/null >日志 2>&1`；先 `cd`，再单独放到后台 |
| shell 脚本报 `port: unbound variable`，变量名后面带乱码 | Mac 非交互 ssh 的 locale 下，紧跟在变量后的中文标点被当成变量名的一部分 | 写成 `${port}` |
| `/tmp` 里积了三 GB 多的浏览器配置 | 每次换一个 `--user-data-dir` 又不删 | 统一放在 `/tmp/bc-*`，`browser.sh stop` 时删掉 |

## 附录：常用命令

在 Claude Code 所在的机器上，把脚本同步到 Mac：

```bash
ssh lzwcc 'mkdir -p /tmp/cdp-kit' && scp -q ~/.claude/skills/browser-check/scripts/* lzwcc:/tmp/cdp-kit/
```

在 Mac 的 `/tmp/cdp-kit` 下（Node 22）：

```bash
./browser.sh headless && ./browser.sh http                  # 无头 Edge（9333）和对比页用的 http 服务（8765）
node shot.mjs shots.json                                    # 批量截图，配置字段见文件开头
node rundiff.mjs shots/before shots/after home-light,home-dark
W=390 DARK=1 REDUCED=1 node evalpage.mjs https://lab.lzwcc.xyz/ check.js
COLD=1 NET=4g MARKS="ring=.ripple-ring" node phases.mjs https://lab.lzwcc.xyz/ 3
CPU=4 node trace.mjs http://localhost:3000/
./browser.sh headed                                         # 有窗口的 Edge（9335），会弹出窗口
PORT=9335 NOEMU=1 START=.ripple-ring node frames.mjs http://localhost:3000/ 4
DARK=1 node secshot.mjs https://example.com/ shots top arch=五层结构
./browser.sh stop                                           # 关掉浏览器和 http 服务，删掉临时配置
```

通用的环境变量：`W`、`H`（宽高，W 小于 700 时按手机模拟）、`DARK=1`、`REDUCED=1`（减弱动效，跳过开场动画）、`CPU=4`（降速）、`COLD=1`（禁用缓存）、`NET=4g`、`UA=ios|android`、`PORT`。
