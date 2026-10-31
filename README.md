# LZWcc-Blog

我的个人博客，记录开发实践、学习笔记和 AI 协作经验。使用 Astro 构建，基于 [Astro Theme Pure](https://github.com/cworld1/astro-theme-pure) 定制。

- 访问博客：[lzwcc.xyz](https://lzwcc.xyz)
- RSS：[订阅文章](https://lzwcc.xyz/rss.xml)
- 源码：[LZWcc/LZWcc-Blog](https://github.com/LZWcc/LZWcc-Blog)

## 本地开发

需要 Bun 和兼容当前 Astro 的 Node.js；使用 Node.js 22 或更高版本。依赖使用仓库中的 `bun.lock` 锁定。

```sh
git clone https://github.com/LZWcc/LZWcc-Blog.git
cd LZWcc-Blog
bun install --frozen-lockfile
bun run dev
```

默认开发地址为 `http://localhost:4321`，以终端实际输出为准。

| 命令                                       | 用途                               |
| ------------------------------------------ | ---------------------------------- |
| `bun run dev`                              | 启动开发服务器，包含草稿           |
| `bun run check`                            | 检查 Astro / TypeScript            |
| `SITE_URL=https://lzwcc.xyz bun run build` | 检查并构建正式站点，输出到 `dist/` |
| `bun run preview`                          | 预览构建结果，不包含草稿           |
| `bun run new --help`                       | 查看新建文章选项                   |

正式构建应显式提供 `SITE_URL`，用于 canonical、RSS 和站点地图。当前 `astro.config.ts` 在未提供该环境变量时回退到 `http://localhost:4321`。

## 写文章

文章位于 `src/content/blog/`，支持 Markdown 和 MDX。新建中文草稿：

```sh
bun run new --lang zh --draft "文章标题"
```

需要 MDX 时追加 `--mdx`，需要独立文章目录时追加 `--folder`。也可以直接新建文件：

```yaml
---
title: 文章标题
description: 文章简介
publishDate: 2026-10-20
tags:
  - 开发笔记
draft: true
comment: false
---
```

日期按实际写作时间填写。草稿可通过 `bun run dev` 在 `/blog/<文章文件名>` 查看，生产构建会排除 `draft: true` 的文章。审核通过后，将 `draft` 改为 `false` 才会进入发布内容；`comment` 控制该文章是否显示评论。

## 配置与部署

- `astro.config.ts`：站点 URL、构建与 Markdown 配置。
- `src/site.config.ts`：站点信息、导航、评论和统计配置。
- `src/content.config.ts`：文章元数据校验规则。
- `public/`：直接复制到构建产物的静态资源。
- `.github/workflows/deploy.yml`：GitHub Actions 构建和 rsync 部署流程。

目前使用自建 Artalk 评论，评论者 IP 与访问明细由独立项目 blog-admin 提供；旧 Remark42、Waline 组件保留用于回退。部署与备份方式见 [评论运维说明](docs/comments.md)。搜索使用 Pagefind，访问统计使用自建 Umami。部署、历史数据导入和维护方式见 [Umami 运维说明](docs/umami.md)。Umami Cloud 免费版可收集访问统计，但 API 访问需要 Pro 套餐。缺少网站 ID、API Key 或 API 请求失败时，构建会写出 `null`，页面显示 `— views`，避免把统计不可用误报为零访问。

默认 `/stats/pageviews.json` 是构建时生成的快照，不会随访问实时变化。`preset/scripts/syncPageviews.ts` 可打包成独立 Node.js 脚本，配合 `preset/deploy/blog-pageviews.service` 和 `.timer` 每 10 分钟同步；请求失败时保留旧快照。定时任务需要单独配置有效的 API 访问权限，并不会随博客静态部署自动安装。

工作流在 `main` 分支的 `src/**`、`public/**`、`package.json` 或 `bun.lock` 发生推送变更时触发，构建后将 `dist/` 同步至服务器 `/var/www/blog/`。仅修改 README 不会触发部署。

GitHub Actions 使用以下仓库配置：

| 类型      | 名称                                                 | 用途                                     |
| --------- | ---------------------------------------------------- | ---------------------------------------- |
| Secrets   | `SITE_URL`                                           | 正式站点地址，设置为 `https://lzwcc.xyz` |
| Secrets   | `REMOTE_HOST`、`REMOTE_USER`、`SSH_PRIVATE_KEY`      | 服务器 SSH 连接                          |
| Secrets   | `UMAMI_API_KEY`                                      | 构建时读取浏览量统计                     |
| Variables | `PUBLIC_UMAMI_SCRIPT_URL`、`PUBLIC_UMAMI_WEBSITE_ID` | Umami 脚本和网站标识                     |
| Variables | `UMAMI_API_CLIENT_ENDPOINT`、`UMAMI_STATS_START_AT`  | Umami API 地址和统计起始日期             |

工作流还传入了历史变量 `VITE_WALINE_SERVER`，当前已禁用的 Waline 不依赖它。凭据不要写入源码或 README。本地 `.env` 已被 Git 忽略；正式构建以上面的显式环境变量为准。

部署使用 rsync 的 `--delete`，会删除目标目录中构建产物不存在的文件；`/var/www/blog/` 应专门用于博客静态文件。

## 文章赞赏

文章底部的咖啡入口指向 `/projects#sponsorship`。赞赏区采用微信和支付宝双卡片：桌面悬停或键盘聚焦显示清晰收款码，手机直接显示，点击可查看原图。

将自己的收款码放入 `src/assets/sponsorship/`，分别命名为 `wechat.png` 和 `alipay.png`（也支持 `.jpg`、`.jpeg`、`.webp`，每种方式保留一张）。重新构建后会自动启用对应卡片；未提供图片时显示「收款码待添加」，无法进行赞赏。

## 主题与许可

主题使用说明见 [Astro Pure 文档](https://astro-pure.js.org/docs)。

博客文本内容以 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 协议发布；主题代码的 Apache 2.0 许可见 [LICENSE](./LICENSE)。
