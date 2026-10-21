---
title: 截尾帧却拿到首帧：媒体代理为什么必须支持 Range
description: 给画布的视频节点做"截取当前帧/首帧/尾帧"，上线后发现截出来的永远是开头。根因是中间那层媒体代理丢了 Range 请求头、整段读进内存再返回 200，浏览器没法 seek。
publishDate: 2026-10-21 09:12:47
tags:
  - 前端
  - HTTP
  - Go
  - Next.js
  - 复盘
language: zh
draft: true
---

这篇记录我做的一个小功能：给画布上的视频节点加“截取当前帧/首帧/尾帧”，以及它上线后暴露出来的一个"看起来像前端 bug、其实是 HTTP 代理 bug"的问题。

开发是我在 Claude Code 里协作完成的：我负责提需求、实机验证和取舍，Claude Code 负责读源码、写代码和测试。文中的"我们"指这个组合。

## 一、需求：从视频里截一帧，变成图片节点

画布上的视频节点是 AI 生成的视频。用户经常需要"拿这段视频的最后一帧当下一段视频的首帧"，以前只能下载视频、本地截图、再上传，非常麻烦。

需求很直接：

1. 视频播放器菜单里提供 **截取当前帧 / 首帧 / 尾帧**。
2. 截出的帧上传为图片节点，放在视频节点右侧，并自动从视频节点连一条线过去。
3. 截帧不能打断用户正在看的播放器。

## 二、实现：离屏 video + canvas

浏览器里截视频帧的标准做法是 `<video>` + `<canvas>.drawImage()`。为了不影响用户正在看的播放器，我们新建一个**离屏的 video 元素**专门用来截帧：

```ts
type FrameKind = 'current' | 'first' | 'last'

function waitFor(video: HTMLVideoElement, event: 'loadeddata' | 'seeked') {
  return new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve() }
    const fail = () => { cleanup(); reject(new Error('视频加载失败')) }
    const cleanup = () => {
      video.removeEventListener(event, done)
      video.removeEventListener('error', fail)
    }
    video.addEventListener(event, done)
    video.addEventListener('error', fail)
  })
}

export async function captureFrame(src: string, kind: FrameKind, currentTime: number): Promise<Blob> {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous' // 否则 canvas 被污染，toBlob 会抛 SecurityError
  video.muted = true
  video.preload = 'auto'
  try {
    const loaded = waitFor(video, 'loadeddata')
    video.src = src
    await loaded

    // 直接 seek 到 duration 经常拿到黑帧，尾帧往前退一点点
    const target =
      kind === 'first' ? 0 : kind === 'last' ? Math.max(0, video.duration - 0.05) : currentTime
    if (target !== video.currentTime) {
      const seeked = waitFor(video, 'seeked')
      video.currentTime = target
      await seeked
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('截帧失败'))), 'image/png')
    )
  } finally {
    video.removeAttribute('src')
    video.load() // 释放连接和解码器
  }
}
```

几个细节：

- **`crossOrigin = 'anonymous'`**：视频在对象存储上，跨域。不设这个，`drawImage` 之后 canvas 会被标记为 tainted，`toBlob` 直接抛错。所以视频走的是我们自己的同源媒体代理 `/api/proxy-image?media=1`。
- **尾帧往前退 0.05 秒**：seek 到精确的 `duration` 很多时候会拿到黑帧或者根本不触发 `seeked`。
- **用完要 `removeAttribute('src')` + `load()`**：否则离屏 video 会一直占着网络连接。

本地测试一切正常，三种截帧都对。上线。

## 三、上线后：尾帧和当前帧都是开头

用户很快反馈："截尾帧，截出来是第一帧。"

奇怪的是：

- 首帧当然是对的（本来就是 0 秒）。
- 当前帧、尾帧**都是开头附近的画面**。
- `seeked` 事件确实触发了，代码没报错。
- 本地用的是本地文件，没问题；线上视频在对象存储，经过代理，有问题。

这已经很像"浏览器没法 seek"了。打开 DevTools 看那个视频请求：

```
GET /api/proxy-image?url=...&media=1
Range: bytes=0-

HTTP/1.1 200 OK
Content-Type: video/mp4
(没有 Accept-Ranges，没有 Content-Range)
```

问题就在这里。

## 四、根因：代理链路把 Range 弄丢了

浏览器播放/seek 视频依赖 HTTP Range 请求：

- 浏览器先发 `Range: bytes=0-`，期待服务端返回 **206 Partial Content** 和 `Accept-Ranges: bytes`。
- 拿到这些之后，seek 到 80% 的位置时，浏览器才会再发 `Range: bytes=<某个偏移>-` 去取那一段。
- 如果服务端返回的是 **200 且没有 `Accept-Ranges`**，浏览器就认定"这个资源不能随机访问"。此时设置 `currentTime` 不会报错，`seeked` 也照样触发，但实际只能停在已经缓冲到的位置附近——也就是开头。

我们的请求链路有两层代理，两层都有问题：

```
浏览器 → Next.js 路由 /api/proxy-image → Go 后端 ProxyImage → 对象存储
```

1. **Next.js 路由只转发了白名单里的请求头**：`accept`、`accept-language`、`user-agent`，没有 `range`。浏览器的 Range 在第一跳就丢了。
2. **Go 后端把整个响应读进内存再写回**：媒体上限 200MB，`io.ReadAll` 之后统一返回 200。就算上游对象存储支持 Range，这里也被"拍平"成了一次完整下载。

第二点还有个副作用：每截一次帧，后端都要把整段视频（可能几十上百 MB）读进内存。截帧本身也是一次 OOM 风险。

## 五、修复：转发 Range，流式透传

### 1. Next.js 路由：把 range 加进转发白名单

```ts
// range 让浏览器能对代理后的媒体做 seek（截帧需要）
for (const name of ['accept', 'accept-language', 'user-agent', 'range']) {
  const value = request.headers.get(name)
  if (value) headers.set(name, value)
}
```

### 2. Go 后端：只转发单段 Range，透传 206，边下边写

下面是按同样思路写的最小示例：

```go
// 只保留单段 Range（bytes=a-b），多段 Range 直接丢弃，按完整资源返回
func singleRange(h string) string {
	h = strings.TrimSpace(h)
	if !strings.HasPrefix(h, "bytes=") || strings.Contains(h, ",") {
		return ""
	}
	return h
}

// "bytes 0-1023/52428800" -> 52428800
func totalFromContentRange(h string) int64 {
	i := strings.LastIndex(h, "/")
	if i < 0 {
		return -1
	}
	n, err := strconv.ParseInt(strings.TrimSpace(h[i+1:]), 10, 64)
	if err != nil {
		return -1
	}
	return n
}

func proxyMedia(w http.ResponseWriter, r *http.Request, upstreamURL string, maxBytes int64) {
	req, _ := http.NewRequestWithContext(r.Context(), r.Method, upstreamURL, nil)
	if rg := singleRange(r.Header.Get("Range")); rg != "" {
		req.Header.Set("Range", rg)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, "upstream error", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	partial := resp.StatusCode == http.StatusPartialContent
	total := resp.ContentLength
	if partial {
		total = totalFromContentRange(resp.Header.Get("Content-Range"))
	}
	// 大小上限要按"完整资源大小"判断，而不是这一段的大小
	if total > maxBytes {
		http.Error(w, "media too large", http.StatusRequestEntityTooLarge)
		return
	}

	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	if partial || strings.EqualFold(resp.Header.Get("Accept-Ranges"), "bytes") {
		w.Header().Set("Accept-Ranges", "bytes")
	}
	if resp.ContentLength >= 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(resp.ContentLength, 10))
	}
	status := http.StatusOK
	if partial {
		w.Header().Set("Content-Range", resp.Header.Get("Content-Range"))
		status = http.StatusPartialContent
	}
	w.WriteHeader(status)
	if r.Method != http.MethodHead {
		_, _ = io.Copy(w, io.LimitReader(resp.Body, maxBytes)) // 流式转发，不再整段进内存
	}
}
```

要点：

- **只转发单段 Range**。多段 Range（`bytes=0-10,20-30`）会返回 `multipart/byteranges`，处理复杂而且浏览器播放视频用不到，直接按完整资源处理。
- **透传 206、`Content-Range`、`Accept-Ranges`**。这三个缺一个，浏览器都可能退化成不可 seek。
- **大小上限按 `Content-Range` 里的总长度判断**。206 响应的 `Content-Length` 只是这一段的长度，拿它和上限比较会让超大文件"分段混过去"。
- **`io.Copy` 流式转发**，代理本身的内存占用从"整个视频"降到一个缓冲区。

### 3. 前端兜底：seek 没到位就明确报错

修复代理之后，我们又在截帧函数里加了一道检查。以后如果哪条链路又不支持 Range，用户会看到"截帧失败"，而不是悄悄拿到一张错误的图：

```ts
if (kind === 'last' && !(Number.isFinite(video.duration) && video.duration > 0)) {
  throw new Error('无法读取视频时长')
}
// 不支持 Range 时浏览器 seek 不了，会静默停在开头附近：宁可失败也不返回错的帧
if (Math.abs(video.currentTime - target) > 0.5) {
  throw new Error('无法定位到目标画面')
}
```

这一条我觉得是这次最值得记住的：**"静默返回错误结果"比"明确失败"糟糕得多**。

## 六、验证

- 单元测试：Next 路由转发 `range` 并透传 206；Go 代理在上游返回 206 时透传状态码和 `Content-Range`，完整请求带 `Accept-Ranges`；对超大文件即使只请求 `bytes=0-9` 也返回 413；多段 Range 被过滤。
- 线上：用一个公开的示例 MP4 走代理，确认返回 `206 Partial Content`，再在画布上分别截当前帧、首帧、尾帧，对比画面。

## 七、收获

1. **视频能播放 ≠ 能 seek**。只要有代理层，就要检查 Range 有没有一路透传到底。排查时直接看响应是 200 还是 206、有没有 `Accept-Ranges`。
2. **代理媒体不要 `ReadAll`**。整段读进内存既破坏 Range，又是内存炸弹，应该流式转发。
3. **上限检查要看完整资源大小**，206 的 `Content-Length` 只是分段长度。
4. **能检测的错误就别静默吞掉**。seek 后核对 `currentTime`，是一行代码换来的确定性。
5. 本地测试用本地文件，天然支持 Range，所以这个问题本地完全复现不了。**和线上链路不一致的测试环境，会系统性地漏掉这类问题**。
