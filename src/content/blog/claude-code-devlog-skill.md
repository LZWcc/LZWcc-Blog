---
title: 用一个 skill 让 Claude 把开发过程写进博客
description: AI 写的开发记录又长又爱下结论，每次还要重复交代博客的格式和检查方法。把这些规矩做成一个 Claude Code skill：一段让 Claude 建 skill 的提示词，加上完整内容。
publishDate: 2026-10-21 17:41:04
tags:
  - Claude Code
  - Skill
  - 博客
draft: false
comment: false
authorship:
  mode: generated
  models: [Claude Opus 5.5]
category: project
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

这个 skill 有两份：lxc 上 Claude Code 用的 `~/.claude/skills/devlog/`，和 Mac 上 Codex 用的 `~/.codex/skills/devlog/`。内容一样，只有路径和执行方式不同。改规则、`posts.md` 或 `check.sh` 时两边一起改。

**文章是给读者看的完成品**，只写做完、验证过的东西。需求清单、进度、"接下来"、待办都不写进文章。还没做完的部分不提，等做完再写。

## 步骤

1. **确定写进哪篇**。本目录的 `posts.md` 记着项目和文章的对应关系。已有文章的，把新内容并进去：放进对应的小节，过时的内容直接改掉，不要在末尾追加"更新"段落。新主题就新建一篇，并在 `posts.md` 补上对应关系。不确定写进哪篇时问用户。
2. **写**。规则见下面"文章怎么写"。改已有文章时，先用 `grep -n '^## \|^### '` 看结构，再按需要 `sed -n` 读相关部分，不要整篇读进来。
3. **检查**。新文章设置 `publishDate`。已有文章默认不动日期：列表按 `updatedDate`（没有就用 `publishDate`）排序，设了 `updatedDate` 的旧文章会跑到最前面，只有用户想让它重新排到前面时才设。然后运行 `check.sh`。
4. **回复**。列出改了哪几处，每处一句，不要贴全文。用户没要求就不要提交。
5. **看一眼首页的「正在做」**。博客首页左栏的「正在做」写在 `src/pages/index.astro` 的 `NOW` 数组里（标题和一句说明是手写的，进度数字和最近提交日期是自动的）。这次的工作做完了其中一件，或者开始了一件新的、要做一阵子的事，在回复末尾问用户要不要改，同意了再改。

## 文章怎么写

用户自己说过，这些内容"和 AI slop 没什么区别"。所以目标是短、准、能照着用，不追求好看。

- **按主题组织，不按日期**。一般的顺序是：要解决的问题 → 方案和原因 → 怎么用 → 踩过的坑（表格，三列：现象 / 原因 / 解决）→ 附录（设置清单、命令汇总）。
- **踩坑表只写真坑**：实际让东西坏过、换个人做同样的事也可能碰上的才写。只在本地开发时出现、线上本来就没事的，写文章过程中（截图、构建预览）遇到的小插曲，自己的笔误，都不写。
- **附录只放读者能照着用的**（命令汇总、设置清单）。正文已经写过的、仓库内部的文件清单和数据结构不放；只有一小段代码时直接放在正文讲到它的地方，不单开附录。
- **同一件事只写一处**。设置项和命令放进附录，正文引用它。
- **只写验证过的事**。实测过的写结果，个别没验证的细节要写明"没测过"。体感类结论（顺不顺、卡不卡、好不好用）必须等用户实测后再写，不要用推理改写用户的实测结论。
- **过时的内容直接改掉**，不保留"这段改过几次"之类的过程。
- 文中的"我"是用户本人。不写客套话，不写总结性的空话。
- **篇幅**。一个主题一篇。超过大约 200 行时，先列出精简方案（删什么、合并什么、能省多少行），等用户确认后再改。
- 用户想要"可以直接复制的提示词"时，单独放一节，用 ```` ```text ```` 代码块，写成以后还能复用的通用版本，参考 `voice-input-before-ai-coding.md`。

### 读起来不像 AI

用户读过几篇 AI 写的文章后提的意见，写的时候照着做，写完对照着检查一遍：

- **标题和小标题写这一节讲什么**，如「测量方法」「定位」「缓存头」。不起带悬念或比喻的标题，如「二分找到元凶」「为什么图标这么贵」。
- **不写金句**。不用「X 不是 Y，是 Z」「代价是……」「这一条修的是……」这种先下判断再解释的句式，直接说做了什么、结果是什么。
- **不自我标榜**。不写「不靠猜」「避免偏差」这类强调自己方法严谨的话，方法照实交代。
- **正文不要塞满**。数字只留得出结论需要的那几个；完整数据、改了哪些文件、命令放进附录。正文给人读，附录给 AI 补上下文。
- **不拆碎句子，不硬加口语**。句子保持完整连贯。拆成一句一件事的短句、加「那就不猜了」这类刻意的口语转折，用户读着更像 GPT。
- **配图只配能当证据的**，比如测试结果的截图；示意性的、为了好看的图不配。截图裁掉无关部分（尺寸见「格式和检查」）。

## 和 ui-motion-lab 的分工

用户的作品站 ui-motion-lab（https://lab.lzwcc.xyz）放成品，回答"做出了什么"；博客放过程，回答"怎么做的"。写作品或项目相关的文章时，博客写方案理由、踩坑、命令，不重复写成品展示，开头一句链到作品站的项目页；作品站那边不写踩坑和安装命令。完整约定见 ui-motion-lab 仓库的 `CLAUDE.md`「和博客的分工」。

## 格式和检查

- 日期格式：`publishDate: 2026-10-21 10:24:18`，不加引号，不带时区，这是项目的惯例。`updatedDate` 也用这个格式。时间取 Mac 当前时间：`date '+%Y-%m-%d %H:%M:%S'`。
- 署名：frontmatter 写 `authorship`，显示在文章顶部日期那一行。你写的新文章是 `mode: generated`、`models: [Claude Opus 5.5]`（写你自己当前的模型名，用正式写法）。并进已有文章时，`models` 里没有你就补在后面，原来是 `human` 的改成 `assisted`。`human`（手写）只在用户说是自己写的时候用。2026 年 5 月以前没有署名的旧文章不用补。
- 分类：frontmatter 写 `category`，首页按它分栏，一篇只填一个：`project`（自己做的东西的开发记录）、`postmortem`（线上问题和排障）、`tooling`（开发环境、AI 工具的配置和工作流）、`study`（课程、刷题、面试、教程）。按文章写的是什么选，和 AI 参与了多少无关（那个看署名）。拿不准时问用户。
- title 不超过 60 个字符，description 不超过 160 个字符（`src/content.config.ts` 会校验）。
- 站内链接写成 `/blog/<slug>/`。
- 文件名就是文章地址，新文章用小写英文加连字符（`lab-performance`）。没有配图用 `<slug>.md`，有配图用 `<slug>/index.md`，图片和它放在同一个目录，不再套子目录。旧文章的文件名不改，改了已有链接会失效。
- 配图：文章改成目录 `<slug>/index.md`，图片放同目录，`![说明](./x.webp)` 引用。截图按 2 倍像素导出：整页截图用 1280 宽的视口、像素比 1 截，不要再缩小。正文栏宽 760px，图片会缩到栏宽显示；640px 的图在 Retina 屏上会糊，首页动态的缩略图也要 720px 宽的源图。只截一块的图，按想要的显示宽度的 2 倍截，并裁掉无关部分。截首页时注意中间动态里的配图缩略图：换了文章配图后要重截，否则拍进去的是旧图。删掉或改名图片后 dev 服务器报 `ImageNotFound`：`.astro/data-store.json` 还记着旧的图片列表，停掉 dev、删 `.astro/data-store.json` 和 `.astro/content-assets.mjs` 再启动。
- 检查（frontmatter、页内锚点、`astro build`）：`ssh lzwcc bash -s -- <slug> < ~/.claude/skills/devlog/check.sh`。提交前加 `full`，跑完整的 `bun run build`（和 GitHub Actions 一样，博客用 bun）：`bash -s -- <slug> full`。
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
export PATH=$HOME/.nvm/versions/node/v22.20.0/bin:/opt/homebrew/bin:$PATH

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
m = re.search(r'^authorship:\n((?:  .*\n)+)', fm + '\n', re.M)
pd = re.search(r'^publishDate:\s*[\'"]?(\d{4}-\d\d)', fm, re.M)
if m:
    print('OK  authorship ' + ' '.join(l.strip() for l in m.group(1).splitlines()))
elif pd and pd.group(1) >= '2026-06':
    print('WARN authorship 没填（AI 写过或改过的文章要填）')
m = re.search(r'^category:\s*(\S+)', fm, re.M)
if m:
    print(('OK  ' if m.group(1) in ('project', 'postmortem', 'tooling', 'study') else 'BAD ') + 'category ' + m.group(1))
elif pd and pd.group(1) >= '2026-06':
    print('WARN category 没填（首页按它分栏）')
PY

node --input-type=module -e "
import S from 'github-slugger'; import fs from 'fs';
const s = new S(); const md = fs.readFileSync('$f', 'utf8');
const ids = new Set(md.split('\n').filter(l => /^#{2,4} /.test(l)).map(l => s.slug(l.replace(/^#+ /, ''))));
let n = 0;
for (const m of md.matchAll(/\]\(#([^)]+)\)/g)) { n++; console.log((ids.has(m[1]) ? 'OK   锚点 ' : 'MISS 锚点 ') + m[1]); }
if (!n) console.log('OK   没有页内锚点');"

if [ "${2:-}" = full ]; then
  (perl -e 'alarm shift; exec @ARGV' 500 bun run build) > /tmp/blog-build.log 2>&1
else
  (perl -e 'alarm shift; exec @ARGV' 300 bunx astro build) > /tmp/blog-build.log 2>&1
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
