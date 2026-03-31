---
title: Python02可迭代序列
description: 'No desc'
publishDate: 2026-03-31 22:27:30
tags:
  - python
---
## 第一题：互不相同的数，组成最大整数

**代码：**

```python
# 读入所有数字
nums = list(map(int, input().split()))

# 先去重，再按从大到小排序
ans = sorted(set(nums), reverse=True)

# 把数字转成字符串后拼接输出
print(''.join(map(str, ans)), end='')
```

## 第二题：合法IP

**代码：**

```python
# 读入测试数据组数
n = int(input())

for _ in range(n):
    # 读入一个 IP 字符串，并去掉两端空格
    s = input().strip()
    parts = s.split('.')

    ok = True

    # 合法 IPv4 必须正好分成 4 段
    if len(parts) != 4:
        ok = False
    else:
        for x in parts:
            # 每一段都必须全是数字
            if not x.isdigit():
                ok = False
                break

            # 不能有前导零，例如 01、001 都不合法
            if x[0] == '0' and len(x) > 1:
                ok = False
                break

            # 每一段的数值必须在 0 到 255 之间
            if not (0 <= int(x) <= 255):
                ok = False
                break

    if ok:
        print("YES")
    else:
        print("NO")
```

## 第三题：西游记角色粉丝统计（字符串处理 + Counter + 排序）

**代码：**

```python
# 解法 1：字典统计版
names = input().split(",")

# 去掉每个名字两边的空格
clean_list = [name.strip() for name in names]

# 用字典统计每个角色出现次数
count = {}
for name in clean_list:
    if name in count:
        count[name] += 1
    else:
        count[name] = 1

# 按“次数降序，名字升序”排序
result = sorted(count.items(), key=lambda x: (-x[1], x[0]))

# 输出结果
for name, cnt in result:
    print(f"{name}:{cnt}")


# 解法 2：Counter 版
from collections import Counter

# 读入一行字符串，先按逗号拆分，再去掉每个名字两边空格
count = Counter(name.strip() for name in input().split(","))

# 按“次数降序，名字升序”排序后输出
for name, cnt in sorted(count.items(), key=lambda x: (-x[1], x[0])):
    print(f"{name}:{cnt}")
```

## 第四题：生日悖论（Birthday Paradox）

**代码：**

```python
from random import seed, randint

# 读入随机种子和测试次数
x, n = map(int, input().split())

# 设置随机种子，保证结果可复现
seed(x)

# 记录“有重复生日”的实验次数
count = 0

for _ in range(n):
    lst = []

    # 生成 23 个随机生日
    for _ in range(23):
        lst.append(randint(1, 365))

    # 如果去重前后长度不同，说明有重复生日
    if len(lst) != len(set(lst)):
        count += 1

# 计算重复出现的比率
rate = count / n

# 按要求保留两位小数输出
print(f"rate={rate:.2f}")
```

## 第五题：jmu-python-班级人员信息统计

**代码：**

```python
# 读入两个班级名单
a = set(input())                # a 班：每个字符代表一个学生
b = set(input().split())        # b 班：按空格分隔学生姓名

# 读入竞赛名单
acm = set(input().split())
English = set(input().split())

# 读入转学学生
p = input()

# 输出总人数
print("Total:", len(a | b))

# 输出没有参加任何竞赛的学生名单和数量
print(f"Not in race: {sorted((a | b) - (acm | English))}, num: {len((a | b) - (acm | English))}")

# 输出所有参赛学生名单和数量
print(f"All racers: {sorted(acm | English)}, num: {len(acm | English)}")

# 输出同时参加 ACM 和英语竞赛的学生名单和数量
print(f"ACM + English: {sorted(acm & English)}, num: {len(acm & English)}")

# 输出只参加 ACM 的学生名单
print(f"Only ACM: {sorted(acm - English)}")

# 输出只参加英语竞赛的学生名单
print(f"Only English: {sorted(English - acm)}")

# 输出只参加一个竞赛的学生名单
print(f"ACM Or English: {sorted(acm ^ English)}")

# 处理转学
if p in a:
    print(sorted(a - {p}))
elif p in b:
    print(sorted(b - {p}))
```

## 第六题：能被 3、5 和 7 整除的数的个数（用集合实现）

**代码：**

```python
# 解法 1：直接计算法
a, b = map(int, input().split())

# 同时被 3、5、7 整除，等价于被 105 整除
# 统计区间 [a, b] 中 105 的倍数个数
print(b // 105 - (a - 1) // 105)


# 解法 2：集合法
a, b = map(int, input().split())

# 分别构造区间内 3、5、7 的倍数集合
set3 = set(range((a + 2) // 3 * 3, b + 1, 3))
set5 = set(range((a + 4) // 5 * 5, b + 1, 5))
set7 = set(range((a + 6) // 7 * 7, b + 1, 7))

# 交集中的元素就是同时被 3、5、7 整除的数
ans = len(set3 & set5 & set7)
print(ans)
```

## 第七题：求右下角的一级子地图

**代码：**

```python
while True:
    # 读入地图大小
    n = int(input())

    # 输入 0 表示结束
    if n == 0:
        break

    # 读入 n 行地图
    grid = [input() for _ in range(n)]

    # 去掉第一行，再去掉每一行的第一列
    for i in range(1, n):
        print(grid[i][1:])
```

## 第八题：输入日期求一年中的第几天

**代码：**

```python
# 读入日期字符串
s = input()

# 默认按平年处理每个月的天数
days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

# 拆分出年、月、日
y, m, d = map(int, s.split('-'))

# 如果是闰年，把 2 月改成 29 天
if (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0):
    days[1] = 29

# 前面月份总天数 + 当月日期
res = sum(days[:m - 1]) + d

print(res)
```
