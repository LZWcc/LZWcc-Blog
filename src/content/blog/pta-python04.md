---
title: Python04字符串
description: 'No desc'
publishDate: 2026-04-21 20:56:50
tags:
  - python
---

## 第一题：单个身份证校验 - 实验 19 身份证校验 - 《Python编程基础及应用实验教程》 - 高牧尘

**代码：**

```python
# 身份证前 17 位对应的加权因子
f = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]

# 余数对应的校验码
relate = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']

try:
    # 读入身份证号
    s = input()

    # 身份证号长度必须为 18
    assert len(s) == 18

    total = 0

    # 计算前 17 位的加权和
    for i in range(17):
        total += int(s[i]) * f[i]

    # 根据余数得到校验码
    total %= 11
    m = relate[total]

    # 判断校验码是否正确
    assert m == s[17]
except:
    print("错误")
else:
    print("正确")
```

## 第二题：字符串排序输出

**代码：**

```python
# 读入测试数据组数
n = int(input())

while n:
    # 读入字符串，排序后用空格连接输出
    s = input()
    print(" ".join(sorted(s)))
    n -= 1
```

## 第三题：字符串循环移位

**代码：**

```python
# 读入右移位数
k = int(input())

# 读入字符串
s = input()

# 避免 k 大于字符串长度
k %= len(s)

# 后 k 个字符移到前面
print(s[-k:] + s[:-k])
```

## 第四题：三国演义中文分词与词频统计

**代码：**

```python
import jieba

# 需要统计的人名列表
names = ["曹操", "刘备", "孙权", "诸葛亮", "孔明", "关羽", "云长", "张飞", "翼德", "赵云", "子龙", "马超", "孟起", "黄忠", "汉升", "周瑜", "公瑾", "吕布", "玄德", "华雄", "颜良", "文丑", "周郎", "仲谋", "许褚", "夏侯渊"]

# 读入文本并分词
s = input()
words = jieba.lcut(s)

# 统计指定人名出现次数
count = {}
for w in words:
    if w in names:
        count[w] = count.get(w, 0) + 1

# 输出统计结果
for k, v in count.items():
    print(f"{k}: {v}")
```

## 第五题：标识符判断

**代码：**

```python
# 读入测试数据组数
n = int(input())

# Python 关键字列表
keyword = ["if", "else", "while", "for", "int", "float", "return", "break", "continue"]

for i in range(n):
    # 读入待判断字符串
    s = input()

    # 标识符不能是关键字，只能由字母、数字、下划线组成，并且不能以数字开头
    if s not in keyword and set(s) <= set("qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM0123456789_") and not s[0].isdigit():
        print("Valid")
    else:
        print("Invalid")
```

## 第六题：jmu-python-输入输出-格式化输出字符串

**代码：**

```python
# 读入浮点数、整数和字符串
a = float(input())
b = int(input())
c = input().strip()

# 保留两位小数
print(f"{a:.2f}")

# 科学计数法和百分数格式
print(f"{a:e}", f"{a:E}", f"{a:.2%}")

# 二进制和十六进制
print(f"{b:b}", f"{b:x}")

# 字符串转大写
print(f"{c.upper()}")

# 右对齐，宽度为 20
print(f"{c:>20}")

# 居中对齐，空位用 * 填充
print(f"{c:*^20}")

# 格式化表达式输出
print(f"{a} + {b} = {a + b}")
```

## 第七题：置换加密算法

**代码：**

```python
# 读入字符串
s = input()

# 偶数下标和奇数下标分别取出
even = s[::2]
odd = s[1::2]

# 先输出奇数下标字符，再输出偶数下标字符
print(odd + even)
```
