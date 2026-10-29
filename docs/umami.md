# 自建 Umami 与博客阅读数（公开说明）

博客使用自建 Umami 和 PostgreSQL 提供访问统计，通过定时任务每 10 分钟更新文章阅读数。统计趋势与管理员请求明细用途不同，请求数不等于独立访客人数。

## 计数行为

- 文章阅读次数取页面浏览次数，不使用去重访客数代替。
- 路径规范化后合并计数，避免域名、查询参数或尾斜杠导致重复讨论和统计分裂。
- 统计不可用时前端显示 `— views`，不把失败误报为零浏览。
- 定时同步失败时保留上次成功快照。

## 开发与部署模板

- `preset/deploy/umami.compose.yml`：容器部署模板，密钥由环境变量注入。
- `preset/scripts/importUmamiCloud.py`：历史导出数据的导入工具，保留事件 ID 并按 ID 去重。
- `preset/deploy/backup-umami.sh`：数据库备份脚本。
- GitHub Actions 的真实密钥通过 Secrets 配置，不写入源码或静态产物。

升级和迁移前应备份并验证恢复；导入工具应先核对实际导出格式。原始统计导出、SQL、数据库、日志和备份均包含私有数据，不应进入公开仓库。

生产环境布局、真实凭据位置、迁移记录及维护命令保存在仓库外的私有运维文档中。本文件只保留适合公开的设计说明。

## 验证

```sh
bun test tests/umami-pageviews.test.ts
python3 -m unittest discover -s tests -p 'test_*.py'
SITE_URL=https://lzwcc.xyz bun run build
```
