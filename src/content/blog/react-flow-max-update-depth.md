---
title: 'React Flow 拖动节点时页面崩溃：两条死循环与一个没根治的 bug'
description: 画布点击、拖动节点时报 Maximum update depth exceeded。记录两条已定位的触发路径（丢失 measured、拖动中父组件回写慢一拍的 selected）和修法，以及仍未根治时如何用"近 3 秒更新来源统计"定位线上压缩堆栈。
publishDate: 2026-10-21 10:47:52
tags:
  - React
  - React Flow
  - 前端
  - 调试
  - 复盘
language: zh
draft: true
---

这篇记录一次处理 React #185（Maximum update depth exceeded）的过程，技术栈是 React 19 + `@xyflow/react` 12。先说结论：**我们定位并修掉了两条触发路径，但之后线上仍偶发，没有根治**；最后做的是给崩溃报告加诊断，让下一次崩溃能直接告诉我们是哪条路径在循环。

一个没有完美结局的 bug，我觉得也值得记下来。

开发和排查是我在 Claude Code 里协作完成的，文中的"我们"指我和 Claude Code。

## 一、现象

用户在画布上点击或拖动节点时，页面直接进入错误边界：

```
画布渲染出现异常
Minified React error #185
```

React #185 就是 **Maximum update depth exceeded**：组件在一次更新里又触发了更新，嵌套层数超过上限，React 主动中止。

线上的堆栈是压缩过的，只能看出循环发生在 React Flow 内部的 `StoreUpdater` 附近。

## 二、先理解 React Flow 的受控模式

画布用的是 React Flow 的**受控模式**：节点数据存在父组件里，通过 `nodes` prop 传给 `<ReactFlow>`；用户拖动、选中时 React Flow 回调 `onNodesChange`，父组件用 `applyNodeChanges` 算出新节点再传回去。

关键在 React Flow 内部有一个 `StoreUpdater`：

```ts
// 示意：React Flow 内部
useEffect(() => {
  store.setNodes(nodes) // nodes prop 引用一变，就写进内部 store
}, [nodes])
```

只要 `nodes` 数组的**引用**变了，它就会把节点重新写进内部 store，内部 store 的变化又会触发订阅它的组件重新渲染。如果父组件每次渲染都给它一个新数组，并且这个过程中又触发了 `onNodesChange` → 父组件 setState → 再渲染……循环就形成了。

另外，React Flow 12 判断一个节点"是否已经初始化"，靠的是节点对象上的 **`measured`** 字段（内部测量出来的宽高）。

## 三、触发路径一：每次渲染都传新节点，丢掉了 `measured`

### 背景

之前有一次重构，为了支持原生的多选拖动，改成了"每次渲染都从运行时状态重新计算节点数组，直接传给 React Flow"：

```tsx
// 修复前（示意）
const computedFlowNodes = useMemo(() => toFlowNodes(runtimeNodes), [runtimeNodes])
return <ReactFlow nodes={computedFlowNodes} onNodesChange={publishToParentImmediately} />
```

问题是：重新计算出来的节点对象**没有 `measured`**。React Flow 认为这些节点没初始化（React Flow 自己会报 #015 警告），于是重新测量、重新派发尺寸和位置变化；这些变化又被**逐帧**推回父组件，父组件重新计算出新的节点数组，再传回来。点击时鼠标的轻微移动就足以触发这个来回，最终 #185。

### 修法

1. **在适配层保留一份 React Flow 自己的节点状态**（由 `applyNodeChanges` 产生，带着 `measured`），父组件传来的新快照**合并**进去，而不是整体替换；内容没变时返回原引用，不触发更新。
2. **拖动过程中以 React Flow 的实时几何为准**，父组件慢一拍的快照不能把节点"拉回去"。
3. **拖动结束时才把最终位置提交给父组件**一次，而不是每次指针移动都回推。

```tsx
const [flowNodes, setFlowNodes] = useState(computedFlowNodes)
const flowNodesRef = useRef(flowNodes)

useEffect(() => {
  // 拖动中：位置、拖动状态以 RF 实时值为准
  const live = new Map(flowNodesRef.current.map((n) => [n.id, n]))
  const incoming = dragging.current
    ? computedFlowNodes.map((n) => {
        const l = live.get(n.id)
        return l ? { ...n, position: l.position, dragging: l.dragging } : n
      })
    : computedFlowNodes
  // 合并而非替换：保留 measured；没有实际变化时返回原数组引用
  const merged = mergeStable(flowNodesRef.current, incoming)
  if (merged === flowNodesRef.current) return
  flowNodesRef.current = merged
  setFlowNodes(merged)
}, [computedFlowNodes])

const onNodesChange = (changes: NodeChange[]) => {
  const next = applyNodeChanges(changes, flowNodesRef.current)
  flowNodesRef.current = next
  setFlowNodes(next)
  // 拖动中不逐帧回推，拖动结束统一提交
  if (!dragging.current && changes.some((c) => c.type === 'position' || c.type === 'dimensions')) {
    publishToParent(next)
  }
}
```

顺带还发现框选后拖动的 `onSelectionDragStart/Stop` 没有接上，导致框选拖动的结果没有提交，一起修了。

## 四、触发路径二：拖动中父组件回写慢一拍的 `selected`

### 现象

上面的修复上线后，同一天晚上又复现了：**点击节点**时偶尔还是 #185。

### 根因

点击时鼠标只要轻微移动，就会进入一次"拖动会话"。我们在拖动期间已经让 `position`、`dragging` 以 React Flow 的实时值为准，**却漏了 `selected`**：

- React Flow 内部：点击后节点变成 `selected: true`。
- 父组件：选中状态要等下一次渲染才同步过来，此时手里还是 `selected: false`。
- 合并 effect 用父组件的 `false` 覆盖了 React Flow 的 `true`。
- React Flow 又派发一次选中变化，父组件更新成 `true`，但这时 React Flow 那边可能已经又被覆盖……

两边来回翻转选中状态，直到 React 中止。

### 修法

一行：拖动期间 `selected` 也以 React Flow 的实时值为准。

```ts
return l ? { ...n, position: l.position, dragging: l.dragging, selected: l.selected } : n
```

另外发现一个容易忽略的点：父组件给 `<ReactFlow>` 传的 `isValidConnection` 是**内联函数**，每次渲染都是新引用。React Flow 会把这个 prop 存进内部 store，引用一变就改写一次 store。改成一个稳定的包装函数：

```ts
const isValidConnectionStable = useCallback(
  (c: Connection | Edge) => latest.current.isValidConnection?.(c) ?? true,
  []
)
```

这一处修复是在一份复制到本地的真实画布数据上复现并验证的。

## 五、仍然没有根治

两天后，又陆续收到两次 #185 报告，而且新旧两个版本都出现过：

- 一个节点和连线都比较多的画布，崩溃前最后一个动作是视口更新（缩放/平移）。
- 另一个画布，崩溃前在跑视频生成任务，任务轮询会持续回写节点。

我们排除了数据本身的问题（没有重复 ID、悬空连线、异常尺寸），也排除了"视口裁剪导致节点进进出出"的猜想（传给 React Flow 的节点没有按视口裁剪）。在本地用真实数据（经用户同意复制，用完删除）跑了 6 轮缩放、平移、点击，**都没有复现**。推测需要任务轮询的回写，或者真实的输入节奏才能触发。

## 六、给崩溃报告加面包屑

既然线上能稳定拿到崩溃报告（错误边界里会通过 `sendBeacon` 上报，前端容器日志能查到），而本地复现不了，那就**让崩溃报告自己说出是哪条路径在循环**。

做法是在每一个"给 React Flow 交新数据"的地方打点，记录最近 3 秒内各来源的次数：

```ts
const WINDOW_MS = 3000
const updates: { at: number; source: string }[] = []

// 在每条可能给 React Flow 新 nodes 的路径上调用
export function recordFlowUpdate(source: string, now = Date.now()) {
  updates.push({ at: now, source })
  while (updates.length && (now - updates[0].at > WINDOW_MS || updates.length > 2000)) {
    updates.shift()
  }
}

// 崩溃时写进报告
export function recentFlowUpdates(now = Date.now()) {
  const counts: Record<string, number> = {}
  for (const u of updates) {
    if (now - u.at <= WINDOW_MS) counts[u.source] = (counts[u.source] || 0) + 1
  }
  return counts
}
```

打点的来源包括：

- `surface-render`：画布适配层渲染
- `flow-merge`：父组件快照合并进 React Flow 节点
- `flow-change:<类型>`：React Flow 派发的变化（`position`、`select`、`dimensions`……）
- `viewport-sync` / `viewport-move`：视口同步与移动

崩溃报告和"复制诊断信息"里会多出一行，例如：

```
近 3 秒节点更新：surface-render×412，flow-merge×409，flow-change:select×406
```

一眼就能看出是谁在和谁打架。成本是一个固定大小的数组，对正常运行几乎没有影响。

## 七、收获

1. **受控组件库的循环，十有八九是"两边都觉得自己是真相"**。拖动这类连续手势中，要明确**谁是权威**：手势期间以组件库的实时状态为准，手势结束再一次性提交。
2. **传给第三方组件的 prop 引用要稳定**，尤其是会被存进内部 store 的回调。内联函数看似无害，可能就是循环的一环。
3. **注意组件库挂在对象上的内部字段**（这里是 `measured`）。整体替换对象会悄悄丢掉它们，用合并代替替换。
4. **本地复现不了的线上问题，就投资诊断能力**。崩溃前几秒的"谁在更新、更新了多少次"，比一个压缩过的堆栈有用得多。
5. 坦白说，到写这篇文章时，这个问题也没有彻底解决。把已知的部分修好、把未知的部分变得可观测，是在有限时间里能做的最好的事。
