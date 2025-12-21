---
title: 面向对象程序设计-- 期末复习笔记
description: '仍在更新...未完成'
publishDate: 2025-12-21 16:20:16
tags:
  - OOP
  - Java
---

---

## 知识点

```java
// 比较值是否相同
a.equals(b);
// 获取用户输入
Scanner sc = new Scanner(System.in);
String str = sc.next();	// 字符串
double depositAmount = sc.nextDouble();	// 浮点数
// 构造器
class Student {
    private static int count = 0;
    public Student() {} // 空参数构造器
    public Student(String name, ...);	// 多参数构造器
    // 静态初始化块 (只执行一次)
    static { System.out.println("This is static initialization block"); }
    // 初始化块 (每次创建对象都会执行)
    {
        id = count++;
        System.out.println("This is initialization block, id is " + id);
    }
}
// 重写toString方法
@Override
public String toString() { return "一个字符串" }

```

---

## PTA

```java
import java.util.*;
// 主函数写法
public class Main {
    public static void main(String[] args) {}
}
```

### 25年java实验题目集-继承与多态

```java
interface Performable {
    void play();	// 等价于public abstract void play();
}
class Monkey implements Performable {}
class Coach {
    public void check(Performable p) { p.play(); }	// 多态
}
```

---

## 头歌

## Java中的异常

**检测型异常(Checked Exception)**

要么 `try-catch`, 要么 `throws` 抛到上层

```java
public static void main(String[] args) throws FileNotFoundException {
    test();
}
public static void test() throws FileNotFoundException {
    File file = new File("abc");
    if(!file.exists()){		//判断文件是否存在
        //文件不存在，则 抛出 文件不存在异常
        throw new FileNotFoundException("该文件不存在");
    }else{
        FileInputStream fs = new FileInputStream(file);
    }
}
```

**运行时异常(Uncheckce Exception)**: 不需要在方法上声明 throws

### 自定义异常

```java
class MyException extends Exception {
    public MyException(String msg) {
        super(msg);
    }
}

public class Task {
	public static void main(String[] args) throws MyException {
		Scanner sc = new Scanner(System.in);
		String username = sc.next();

		//判断用户名
        if (username.length() < 3) {
            throw new MyException("用户名小于三位Exception");
        } else {
            System.out.println("用户名格式正确");
        }
	}
}
```

`str.charAt(i)`取出字符串的第 `i`个字符

`Chacter.isDigit(char ch)`判断某个字符是否是数字字符

```java
if (!sc.hasNextLine()) break; // 检查是否有下一行输入, 若没有, 则break
String line = sc.nextLine().trim(); 	// 读取完整的一行字符串
String[] parts = line.split("\\s+");	// 按空白字符分割字符串
if (parts.length < 2) {
    throw new NoSuchElementException();
}
```

---

## 清览

### 面向对象-第四章-1-作业

在调用方法时, 若要使方法改变实参的值, 可以**用对象作为参数**

**重载（Overload）**：同一类中，方法名相同，但参数的个数、类型、顺序不同**(至少满足一项)**, **仅返回值类型不同不构成重载**

**覆盖（Override）**：子类重写父类的方法，要求方法名、参数、返回值完全一致

构造函数**没有返回值类型(不是void型)**

被 `private`修饰的成员变量只能被该类自身访问和修改, 调用

Java 类默认会有一个 “隐式的无参构造方法”，但只要手动定义了任意构造方法，这个默认的无参构造方法就不再自动生成

**匿名内部类**

```java
// 父类
class Animal {
    void sound() {
        System.out.println("动物叫");
    }
}

// 匿名内部类
Animal a = new Animal() {
    @Override
    void sound() {
        System.out.println("狗叫：汪汪！");
    }
};

a.sound();
```

### 面向对象-第五章-1-作业

接口的正确定义需遵循以下规则

1. **关键字**：用 `interface`声明（不能用 `abstract`修饰，接口默认是抽象的）；
2. **继承**：接口可以通过 `extends`继承多个其他接口（类不支持多继承，但接口支持）；

```java
interface 接口名 extends 父接口1, 父接口2 {
    // 抽象方法（无方法体）
    返回值类型 方法名(参数列表);
}
```

`String[] args` 和 `String args[]` 是数组声明的两种等价写法（前者是更推荐的 “数组类型 + 变量名” 风格，后者是兼容 C 语言的写法）。

1. 类修饰符：`abstract`（抽象类，需被继承）与 `final`（最终类，禁止继承）不能同时修饰类；
2. 方法修饰符：`abstract`（抽象方法，需被重写）与 `private`（私有方法，无法继承）不能共存；`abstract` 方法不能有方法体；
3. 变量修饰符：`protected`（受保护访问）与 `private`（私有访问）是互斥访问修饰符，不能同时修饰变量。
   - 接口**本身不能用 `abstract` 修饰**（默认抽象）；
   - 接口的方法**默认是 `public abstract`**（只能用这两个修饰符）；
   - 接口的变量**默认是 `public static final`**。

### 面向对象-第五章-2-作业

Java编程所必须的默认引用包为 `java.lang`包

使用 `Iterator`遍历集合时，**必须通过 `Iterator`自身的 `remove()`方法删除元素**

在Java中, 用 package 语句说明一个包时, 该包的层次结构必须**与文件目录的层次相同**

实现多重继承效果方式是**接口(Interface)**

1. **接口定义**：用 `interface`关键字声明，接口中的方法默认是 `public abstract`（可省略，但显式写 `abstract`也合法）。
2. **类实现接口**：**类通过 `implements`关键字实现多个接口**（模拟 “多重继承”，因为 Java 类仅支持单继承，但可实现多个接口）。
3. **规则**：实现接口的类必须重写接口中所有抽象方法。

### 面向对象-第六章-配套试卷

若方法内部调用了IOException, 需要在方法声明处通过 `throws`关键字声明该异常

```java
public void methodName throws IOException {}
```

Java 异常分为**检查型异常**（编译期强制处理）和**非检查型异常**（运行时异常，编译期不强制处理）。

- **A. NullPointerException**：空指针异常，属于运行时异常（非检查型）。
- **B. ClassCastException**：类型转换异常，属于运行时异常（非检查型）。
- **C. FileNotFoundException**：文件未找到异常，属于检查型异常，编译期要求必须声明或捕获。
- **D. IndexOutOfBoundsException**：索引越界异常，属于运行时异常（非检查型）。

### 面向对象-第七章-配套试卷

Chartacter流与Byte流的区别是(前者是字符读写, 后者是字节读写)

| 选项                  | 分析                                                                                     | 结论 |
| --------------------- | ---------------------------------------------------------------------------------------- | ---- |
| A.`BufferedWriter`    | 属于**面向字符的输出流**，用于缓冲字符写入操作，并非输入流。                             | 错误 |
| B.`FileInputStream`   | 属于**面向字节的输入流**，以字节为单位读取文件数据，不是字符流。                         | 错误 |
| C.`ObjectInputStream` | 属于**对象输入流**，用于读取序列化的对象数据，本质是字节流的扩展，并非字符流。           | 错误 |
| D.`InputStreamReader` | 是**字节流到字符流的转换流**，将字节输入流转换为面向字符的输入流，属于字符输入流的范畴。 | 正确 |

| 选项                                                    | 分析                                                                                                                                                   | 结论 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| A.`new BufferedWriter(new FileWriter("a.txt"))`         | `BufferedWriter` 接收 `Writer` 类型参数，`FileWriter` 是 `Writer` 的子类，语法合法。                                                                   | 正确 |
| B.`new BufferedReader(new FileInputStream("a.dat"))`    | `BufferedReader` 要求接收 `Reader` 类型参数，但 `FileInputStream` 是字节流（属于 `InputStream` 类），并非字符流（`Reader` 类），类型不匹配，语法错误。 | 错误 |
| C.`new GZIPOutputStream(new FileOutputStream("a.zip"))` | `GZIPOutputStream` 接收 `OutputStream` 类型参数，`FileOutputStream` 是 `OutputStream` 的子类，语法合法。                                               | 正确 |
| D.`new ObjectInputStream(new FileInputStream("a.dat"))` | `ObjectInputStream` 接收 `InputStream` 类型参数，`FileInputStream` 是 `InputStream` 的子类，语法合法。                                                 | 正确 |
