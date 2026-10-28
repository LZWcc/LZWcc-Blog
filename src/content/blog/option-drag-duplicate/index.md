---
title: Option 拖拽复制节点：一次 React Flow 画布功能开发复盘
description: 在 ohmygame 资源画布上实现 Option 拖拽复制节点，从替身交换方案推翻到拖动副本，再到实测、测试和提 PR 的完整过程与经验。
publishDate: '2026-10-14T00:46:07+08:00'
tags:
  - React Flow
  - React
  - 开源贡献
  - 复盘
language: zh
draft: false
category: project
---

这篇文章记录我给开源项目 [ohmygame](https://github.com/WhiteTowerAI/ohmygame) 的资源画布（Asset Canvas）实现 **Option 拖拽复制节点** 的完整过程。

功能本身不大，最终提交的源码改动只有四十行左右，但开发过程并不顺利：推翻过一次整体方案，实测中陆续冒出五六个问题，测试和 PR 描述也都反复改过好几轮。很多问题单看都不难，难的是它们互相牵连。所以我想把过程完整记下来，也包括走过的弯路。

开发全程是我在 Claude Code 里，通过 SSH 连到自己的 Mac 上协作完成的：我负责提需求、实机测试、做取舍，Claude Code 负责读源码、写代码和测试。文中的"我们"指的就是这个组合。

## 一、需求

画布基于 React Flow 12（`@xyflow/react` 12.11.3）。目标交互和 Figma 一样：按住 Option（Windows/Linux 上是 Alt）拖动节点，拖出一个副本。

我一开始定下的验收标准：

1. 原节点的位置、ID、输入输出连接都保持不变；副本生成独立的 ID。
2. 副本不能有任何连接。不只是检查显式的连线（edges），还要检查由 `references`、`promptSource` 等字段生成的派生连接。
3. 保留节点内容、配置和有效的 Library 资源引用，不能误删正常数据。
4. 多选 Option 拖拽时，副本之间也不能自动建立连接。
5. 普通拖拽、取消拖拽、撤销重做、自动保存和重新加载都必须正常。
6. 拖拽过程中原节点的连线要稳定，不能出现短暂的错误连接。

## 二、先搞清楚"连接"有几种

做之前得先弄明白画布里的"连接"是怎么存的。这个画布有两种：

- **显式连线**：存在文档的 `edges` 数组里，每条有 `source` 和 `target`。
- **派生连接**：存在节点自己的数据里，画布渲染时再推导出连线。比如图片节点的 `promptSource`（prompt 来自哪个文本节点）、`images`（参考图），视频节点的 `references`，文本节点的 `references`，3D 节点的 `source`。

另外，节点有两种形态：

- **画布形态（flow node）**：给 React Flow 用的，带选中状态、运行时数据等。
- **保存形态（`AssetCanvasNode`）**：写进文件的数据。

两者之间通过 `toAssetCanvasNode` / `toFlowNode` 互相转换。

好消息是，项目里已经有现成的复制函数 `duplicateAssetCanvasNode`，Cmd+D 和粘贴用的都是它：在保存形态上复制节点、生成新 ID，并且通过 `remapReferences` 把所有指向"复制范围之外"的节点引用清掉，只保留 Library 资源引用。**每个节点单独调用一次**，复制范围就只有它自己，所以副本之间也不会互相引用。需求 2、3、4 基本可以靠它保证。

有一个细节当时让我犹豫了一下：视频节点有一张"别名表" `referenceMentions`，记录 prompt 里 `@Image1` 指向哪张图。复制后，这张表里仍然留着指向原来那个节点的条目。查代码发现这是有意的设计：手动断开一张参考图时，别名同样会保留，目的是"保留别名，让旧的提及永远不会指向新的图片"。这份数据不会生成任何连线，所以不算连接，保持现状即可。

## 三、第一版：替身交换

最初的实现思路是这样的：

> React Flow 继续拖原节点；拖动开始时，在原位置放一个"替身"副本；松手时，把原节点和副本的位置交换。

这样最终结果是对的：原节点回到原位、ID 不变，副本出现在落点。但拖动过程中，**原节点和副本的身份是反的**：跟着鼠标走的是原节点，原地站着的是副本。

为了让画面"看起来"正确，必须把原节点的连线临时画到替身身上：

```tsx
edges={altDragEdgeIds
  ? [...edges, ...assetEdges].map((edge) => ({
      ...edge,
      source: altDragEdgeIds.get(edge.source) ?? edge.source,
      target: altDragEdgeIds.get(edge.target) ?? edge.target,
    }))
  : [...edges, ...assetEdges]}
```

审查这一版时，我们陆续发现了一串问题，并逐个打了补丁：

1. **连线短暂消失**：替身是刚挂载的新节点。React Flow 在测量出节点尺寸之前，不会显示它，也不会画连到它的线（源码里 `getEdgePosition` 会因为 `isNodeInitialized` 为 false 而返回 `null`）。而测量是在 `useEffect` 里挂 `ResizeObserver` 完成的，拖动刚开始的一两帧里，原节点的连线可能会闪一下。补丁：让替身借用原节点的 `measured` 尺寸和连接点位置（`handles`），DOM 测量完成后再去掉。这依赖了 React Flow 的内部字段。
2. **替身位置跳动**：复制函数会把位置吸附到网格上；原节点如果不在网格上，替身会偏几像素，连线也跟着跳。补丁：替身强制放在原节点的精确位置。
3. **自动保存存下中间状态**：拖动途中停顿超过 350ms 就会自动保存，存下的是"原节点被拖走、副本留在原地"的反转状态。这时如果应用崩溃，重新打开后带着连接的原节点就在落点了。补丁：Option 拖拽期间暂停自动保存。
4. **拖动中按 Delete**：React Flow 会中止拖拽，并且不触发 `onNodeDragStop`，副本和连线映射都会残留。补丁：删除时额外清理。

补丁打完，测试也写了，功能能用。但代码里多了一堆"为了维持假象"的东西。

## 四、转折：移动原节点是好做法吗？

这时我问了一个问题：**移动原节点真的是好做法吗？其他画布是怎么做的？**

于是去翻了两个开源画布的源码：

- **tldraw**（`Translating.ts`）：按下 Alt 时调用 `startCloning`，先把原图形恢复到拖动起点，再复制一份，之后的拖动作用在副本上。中途松开 Alt 还能切回移动原件。
- **Excalidraw**（`App.duplicate.ts`）：注释写得很直白，"the originals go back to where the drag started, and the drag continues with the duplicates"。

都是**原件留在原地，拖动的是副本**。

我又对照了一下 LibTV：拖动过程中，被拖着走的节点标题已经变成了"图片节点1-副本"。也就是说，不管它内部怎么实现，用户看到的都是"手上拿着副本"。

回头看第一版的那堆补丁，本质上都是同一个原因：**拖动期间身份反转**。连线要转画、自动保存要暂停、Delete 和撤销要特殊处理，都是在给这个反转打补丁。方向错了，补丁只会越打越多。

## 五、第二版：把位置变化转给副本

问题是 React Flow 在拖拽开始时，就把被拖的节点固定在内部的 `dragItems` 里，中途没法换成副本。

读源码时注意到一个关键点：React Flow 计算拖拽位置时，**用的是鼠标位置，而不是我们 state 里节点的位置**。在受控模式下，它只是通过 `onNodesChange` 把"某节点移动到了某处"报告给我们，应用不应用由我们决定。这本来就是受控模式的常规用法，比如用来限制节点的移动范围。

那就让 React Flow 继续"以为"自己在拖原节点，我们在收到报告时，把原节点的 ID 换成副本的 ID：

```tsx
const altDragCopies = useRef<ReadonlyMap<string, string> | undefined>(undefined)

const onNodesChange = useCallback((changes: NodeChange<AssetCanvasFlowNode>[]) => {
  const copies = altDragCopies.current
  const moves = copies
    ? changes.map((change) =>
        change.type === 'position' && copies.has(change.id)
          ? { ...change, id: copies.get(change.id)! }
          : change
      )
    : changes
  setNodes((current) => applyNodeChanges(moves, current))
}, [])
```

`altDragCopies` 是一张"原节点 ID → 副本 ID"的表，拖动开始时建立，松手时清空。普通拖拽时它是 `undefined`，这几行等于什么都没做。

这一改，第一版的补丁几乎全部消失了：

- **连线天然稳定**：原节点从头到尾没动过，它的连线自然也不动，不需要任何转画。
- **自动保存天然正确**：任何时刻存下来的都是"原节点在原位、副本没有连接"，不需要暂停。
- **副本就是一个普通的新节点**：它本来就没有连接，首帧还没测量完时被隐藏一帧也看不出来，因为它正好和原节点重叠。

### 一个时序上的坑

上面代码里，表必须在函数开头读取，**不能放进 `setNodes` 的回调里**。

松手那一刻，React Flow 会连续做两件事：

1. 调用 `onNodesChange`，报告最后一次位置变化；
2. 调用 `onNodeDragStop`，我们在这里清空表。

`setNodes(回调)` 里的回调是 React 稍后处理更新时才执行的。如果在回调里读表，那时表已经被清空，最后一次位置变化就会落到原节点上，原节点被移走。这个顺序是读 React Flow 的 `XYDrag` 源码确认的：`end` 事件里先 `updateNodePositions(dragItems, false)`，再调 `onNodeDragStop`。

### 开始和结束

```tsx
function startAltDragDuplicate(dragged: readonly AssetCanvasFlowNode[]): void {
  if (nodesRef.current.length + dragged.length > MAX_ASSET_CANVAS_NODES) {
    setTransferError(t('assetCanvas.nodeLimit'))
    return
  }
  const copies = dragged.map((node) => {
    const source = toAssetCanvasNode(node, model3DModels)
    return {
      ...toFlowNode(duplicateAssetCanvasNode(source, source.position), imageModels, videoModels),
      selected: true
    }
  })
  altDragCopies.current = new Map(dragged.map((node, index) => [node.id, copies[index]!.id]))
  clearSelection()
  setNodes((current) => [...current, ...copies])
  setMarqueeSelectedIds(new Set(altDragCopies.current.values()))
}

function finishAltDragDuplicate(dragged: readonly AssetCanvasFlowNode[]): void {
  const copies = altDragCopies.current
  altDragCopies.current = undefined
  if (!copies) return
  const start = new Map(nodesRef.current.map((node) => [node.id, node.position]))
  if (
    dragged.some(
      (node) =>
        node.position.x !== start.get(node.id)?.x || node.position.y !== start.get(node.id)?.y
    )
  )
    return
  const copyIds = new Set(copies.values())
  setNodes((current) =>
    current.flatMap((node) =>
      copyIds.has(node.id) ? [] : [copies.has(node.id) ? { ...node, selected: true } : node]
    )
  )
  setMarqueeSelectedIds(new Set(copies.keys()))
}
```

`finishAltDragDuplicate` 的判断很简单：`dragged` 是 React Flow 报告的**落点**，`start` 是原节点在 state 里的**实际位置**（原节点从没动过，所以就是起点）。有任何一个不同就是完成复制，什么都不用做；全部相同就是原地取消：删掉副本，把选中还给原节点。

接线只需要在拖拽回调里各加一行：

```tsx
onNodeDragStart={(event, _node, dragged) => {
  setCanvasContextMenu(undefined); beginHistoryGesture();
  altDragCopies.current = undefined;
  if (event.altKey) startAltDragDuplicate(dragged);
}}
onNodeDragStop={(_event, _node, dragged) => { finishAltDragDuplicate(dragged); finishHistoryGesture(); }}
```

`beginHistoryGesture()` 在复制之前调用，这样"添加副本"就被算进这次拖拽的历史步骤里，撤销一次就能去掉副本，不需要额外代码。

## 六、实机测试：一个问题接一个问题

代码写完、测试也过了，真正的问题是在实机测试里冒出来的。

### 1. 副本弹出了节点面板

**现象**：框选 A、B 两个节点后 Option 拖动，两个副本都弹出了节点面板。

**原因**：项目之前的一个 PR（#177）定了规则：**框选是为了整理布局，点击才是为了编辑**。所以被选中、但不是通过框选选中的节点会打开面板。框选的节点记录在 `marqueeSelectedIds` 里。拖动开始时选中转到了副本上，副本是新 ID，不在这张表里，就被当成"点击选中"，打开了面板。

这个问题前后改了三版：

- **第一版**：写了一个 `moveMarqueeMarks` 函数，选中转给副本时把"框选标记"也一起搬过去，取消时再搬回来。能用，但我觉得为了这件事多一个双向搬运的函数，不够优雅。
- **第二版**：拖动过程中不改选中状态，松手完成复制时再把选中切给副本，并统一标记为框选。代码确实简单了，但我实测发现一个新问题：拖动中选中的还是原节点，按 Delete 删掉的是**原节点**，而视觉上我手里拿着的是副本。
- **第三版**（最终）：换一个统一的规则——**Option 拖拽结束后，选中的节点一律不开面板**。开始时选中切给副本、标记副本；原地取消时选中还给原节点、标记原节点。两边都是一行 `setMarqueeSelectedIds(...)`，对称，也不需要额外的函数。

代价是：如果你先点击选中了一个开着面板的节点，Option 拖动后又原地取消，面板会变成关闭，需要再点一下。可以接受。

### 2. 拖动中按 Delete，原节点的连线没了

**现象**：框选 A、B，Option 拖动，鼠标不松开时按 Delete，再松手。两个副本消失了，但 A 和 B 之间的连线也没了。

**原因**：React Flow 框选时，会把**和选中节点相连的所有连线一起选中**（`UserSelection` 里遍历 `connectionLookup`）。拖动开始时我们只取消了节点的选中，这些连线还是选中的，Delete 就把它们一起删了。删的还是派生连线，对应的连接数据（prompt 来源、引用）也跟着被清掉了。

**修复**：拖动开始时调用 `clearSelection()` 清空所有选中，再选中副本。顺便发现 `clearSelection()` 原来只清了节点和派生连线的选中，没清 `edges` 里普通连线的选中，补了一行：

```tsx
setEdges((current) => current.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)))
```

### 3. 光标：单选是箭头，框选却是抓手

**现象**：单个节点 Option 拖动时，光标是默认箭头；框选后再拖却是正常的抓取光标。

**原因**：React Flow 会给**被鼠标抓住的那个节点的 DOM** 加上 `.dragging` class，而原来的 CSS 只让这个节点和多选框显示抓取光标。Option 拖动时，React Flow 以为自己在拖原节点，`.dragging` 加在了原地不动的原节点上，鼠标下面却是副本，所以显示箭头。框选时，多选框正好盖在副本上方，所以显示正常。

**第一次修复**：在原来那条规则里加一个选择器，让拖动期间所有节点都显示抓取光标。

紧接着我又发现了另一个问题：**从文本节点边缘那一小块拖动时**（文字区域本身不能拖），光标在抓手、I 形和箭头之间来回跳。原因是节点跟随鼠标会慢一两帧，鼠标经常短暂滑到文字区域或画布空白处。这个问题普通拖拽本来就有。

**最终修复**：拖动期间，画布里所有元素都显示抓取光标：

```css
.story-canvas .react-flow__nodesselection-rect:active,
.story-canvas:has(.react-flow__node.dragging) * {
  cursor: grabbing;
}
```

这里要算一下 CSS 优先级：`.story-canvas:has(.react-flow__node.dragging) *` 相当于 3 个 class（`:has()` 取括号里的优先级），和"可拖动节点默认箭头"那条规则（`.story-canvas .react-flow__node.draggable`）一样高，靠写在后面才胜出。文字区域的 I 形光标来自浏览器默认样式，任何项目样式都能覆盖它。

### 4. 拖动中按 Cmd+Z，历史记录乱了

这个问题不是我实测撞见的，而是 Claude Code 审查代码时发现、并用临时测试实际复现过的。我一开始没看懂它的描述，它又整理成了手动复现步骤：

1. 移动节点 A，等 1 秒，让这一步单独记入历史；
2. Option 拖动节点 C，鼠标不松开时按 Cmd+Z；
3. 结果：A 跳回了移动前的位置（上一个操作被撤销了），正在拖的副本也消失了；
4. 松手后按 Cmd+Shift+Z，重做没反应；
5. 再按 Cmd+Z，A 又跳回移动后的位置——"撤销"反而把刚才撤销的操作恢复了。

**原因**：一次拖动要等松手时才记成一个撤销步骤，内容是"拖动开始前的快照"。中途撤销后，松手时又把这份包含被撤销操作的旧快照压回撤销栈，顺序就乱了。普通拖拽和调整尺寸也有这个问题，并不是 Option 拖拽引入的。

**修复**：拖动或调整尺寸进行中，直接忽略撤销和重做快捷键（`historyGestureBase` 有值就表示手势进行中）：

```tsx
const step = undoShortcut(event)
if (!step) return
event.preventDefault()
if (historyGestureBase.current) return
```

但这又引出一个新问题：拖动中删掉**正在拖的节点**时，React Flow 会中止拖拽且不触发 `onNodeDragStop`，`historyGestureBase` 永远不会被清空，撤销就被永久屏蔽了。所以在 `onNodesDelete` 里主动结束这次手势：

```tsx
onNodesDelete={(deleted) => {
  removeCanvasNodes(new Set(deleted.map((node) => node.id)));
  finishHistoryGesture();
}}
```

没在拖拽时，`finishHistoryGesture` 什么都不做，所以这行对其他删除操作是安全的。

### 5. 对齐辅助线常亮

这个问题是写代码时预判出来的，没等到实测就处理了。计算对齐辅助线时，画布上所有节点都会参与比较，和"正在拖的节点"ID 相同的会被跳过。Option 拖动时，React Flow 报告的"正在拖的节点"是原节点 A，位置却是鼠标处，而副本 A' 恰好在完全相同的位置，每条边都"对齐"，辅助线就会一直亮着。

修复是一行：计算时排除所有 `dragging` 的节点。

```tsx
const [active, ...candidates] = alignmentNodesFromDom([
  node,
  ...nodes.filter((candidate) => !candidate.dragging)
])
```

位置变化里的 `dragging: true` 也跟着转给了副本，所以副本会被排除。这条规则对普通多选拖动同样合理：一起移动的节点本来就不应该互相对齐。

### 6. 两个不是 bug 的"bug"

- **突然连不了线**：测试中途我发现节点之间连不了线了，退出重进就好了。原因是开发模式下 Vite 不断把改动热替换进正在运行的应用，替换多次后 React Flow 的内部状态和组件对不上了。以后每次同步改动后，我都先刷新再测。
- **Shift 点击多选不生效**：手动测试清单里写了"Shift+点击多选"，实际上 React Flow 默认 Shift 是框选键，macOS 上多选是 **Cmd+点击**。清单写错了。

## 七、测试：怎么确认测试真的有用

最终测试文件 `test/canvas-alt-drag-duplicate.test.tsx` 有 10 个测试。思路是用 `vi.doMock` 把真实的 React Flow 画布替换成一个假组件，只记录它收到的 props，再按真实拖拽的顺序手动调用回调。仓库里已有的几个画布测试也是这个写法。

核心是一个模拟拖拽的辅助函数：

```tsx
async function drag(ids: string[], altKey: boolean) {
  const at = new Map(ids.map((id) => [id, { ...flowNode(id).position }]))
  const dragged = (dragging: boolean) =>
    ids.map((id) => ({ ...flowNode(id), position: at.get(id)!, dragging }))
  const report = (dragging: boolean) =>
    captured.props!.onNodesChange!(
      ids.map((id) => ({ type: 'position', id, position: at.get(id)!, dragging }))
    )
  await act(async () =>
    captured.props!.onNodeDragStart!({ altKey } as never, dragged(true)[0]!, dragged(true))
  )
  return {
    by: (x: number, y: number) =>
      act(async () => {
        for (const [id, position] of at) at.set(id, { x: position.x + x, y: position.y + y })
        report(true)
      }),
    drop: () =>
      act(async () => {
        report(false)
        captured.props!.onNodeDragStop!({ altKey } as never, dragged(false)[0]!, dragged(false))
      })
  }
}
```

它报告的始终是**原节点的 ID**，和真实的 React Flow 一样，所以能真正验证"位置变化被转给副本"这件事。另外还有一个 `pressDelete()`，模拟 React Flow 的 Delete 键：同时删除选中的节点**和选中的连线**。第 2 个 bug 正是靠这个"连线也会被删"的细节才测出来的。

### 变异测试：故意把代码改错

测试全过不代表测试有用。每次修完一个问题，我们都会把修复**故意还原或改错**，看测试会不会失败：

| 故意改错                           | 失败的测试数           |
| ---------------------------------- | ---------------------- |
| 不把位置变化转给副本               | 4                      |
| 在 `setNodes` 回调里读表（时序坑） | 4                      |
| 不处理原地取消                     | 1                      |
| 副本保留连接                       | 3                      |
| 开始时不选中副本                   | 2                      |
| 不给副本打框选标记                 | 2                      |
| 取消时不还原框选标记               | 1                      |
| 不调用 `clearSelection()`          | 1                      |
| `clearSelection()` 不清普通连线    | 起初 **0**，后来补成 1 |
| 不忽略拖动中的撤销                 | 起初 **0**，后来补成 1 |
| 删除时不结束手势                   | 1                      |

表里有两项起初是 0，说明那时测试其实没测到：

- **`clearSelection()` 不清普通连线**：测试画板里唯一的普通连线和被拖的节点不相连，框选时根本不会被选中。修法是在那个测试里额外 Cmd+点击选中这条连线。
- **不忽略拖动中的撤销**：测试在拖动中**连续**按了撤销和重做再检查结果。不加修复时，撤销会把副本和上一步操作一起撤掉，重做又把它们原样恢复，两次操作恰好抵消，结果和"什么都没发生"一样。修法是每按一次就检查一次。

这两个例子让我印象很深：**一个从来不会失败的测试，和没有测试差不多。**

### 全量测试中途退出

本地跑完整的 `bun run test`，会在 40 秒左右以退出码 0 结束，但不输出汇总，只跑了 231 个测试文件中的一部分。切回没有改动的基础提交跑，情况一样。

最后的办法是分片运行（`vitest run --shard=N/6`），每一片都能跑完。结果是 2225 个通过、21 个跳过、14 个失败。再用 `git worktree` 检出基础提交，对那 5 个失败的文件单独再跑一次，失败的正好是**同样的 14 个测试**（本地预览服务器、OpenAI 会话传输、项目依赖扫描），逐条比对完全一致。整体中途退出的根本原因到现在也没查清，但至少确认了和这次改动无关。

中间还踩了个小坑：在 macOS 上，`/tmp` 实际是 `/private/tmp` 的符号链接。在 `/tmp` 下的 worktree 里按文件路径过滤测试，Vitest 会报 "No test files found"，切到真实路径再跑就好了。

## 八、精简代码

功能稳定后，我一段一段地让 Claude Code 讲解代码，边看边精简：

- `toAssetCanvasNode(nodesRef.current.find(...) ?? node, ...)` 里的查找是多余的。React Flow 传来的节点对象虽然多了些运行时字段，但转换函数只按字段名读取需要的数据，结果完全一样，所以直接用 `node`。
- 把 `if (!copies) return;` 提到最前面，普通拖拽松手时就不会白建一张位置表，函数的三个出口（普通拖拽、完成复制、原地取消）也一目了然。
- 删掉了 diff 里所有新增的注释。这是个取舍：像"必须在函数开头读表"这种时序细节，没有注释就看不出原因。不过有测试兜底，挪错位置会有 4 个测试失败。
- 删掉一个被另一个测试完全覆盖的冗余测试（单节点拖动中按 Delete，已经被框选版本覆盖）。

最终 diff：

| 文件                                 | 改动                                           |
| ------------------------------------ | ---------------------------------------------- |
| `asset-canvas-workspace.tsx`         | Option 拖拽；撤销修复；`clearSelection` 清连线 |
| `editor-canvas.tsx`                  | 对齐辅助线排除移动中的节点（1 行）             |
| `styles.css`                         | 拖动时全画布抓取光标（1 行）                   |
| `asset-canvas-clipboard.test.ts`     | 补充 3D、文档、表格节点的复制测试              |
| `canvas-alt-drag-duplicate.test.tsx` | 新增 10 个交互测试                             |

源码改动四十行左右，测试三百多行。

## 九、提 PR

### 上游换了开发分支

准备提交时先去看了上游，发现 `main` 没有新提交，但 `dev` 多了 46 个。读了新版的 `CONTRIBUTING.md` 才知道规则变了：**`dev` 是开发集成分支，贡献分支从 `dev` 拉、PR 提到 `dev`；`main` 只用于发布。**

用 `git merge-tree` 在不动工作区的情况下模拟了一次合并，确认没有冲突后：

```bash
git stash push -u
git merge --ff-only upstream/dev
git stash pop
```

`dev` 刚加了中文界面（i18n），我们代码里"超过 2000 个节点"的报错还是写死的英文，于是改成了已有的翻译键 `t("assetCanvas.nodeLimit")`。`dev` 还新增了 `i18next` 依赖，需要重新 `bun install`，正在运行的开发版应用也得重启。

### 推送：SSH 会话读不到钥匙串

`git push` 报错 `failed to get: -25308`。原因是 GitHub 凭证存在 macOS 钥匙串里，而通过 SSH 登录的会话没有图形会话，访问不了钥匙串。好在机器上有 GitHub 的 SSH 密钥，于是只在这一次推送里临时改用 SSH 地址，不改 `origin` 的配置：

```bash
git -c url."git@github.com:".pushInsteadOf="https://github.com/" push -u origin feat/canvas-alt-drag-duplicate
```

### PR 描述改了好几轮

PR 描述是这次花时间最多的部分之一：

- **第一版太简略**：改动的地方、理由都不少，拖动光标的问题只一笔带过，没有展开说明。
- **让网页版 Claude Code 精简后，又丢了太多内容**：比如各个问题的现象、完整的测试清单，测试数量也还是同步 `dev` 之前的旧数字。
- **最后按 `dev` 新的 PR 模板组织**：What changed / Why it changed / How it was checked，再补回丢失的内容。GIF 只录核心的 Option 拖拽，Delete、Cmd+Z 这种按键操作在录屏里看不出来，就只用文字说明。

审查描述时，还发现了两类不准确的说法：

1. **把"新功能自身的细节"写成了"顺带修复的 bug"**。"拖动中 Delete 误删连线""辅助线常亮""Option 拖动光标是箭头"这三个问题，上游从来没出现过：Option 拖拽是新功能，它们只存在于开发过程中。写成"修复"，reviewer 会去上游找复现方法，结果找不到。最后把它们归到"实现时需要处理的细节"，只有"拖动中撤销打乱历史"和"拖动时光标乱跳"这两个才是真正的"已有问题"。
2. **事实写反了**：一版描述里写"原节点一直被当成对齐目标"，实际被当成对齐目标的是**副本**（原节点和"正在拖的节点" ID 相同，本来就会被跳过）。

另外，全量测试那句一开始写的是"本地中途退出，属于环境问题"，太含糊。后来重跑一遍、和基础提交逐条比对之后，才换成有具体数字和依据的说法。

## 十、收获

1. **当补丁越打越多时，先回头质疑方案本身。** 替身交换方案的每个补丁单看都合理，合起来却说明方向错了。"其他产品是怎么做的"这个问题，比继续打补丁有价值得多。
2. **读框架源码，找"正当"的扩展点。** 受控模式下改写 `onNodesChange` 收到的变化，是 React Flow 设计上就允许的用法，比依赖内部字段（`measured`、`handles`）稳得多。
3. **时序问题要追到源码层面。** "松手时先报告位置、再触发结束回调"这个顺序决定了表要在哪里读。不读 `XYDrag` 的源码，很难想到这里会出错。
4. **选中状态是一条隐形的耦合链。** 面板规则、框选会连带选中连线、Delete 删的是选中项……拖动开始时"选中给谁"一个看似很小的决定，牵连出了三个问题。
5. **测试要能失败。** 变异测试抓出了两个"永远不会失败"的测试。撤销加重做恰好抵消的那个例子尤其值得记住。
6. **区分"新功能的实现细节"和"上游已有的问题"。** 这在 PR 描述里很重要，直接影响 reviewer 怎么理解和验证这些改动。
7. **代码要简洁，但简洁有代价。** 删掉注释让 diff 更干净，但也把一些"为什么"藏了起来。我的做法是用测试来守住这些不容易看出的约束。
8. **开发环境的坑会伪装成 bug。** 热更新导致连线失效、`/tmp` 和 `/private/tmp`、SSH 会话读不到钥匙串、全量测试中途退出……先排除环境问题，再怀疑代码。
9. **和 AI 协作时，人负责判断和实测。** 好几个关键问题（副本弹面板、Delete 删了原节点、文本节点边缘光标乱跳）都是我实机操作时发现的；"移动原节点真的好吗""这样实现优雅吗"这类方向性的质疑，也推动了两次大的重构。代码讲解一次只讲一小段、一段一段地过，比一次性给一大篇有效得多。

## 附：手动测试清单（精简版）

- 单选、框选、Cmd+点击多选后 Option 拖动：副本跟着走，原节点和连线不动，副本没有连线，不弹面板
- 拖回原位松手：没有副本，原节点保持选中且不弹面板
- 框选后 Option 拖动，拖动中按 Delete：只有副本消失，原节点之间的连线完整
- 拖动中按 Cmd+Z / Cmd+Shift+Z：没有反应；松手后撤销一次去掉副本，再撤销才回到上一步
- 普通拖动中删掉正在拖的节点，再按 Cmd+Z：节点恢复到拖动前的位置
- 关闭画板后重新打开：副本仍在、没有连线
- 单选 Option 拖动、从文本节点边缘拖动：光标始终是抓手
- 对齐辅助线正常出现和消失
