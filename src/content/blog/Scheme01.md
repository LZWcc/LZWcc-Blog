---
title: Scheme 中常用表达式的用法
description: '回头看发现忘光光了'
publishDate: 2025-05-31 22:21:32
tags:
  - Scheme
  - Technology
---

## 1. `if` 用法

```scheme
 (if condition
     true-expression
     false-expression)    ; 可选
```

### 特点

- **只有一个条件**
- **最多两个分支**（true 和 false）
- **false 分支是可选的**，如果省略且条件为假，返回未定义值

### 示例

```scheme
 ; 基本用法
 (if (> 5 3)
     'big
     'small)          ; 返回 'big
```

## 2. `cond` 用法

### 基本语法

```scheme
 (cond
   (condition1 expression1)
   (condition2 expression2)
   ...
   (else expression-else))    ; 可选
```

### 特点

- **多个条件分支**
- **从上到下依次检查条件**
- **第一个为真的条件对应的表达式被执行**
- **`else` 分支是可选的**，相当于默认情况

### 示例(CS61A-hw08)

```scheme
 (define (ascending? s)
     (cond
         ((null? s) #t)
         ((null? (cdr s)) #t)
         ((> (car s) (car (cdr s))) #f)
         (else (ascending? (cdr s)))
     )
 )
```

## 3. `filter`用法

### 基本语法

```scheme
 (filter predicate list)
```

- **`predicate`**: 谓词函数，接受一个参数，返回 `#t` 或 `#f`
- **`list`**: 要过滤的列表
- **返回**: 包含所有满足谓词条件的元素的新列表

### `filter` 示例

```scheme
 ; 过滤偶数
 (filter even? '(1 2 3 4 5 6))        ; 结果: (2 4 6)
 
 ; 过滤正数
 (filter positive? '(-2 -1 0 1 2 3))  ; 结果: (1 2 3)
 
 ; 使用 lambda 过滤大于 5 的数
 (filter (lambda (x) (> x 5)) '(1 3 5 7 9 11))  ; 结果: (7 9 11)
 
 ; 过滤不等于某个值的元素
 (filter (lambda (x) (not (= x 3))) '(1 2 3 4 3 5))  ; 结果: (1 2 4 5)
```

### `cons` 用法

### 基本语法

```scheme
 (cons first-element rest-list)
```

- `first-element`：要添加的元素（任意类型）
- `rest-list`：一个列表（或点对）
- **非破坏性操作**：不修改原始列表
- **创建一个新的列表**，其中第一个元素是 `first-element`，后跟 `rest-list` 的所有元素

### 示例

```scheme
 (cons 1 '())                ; 结果: (1)
 (cons 1 '(2 3))             ; 结果: (1 2 3)
 (cons 'a '(b c d))          ; 结果: (a b c d)
 (cons '(1 2) '(3 4))        ; 结果: ((1 2) 3 4) - 注意第一个元素是列表
```

## 4.`list`用法

### 基本语法

```scheme
 (list item1 item2 ... itemN)
```

### 基本示例

```scheme
 (list)                       ; 结果: () - 空列表
 (list 1 2 3)                 ; 结果: (1 2 3)
 (list 'a 'b 'c)              ; 结果: (a b c)
 (list "hello" "world")       ; 结果: ("hello" "world")
 
 ;嵌套列表
 (list 1 (list 2 3) 4)        ; 结果: (1 (2 3) 4)
 (list (list 'a 'b) (list 'c 'd)) ; 结果: ((a b) (c d))
```

### 与 `cons` 的对比

```scheme
 ; 使用 list 创建
 (list 1 2 3)                 ; 结果: (1 2 3)
 
 ; 使用 cons 创建同样的结果
 (cons 1 (cons 2 (cons 3 '())))  ; 结果: (1 2 3)
 
 ; 处理嵌套列表的区别
 (list 1 '(2 3))              ; 结果: (1 (2 3))
 (cons 1 '(2 3))              ; 结果: (1 2 3) - 注意区别!
```

## 5.`append`用法

### 基本语法

```scheme
 (append list1 list2 ... listN)
```

- **合并多个列表**：将多个列表连接成一个新列表
- **展平结构**：连接列表的内容而非列表本身
- **保留最后参数结构**：最后一个参数的结构会被保留
- **非破坏性**：不修改原始列表
- **处理空列表**：空列表被视为中性元素

### 示例

```scheme
 (append '(1 2) '(3 4))       ; 结果: (1 2 3 4)
 (append '(a b) '(c d e))     ; 结果: (a b c d e)
 (append '() '(1 2 3))        ; 结果: (1 2 3)
 (append '(1 2 3) '())        ; 结果: (1 2 3)
```

## 6. `cons`, `list`, `append`的区别

- **`cons`** - 添加单个元素到列表**前面**
- **`list`** - 创建新列表，每个参数作为**独立元素**
- **`append`** - **连接**多个列表成一个列表

### 关键区别对比表

|          | **cons**                   | **list**                 | **append**             |
| -------- | -------------------------- | ------------------------ | ---------------------- |
| **作用** | **添加单个元素到列表前面** | **创建新列表**           | **连接多个列表**       |
| **参数** | **2个参数**                | **任意多个参数**         | **任意多个参数(列表)** |
| **结构** | **保留第二参数原始结构**   | **每个参数作为独立元素** | **展平并连接列表内容** |
| **用途** | **递归构建列表**           | **创建新的数据结构**     | **合并已有列表**       |

### 常用用例对比

#### 示例1: 将 `1` 和列表 `(2 3)` 组合

```scheme
 (cons 1 '(2 3))     ; => (1 2 3)
 (list 1 '(2 3))     ; => (1 (2 3))
 (append (list 1) '(2 3))  ; => (1 2 3)
```

#### 示例2: 创建列表 `(1 2 3)`

```scheme
 (cons 1 (cons 2 (cons 3 '())))  ; => (1 2 3)
 (list 1 2 3)                    ; => (1 2 3)
 (append '(1) '(2) '(3))         ; => (1 2 3)
```

#### 示例3: 组合两个列表 `(1 2)` 和 `(3 4)`

```scheme
 (cons '(1 2) '(3 4))    ; => ((1 2) 3 4)
 (list '(1 2) '(3 4))    ; => ((1 2) (3 4))
 (append '(1 2) '(3 4))  ; => (1 2 3 4)
```

## 7. `define`用法

### 1. 定义变量

```scheme
(define 变量名 表达式)
```

### 定义函数

```scheme
(define (函数名 参数1 参数2 ...) 函数体)
```

例子:

```scheme
(define (f x total)
  (if (< x 10)
    (f (+ x 2) (+ total (* x x)))
    total
  )
)
```
