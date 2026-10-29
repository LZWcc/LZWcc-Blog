---
title: 从 Umami Cloud 迁移到自建，并恢复博客阅读数
description: 博客阅读数一直显示 0，排查后发现 Cloud API 需要 Pro。记录保留历史数据、自建 Umami，以及通过定时快照给静态博客显示浏览次数的做法。
publishDate: 2026-10-30 00:21:36
tags:
  - Umami
  - Astro
  - Docker
  - 运维
language: zh
draft: true
authorship:
  mode: generated
  models: [GPT-6]
category: postmortem
---

博客文章下面的阅读数一直是 `0 views`，但 Umami 后台能看到访问记录。检查线上 `/stats/pageviews.json`，返回的是空对象 `{}`，部署日志里则有这条错误：

```text
[umami] Failed to fetch pageviews stats: 403 Forbidden
```

原来的实现会在构建时请求 Umami API。请求失败后，程序继续生成空 JSON，页面查不到文章数据就显示 0，构建本身仍然成功。

打开 Cloud 的 API keys 页面，账户提示 API 访问需要 Pro。排查时，[官方套餐页](https://umami.is/pricing)也把 API access 列在 Pro 中。Cloud 后台里能看到已收集的数据，文章阅读数的读取请求被拒绝了。

## 保留历史数据再迁移

我已有一台 2 核 2 GB 的服务器，决定部署自建 Umami，同时把 Cloud 的历史记录迁过去。

自建部分使用[官方 Docker 部署方式](https://docs.umami.is/docs/install)，数据库通过独立数据卷保存。我通过建站 API 沿用了 Cloud 的网站 ID，导入记录里的 `website_id` 也保持不变。

Cloud 的「设置 → 统计数据 → 导出」仍然可以使用。选择博客和时间范围后，下载链接会发到邮箱；[官方导出说明](https://docs.umami.is/docs/cloud/export-data)介绍了这个入口。这次下载的 ZIP 里有三份 CSV：`website_event.csv`、`event_data.csv` 和 `session_data.csv`。

导入前先检查列名、记录数和日期范围。我的后两份文件只有表头，没有属性数据，转换器便按这份实际导出适配；遇到未知字段或非空的属性表会停止，防止只导入一部分。

导入时保留原始的 `event_id`、`session_id`、`visit_id` 和事件的 UTC 时间，在一个事务中写入 PostgreSQL，主键冲突时跳过已有记录。重复执行同一份导入后，记录数没有增加。

第一次导入后，核对了事件 ID、会话数、访问次数、日期范围，以及按日、按文章分组的计数。切换博客脚本后又导出了一次 Cloud 数据，补进首次导出后新增的 5 条记录，最终保留了 **931 条历史浏览记录**。Cloud 原站和原始导出包都保留着。

## 给静态博客同步阅读数

博客使用 Astro 静态构建。为让阅读数在两次部署之间也能更新，我在服务器上加了一个独立的同步任务：每隔 10 分钟查询 Umami，按文章路径生成 JSON，页面加载时读取对应的值。

这次部署的是 Umami 3.4.1。同步调用 `/breakdown`，按 `path` 分组，读取返回的 `views`。先准备 `UMAMI_URL`（服务地址，不带末尾斜杠）、`UMAMI_WEBSITE_ID` 和 `UMAMI_API_KEY`，可以这样验证请求：

```sh
curl --get "$UMAMI_URL/api/websites/$UMAMI_WEBSITE_ID/breakdown" \
  -H "Authorization: Bearer $UMAMI_API_KEY" \
  --data-urlencode 'fields=["path"]' \
  --data-urlencode 'eventType=1' \
  --data-urlencode 'startAt=0' \
  --data-urlencode "endAt=$(date +%s)000"
```

这个版本的 Breakdown 最多返回 500 个分组，我的历史数据有 59 个原始路径。同步脚本在返回数量达到上限时会报错并保留旧文件，防止把可能截断的结果当作完整统计。

systemd timer 的核心配置很短：

```ini
[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
```

任务在开机后约 2 分钟首次运行，此后每隔约 10 分钟运行一次。Umami 持续接收访问，10 分钟是文章阅读数快照的同步间隔。已经打开的页面需要刷新，才会重新读取数字。

同步成功后，先写临时文件，再通过重命名替换旧 JSON；失败时保留上次结果。页面读取失败则显示 `— views`，避免把不可用的数据写成 0。API Key 留在服务器，浏览器只读取公开的路径和计数。

JSON 放在静态构建目录之外，由 Nginx 把 `/stats/pageviews.json` 映射过去。这样正常发布文章、同步 `dist` 时，阅读数文件也能独立保留。

## 导入和统计时遇到的两个坑

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 导入时报数值字段不能接受 `\N` | CSV 用 `\N` 表示空值，直接拼成字符串后不符合目标字段类型 | 解析 CSV 时转换成空值，再生成 SQL；事务失败时整批回滚 |
| 文章有 9 次浏览，接口却返回 5 | 3.4.1 的 `/metrics?type=path` 按 `session_id` 去重，返回的是访客数 | 改用 Breakdown 的 `views`，与导出的逐条访问记录比对 |

第二个问题在[这一版本的源码](https://github.com/umami-software/umami/blob/v3.4.1/src/queries/sql/pageviews/getPageviewMetrics.ts)里能直接看到：聚合使用了 `count(distinct website_event.session_id)`。接上接口之后，还需要确认返回的数字与页面上的 `views` 含义一致。[Breakdown 文档](https://docs.umami.is/docs/api-reference/get-website-breakdown)分别列出了浏览次数、访客数和访问次数。

## 2 GB 服务器上的占用

使用官方预构建镜像运行 Umami 3.4.1 和 PostgreSQL 16，没有在服务器上编译源码。部署后、完成后台查询和真实访问时，应用约占 314 MiB，数据库约占 52 MiB，合计约 **366 MiB**；这是当时的短时采样值。

两个容器的内存上限分别设置为 512 MiB 和 256 MiB。应用只监听服务器回环地址，由 Nginx 提供 HTTPS，数据库不发布宿主机端口。

数据库每天自动备份，迁移完成时也另外保存了一份到本机。恢复所需的服务配置和凭据与备份一起私下保存，文章和配置模板不包含密钥。
