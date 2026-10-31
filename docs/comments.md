# 评论运维说明

评论使用自建 [Artalk](https://artalk.js.org)，和博客部署在同一台服务器。评论者 IP、邮箱、设备和访问明细由独立项目 blog-admin 提供，本仓库不包含后台代码。

## 组成

- 前端：`src/components/artalk/`，配置在 `src/site.config.ts` 的 `artalkConfig`。评论按 `src/utils/commentPath.ts` 统一后的路径归属页面，从 Waline、Remark42 迁入的历史评论也按这个规则归属。
- 服务：`preset/deploy/blog-artalk.service`，监听 `127.0.0.1:23366`，数据在 `/opt/blog-comments/data/`。
- 反向代理：`preset/deploy/blog-comments.nginx.conf`，`/comments/` 直接转给 Artalk。Artalk 从 `X-Real-IP` 读取访客 IP（`artalk.yml` 的 `http.proxy_header`），登录验证码和频率限制都按这个 IP 计算。
- 属地：Artalk 自带的 IP 属地（`artalk.yml` 的 `ip_region`，省级精度，数据库 `data/ip2region.xdb`）。
  数据库必须是旧格式。ip2region 在 2025-09 去掉了「区域」一列，Artalk 2.10 仍按旧格式取第 3 列作省份，换成新的 `ip2region_v4.xdb` 会把城市当成省份显示。线上用的是 ip2region 提交 `27b5efde55`（2024-02）里的 `data/ip2region.xdb`。
- 头像：从 Remark42 迁来的 2 个用户头像在 `public/images/comment-avatars/`，按 Artalk 用户 ID 写在 `artalkConfig.avatars`；其他用户使用 Gravatar。

公开接口不返回 IP 和邮箱。浏览器标识（UA）会随评论数据返回，前端不显示。

## 备份

`preset/scripts/backupComments.ts` 每天 03:20（`blog-comments-backup.timer`）在线备份 `artalk.db`，连同 `artalk.yml`（其中的 app key 用于签发登录 token）打包到 `/opt/blog-comments/daily-backups/`，保留 14 份。需要 Node.js 22.16+。

```sh
bun build preset/scripts/backupComments.ts --target=node --outfile=dist-tools/backup-comments.mjs
```

备份和数据库在同一台服务器上，防不了整机故障。

生产凭据、数据库、日志和备份不放进本仓库。
