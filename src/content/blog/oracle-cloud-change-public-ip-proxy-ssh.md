---
title: Oracle 云服务器更换公网 IP 后恢复代理与 SSH
description: 记录 Oracle Cloud 实例更换临时公网 IP、恢复 SSH、更新 VLESS/Reality 节点并核对云端与主机防火墙的流程。
publishDate: 2026-10-25 23:16:05
tags:
  - Oracle Cloud
  - SSH
  - 代理
comment: false
authorship:
  mode: generated
  models: [Claude Opus 5.5]
category: postmortem
---

## 要解决的问题

一台 Oracle Cloud 实例的公网 IP 被更换后，通常会同时影响三处：

1. 本地 SSH 配置里的 `HostName`。
2. Mihomo 和 Shadowrocket 里的 VLESS/Reality 节点地址。
3. 云端安全规则、主机防火墙和外部连通性检查。

这次实例使用的是临时公网 IP。更换后，私有 IP、实例磁盘、`sing-box` 服务和代理端口都不需要跟着改变；需要更新的是指向旧公网 IP 的配置引用。

本文使用占位符，避免把真实信息写进公开文章：

| 占位符 | 含义 |
| --- | --- |
| `<INSTANCE_OCID>` | OCI 实例 OCID |
| `<REGION>` | OCI 区域标识 |
| `<OLD_PUBLIC_IP>` | 更换前的公网 IPv4 地址 |
| `<NEW_PUBLIC_IP>` | 更换后的公网 IPv4 地址 |
| `<PRIVATE_IP>` | 实例的私有 IPv4 地址 |
| `<SSH_ALIAS>` | 本地 `~/.ssh/config` 中的主机别名 |
| `<PROXY_PORT>` | 客户端实际使用的 VLESS/Reality TCP 端口 |

## 方案和原因

### 1. 先确认正在操作正确的实例

OCI 控制台中可能同时有 AMD 和 ARM 实例。先确认实例名称、架构、私有 IP 和当前公网 IP，再进入网络设置。不要只凭浏览器地址栏中的 OCID 判断目标。

脱敏后的控制台地址形如：

```text
https://cloud.oracle.com/compute/instances/<INSTANCE_OCID>?region=<REGION>
```

目标实例的页面路径是：

```text
计算（Compute）
  → 实例（Instances）
  → 目标实例
  → 网络（Networking）
  → 向下滚动到“附加的 VNIC”（Attached VNIC）
  → 点击“名称”列中的蓝色 VNIC 名称
  → IP 管理（IP administration）
```

### 2. 在 OCI 中更换临时公网 IP

进入“IP 管理”后，在“IPv4 地址”区域找到主要私有 IP 所在的那一行。不要点击上方的“分配辅助专用 IP 地址”，而是点击该行最右侧的三个点（`...`）并选择“编辑”。

1. 记录当前私有 IP、当前公网 IP 和路由表，确认私有 IP 不要改变。
2. 在编辑面板中，只把“公共 IP 类型”改成“没有公共 IP”，然后点击右下角的“更新”。这一步会解除旧的临时公网 IP；私有 IP、CIDR 前缀和路由表不要改。
3. 页面返回 IPv4 地址列表后，再次点击同一行最右侧的三个点，选择“编辑”。
4. 这次把“公共 IP 类型”改成“临时公共 IP（Ephemeral public IP）”，再次点击“更新”。OCI 会为这个私有 IP 分配新的临时公网 IP。
5. 等待 IPv4 地址行显示新的公网 IP，再进行 SSH 和端口验证。

这次使用的是临时 IP。如果需要在停止、释放或重新分配资源后仍保持地址，应改用预留公共 IP（Reserved public IP），但它的生命周期和费用策略需要单独确认。

更换过程中已有 SSH 会话可能断开，这是预期现象。不要在旧连接尚未确认失效前关闭所有终端，保留一个本地终端用于重新连接。

### 3. 验证服务器实际出口地址

重新连接后，从服务器内部分别通过两个独立的公网地址查询服务确认出口地址；两次结果都应为 `<NEW_PUBLIC_IP>`。再查看网络接口和路由，确认私有 IP 与默认路由没有变化。

只看到 OCI 页面变化还不够；从实例内部确认出口地址，才能排除页面缓存、操作了错误实例或公网 IP 尚未生效的情况。

### 4. 更新本地 SSH 别名

先备份本地 SSH 配置，只修改目标别名下的 `HostName`。

配置中的变化应类似：

```sshconfig
Host <SSH_ALIAS>
    HostName <NEW_PUBLIC_IP>
```

如果原来是 `<OLD_PUBLIC_IP>`，只替换这一项；用户名、端口、身份文件、跳板机和其他主机块都保持不变。修改后重新用 `<SSH_ALIAS>` 登录，并确认解析到新地址。

如果同一台实例只是换了公网 IP，SSH 主机指纹通常应保持不变。出现 `REMOTE HOST IDENTIFICATION HAS CHANGED` 时，先核对实例和指纹，不要直接批量删除 `known_hosts`。

### 5. 更新 Mihomo 和 Shadowrocket 节点

本次只更新两个配置文件中 AMD 实例节点的地址字段：

```text
server: <OLD_PUBLIC_IP>  →  server: <NEW_PUBLIC_IP>
```

Shadowrocket 的等价变化是 VLESS 节点的第二个字段：

```text
vless-Oracle-Reality = vless,<OLD_PUBLIC_IP>,<PROXY_PORT>,...
vless-Oracle-Reality = vless,<NEW_PUBLIC_IP>,<PROXY_PORT>,...
```

`...` 代表 UUID、流控、TLS/Reality 公钥和指纹等字段，不能把真实值贴到博客或聊天记录里。更换公网 IP 时，端口、UUID、Reality 参数和节点名称都不应无理由改变。

ARM 实例对应的节点地址保持不变。两个配置中的 SSH 分流也是按 SSH 进程或目标端口 `22` 匹配，并没有绑定 AMD 的旧 IP，所以这次不需要改 SSH 分流逻辑；如果配置里存在某个明确写死旧 IP 的规则，才需要单独替换。

### 6. 检查云端和主机防火墙

端口是否可用，取决于三层设置的交集：

1. OCI 子网的 Security List 或实例绑定的 Network Security Group。
2. 服务器操作系统的 `ufw`、`firewalld` 或 `iptables/nftables`。
3. 服务是否真的监听该端口，以及客户端是否使用该端口。

SSH 管理端口和代理端口用途不同：SSH 的 `22/tcp` 用来登录服务器，`<PROXY_PORT>/tcp` 用来接收 VLESS/Reality 客户端连接。两者都需要时才同时放行；另一个只是在 `sing-box` 配置中监听、但没有客户端引用的端口，不应因为“正在监听”就自动暴露到公网。

服务器侧需要确认服务监听、`ufw`/`firewalld` 状态以及 `iptables`/`nftables` 的实际规则。云端则从实例的主要 VNIC 进入子网和安全列表，确认入站规则至少覆盖：

```text
TCP 22             ← SSH，来源按管理需要限制
TCP <PROXY_PORT>   ← 代理，来源按使用场景限制
```

再从外部分别测试 SSH 和代理端口。TCP 层可达只能证明网络路径和防火墙基本匹配，不代表 SSH 登录成功，也不代表代理协议、TLS/Reality 握手和实际流量都成功。

