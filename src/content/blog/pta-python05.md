---
title: Python05函数
description: 'No desc'
publishDate: 2026-05-06 15:08:43
tags:
  - python
---

## 第一题：p094扑克排序

**代码：**

```python
def re(p):
    # 点数从小到大的顺序
    mm = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
    m = {i: j for j, i in enumerate(mm)}

    # 花色从小到大的顺序
    hh = ['c', 'd', 's', 'h']
    h = {i: j for j, i in enumerate(hh)}

    # 先比较点数，再比较花色
    return h[p[0]] + m[p[1:]] * 100


try:
    while True:
        # 读入一行扑克牌，按自定义规则降序排序
        print(" ".join(sorted(input().split(), key=re, reverse=True)), end=" \n")
except Exception:
    pass
```

## 第二题：多数乘积（可变函数）

**代码：**

```python
def func(*nums):
    # 计算所有参数的乘积
    res = 1
    for num in nums:
        res *= num
    return res


# 读入用逗号分隔的数字
arr = list(map(float, input().split(",")))

# 分别输出前 2、3、4 个数的乘积
print(f"前两个数乘积为：{func(*arr[:2]):.1f}")
print(f"前三个数乘积为：{func(*arr[:3]):.1f}")
print(f"前四个数乘积为：{func(*arr[:4]):.1f}")
```

## 第三题：lambda表达式的使用

**代码：**

```python
# 读入学生人数
n = int(input())

stu = []
for _ in range(n):
    # 每行包含姓名和三门成绩
    data = input().split()
    name = data[0]
    ds, db, c = map(int, data[1:])
    stu.append([name, ds, db, c])

# 使用 lambda 按三门课总分降序排序
sortStu = sorted(stu, key=lambda x: x[1] + x[2] + x[3], reverse=True)

# 输出排序后的学生信息
for s in sortStu:
    print(s[0], s[1], s[2], s[3])
```

## 第四题：金额转换---测试3

**代码：**

```python
d = "零壹贰叁肆伍陆柒捌玖"

# 读入金额
num = float(input())
s = ""


def to(num):
    # 将 0 到 9999 的整数转换为大写金额数字
    s = ""
    if num >= 1000:
        s += d[num // 1000] + "仟"
    if num >= 100:
        s += d[num // 100 % 10] + "佰"
    if num >= 10:
        s += d[num // 10 % 10] + "拾"
    s += d[num % 10]
    return s


# 处理亿、万、元三个整数部分单位
if num > 100000000:
    s += to(int(num // 100000000)) + "亿"
if num > 10000:
    s += to(int(num // 10000 % 10000)) + "万"
s += to(int(num % 10000)) + "元"

# 处理小数部分的角和分
num = int(num * 100 % 100)
s += f"{d[num // 10]}角{d[num % 10]}分"

print(s)
```

## 第五题：逆转裁判

**代码：**

```python
# 读入两个字符串
s1 = input()
s2 = input()

ans = ""

# 保留 s1 中没有在 s2 出现过的字符
for ch in s1:
    if ch not in s2:
        ans += ch

# 如果所有字符都被删除，输出指定提示
if ans == "":
    print("Objection!")
else:
    print(ans)
```

## 第六题：计算某天距元旦的天数

**代码：**

```python
from datetime import date

# 读入测试数据组数
n = int(input())

for _ in range(n):
    try:
        # 读入年月日并构造日期对象
        y, m, d = map(int, input().split())
        dd = date(y, m, d)
    except Exception:
        print("ErrorInput")
    else:
        # 计算该日期是当年的第几天
        print("Totaldays =", (dd - date(y, 1, 1)).days + 1)
```

## 第七题：嵌套列表拆分

**代码：**

```python
# 读入嵌套列表
s = input()
a = eval(s)


def get(l):
    # 递归展开嵌套列表
    ret = []
    for i in l:
        if type(i) == list:
            ret += get(i)
        else:
            ret.append(i)
    return ret


print(get(a))
```

## 第八题：Z字形打印

**代码：**

```python
# 读入矩阵规模
n = int(input())

# 读入 n * n 矩阵
data = [list(map(int, input().split())) for _ in range(n)]

for i in range(n * n):
    x, y = 0, 0
    d = 1

    # 根据 i 的四进制位计算对应位置
    while i:
        match i % 4:
            case 0:
                pass
            case 1:
                y += d
            case 2:
                x += d
            case 3:
                x += d
                y += d
        d *= 2
        i //= 4

    print(data[x][y], end=" ")
```
