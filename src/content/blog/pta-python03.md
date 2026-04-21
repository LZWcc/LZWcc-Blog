---
title: Python03选择与循环
description: 'No desc'
publishDate: 2026-04-21 20:47:14
tags:
  - python
---
## 第一题：jmu-python-判断是否构成三角形

**代码：**

```python
# 读入三条边
a, b, c = map(int, input().split())

# 判断是否满足三角形两边之和大于第三边
if a + b > c and a + c > b and c + b > a:
    print("yes")
else:
    print("no")
```

## 第二题：字符串变换

**代码：**

```python
# 读入两个字符串
a, b = input().split()


def func(s, t):
    # 将 s 拼接两次，方便判断旋转后的字符串
    ss = s + s
    n = len(s)

    for k in range(n):
        # 判断 t 是否出现在旋转后的长度为 n 的子串中
        if t in ss[k:k + n]:
            return k

    return 999


res = 999

# 如果 b 的长度不超过 a，判断 b 是否能在 a 的旋转结果中出现
if len(b) <= len(a):
    res = min(res, func(a, b))

# 如果 a 的长度不超过 b，判断 a 是否能在 b 的旋转结果中出现
if len(a) <= len(b):
    res = min(res, func(b, a))

print(res if res != 999 else -1)
```

## 第三题：基因相似性

**代码：**

```python
# 读入相似度阈值
flag = float(input().strip())

# 读入两段基因序列
s1 = input().strip()
s2 = input().strip()

# 统计对应位置相同的字符个数
cnt = 0
for i in range(len(s1)):
    if s1[i] == s2[i]:
        cnt += 1

# 计算相似度
ans = cnt / len(s1)
print(f"{ans:.2f}")

# 判断是否达到阈值
if ans >= flag:
    print("yes")
else:
    print("no")
```

## 第四题：个人所得税 - 《Python编程基础及应用》第2版，习题3-5

**代码：**

```python
# 解法 1：分段判断法
# 读入应纳税所得额
num = float(input().strip())

tax = 0.0

# 按超额累进税率从高到低计算
if num > 960000:
    tax += (num - 960000) * 0.45
    num = 960000

if num > 660000:
    tax += (num - 660000) * 0.35
    num = 660000

if num > 420000:
    tax += (num - 420000) * 0.30
    num = 420000

if num > 300000:
    tax += (num - 300000) * 0.25
    num = 300000

if num > 144000:
    tax += (num - 144000) * 0.20
    num = 144000

if num > 36000:
    tax += (num - 36000) * 0.10
    num = 36000

tax += num * 0.03

# 保留两位小数输出
print(f"{tax:.2f}")


# 解法 2：税率表循环法
# 读入应纳税所得额
num = float(input().strip())

# 每一项表示：超过 base 的部分，按 rate 税率计算
levels = [
    (960000, 0.45),
    (660000, 0.35),
    (420000, 0.30),
    (300000, 0.25),
    (144000, 0.20),
    (36000, 0.10),
    (0, 0.03)
]

tax = 0

# 从高档到低档逐段计算税额
for base, rate in levels:
    if num > base:
        tax += (num - base) * rate
        num = base

print(f"{tax:.2f}")
```

## 第五题：简单计算器

**代码：**

```python
# 读入两个操作数和一个运算符
a, b, op = input().split()
a = int(a)
b = int(b)

# 根据运算符进行对应计算
if op == '+':
    print(a + b)
elif op == '-':
    print(a - b)
elif op == '*':
    print(a * b)
elif op == '/':
    if b == 0:
        print("Divided by zero!")
    else:
        print(int(a / b))
else:
    print("Invalid operator!")
```

## 第六题：计算天距元旦的天数

**代码：**

```python
# 读入测试数据组数
n = int(input())

for _ in range(n):
    # 读入年、月、日
    y, m, d = map(int, input().split())

    # 年份必须为正数
    if y <= 0:
        print("ErrorInput")
        continue

    # 判断是否为闰年
    isYear = (y % 400 == 0) or (y % 4 == 0 and y % 100 != 0)

    # 每个月的天数
    days = [31, 29 if isYear else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

    # 判断日期是否合法
    if m < 1 or m > 12 or d < 1 or d > days[m - 1]:
        print("ErrorInput")
        continue

    # 计算距离元旦的天数
    total = sum(days[:m - 1]) + d
    print("Totaldays=", total)
```

## 第七题：输入一个正整数，统计该数各位数字之和。

**代码：**

```python
# 读入一个正整数
n = int(input())

ans = 0

# 逐位取出数字并累加
while n != 0:
    ans += n % 10
    n //= 10

print("各位数字之和是：", ans)
```

## 第八题：游程编码

**代码：**

```python
# 读入游程编码字符串
s = input().strip()

res = ""
num = 0

for ch in s:
    # 连续数字组成重复次数
    if ch.isdigit():
        num = num * 10 + int(ch)
    else:
        # 遇到字符时，按前面的数字重复输出
        res += ch * num
        num = 0

print(res)
```
