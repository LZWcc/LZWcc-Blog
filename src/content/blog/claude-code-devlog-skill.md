---
title: 用一个 skill 让 Claude 把开发过程写进博客
description: AI 写的开发记录又长又爱下结论，每次还要重复交代博客的格式和检查方法。把这些规矩做成一个 Claude Code skill：一段让 Claude 建 skill 的提示词，加上完整内容。
publishDate: 2026-10-21 17:41:04
tags:
  - Claude
  - Claude Code
  - Skill
  - 博客
draft: false
comment: false
---

我现在开发都是和 Claude 一起做，做完顺手让它写进博客。写[远程用 Claude Code](/blog/claude-code-remote-terminal/)那篇时，有几个问题反复出现：

1. **每次都要重复交代**：博客在哪、文章放哪个目录、日期是什么格式、改完怎么检查、push 为什么会失败。
2. **写得太长**：按日期一天一段往后堆，同一个设置写了三遍，过时的内容也留着。最后连我自己都不想看。
3. **爱用推理下结论**：tmux 滚动顺不顺，它先后写了三个不同的结论，每次都被我实测推翻。

说实话，这些文章和 AI slop 区别不大。但记录本身有用，所以把规矩定下来，做成一个 skill。

一开始我还让文章里带着"需求"和"接下来"，好让下一个会话读了接着做。后来觉得不对：**文章是给读者看的完成品**，进度和待办不该放进去。会话之间的衔接用 `claude -r` 接回原会话，或者开工时直接说一句就够了。

## skill 是什么

Claude Code 的 skill 就是一个目录，里面放一个 `SKILL.md`，开头的 frontmatter 写 `name` 和 `description`：

```
~/.claude/skills/devlog/
├── SKILL.md      # 必须有：name、description + 具体做法
├── posts.md      # 自己加的：项目和文章的对应表
└── check.sh      # 自己加的：检查脚本
```

- `description` 决定什么时候用：Claude 会看到所有 skill 的描述，碰到相关的请求就自己加载。也可以直接敲 `/devlog` 调用，后面跟的文字会作为参数传进去。
- 只有被用到时，`SKILL.md` 的正文才会读进上下文，所以可以写得详细一些。
- 同目录里的其他文件，在 `SKILL.md` 里写清路径就能引用。
- 放进 `~/.claude/skills/` 后，当前会话马上就能用，不用重启（我这次就是这样）。

## 让 Claude 帮你建

把下面这段发给 Claude，把尖括号里的内容换成自己的：

```text
帮我在 ~/.claude/skills/devlog/ 下创建一个 Claude Code skill：我说"写进博客"时，把做完的开发工作写成博客文章，或者并进已有的文章。

- 博客仓库：<博客路径>。先读 2～3 篇已有文章和内容配置（比如 Astro 的 src/content.config.ts），弄清 frontmatter 字段、日期格式、长度限制和站内链接写法，按仓库已有的惯例来。
- 文章是给读者看的完成品：只写做完、验证过的东西，不写需求清单、进度和待办。
- 项目和文章的对应关系记在 skill 目录的 posts.md：已有文章就把新内容并进对应小节、过时的直接改；新主题就新建一篇。拿不准就问我。
- 写作规则：按主题组织，不按日期；同一件事只写一处，设置和命令汇总到附录；踩过的坑用"现象 / 原因 / 解决"表格；没验证的细节要标明，顺不顺、好不好用这类结论等我实测后再写；超过 200 行先给精简方案让我确认；文中的"我"是我本人，不写客套和空话。
- 写一个 check.sh：检查 frontmatter 长度和日期格式、页内锚点是否存在，再跑一次构建。
- 不要自动提交。

写完用一篇已有文章试跑 check.sh，然后告诉我怎么用。
```

如果 Claude 和博客不在同一台机器上（我的 Claude 跑在 VPS、博客在 Mac），在提示词里加一句"博客在另一台机器上，通过 `ssh 主机名` 读写"。

## 我的版本

下面是我实际在用的三个文件，可以拿来对照 Claude 生成的结果。

`SKILL.md`：

````markdown
---
name: devlog
description: 把做完的开发工作写成用户博客（Mac 上的 LZWcc-Blog）里的文章，或者并进已有的文章。用户输入 /devlog，或者说"写进博客""记到博客""写篇文章""更新博客"时使用。
---

博客仓库在 Mac 的 `/Users/lzwcc/Documents/Code/LZWcc-Blog`（Astro），文章放在 `src/content/blog/<slug>.md`。读写都通过 `ssh lzwcc`，改文件按全局 CLAUDE.md 的 python 精确替换来做。

**文章是给读者看的完成品**，只写做完、验证过的东西。需求清单、进度、"接下来"、待办都不写进文章。还没做完的部分不提，等做完再写。

## 步骤

1. **确定写进哪篇**。本目录的 `posts.md` 记着项目和文章的对应关系。已有文章的，把新内容并进去：放进对应的小节，过时的内容直接改掉，不要在末尾追加"更新"段落。新主题就新建一篇，并在 `posts.md` 补上对应关系。不确定写进哪篇时问用户。
2. **写**。规则见下面"文章怎么写"。改已有文章时，先用 `grep -n '^## \|^### '` 看结构，再按需要 `sed -n` 读相关部分，不要整篇读进来。
3. **检查**。设置 `publishDate`（新文章）或 `updatedDate`（已有文章），然后运行 `check.sh`。
4. **回复**。列出改了哪几处，每处一句，不要贴全文。用户没要求就不要提交。

## 文章怎么写

用户自己说过，这些内容"和 AI slop 没什么区别"。所以目标是短、准、能照着用，不追求好看。

- **按主题组织，不按日期**。一般的顺序是：要解决的问题 → 方案和原因 → 怎么用 → 踩过的坑（表格，三列：现象 / 原因 / 解决）→ 附录（设置清单、命令汇总）。
- **同一件事只写一处**。设置项和命令放进附录，正文引用它。
- **只写验证过的事**。实测过的写结果，个别没验证的细节要写明"没测过"。体感类结论（顺不顺、卡不卡、好不好用）必须等用户实测后再写，不要用推理改写用户的实测结论。
- **过时的内容直接改掉**，不保留"这段改过几次"之类的过程。
- 文中的"我"是用户本人。不写客套话，不写总结性的空话。
- **篇幅**。一个主题一篇。超过大约 200 行时，先列出精简方案（删什么、合并什么、能省多少行），等用户确认后再改。
- 用户想要"可以直接复制的提示词"时，单独放一节，用 ```` ```text ```` 代码块，写成以后还能复用的通用版本，参考 `voice-input-before-ai-coding.md`。

## 格式和检查

- 日期格式：`publishDate: 2026-10-21 10:24:18`，不加引号，不带时区，这是项目的惯例。`updatedDate` 也用这个格式。时间取 Mac 当前时间：`date '+%Y-%m-%d %H:%M:%S'`。
- title 不超过 60 个字符，description 不超过 160 个字符（`src/content.config.ts` 会校验）。
- 站内链接写成 `/blog/<slug>/`。
- 检查（frontmatter、页内锚点、`astro build`）：`ssh lzwcc bash -s -- <slug> < ~/.claude/skills/devlog/check.sh`。提交前加 `full`，跑完整的 `npm run build`：`bash -s -- <slug> full`。
- 提交时只 `git add` 对应的文章，提交说明不加 AI 署名。push 走 HTTPS 和钥匙串，通过 ssh 执行会失败（`-25308`），要请用户在 Mac 本地执行 `git push`。
````

`posts.md`：

```markdown
# 项目 → 博客文章

项目目录指本机的 `/home/lzwcc/workspace/<目录>`，文章在 Mac 的 `LZWcc-Blog/src/content/blog/` 下。

| 项目目录 | 文章 | 内容 |
|---|---|---|
| terminal-optimization | claude-code-remote-terminal.md | 远程用 Claude Code：iTerm2 + tmux -CC、多 agent 侧栏 ag（`~/.local/bin/ag`）、通知。剪贴板桥做完后另写一篇 |
| （devlog skill 本身，`~/.claude/skills/devlog`） | claude-code-devlog-skill.md | 用 skill 把开发过程写进博客：建 skill 的提示词、完整内容 |
```

`check.sh`：

```bash
#!/bin/bash
# 在 Mac 上检查一篇博客文章：frontmatter 长度、页内锚点、构建。
# 用法（在本机执行）：ssh lzwcc bash -s -- <slug> [full] < ~/.claude/skills/devlog/check.sh
set -u
slug=${1:?用法: check.sh <slug> [full]}
cd ~/Documents/Code/LZWcc-Blog || exit 1
f=src/content/blog/$slug.md
[ -f "$f" ] || f=src/content/blog/$slug/index.md
[ -f "$f" ] || { echo "找不到文章: $slug"; exit 1; }
export PATH=$HOME/.nvm/versions/node/v22.20.0/bin:$PATH

echo "== ${f}（$(wc -l < "$f" | tr -d ' ') 行）"
/usr/bin/python3 - "$f" <<'PY'
import re, sys
s = open(sys.argv[1], encoding='utf-8').read()
fm = s.split('\n---\n', 1)[0]
for k, limit in (('title', 60), ('description', 160)):
    m = re.search(rf'^{k}: (.*)$', fm, re.M)
    v = m.group(1).strip().strip('\'"') if m else ''
    print(f"{'OK  ' if v and len(v) <= limit else 'BAD '}{k} {len(v)}/{limit}")
for k in ('publishDate', 'updatedDate'):
    m = re.search(rf'^{k}: (.*)$', fm, re.M)
    if m:
        ok = re.fullmatch(r'\d{4}-\d\d-\d\d \d\d:\d\d:\d\d', m.group(1))
        print(f"{'OK  ' if ok else 'BAD '}{k} {m.group(1)}")
PY

node --input-type=module -e "
import S from 'github-slugger'; import fs from 'fs';
const s = new S(); const md = fs.readFileSync('$f', 'utf8');
const ids = new Set(md.split('\n').filter(l => /^#{2,4} /.test(l)).map(l => s.slug(l.replace(/^#+ /, ''))));
let n = 0;
for (const m of md.matchAll(/\]\(#([^)]+)\)/g)) { n++; console.log((ids.has(m[1]) ? 'OK   锚点 ' : 'MISS 锚点 ') + m[1]); }
if (!n) console.log('OK   没有页内锚点');"

if [ "${2:-}" = full ]; then
  (perl -e 'alarm shift; exec @ARGV' 500 npm run build) > /tmp/blog-build.log 2>&1
else
  (perl -e 'alarm shift; exec @ARGV' 300 npx astro build) > /tmp/blog-build.log 2>&1
fi
echo "build exit=$?"; grep -E '^- [0-9]+ errors' /tmp/blog-build.log; tail -1 /tmp/blog-build.log
```

## 怎么用

| 什么时候 | 输入 | 它会做什么 |
|---|---|---|
| 一部分做完、踩了坑、实测出结论 | `/devlog`，或者直接说"写进博客" | 找到对应文章并入，或者新建一篇；更新日期，跑 `check.sh`，列出改了哪几处 |
| 文章太长 | "精简一下" | 先列出删什么、合并什么，确认后再改 |
| 要发布 | "提交吧" | 先跑完整构建，只 add 这篇，提交说明不加 AI 署名；push 要我在 Mac 本地执行 |

几条规则是踩坑踩出来的：

- **体感结论等实测**：这是 Claude 最容易犯的错。它会根据原理推出"应该很顺"，写得很肯定，结果和实际体验相反。
- **过时内容直接改**：保留修改过程只会让文章越来越长，对读者没有帮助。
- **没做完的不写**：做到一半的东西写进去，读者看到的就是一篇没有结尾的文章。
