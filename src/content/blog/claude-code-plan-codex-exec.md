---
title: Claude Code 写计划、Codex 执行：跨机器自动派活与验收
description: Claude Code 跑在服务器上，代码和 Codex 在 Mac 上。用 codex exec 和 resume 让 Claude Code 自动把计划交给 Codex、验收、反馈、循环；文末附一段可以直接粘贴给 Claude Code 的项目级配置提示词。
publishDate: '2026-10-19T22:40:01+08:00'
updatedDate: '2026-10-20T13:22:28+08:00'
tags:
  - Claude
  - Codex
  - AI
draft: false
comment: false
---

我的开发方式是：Claude Code 跑在服务器上，项目代码、依赖、构建和测试都在 Mac 上，Claude Code 通过 `ssh` 操作 Mac。Codex CLI 也装在这台 Mac 上，额度一直用不完。

于是想换个分工：**Claude Code 负责写计划和验收，Codex 负责写代码。** 以前试过 Claude Code 的 Plan 模式，但每次都要手动把计划复制给 Codex，再把 Codex 的结果复制回来，太麻烦。

目标是：我只说一句「写好计划，让 Codex 执行」，Claude Code 就自动完成「派活 → 等待 → 验收 → 反馈 → 再执行」的循环，直到通过或者需要我拍板。

文末有一段完整的配置提示词，在新服务器的项目目录里打开 Claude Code，整段粘贴给它就能配好。

## 一、整体流程

```text
我：「写好计划，让 Codex 执行」
 └─ Claude Code：读代码，写计划和验收标准
     └─ ssh 到 Mac，用 nohup 独立运行 codex exec（计划从文件读入）
         （Claude Code 后台等待结果，结束时收到通知；Claude Code 中断了 Codex 也照常跑完）
     └─ 审查：逐个文件读 diff + 自己跑检查和测试，对照验收标准，结论记进运行目录
         ├─ 不通过 → codex exec resume <session id>，把必须改的问题发回去 → 再审查
         └─ 通过   → 做项目规定的收尾（构建、部署等），按固定格式汇报
     └─ 最多 3 轮还不通过，停下来问我
```

### 为什么能循环

`codex exec` 看起来是一次性的：发一段提示、拿一段结果。但 Codex CLI 有 `codex exec resume <SESSION_ID>`，会接着同一个会话继续，前面读过的代码、跑过的命令它都记得。

实测（codex-cli 0.163.0）：第一轮让 Codex 把文件改成打印 2 并运行；第二轮用 `resume` 发「把你刚才改的那个文件再改成打印 3，并告诉我上一轮看到的输出」，它改的是同一个文件，也答出了上一轮的输出 `2`。

循环由 Claude Code 驱动：Claude Code 这边始终是同一段对话，Codex 那边始终是同一个 session，每轮只补发一段反馈。

## 二、规则怎么放

服务器上 Claude Code 的规则里写满了「先 ssh 到 Mac」「用 heredoc」「用 python 精确替换改代码」。这些对 Codex 是错的：Codex 就在 Mac 上，直接改文件就行。

解决办法不是写两套规则，而是**按读者拆开**。同一句「在仓库根目录运行 `pnpm check`」，Codex 读到直接执行；Claude Code 读到，按远程约定包一层 `ssh 主机 bash -s` 再执行。所以项目规则只要写成**不提执行方式的中性写法**，两边就能共用一份。

服务器可能多人共用，不一定能改 `~/.claude` 下的用户级配置，所以 Claude Code 这边的东西全部放在**项目级**，也就是服务器上的项目目录里：

| 内容                                                       | 放在哪                                                      | 谁读                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| 远程开发约定（ssh、heredoc、精确替换）+ Mac 主机和仓库路径 | 服务器项目目录 `CLAUDE.md`                                  | Claude Code                            |
| 派活流程（写计划、启动、验收、续接、轮数上限）             | 服务器项目目录 `.claude/skills/codex-exec/SKILL.md`         | Claude Code                            |
| 会话开始时读入 Mac 上的 `AGENTS.md`                        | 服务器项目目录 `.claude/settings.json` 的 SessionStart hook | Claude Code                            |
| 项目规则（版本、命令、测试、代码约定、禁忌）               | **Mac 上仓库根目录的 `AGENTS.md`**，唯一来源                | Codex 自动读；Claude Code 由 hook 读入 |
| 每次的计划、反馈、日志                                     | Mac 上 `~/.cache/cx-runs/<本次>/`                           | Codex / 留档                           |

每个任务的运行目录记录了这个任务的全部状态：计划、每轮反馈、Codex 的事件流和总结、退出码、Claude 每轮的审查结论、最终汇报。几个作用：

- Codex 的 session id 在 `--json` 事件流的第一行，续接要用。
- Claude Code 只读 Codex 的最后一条回复（`-o`），不读整个事件流，省的是 Claude 的额度。
- Claude Code 中断后，新会话靠这些文件判断任务进行到哪一步，接着往下做。

这些都不放进项目仓库，随时可以删。

## 三、配置提示词

前提：服务器能免密 `ssh` 到 Mac，Mac 上已安装并登录 Codex CLI。

在服务器上进入项目目录（每个项目一个目录），启动 Claude Code，把下面整段粘贴进去。

它分两个阶段，以前没配过或配得不完整的项目也适用：

1. **只读起草**：检查环境，读已有的 `CLAUDE.md` 和 Mac 上的 `AGENTS.md`，把要写的内容全部起草好，连同改前改后的 diff、旧规则的去向、靠推测写的内容一起交给你审核，然后停下来。
2. **批准后写入**：你批准后才写，写之前先备份已有文件。你要求修改，它就改完再给你审核。

配置完退出重开 Claude Code，hook 和 skill 才会生效。

`````markdown
请在【当前项目目录】配置一个工作流：你（Claude Code）写计划，通过 ssh 交给用户 Mac 上的 Codex CLI 执行，然后由你验收、反馈、续接，循环到通过为止。

背景：你运行在服务器上，项目代码和 Codex CLI 都在用户的 Mac 上，你通过 ssh 操作 Mac。

改动范围（硬性约束）：

- 只能改两处：服务器上的当前项目目录（含其中的 .claude/），以及 Mac 上该项目仓库的 AGENTS.md。
- 不要创建、修改或删除服务器上 ~/.claude/ 里的任何文件（这台服务器可能多人共用），包括用户级的 CLAUDE.md、settings.json、skills、hooks。
- 不要修改 Mac 上的 ~/.codex/ 配置。Codex 的模型、思考强度、沙箱等都只通过命令行参数指定。
- 用户级配置看起来需要调整时，只在汇报里提出建议，由用户自己决定。

## 工作方式：先审核，批准后才写入

分两个阶段，不要合并：

- 阶段一（只读）：完成第 1 步；读当前项目目录已有的 CLAUDE.md、.claude/settings.json，和 Mac 仓库里已有的 AGENTS.md；按第 2～5 步把要写的内容全部起草好，但一个文件都不要写。然后按下面的「审核材料」交给用户，停下来等回复。
- 阶段二（写入）：只有用户明确批准后才按第 2～5 步写入。用户要求修改，就改完重新交审核材料；用户只批准一部分，就只写那一部分。

审核材料：

1. 第 1 步确认的变量值和检查结果。
2. 文件清单：每个文件的路径、在服务器还是 Mac、新建还是修改。
3. CLAUDE.md 和 AGENTS.md：新建的给全文；修改的给改前改后的 diff。
4. 规则迁移对照：原有 CLAUDE.md 的每条规则去了哪里（搬到 AGENTS.md / 保留 / 删除），删除的说明原因。
5. AGENTS.md 里不确定、靠推测写的内容（例如从 package.json 猜的命令），逐条标出来请用户确认；和 Codex 全局规则冲突的条目，以及 AGENTS.md 里怎么覆盖。
6. hook 脚本、skill 按下面的模板生成，只列出替换进去的值；settings.json 已存在时给 diff。

写入时：已存在的文件先备份。服务器上的文件复制为 `<文件名>.bak-<日期>`。Mac 上的 AGENTS.md 如果已被 git 跟踪且没有未提交改动，可以不备份；否则复制到 `~/.cache/cx-runs/backup-<日期>/`。在汇报里写明备份位置。所有修改都是合并而不是覆盖，不要删掉审核材料里没提到的内容。

## 第 1 步：确认变量

先自己检测，再请用户确认：

- REMOTE_HOST：连接 Mac 的 ssh 主机别名（看 ~/.ssh/config）
- REMOTE_REPO：项目在 Mac 上的路径（从 Mac 的家目录写起，如 ~/Code/projects/xxx）
- CODEX_BIN：Mac 上 codex 的绝对路径（依次检查 ~/.local/bin/codex、/opt/homebrew/bin/codex、/usr/local/bin/codex）

确认后运行检查（替换为实际值）：

```bash
ssh -o BatchMode=yes REMOTE_HOST "uname -sm; cd REMOTE_REPO && git rev-parse --show-toplevel; CODEX_BIN --version; CODEX_BIN exec resume --help | head -5"
```

ssh 需要密码、codex 未登录、或者 `exec resume` 的帮助里没有 SESSION_ID 参数时，停下来告诉用户自己处理（配置密钥、`codex login`、升级 Codex）。

## 第 2 步：项目 CLAUDE.md

当前项目目录的 CLAUDE.md 最终内容如下（替换实际值）。文件里原有的规则：与执行方式无关的项目规则搬到 Mac 的 AGENTS.md（第 5 步），与远程执行有关的已被下面的约定覆盖，删掉；去向都要列进审核材料的「规则迁移对照」。

````markdown
REMOTE_HOST: <REMOTE_HOST>
REMOTE_REPO: <REMOTE_REPO>

# 远程开发约定

- 本目录是空目录，只用来区分会话。项目代码、依赖、构建、测试都在 Mac 的 REMOTE_REPO 里，通过 `ssh REMOTE_HOST` 操作。
- 项目规则在 Mac 仓库根目录的 AGENTS.md，会话开始时由 hook 读入。规则里的命令一律理解为「在 Mac 的仓库里执行」。
- Read / Edit / Write / Grep / Glob 只作用于本机，不要用它们处理项目代码；也不要把仓库拷到本机改完再拷回去。
- 把相关命令合并进一次 ssh，用带引号的 heredoc，远端用 `bash -s`：

```bash
ssh REMOTE_HOST bash -s <<'EOF'
cd REMOTE_REPO
git status --short
sed -n '1,80p' src/a.ts
EOF
```

- 脚本里会读 stdin 的命令（内层 ssh、while read、codex）要加 `</dev/null` 或从文件重定向输入，否则会吞掉 heredoc 剩下的脚本。
- Mac 非交互 ssh 的 PATH 只有系统目录：Homebrew 工具先 `export PATH=/opt/homebrew/bin:$PATH`，node 等按 AGENTS.md 设置。Mac 是 BSD 工具：`sed -i` 要写成 `sed -i ''`，没有 `timeout`，`grep -P` 不可用。
- 改代码用 `/usr/bin/python3` 做精确字符串替换：每处必须恰好匹配 1 次，否则报错退出、文件不动；读写用 `newline=''` 保留换行符；两层 heredoc 用不同的结束符并都加引号。改完立刻 `git diff` 核对。新建文件用 `cat > 路径 <<'FILE'`。
- 输出用 head / tail / sed -n 控制在需要的范围。构建和测试的输出只看 `| tail -40`；预计超过 2 分钟的命令调大超时或后台运行。
- 让 Codex 写代码时按 codex-exec skill 执行。
````

## 第 3 步：SessionStart hook

新建 `.claude/hooks/load-remote-agents.sh`，并 `chmod +x`：

```bash
#!/bin/bash
# SessionStart hook：把 Mac 上仓库的 AGENTS.md 读进上下文
f="$CLAUDE_PROJECT_DIR/CLAUDE.md"
host=$(sed -n 's/^REMOTE_HOST: *//p' "$f" 2>/dev/null | head -1)
repo=$(sed -n 's/^REMOTE_REPO: *//p' "$f" 2>/dev/null | head -1)
[ -n "$host" ] && [ -n "$repo" ] || exit 0
echo "以下是 $host:$repo/AGENTS.md 的内容（项目规则；执行方式按远程开发约定）："
ssh -n -o ConnectTimeout=5 -o BatchMode=yes "$host" "cat $repo/AGENTS.md" 2>&1 | head -300
exit 0
```

在 `.claude/settings.json` 里合并加入（保留已有内容；不写 matcher，启动、恢复、清空和压缩上下文后都会触发）：

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/load-remote-agents.sh\""
          }
        ]
      }
    ]
  }
}
```

## 第 4 步：skill

新建 `.claude/skills/codex-exec/SKILL.md`，内容如下，把 HOST、REPO、PROJECT（仓库目录名）、CODEX_BIN 替换为实际值：

````markdown
---
name: codex-exec
description: 用户输入 /codex-exec，或说「让 Codex 执行」「交给 Codex 做」「写好计划给 Codex」「继续上次的 Codex 任务」时使用：写计划，通过 ssh 在 Mac 上用 codex exec 执行，然后审查、反馈、续接，循环到通过为止；也用于恢复被中断的任务。用户只说写计划、没说交给 Codex 时不要用。
argument-hint: '[模型] [思考强度] 需求 | 继续'
---

# 计划交给 Codex 执行并验收

分工：你负责读代码、写计划、审查和验收；Codex 在 Mac 的仓库里直接改代码。

每个任务在 Mac 上有一个运行目录 `~/.cache/cx-runs/<RUN_ID>/`，RUN_ID 取 `PROJECT-<YYYYmmdd-HHMMSS>`。任务的全部状态都记在这里，你的会话中断了也能从这里恢复：

| 文件                                               | 内容                                            | 谁写     |
| -------------------------------------------------- | ----------------------------------------------- | -------- |
| repo、model、effort                                | 仓库路径、选定的模型和思考强度                  | 启动命令 |
| plan.md、feedback-N.md                             | 计划、第 N 轮的反馈                             | 你       |
| run.sh                                             | 执行第 N 轮的脚本                               | 启动命令 |
| pid-N                                              | 第 N 轮的进程号                                 | 启动命令 |
| session                                            | Codex 会话 id                                   | run.sh   |
| events-N.jsonl、stderr-N.log、summary-N.md、exit-N | 第 N 轮的事件流、错误输出、Codex 的总结、退出码 | run.sh   |
| review-N.md                                        | 你对第 N 轮的审查结论                           | 你       |
| report.md                                          | 最终汇报；有这个文件表示任务已结束              | 你       |

## 参数

`/codex-exec` 后面的文字整段交给你，不按位置切分，按下面的规则解析：

- 开头可以有模型名（如 `gpt-6.1-sol`）和思考强度（如 `low`、`medium`、`high`、`xhigh`），都可以省略，顺序不限。
- 其余部分是需求。需求可以是「按上面的计划执行」，这时用对话里已经和用户讨论好的计划，不要重写。
- 参数是「继续」，或用户说「继续上次的 Codex 任务」时，按第 7 节恢复。
- 开头的词分不清是模型名还是需求的一部分时，先问用户。
- 用自然语言触发时（如「让 Codex 用 gpt-6.1-sol high 执行」），从话里找出模型和思考强度，规则相同。

## 0. 模型和思考强度

- 用户指定了，就用指定的值。
- 没指定的，读 Mac 上 `~/.codex/config.toml` 顶层的 `model` 和 `model_reasoning_effort` 作为本次的值；读不到就问用户。
- 选定后写进运行目录的 model、effort 文件，run.sh 每一轮（包括续接）都显式传这两个值。续接时不带参数，思考强度会退回 config 的默认值，而不是沿用上一轮。
- 同一个任务中途不换模型和思考强度，换了会让 Codex 那边的上下文缓存失效。用户中途要求换时，先说明这一点，让用户选：继续用原来的值，或者开一个新任务，你把已完成的部分和剩余工作写成新计划。

## 1. 写计划

同一个仓库同时只允许一个进行中的任务。动手前先检查：

```bash
ssh HOST bash -s <<'EOF'
for D in ~/.cache/cx-runs/PROJECT-*/; do
  [ -d "$D" ] && [ ! -f "$D/report.md" ] && echo "未结束：$D"
done; true
EOF
```

有输出就先停下，告诉用户那个任务是什么（读它的 plan.md）、进行到哪一步（按第 7 节判断），让用户选：等它结束、接着做它（第 7 节），或者放弃它（写 report.md）再开新的。

先读够代码再写。计划写给「在仓库里直接工作的人」看：

- 目标：要实现什么，为什么。
- 现状：相关文件（仓库相对路径）和关键代码位置。
- 步骤：改哪些地方、怎么改；有取舍的地方直接给出决定。
- 不要做的：范围之外的改动；不要提交 git；不要打开有界面的程序；不要安装或升级依赖。
- 依赖：需要新增或升级依赖时，你在启动 Codex 之前自己装好，计划里写明已经装了什么。Codex 的沙箱默认可能不能联网。
- 验收标准：可执行的命令和预期结果，以及要人工核对的行为。
- 结尾要求：完成后简短汇报改了哪些文件、跑了哪些命令和结果、没做完或不确定的地方。

计划里不要出现 ssh、scp、heredoc、python 精确替换这些你自己的远程操作方式，Codex 直接改文件；提醒它遵守仓库根目录的 AGENTS.md。在对话里给用户看计划要点，然后直接启动，不用等确认：用户调用这个 skill 就表示同意直接执行。想先审计划的用户会先说「写计划给我看」，审完再调用。

## 2. 启动

Codex 在 Mac 上用 nohup 独立运行，不依赖这次 ssh 连接，也不依赖你的会话：你被中断了，它也会照常跑完。启动前如果工作区有未提交的改动，告诉用户是哪些文件，审查时和 Codex 的改动区分开。把 RUN_ID、MODEL、EFFORT 换成实际值：

```bash
ssh HOST bash -s <<'EOF'
# 清理本项目 30 天前、已经结束（有 report.md）的运行目录；没结束的不删
find ~/.cache/cx-runs -maxdepth 1 -type d -name 'PROJECT-*' -mtime +30 -exec test -f {}/report.md \; -exec rm -rf {} +
# 再检查一次未结束的任务，防止两个会话几乎同时启动
U=$(for D in ~/.cache/cx-runs/PROJECT-*/; do [ -d "$D" ] && [ ! -f "$D/report.md" ] && echo "$D"; done)
[ -z "$U" ] || { echo "有未结束的任务，没有启动：$U"; exit 2; }
R=~/.cache/cx-runs/RUN_ID; mkdir -p $R
cd REPO || exit 1
pwd > $R/repo; echo 'MODEL' > $R/model; echo 'EFFORT' > $R/effort
git rev-parse HEAD > $R/base; git status --short > $R/status-before
cat > $R/plan.md <<'PLAN'
（计划全文）
PLAN
cat > $R/run.sh <<'RUN'
#!/bin/bash
# 用法：run.sh <轮次> <输入文件>。第 1 轮新建 Codex 会话，之后的轮次续接同一个会话
R=$(cd "$(dirname "$0")" && pwd); N=$1; IN=$2
cd "$(cat "$R/repo")" || exit 1
args=(-m "$(cat "$R/model")" -c model_reasoning_effort="\"$(cat "$R/effort")\"" \
  -c approval_policy='"never"' -c 'notify=[]' --json -o "$R/summary-$N.md")
if [ "$N" = 1 ]; then
  CODEX_BIN exec -C "$PWD" -s workspace-write "${args[@]}" - < "$IN"
else
  CODEX_BIN exec resume "$(cat "$R/session")" -c sandbox_mode='"workspace-write"' "${args[@]}" - < "$IN"
fi > "$R/events-$N.jsonl" 2> "$R/stderr-$N.log"
echo $? > "$R/exit-$N"
[ -s "$R/session" ] || sed -n 's/.*"thread_id":"\([^"]*\)".*/\1/p' "$R/events-1.jsonl" | head -1 > "$R/session"
RUN
nohup bash $R/run.sh 1 $R/plan.md </dev/null >/dev/null 2>&1 &
echo $! > $R/pid-1; echo "started RUN_ID"
EOF
```

提示必须从文件传入（`- < 文件`）：codex 会读 stdin，直接把提示写在命令行上，它会吞掉 heredoc 后面的脚本。`exec resume` 没有 `-C`、`-s` 参数，所以 run.sh 先 cd，沙箱用 `-c` 指定。

## 3. 等待结果

用 Bash 的 run_in_background 运行（N 是当前轮次），等它的完成通知；期间不要改这个仓库：

```bash
ssh HOST bash -s <<'EOF'
R=~/.cache/cx-runs/RUN_ID; N=1
while [ ! -f $R/exit-$N ]; do kill -0 "$(cat $R/pid-$N)" 2>/dev/null || break; sleep 15; done
[ -f $R/exit-$N ] || { echo "第 $N 轮被中断：Codex 进程已不在，也没有退出码"; exit 1; }
echo "codex exit=$(cat $R/exit-$N) session=$(cat $R/session)"
grep '"type":"turn_context"' ~/.codex/sessions/*/*/*/rollout-*"$(cat $R/session)".jsonl | tail -1 \
  | grep -o '"model":"[^"]*"\|"effort":"[^"]*"' | sort -u | tr '\n' ' '; echo
cat $R/summary-$N.md
EOF
```

- 第二行输出是这一轮实际用的模型和思考强度，和 model、effort 文件对不上就停下来告诉用户。
- exit 不为 0 或没有总结时，看 `tail -30 $R/stderr-$N.log`。exit 为 0 只代表 Codex 正常结束，不代表任务完成。
- 第 N 轮被中断：session 文件有内容，就按第 5 节派下一轮，反馈写「上一轮执行被中断了，先检查工作区当前状态，然后继续完成上一轮的要求」，再附上上一轮要求的要点。session 为空（第 1 轮还没建立会话就中断了），就先看工作区有没有被改动，告诉用户情况，问要不要重新开始。

## 4. 审查

逐项做，不能只看测试结果：

1. 读 Codex 的总结，了解它自称做了什么。
2. 读完整的改动：相对 base 文件里那个 commit 的 `git diff`，加上新增的未跟踪文件，逐个文件读，不要只看 `--stat`。status-before 里原有的改动不算 Codex 的。
3. 按下面几类检查，每个问题记下文件和行号：
   - 需求：计划里每条验收标准是否满足。
   - 正确性：逻辑错误；边界情况（空值、空列表、首次使用、已有的旧数据、异步时序、失败路径）。
   - 范围：计划外的改动、无关的格式化或重命名、删掉了不该删的代码。
   - 代码质量：AGENTS.md 的代码约定；多余的兜底和抽象；和周围代码的风格是否一致。
   - 测试：该加的测试有没有加；有没有靠删断言、跳过测试、放宽检查让测试通过。
   - 安全：密钥、个人路径、调试输出有没有进代码；有没有改不该改的配置文件。
4. 自己跑 AGENTS.md 规定的检查和测试，以你跑出来的结果为准，不采信 Codex 的自述。
5. 把问题分成两类：
   - 必须改：不满足验收标准、正确性问题、检查或测试不通过、违反 AGENTS.md 的禁止事项。
   - 建议改：其余问题。一两行就能改好的（拼写、格式、命名）你直接改；其余留到汇报里。
6. 把审查结论写进 `$R/review-$N.md`：第一行写 `结论：通过` 或 `结论：不通过`，然后列出必须改的、建议改的、你直接改了的，每条带文件和行号。

有必须改的问题，走第 5 节；没有，走第 6 节。

## 5. 不通过：派下一轮

反馈只写必须改的问题：哪条标准没满足或哪里有错（文件和行号）、报错输出的关键几行、期望的结果。N 是新一轮的轮次：

```bash
ssh HOST bash -s <<'EOF'
R=~/.cache/cx-runs/RUN_ID; N=2
cat > $R/feedback-$N.md <<'FB'
（反馈全文）
FB
nohup bash $R/run.sh $N $R/feedback-$N.md </dev/null >/dev/null 2>&1 &
echo $! > $R/pid-$N; echo "started round $N"
EOF
```

然后回到第 3 节等待。总共最多 3 轮。第 3 轮审查仍不通过就停下，按第 6 节的格式汇报，结论写「未通过」，并说明卡在哪里、你的判断和可选方案。

## 6. 汇报

通过后先做 AGENTS.md 规定的收尾（例如构建、部署到本地加载目录）。然后按下面的格式汇报，同时把全文写进 `$R/report.md`，表示任务已结束，并删掉体积最大的事件流（session id 已存在 session 文件里，完整过程在 Codex 自己的会话记录里也有）。不要提交 git，除非用户要求。

```bash
ssh HOST bash -s <<'EOF'
R=~/.cache/cx-runs/RUN_ID
cat > $R/report.md <<'REPORT'
（汇报全文）
REPORT
rm -f $R/events-*.jsonl
EOF
```

汇报格式：

```markdown
## Codex 执行结果：通过 / 未通过

- 任务：一句话
- Codex：模型 / 思考强度，共 N 轮；运行记录 ~/.cache/cx-runs/RUN_ID

### 改动

- `文件路径`：改了什么（每个文件一行）

### 验证

- `命令` → 结果

### 各轮发现的问题

- 第 1 轮：问题 → 第 2 轮已修复（只有一轮且没有问题就写「无」）

### 我直接改的

- `文件:行`：改了什么（没有就写「无」）

### 审查发现、没有处理的

- `文件:行`：问题和建议（没有就写「无」）

### 需要你确认或手动测试的

- ……
```

## 7. 恢复中断的任务

先列出这个项目所有没有 report.md 的运行目录，看各自进行到了哪一步：

```bash
ssh HOST bash -s <<'EOF'
for R in $(ls -td ~/.cache/cx-runs/PROJECT-*/ 2>/dev/null); do
  [ -f $R/report.md ] && continue
  N=$(ls $R | sed -n 's/^pid-\([0-9]*\)$/\1/p' | sort -n | tail -1)
  echo "== RUN=$R 最新轮次=$N"; head -3 $R/plan.md; ls $R
  [ -n "$N" ] && kill -0 "$(cat $R/pid-$N)" 2>/dev/null && echo "第 $N 轮 Codex 仍在运行"
done; true
EOF
```

正常情况下最多只有一个。有多个（比如以前并行开过任务）时，列出来让用户选接哪个，不要自己挑。

按选中任务的最新轮次 N 判断：

| 状态                                             | 说明                 | 接着做                     |
| ------------------------------------------------ | -------------------- | -------------------------- |
| 没有任何 pid 文件                                | 计划写了但还没启动   | 读 plan.md，问用户是否启动 |
| 没有 exit-N，Codex 仍在运行                      | 还在跑               | 第 3 节，等待              |
| 没有 exit-N，进程已不在                          | 这一轮被中断         | 第 3 节「被中断」的处理    |
| 有 exit-N，没有 review-N.md                      | 跑完了，还没审查     | 第 3 节读结果，然后第 4 节 |
| review-N.md 结论是不通过，没有 feedback-(N+1).md | 审查完，还没派下一轮 | 第 5 节                    |
| review-N.md 结论是通过                           | 只差汇报             | 第 6 节                    |
| 找不到运行目录                                   | 没有未完成的任务     | 告诉用户                   |

恢复前先读 plan.md、各轮的 feedback 和 review，了解任务的来龙去脉。找到的任务不像是用户说的那个时，先和用户确认。用户决定放弃时，在 report.md 里写「已放弃」和原因。

汇报之后用户要求在同一个任务上再改：先把 report.md 改名为 `report-<当前轮次>.md`，表示任务重新进行中，然后按第 5 节在同一个运行目录派下一轮，轮数上限从这里重新算。
````

## 第 5 步：Mac 上仓库的 AGENTS.md

AGENTS.md 是项目规则的唯一来源，Codex 和你共用。写法要求：中性，只写「做什么、用什么命令」，不写 ssh、scp 等执行方式；路径用仓库相对路径。

- 仓库里已有 AGENTS.md：保留原有内容，把执行方式相关的改成中性写法，再补上缺的部分和从 CLAUDE.md 搬来的规则。
- 没有：参考 README、package.json（或其他构建配置）、docs 目录，以及当前项目 CLAUDE.md 里原有的项目规则，起草一份。结构参考：项目简介、环境（语言版本、包管理器；非交互 shell 下如何设置 PATH）、常用命令（检查、测试、构建、部署）、禁止事项、代码约定、完成的标准（改完跑哪些检查，不要提交 git 除非被要求）。

命令要先在 Mac 上核实存在（例如 package.json 的 scripts 里确实有），核实不了的在审核材料里标出来。

还要读 Mac 上 Codex 的全局规则（`~/.codex/AGENTS.md`，以及它引用的文档），找出和本项目规则冲突的条目，例如全局要求「前端改动后用浏览器截图检查」而本项目禁止打开有窗口的浏览器。冲突的地方在 AGENTS.md 里明确写出本项目怎么做，并列进审核材料。只改项目的 AGENTS.md，不改全局规则。批准后通过 ssh 写到 REMOTE_REPO/AGENTS.md。不要提交 git，是否提交由用户决定。

## 第 6 步：写入后验证并汇报

1. 运行 `CLAUDE_PROJECT_DIR="$PWD" bash .claude/hooks/load-remote-agents.sh | head -20`，应输出 AGENTS.md 的开头。
2. 运行 `python3 -m json.tool .claude/settings.json > /dev/null && echo ok`。
3. 列出新建和修改的文件、备份位置，并告诉用户：退出并重新打开 Claude Code 后 hook 和 skill 才会生效；可以先用一个小改动试一次「写好计划，让 Codex 执行」。
`````

## 四、日常使用

配置好之后，在服务器的项目目录里打开 Claude Code，用 `/codex-exec` 调用：

```text
/codex-exec 给设置页加一个导出按钮
/codex-exec high 给设置页加一个导出按钮
/codex-exec gpt-6.1-sol high 给设置页加一个导出按钮
```

`/codex-exec` 后面的文字会整段交给 skill，不按位置切分。开头的模型名和思考强度都可以省略，顺序不限，剩下的就是需求。说「写好计划，让 Codex 用 high 执行」这样的自然语言也能触发，但要靠 Claude 自己判断该不该用这个 skill；`/codex-exec` 则一定会走这个流程。

三种用法：

| 用法     | 怎么做                                                                            | 会发生什么                                                                    |
| -------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 直接执行 | `/codex-exec [模型] [强度] 需求`                                                  | 写计划 → Codex 执行 → 验收 → 不通过就续接，最多 3 轮 → 汇报。中间不停下来问你 |
| 先审计划 | 先说「……，写计划给我看」，讨论定稿后 `/codex-exec [模型] [强度] 按上面的计划执行` | 用定稿的计划执行，不重写                                                      |
| 继续改   | 任务结束后说「让 Codex 按这些意见再改一下」                                       | 续接同一个 Codex 会话，模型和思考强度不变                                     |
| 恢复中断 | `/codex-exec 继续`                                                                | 找到这个项目没结束的任务，从中断的那一步接着做                                |

依据：Codex 按计划（目标、现状、步骤、不要做的、验收标准）和仓库的 `AGENTS.md` 干活。调用 `/codex-exec` 本身就表示同意直接执行。

### 审查和汇报

每轮 Codex 跑完，Claude Code 都会审查：逐个文件读完整的 diff，按需求、正确性（边界情况、旧数据、失败路径）、范围、代码质量、测试（有没有靠删断言让测试通过）、安全（密钥、调试输出）几类检查，再自己跑一遍检查和测试，不采信 Codex 的自述。问题分成「必须改」和「建议改」：必须改的发回给 Codex 再改一轮；一两行的小问题 Claude 直接改；其余写进汇报。

汇报格式固定：结论（通过 / 未通过）、用的模型和轮数、每个文件改了什么、验证命令和结果、各轮发现的问题、Claude 直接改的、审查发现但没处理的、需要你确认或手动测试的。汇报同时存一份在运行目录的 `report.md`。

### Claude Code 中断了怎么办

Codex 在 Mac 上是独立运行的，Claude Code 停了（关掉终端、断网、服务器重启）它也会照常跑完。回来之后有两种接法：

1. 恢复原来的对话：在项目目录运行 `claude --continue`（或者在 Claude Code 里用 `/resume` 选那段对话），然后说「继续」。对话的上下文都在，最顺。
2. 开新会话：输入 `/codex-exec 继续`。Claude Code 会去 Mac 上找这个项目最近一个没结束的任务，读计划、每轮反馈和审查结论，判断进行到了哪一步：还在跑就接着等，跑完了就审查，审查完了就派下一轮或者汇报，Codex 中途被杀了就续接同一个 Codex 会话让它接着做。

实测：启动后马上断开 ssh，Codex 照常跑完；从另一个 ssh 连接能取到结果并续接第二轮；第二轮跑到一半把进程杀掉，能检测出「被中断」，第三轮续接后 Codex 先检查了工作区，再接着完成要求。

几点说明：

- **不指定模型时**，用 Mac 上 Codex 配置里的默认模型和思考强度。不管是不是你指定的，选定的值都会在第一轮记下来，之后每一轮都显式传同样的参数。这一步是必须的：实测（codex-cli 0.163.0）第一轮用 low，`resume` 时不带参数，第二轮就变成了配置里默认的 medium；带上参数后又回到 low。每一轮实际用的值都可以在 Codex 的会话记录里查到，skill 每轮都会核对。
- **中途不换模型。** 换了会让 Codex 的上下文缓存失效。如果你中途要求换，Claude Code 会先提醒你；要换就开一个新会话，把剩下的工作写成新计划。
- Claude Code 自己用什么模型，照常用 `/model` 切换，和 Codex 用什么模型无关。
- Codex 跑的时候 Claude Code 是空闲的，可以接着讨论别的，但不要让它改同一个仓库。
- 每次运行的计划、反馈和日志都在 Mac 的 `~/.cache/cx-runs/` 里，想看 Codex 具体做了什么可以去翻。

### Codex 运行时不会请示

为了全自动，Codex 用的是 `approval_policy=never` 加 workspace-write 沙箱：执行任何命令前都不会问你，但写文件只限于仓库目录内（以及沙箱允许的临时目录）。这是全自动的代价。不放心的任务，先「写计划给我看」，审过再交给 Codex。

### 并行和冲突

**同一个仓库同时只允许一个进行中的任务。** 两个任务同时改一个工作区，改动会互相覆盖；审查时 `git diff` 混着两个任务的改动，Claude 会把另一个任务的改动当成「计划外改动」让 Codex 撤销；测试结果也分不清是谁造成的。所以开新任务前，skill 会检查这个项目有没有没结束的任务，有就先问你：等它结束、接着做它，还是放弃它。不同项目之间互不影响，可以同时跑。

**同时在 Mac 上手动用 Codex：**

- 不会读错 session。这套流程的 session id 只来自这次 `codex exec` 自己的输出，续接时指定 id，从不用「最近的会话」，核对模型时也只读带这个 id 的会话记录。你手动开的 Codex 会话和它互不相干。
- 但工作区是同一个。手动开的 Codex 如果也改代码，就和两个任务并行是一样的问题。
- 只做只读检查可以，建议用 `codex -s read-only` 启动，防止它误改。它看到的可能是改到一半的代码，结论要以任务结束后的状态为准。也不要让它跑构建和测试，这些命令会写构建产物，还会和流程里的测试抢同一个输出目录。
- 你自己在编辑器里改同一个仓库也一样：任务进行中不要改。

**以后的优化：同一个仓库并行多个任务。** 思路是每个任务一个 git worktree（独立的工作目录和分支），改动完全隔离，审查时 diff 也只包含自己的改动。要解决的问题：

- 每个 worktree 要单独装依赖；
- 任务结束后要合并回主分支，并处理合并冲突，合并后还要再跑一遍测试；
- 构建、部署到本地加载目录这类共享资源要排队；
- 运行目录要记录对应的 worktree 和分支，恢复和清理时一起处理。

Codex 自带 `--worktree` 参数，但这里没有测过；由 Claude 自己用 `git worktree add` 建工作目录更好控制。现在先用单任务锁。

### 磁盘占用

会增长的有两处：

- `~/.cache/cx-runs/`：这套流程自己的运行目录，会自动清理。任务结束时删掉体积最大的事件流，只留几 KB 的计划、反馈、审查和汇报；每次启动新任务时，删掉本项目 30 天前、已经结束的运行目录。没结束的任务不会被删，不影响中断续接。
- `~/.codex/sessions/`：Codex 自己的会话记录，平时直接用 Codex 也会写。续接要靠它，所以不能关，配置提示词也约定了不动 `~/.codex`。它会随使用增长，需要清理时自己删旧文件，但不要删还没结束的任务对应的会话。
- 新项目：在服务器上新建项目目录，再粘贴一次上面的提示词。
