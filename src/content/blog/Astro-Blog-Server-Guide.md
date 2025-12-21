---
title: 将 Astro 博客部署到服务器
description: '本教程将指导你如何将本地开发的 Astro 博客部署到服务器，使其能被公开访问。'
publishDate: 2025-12-21 15:47:48
tags:
  - Nginx
  - Astro
---

## 第一步：本地构建静态文件

在项目根目录下运行构建命令：

```bash
bun run build
```

构建成功后，会在项目根目录生成 `dist` 文件夹，里面包含所有静态网页文件。

## 第二步：服务器环境准备

1. 安装 Nginx

   ```bash
   # 更新软件包列表
   apt update

   # 安装 Nginx
   apt install nginx -y

   # 设置为开机自启
   systemctl start nginx
   systemctl enable nginx

   # 检查 Nginx 是否运行
   systemctl status nginx
   ```

2. 创建网站目录

   ```bash
   # 创建博客文件存放目录
   mkdir -p /var/www/blog
   ```

3. 配置 Nginx

   创建一个新的站点配置文件：

   ```bash
   vim /etc/nginx/sites-available/blog
   ```

   粘贴以下内容

   ```nginx
   server {
       listen 80;
       server_name _;  # 如果有域名，替换为你的域名，如 example.com

       root /var/www/blog;	# 指向上传文件的目录, blog里为dist内的所有文件
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # 开启 gzip 压缩
       gzip on;
       gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
   }
   ```

4. 启用站点配置

   ```bash
   # 创建软链接到 sites-enabled 目录
   ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/

   # 重启 Nginx
   systemctl restart nginx
   ```

## 第三步：上传文件到服务器

```bash
scp -r dist/* root@YOUR_SERVER_IP:/var/www/blog/
```
