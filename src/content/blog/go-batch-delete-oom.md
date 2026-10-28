---
title: 一次"删文件把后端删挂了"：Go 服务 OOM 排查与删除队列化
description: 用户在云空间删几个文件，Go 后端被容器内存上限连续杀掉。根因是删除流程一次性加载用户全部历史数据。记录分批扫描、keyset 分页、单次解析、GOMEMLIMIT 跟随 cgroup，以及把删除迁到独立 worker 队列的过程。
publishDate: 2026-10-21 10:06:33
tags:
  - Go
  - 后端
  - 性能
  - Docker
  - 复盘
language: zh
draft: false
authorship:
  mode: generated
  models: [Claude Opus 5.5]
category: postmortem
---

这篇记录一次线上 Go 服务的 OOM 排查（Go + Gin + GORM + PostgreSQL，Docker Compose 部署）。

开发和排查是我在 Claude Code 里协作完成的：我负责看现场、定方案和取舍、安排上线；Claude Code 负责读源码、写代码和测试。文中的"我们"指这个组合。

## 一、现象

某天清晨，后端容器在几分钟里被内核 OOM kill 了好几次（容器内存上限 1G）。每次重启都会中断正在进行的任务提交和轮询。

对照访问日志，这几次被杀都能和同一个用户在"云空间"里执行的**永久删除文件**操作对上。

当天上午又发生了两次，另外还有一次是删除画布时把 deletion-worker 也杀掉了（worker 上限 512M），导致一个删除任务卡在半路，几十个文件一直显示"删除中"。

## 二、删除一个文件要做什么

"删一个文件"在这个系统里并不只是删一个对象存储的 key。因为文件可能被画布节点、回收站、AI 生成任务的请求参数引用，删除前要做一次**全账号范围的引用清理**：

1. 找出这个用户所有引用了这些文件的**生成任务**（图片/音频/视频），这些任务的结果已经失效，把它们删掉。
2. 找出这个用户所有**画布**、所有**画布历史快照**、所有**画布操作记录**，把里面对这些文件的引用摘掉。
3. 处理回收站里的条目。
4. 最后才去删对象存储里的文件和数据库记录。

问题就出在"找出所有……"这一步的写法上。

## 三、根因：一次性把账号的全部历史读进内存

### 1. 生成任务表：单行可能超过 10MB

```go
// 修复前（示意）
var tasks []model.VideoTask
tx.Where("user_id = ?", userID).Find(&tasks) // 一次性加载这个用户的全部任务
for _, t := range tasks {
	if containsAny(mustMarshal(t), objectIDs) { /* 删除 */ }
}
```

看起来没毛病，但任务的 `request_body` 里可能**内嵌 base64 编码的参考图**。出事的这个用户只有两百多行任务，加起来却有 **1GB 多**。这一行 `Find` 就足以把 1G 的容器撑爆。

### 2. 画布快照表：两千多份，压缩后近 1GB

同样的写法也用在了画布快照上：一次加载用户所有画布的所有历史快照。重度用户有两千多份快照，单份接近 1MB，全部加起来接近 1GB。

### 3. 每个文件 ID 都把 JSON 重新解析一遍

摘除引用时，对每份画布 JSON 循环所有要删除的文件 ID，**每个 ID 都完整解析、修改、序列化一次**。删 100 个文件，就是对同一份 JSON 解析 100 次。

### 4. 删除跑在 API 进程里

前面这些重活都跑在 **API 进程的 goroutine 里**。后果是：

- 删除吃掉的内存直接算在 API 进程头上，OOM 杀掉的是整个后端。
- 删到一半进程重启，任务就丢了（启动恢复逻辑默认是关闭的）。

### 5. Go GC 不知道容器有内存上限

两个容器都没有设置 `GOMEMLIMIT`。Go 的 GC 默认按 `GOGC=100` 节奏回收：堆增长到上次存活量的 2 倍才触发。它完全不知道 cgroup 只给了 1G，**垃圾还没来得及回收，峰值就先碰到了上限**。

## 四、修复

我们按"先止血、再治本"的顺序分了几步，每一步都是一个独立的提交，可以单独上线和回滚。

### 1. 生成任务：过滤下推到 SQL + 分批扫描

能在 SQL 里过滤的，就不要拿到内存里过滤：

```go
// 只有 local-file: 前缀的任务才会关联本地文件，过滤条件下推到数据库
tx.Where("user_id = ? AND storage_key LIKE ?", userID, "local-file:%").Find(&images)
```

过滤不掉的（要在请求体里搜文件 ID），就用 GORM 的 `FindInBatches` 分批处理：

```go
// 任务请求体可能内嵌 base64 媒体，单行超过 10MB；每批只拿 5 行
const taskScanBatchSize = 5

var batch []model.VideoTask
err := tx.Where("user_id = ?", userID).
	FindInBatches(&batch, taskScanBatchSize, func(_ *gorm.DB, _ int) error {
		for _, t := range batch {
			if containsAny(mustMarshal(t), objectIDs) {
				if err := tx.Delete(&model.VideoTask{}, "id = ?", t.ID).Error; err != nil {
					return err
				}
			}
		}
		return nil
	}).Error
```

批大小选 5，是因为这里的单行可能就有十几 MB。**批大小要按"单行最大可能多大"来定，而不是按行数的直觉。**

### 2. 快照表：复合主键用不了 FindInBatches，自己写 keyset 分页

`FindInBatches` 依赖单列主键。快照表的主键是 `(project_id, revision)` 复合主键，用不了。于是改成**按画布逐个处理，每个画布内按 revision 做 keyset 分页**：

```go
const snapshotScanBatchSize = 20

// 按 revision 分页扫描一个画布的快照；visit 返回 true 表示可以提前结束
func scanSnapshots(tx *gorm.DB, projectID string, visit func(model.CanvasSnapshot) (bool, error)) error {
	last := int64(math.MinInt64)
	for {
		var page []model.CanvasSnapshot
		err := tx.Select("project_id, revision, document_json").
			Where("project_id = ? AND revision > ?", projectID, last).
			Order("revision").Limit(snapshotScanBatchSize).
			Find(&page).Error
		if err != nil {
			return err
		}
		for _, s := range page {
			if stop, err := visit(s); err != nil || stop {
				return err
			}
		}
		if len(page) < snapshotScanBatchSize {
			return nil
		}
		last = page[len(page)-1].Revision
	}
}
```

为什么用 keyset（`revision > last`）而不是 `OFFSET`：扫描的同时会**原地更新**快照内容；而且 `OFFSET` 越往后越慢，keyset 每一页的代价都一样。

顺带还有一个收益：只需要判断"有没有引用"的地方（比如回收站过期检查），**命中一次就可以提前停止**，不必扫完全部快照。

### 3. JSON 只解析一次，一次去掉全部目标 ID

```go
// 修复前：每个 ID 解析一次
for _, id := range objectIDs {
	raw, _ = removeOne(raw, id)
}

// 修复后：先在原始字节里快速判断这份文档包含哪些目标 ID，
// 一个都不包含就直接跳过；包含的话只解析一次，一次性移除
func removeAll(raw string, objectIDs []string) (string, bool) {
	hit := idsPresentIn(raw, objectIDs) // 单遍字符串扫描
	if len(hit) == 0 {
		return raw, false
	}
	return removeSet(raw, hit) // 解析一次、修改、序列化一次
}
```

同一份 1.4MB 的画布、删 100 个文件：**689ms → 7ms**；对于根本没有引用这些文件的画布：**502ms → 0.5ms**。绝大多数画布都属于后一种，所以整体收益非常可观。

### 4. 按 cgroup 内存上限设置 GOMEMLIMIT

Go 1.19 起有了软内存上限 `debug.SetMemoryLimit`：堆接近这个值时，GC 会更积极地回收。我们在启动时读取 cgroup v2 的 `memory.max`，取 80% 作为软上限：

```go
const cgroupMemoryMax = "/sys/fs/cgroup/memory.max"

// 启动时调用：把 Go 软内存上限设为容器上限的 80%；显式设置的 GOMEMLIMIT 优先
func applyContainerMemoryLimit() {
	if os.Getenv("GOMEMLIMIT") != "" {
		return
	}
	raw, err := os.ReadFile(cgroupMemoryMax)
	if err != nil {
		return // 不在容器里，或者是 cgroup v1
	}
	v := strings.TrimSpace(string(raw))
	if v == "" || v == "max" { // "max" 表示没有设置上限
		return
	}
	limit, err := strconv.ParseInt(v, 10, 64)
	if err != nil || limit <= 0 {
		return
	}
	soft := limit / 10 * 8
	debug.SetMemoryLimit(soft)
	log.Printf("go memory limit set to %d MiB (80%% of container limit)", soft>>20)
}
```

上线后日志里能看到两个容器分别是 `819 MiB` 和 `409 MiB`。

需要说明的是：**GOMEMLIMIT 不是 OOM 的解药**。如果存活对象本身就超过上限（比如一次性加载 1GB 数据），GC 再积极也回收不了，前面几步才是根治。它的作用是让"垃圾堆积导致的峰值"不再碰到上限。另外要留出余量（这里是 20%），因为 Go 运行时之外还有其他内存开销。

### 5. 删除迁到独立的 deletion-worker 队列

最后一步是架构上的调整：**API 进程只负责登记删除任务，真正的删除由独立的 worker 进程领取执行**。

```
修复前：API 请求 → 写任务 → 在 API 进程里起 goroutine 执行删除
修复后：API 请求 → 写任务（phase=requested）→ 返回
                          ↓
        deletion-worker 轮询领取（带租约）→ 准备 → 按固定清单删除 → 完成
```

几个要点：

- **任务带阶段（phase）**：`requested` → 准备中 → 删除存储 → 删除记录……worker 按阶段续跑。删到一半重启，下次领取时从记录的阶段继续，**按已经确定的清单继续删，不重新扫描**，避免删除范围扩大。
- **租约（lease）**：领取时写入 `lease_owner` 和 `lease_until`，过期的任务才能被重新领取，防止两个执行者同时处理同一个任务。
- **重试 = 重新排队**：用户点"重试"不再在 API 进程里直接执行（之前可能和 worker 同时跑同一个任务），而是把任务状态改回 pending、交给 worker。
- **续跑时保留进度**：重新准备时保留已经完成的删除明细，否则收尾对账会不一致，已删除的文件还可能被改回回收站。

worker 和后端是**同一个镜像**，只是启动参数不同（`--deletion-worker`），内存上限也单独设置。这样删除再重，最坏也只是 worker 重启续跑，不会拖垮 API。

另外把云空间多选删除的单次上限定为 100 个文件。压测删 100 个文件约 1.2 秒，比逐个删除更轻；如果选中的文件里有一部分已经在删除中，只跳过这部分，其余照常建任务（之前的写法会整批返回旧任务，导致静默漏删）。

## 五、上线结果

- 切换后 25 秒，worker 自动续跑完成了那个卡住的删除任务，"删除中"的文件全部清零。
- 之后没有再出现 OOM，也没有 5xx。

## 六、收获

1. **`Find` 全量加载是最常见的内存炸弹**。尤其是表里有大字段（JSON、base64、文档快照）时，行数少不代表数据量小。写 `Find` 之前先想想这张表单行最大可能有多大。
2. **能下推到 SQL 的过滤就下推**，过滤不掉的就分批处理；批大小按单行最大体积来定。
3. **复合主键用 keyset 分页**，同时还能支持边扫边改和提前结束。
4. **GOMEMLIMIT 应该是容器化 Go 服务的默认配置**，但它只能削峰，不能代替"别一次性加载太多数据"。
5. **重活不要放在 API 进程里**。拆成带阶段、带租约、可续跑的 worker 队列，失败的影响范围就被限制在 worker 内部。
6. 每一步修复都是独立的提交、可以单独上线。线上出事时，先上最小的止血补丁，再逐步治本。
