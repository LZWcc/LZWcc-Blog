---
title: 把 Codex 宠物放进新标签页：格式、动画和内存实测
description: 给自己的新标签页扩展 Niwa 加了宠物：直接导入 Codex 生成的宠物文件夹。导入时裁掉不用的行、缩小存成 webp，动画只改 transform；用无头 Edge 实测了每个标签页多占多少内存。
publishDate: 2026-10-22 11:39:13
tags:
  - 浏览器扩展
  - 前端
  - 性能
draft: false
authorship:
  mode: generated
  models: [Claude Opus 5.5]
category: project
---

[Niwa](https://lab.lzwcc.xyz/project/niwa) 是我写的新标签页扩展（Edge / Chrome）。Codex 能生成宠物（hatch-pet），我想让同一只宠物也待在新标签页上：浮在页面上，拖到哪停在哪。顾虑是新标签页开得最频繁，要尽量轻，所以这篇主要记格式、怎么省内存，以及实测的内存数字。

## Codex 宠物的格式

一只宠物是 `~/.codex/pets/<名字>/` 下的一个文件夹：

- `pet.json`：`id`、`displayName`、`description`、`spritesheetPath`（v2 还有 `spriteVersionNumber: 2`）
- 一张透明的精灵图（webp 或 png），8 列，每格 192×208，每一行是一个动作

| 行 | 动作 | 帧数 | 每帧时长（ms） |
|---|---|---|---|
| 0 | idle（呼吸、眨眼） | 6 | 280, 110, 110, 140, 140, 320 |
| 1 / 2 | 往右 / 往左走 | 8 | 120…，最后一帧 220 |
| 3 | waving | 4 | 140…，最后一帧 280 |
| 4 | jumping | 5 | 140…，最后一帧 280 |
| 5 | failed | 8 | 140…，最后一帧 240 |
| 6 | waiting（等你回应） | 6 | 150…，最后一帧 260 |
| 7 | running（在干活，不是跑步） | 6 | 120…，最后一帧 220 |
| 8 | review | 6 | 150…，最后一帧 280 |
| 9–10 | 16 个方向的「看向」（仅 v2） | 8 + 8 | 静止的姿势 |

v1 是 9 行（1536×1872），v2 是 11 行（1536×2288）。看向从正上方 0° 开始，顺时针每 22.5° 一格，指针离得太近时回到 idle。我手上的两只（雪瞳、Hatchbit）都是 v1，各 1.9～2.3 MB。

## 方案

**导入时就把图处理好。** 原图解码后约 11.5 MB（v2 约 14 MB），每个新标签页各解码一份。所以在设置里选文件夹导入时：

1. 只留用到的行：idle、往右、往左、waving、waiting、running，v2 再加看向的两行。
2. 缩成显示尺寸（72×78）的两倍，在 Retina 屏上刚好清晰。
3. 用 `OffscreenCanvas.convertToBlob({ type: 'image/webp' })` 存成 webp，放进 IndexedDB。localStorage 放快捷方式图标已经用掉不少，放不下。

实测雪瞳从 1,852,066 B 变成 259,254 B，Hatchbit 从 2,253,194 B 变成 312,596 B，都是 1152×936，解码后约 4.3 MB。是 v1 还是 v2 按图的高度判断，不看 `pet.json` 里写的版本。

**动画只改 `transform`。** 一个 72×78、`overflow: hidden` 的框里放整张图：行用 `top` 选，帧用 Web Animations 平移。每帧一个关键帧，加 `easing: 'step-end'` 直接跳到下一格，时长照抄上面的表：

```ts
const duration = frames.reduce((sum, ms) => sum + ms, 0);
let at = 0;
const keyframes = frames.map((ms, i) => {
  const k = { offset: at / duration, transform: `translateX(${-i * 72}px)`, easing: 'step-end' };
  at += ms;
  return k;
});
keyframes.push({ ...keyframes.at(-1), offset: 1 });
img.animate(keyframes, { duration, iterations: Infinity });
```

`transform` 动画由合成器播放，不占主线程；看不见的标签页浏览器自己会暂停。开了「减少动态效果」时不播放，停在第一帧。

**什么时候播哪个动作**，按优先级：

| 优先级 | 情况 | 动作 |
|---|---|---|
| 1 | 正在拖动 | 往哪边拖就播往哪边走 |
| 2 | 点了一下 | waving，播一轮 |
| 3 | 网格里有倒计时到点、还没重置 | waiting |
| 4 | 有计时器在走 | running |
| 5 | 指针离它 40～420px（仅 v2） | 看向指针的方向 |
| 6 | 其他 | idle |

位置存的是宠物中心在窗口里的比例，CSS 用 `clamp(0px, calc(var(--x) * 100% - 36px), calc(100% - 72px))` 保证贴边时不出界，窗口大小变了还在相对的位置。松手时才写存储。

## 内存实测

**方法**：在 Mac 上用无头 Edge（`--headless=new`，不弹窗口），通过 DevTools 协议打开 N 个新标签页，每个放在单独的窗口里。先全部显示，再全部最小化转入后台。用 Chromium 的 memory-infra 分项统计，和没导入宠物时对比。

| 新标签页数 | 转入后台后多出 | 平均每个 |
|---|---|---|
| 1 | 3.6 MB | 3.6 MB |
| 6 | 22～24 MB | 约 3.8 MB |
| 12 | 35.6 MB | 约 3 MB |

- **显示时**：GPU 进程里还有一份（`gpu/transfer_cache`、`skia`）。转入后台后，这份被 Edge 自动释放（7.4 MB → 0.1 MB）。
- **转入后台后留下的**：在渲染进程里，是 `discardable`（解码图片的缓存，系统内存紧张时可以回收）和 `skia`。
- **后台时手动拿掉图片没用**：在 `visibilitychange` 里把 `<img>` 去掉、`revokeObjectURL`，再用 `HeapProfiler.collectGarbage` 强制垃圾回收、等 20 秒，这两项都没变。它们是渲染进程级别的缓存，不归页面上那个元素管。所以这个改动没有留下。
- **对比**：同样 6 个新标签页、没有宠物时，渲染进程本身约 470 MB。宠物在这之上每个标签页多 3～4 MB。这是无头模式下的数字，和平时开着的 Edge 会有些差别。

还想再省的话，只能把存下来的图再缩小一半，内存降到四分之一，代价是在 Retina 屏上会糊。

**为什么没让宠物浮到其他网页上。** 技术上可行：用 `scripting.executeScript` 把宠物放进当前在看的那个网页，Shadow DOM 隔离样式，canvas 绘制（避开网页 CSP 对 `blob:` 图片的限制）。但要申请「所有网站」的访问权限，网页也看不到扩展的 IndexedDB 和 localStorage，图片和状态都得迁到 `chrome.storage`。这和 Niwa「只管新标签页、用到时才要权限」的定位不符，没做。

## 踩过的坑

| 现象 | 原因 | 解决 |
|---|---|---|
| idle 时眨眼太频繁 | idle 一轮只有 1.1 秒，里面有一次眨眼，`iterations: Infinity` 连着播就是一秒眨一次 | idle 只播一轮（`iterations: 1`），`onfinish` 里随机歇 3～6 秒再 `play()`；其他动作照常循环 |
| 图片大小不对时，提示写成「0×0」 | 先 `ImageBitmap.close()` 再读 `width` / `height`，关掉后宽高变成 0 | 先把宽高存下来，再 `close()` |
| 加了一个 IndexedDB 仓库后，老测试打不开库 | 库升到版本 2，测试还用 `indexedDB.open('niwa', 1)` 打开，报 VersionError | 测试里不写版本号；应用升级时只补上还没有的仓库，老用户库里的日历文件不动 |
| 无头页面测试偶尔跑不完、没有输出 | 无头模式用虚拟时间，页面空闲时直接快进；读 IndexedDB、生成图片是真实的异步操作，虚拟时间不等它们 | 等待期间一直请求一个 20ms 才返回的地址（`/__tick`），请求挂起时虚拟时间暂停 |
| 测内存时，连续两次采样差 50 MB | 看的是整个 Edge 的 phys_footprint，噪声比要测的差别（约 26 MB）还大 | 改用 memory-infra，只看和图片有关的几项 |
| 无头模式里新开的窗口有的是 hidden | 窗口互相重叠，被算作遮挡，转入后台 | 加 `--disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion` |
| 后台多出来的内存，怀疑来自导入过程 | 导入在同一个渲染进程里解码过原图 | 导入后关掉浏览器，用同一个配置目录重启再测：数字不变，排除了这个可能 |
| `<input webkitdirectory>` 在 TSX 里报类型错误 | React 的类型定义里没有这个属性 | 在 ref 回调里设：`el.webkitdirectory = true` |

## 附录：memory-infra 怎么取

通过 DevTools 协议（Node 24 自带 `WebSocket`）：

```js
await send('Tracing.start', {
  traceConfig: { includedCategories: ['disabled-by-default-memory-infra'], memoryDumpConfig: { triggers: [] } },
  transferMode: 'ReportEvents',
});
await send('Tracing.requestMemoryDump', { levelOfDetail: 'detailed' });
await send('Tracing.end');
// 收集 Tracing.dataCollected 里 ph === 'v' 的事件：
// args.dumps.allocators['cc/image_memory' | 'discardable' | 'skia' | 'gpu/transfer_cache'].attrs.size.value（十六进制字节数）
// 事件里的 pid 是系统进程号，用 ps 的 --type= 区分 renderer / gpu-process
```

转入后台用 `Browser.getWindowForTarget` + `Browser.setWindowBounds({ windowState: 'minimized' })`，再用 `document.visibilityState` 确认确实是 hidden。
