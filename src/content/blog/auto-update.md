---
title: 使用 GitHub Actions 自动部署 Astro + Bun 博客
description: '不错的尝试...'
publishDate: 2025-12-21 17:14:33
tags:
  - github
---
## 第一步：配置 GitHub Secrets

* 在 GitHub 仓库页面，点击 **Settings** -> **Secrets and variables** ->  **Actions** 。
* 点击  **New repository secret** ，添加以下三个变量：
  * `SSH_PRIVATE_KEY`: 连接服务器的**私钥**
  * `REMOTE_HOST`: 服务器 IP 地址。
  * `REMOTE_USER`: 登录用户名（如 `root`）。

获取私钥:

```bash
cat key.pem
```

结果如下

```
# 全部粘贴到SSH_PRIVATE_KEY中
-----BEGIN RSA PRIVATE KEY-----
私钥....
-----END RSA PRIVATE KEY-----
```

## 第二步：创建Workflow文件

在你项目根目录下，创建文件夹和文件：`.github/workflows/deploy.yml`

```yml
name: Deploy Blog

on:
  push:
    branches: [ main ] # 监听 main 分支的推送

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest # 使用标准的 Linux 环境进行构建
  
    steps:
    # 1. 检出代码
    - name: Checkout code
      uses: actions/checkout@v4

    # 2. 配置 Bun 环境
    # 既然本地用 Bun，CI 环境也建议用 Bun，速度更快且环境一致
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      with:
        bun-version: latest

    # 3. 安装依赖
    # --frozen-lockfile 相当于 npm ci，确保依赖版本与本地 bun.lockb 完全一致
    - name: Install dependencies
      run: bun install --frozen-lockfile

    # 4. 构建项目
    - name: Build project
      run: bun run build

    # 5. 部署到服务器
    - name: Deploy to Server
      uses: appleboy/scp-action@master
      with:
        host: ${{ secrets.REMOTE_HOST }}
        username: ${{ secrets.REMOTE_USER }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        source: "dist/*"           # 上传构建好的 dist 文件夹内容
        target: "/var/www/blog"    # 服务器上的目标目录
        strip_components: 1        # 关键：移除 dist 这一层目录，直接上传内容
```

---

完成之后, 每次 `push`之后网站就会自动更新
