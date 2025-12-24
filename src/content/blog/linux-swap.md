---
title: Linux 配置虚拟内存Swap
description: '轻量云主机还是不太够用啊...'
publishDate: 2025-12-24 22:19:32
tags:
  - linux
---
### 一、 为什么要开启 Swap？

当物理内存（RAM）不足时，Linux 内核会将不常用的数据交换到磁盘上的 Swap 空间，从而腾出物理内存给活跃进程。

* **防止崩溃** ：避免因 Out of Memory 导致进程随机被杀或 SSH 断开。
* **应对突发流量** ：如 VS Code 远程连接时瞬间启动多个 Node.js 进程。

---

### 二、 环境检查

在操作前，先确认当前内存和磁盘状态：

1. **查看内存状态** ：`free -h`（如果 Swap 行为 0B，则未开启）。
2. **查看磁盘空间** ：`df -h`（确保磁盘有足够空间创建 4G 的文件）。

---

### 三、 核心配置步骤

#### 1. 创建交换文件 

```bash
# 创建一个 4GB 的文件 (1M * 4096)
dd if=/dev/zero of=/var/swapfile bs=1M count=4096
```

#### 2. 设置安全权限 

Swap 文件权限必须设置为仅 root 用户可读写，否则系统会出于安全原因拒绝挂载。

```bash
chmod 600 /var/swapfile
```

#### 3. 格式化为 Swap 格式

```bash
mkswap /var/swapfile
```

#### 4. 激活 Swap

手动启用该文件作为交换空间。

```bash
swapon /var/swapfile
```

#### 5. 验证结果 (Verification)

再次检查内存，此时 Swap 栏应显示已分配的大小。

```bash
~ free -h
               total        used        free      shared  buff/cache   available
Mem:           1.9Gi       1.5Gi        89Mi       1.8Mi       522Mi       438Mi
Swap:          4.0Gi       524Ki       4.0Gi
```

---

### 四、 永久生效配置

如果不执行这一步，服务器重启后 Swap 会失效。

**操作：** 将挂载信息写入 `/etc/fstab` 文件。

```bash
echo "/var/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
```

> **参数说明：**
>
> * `/var/swapfile`: 文件路径。
> * `none`: 挂载点（Swap 没有目录挂载点，填 none）。
> * `swap`: 文件系统类型。
> * `sw`: 挂载选项。
> * `0 0`: 不进行 dump 备份和 fsck 检查。

---

### 五、 故障排查

* **路径错误** ：确保 `fstab` 里的路径与 `dd` 创建的路径完全一致（如 `/var/swapfile` vs `/swapfile`）。
* **权限不足** ：如果报错 `swapon: /var/swapfile: insecure permissions`，请务必执行 `chmod 600`。
* **重复写入** ：如果多次执行 `echo >> /etc/fstab`，请用 `vi /etc/fstab` 检查并删除重复行，防止系统启动异常。
