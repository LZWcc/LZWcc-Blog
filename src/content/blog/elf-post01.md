---
title: ELF 文件变量存储与段表/符号表分析笔记
description: 'Fine.'
publishDate: 2025-11-16 14:39:37
tags:
  - os
  - risc-v
---

## 问题如下

如下例⼦ C 语⾔代码 `hello.c`

```c
#include <stdio.h>
int global_init = 0x11111111;
const int global_const = 0x22222222;
void main()
{
        static int static_var = 0x33333333;
        static int static_var_uninit;
        int auto_var = 0x44444444;
        printf("hello world!\n");
        return;
}
```

请问编译为 .o 文件后，global_init, global_const, static_var, static_var_uninit, auto_var 这些变 量分别存放在那些 section ⾥，"hello world!\n" 这个字符串⼜在哪⾥？并尝试⽤⼯具查看并验证你的猜测\

---

## 前置工具(objdump和readelf)

| 工具      | 适合用途                       | 优点                                                           |
| --------- | ------------------------------ | -------------------------------------------------------------- |
| `readelf` | 查看 ELF 头、段表、符号表      | 结构化信息清楚，但内容原始，需要自己解码                       |
| `objdump` | 查看二进制内容、反汇编、段内容 | 可以直接看到每个字节的十六进制内容和对应 ASCII，方便找到字符串 |

---

```bash
# 编译
gcc -c hello.c -o hello.o
```

`readelf -s`获得符号索引表, 记录了所有**变量、函数、符号名**与它们所在的 section 之间的对应关系。

关键查看**Ndx** 含义: 该符号属于哪个段

```bash
readelf -s --wide hello.o # -s获得符号索引表
Symbol table '.symtab' contains 10 entries:
   Num:    Value          Size Type    Bind   Vis      Ndx Name
     0: 0000000000000000     0 NOTYPE  LOCAL  DEFAULT  UND
     1: 0000000000000000     0 FILE    LOCAL  DEFAULT  ABS hello.c
     2: 0000000000000000     0 SECTION LOCAL  DEFAULT    1 .text
     3: 0000000000000000     0 SECTION LOCAL  DEFAULT    5 .rodata
     4: 0000000000000000     4 OBJECT  LOCAL  DEFAULT    4 static_var_uninit.1
     5: 0000000000000004     4 OBJECT  LOCAL  DEFAULT    3 static_var.0
     6: 0000000000000000     4 OBJECT  GLOBAL DEFAULT    3 global_init
     7: 0000000000000000     4 OBJECT  GLOBAL DEFAULT    5 global_const
     8: 0000000000000000    37 FUNC    GLOBAL DEFAULT    1 main
     9: 0000000000000000     0 NOTYPE  GLOBAL DEFAULT  UND puts
```

`readelf -S` **查看 ELF 文件的 Section Header Table(段表)**

```bash
readelf -S --wide hello.o

There are 14 section headers, starting at offset 0x308:

Section Headers:
  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            0000000000000000 000000 000000 00      0   0  0
  [ 1] .text             PROGBITS        0000000000000000 000040 000025 00  AX  0   0  1
  [ 2] .rela.text        RELA            0000000000000000 000248 000030 18   I 11   1  8
  [ 3] .data             PROGBITS        0000000000000000 000068 000008 00  WA  0   0  4
  [ 4] .bss              NOBITS          0000000000000000 000070 000004 00  WA  0   0  4
  [ 5] .rodata           PROGBITS        0000000000000000 000070 000011 00   A  0   0  4
  [ 6] .comment          PROGBITS        0000000000000000 000081 00002c 01  MS  0   0  1
  [ 7] .note.GNU-stack   PROGBITS        0000000000000000 0000ad 000000 00      0   0  1
  [ 8] .note.gnu.property NOTE            0000000000000000 0000b0 000020 00   A  0   0  8
  [ 9] .eh_frame         PROGBITS        0000000000000000 0000d0 000038 00   A  0   0  8
  [10] .rela.eh_frame    RELA            0000000000000000 000278 000018 18   I 11   9  8
  [11] .symtab           SYMTAB          0000000000000000 000108 0000f0 18     12   6  8
  [12] .strtab           STRTAB          0000000000000000 0001f8 00004d 00      0   0  1
  [13] .shstrtab         STRTAB          0000000000000000 000290 000074 00      0   0  1
Key to Flags:
  W (write), A (alloc), X (execute), M (merge), S (strings), I (info),
  L (link order), O (extra OS processing required), G (group), T (TLS),
  C (compressed), x (unknown), o (OS specific), E (exclude),
  D (mbind), l (large), p (processor specific)
```

`objdump -s` 显示 ELF 文件中**节（section）的完整内容**，也就是**原始二进制数据**。

**常用参数**：

- `-s`：显示节内容
- `-j <section>`：只显示指定节（比如 `.text`、`.rodata`、`.data` 等）

```bash
objdump -s --wide hello.o

hello.o:     file format elf64-x86-64

Contents of section .text:
 0000 f30f1efa 554889e5 4883ec10 c745fc44  ....UH..H....E.D
 0010 44444448 8d050000 00004889 c7e80000  DDDH......H.....
 0020 000090c9 c3                          .....
Contents of section .data:
 0000 11111111 33333333                    ....3333
Contents of section .rodata:
 0000 22222222 68656c6c 6f20776f 726c6421  """"hello world!
 0010 00                                   .
Contents of section .comment:
 0000 00474343 3a202855 62756e74 75203133  .GCC: (Ubuntu 13
 0010 2e332e30 2d367562 756e7475 327e3234  .3.0-6ubuntu2~24
 0020 2e303429 2031332e 332e3000           .04) 13.3.0.
Contents of section .note.gnu.property:
 0000 04000000 10000000 05000000 474e5500  ............GNU.
 0010 020000c0 04000000 03000000 00000000  ................
Contents of section .eh_frame:
 0000 14000000 00000000 017a5200 01781001  .........zR..x..
 0010 1b0c0708 90010000 1c000000 1c000000  ................
 0020 00000000 25000000 00450e10 8602430d  ....%....E....C.
 0030 065c0c07 08000000                    .\......
```

可以得出结论👇

| 变量名              | 定义                 | 存放段                 | 原因                |
| ------------------- | -------------------- | ---------------------- | ------------------- |
| `global_init`       | 全局变量 + 已初始化  | `.data`                | 有初始值且可写      |
| `global_const`      | 全局常量             | `.rodata`              | const 数据只读      |
| `static_var`        | 局部静态 + 已初始化  | `.data`                | 静态 + 已初始化     |
| `static_var_uninit` | 局部静态 + 未初始化  | `.bss`                 | 静态 + 未初始化     |
| `auto_var`          | 局部变量（自动变量） | **栈中（运行时分配）** | 不在任何 section 里 |
| `"hello world!\n"`  | 字符串字面量         | `.rodata`              | 字符常量区（只读）  |

## 知识补充表格(ChatGPT)

**readelf**

| 参数 | 含义                                                                |
| ---- | ------------------------------------------------------------------- |
| `-s` | **symbol table**：显示符号表（函数、变量、全局符号等）              |
| `-S` | **section headers**：显示段表信息（各段的名字、类型、大小、偏移等） |

✅ 逻辑很直观：小写 s → symbol，小写 S → section（但记得 S 大写）

**objdump**

| 参数 | 含义                                                                          |
| ---- | ----------------------------------------------------------------------------- |
| `-s` | **section contents**：显示节（section）中的原始二进制数据（十六进制 + ASCII） |
| `-S` | **source + assembly**：在反汇编时，同时显示对应的源代码（如果有调试信息）     |

💡 **记忆技巧**：

- readelf → 偏向 **分析 ELF 结构**（symbol、section）
- objdump → 偏向 **分析指令/二进制**（contents、disassembly）
