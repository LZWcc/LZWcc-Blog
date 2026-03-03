---
title: 如何在 primereact 中实现主题切换器
description: 'No description.'
publishDate: 2026-03-03 22:41:05
tags:
  - React
---
## 1. 静态资源配置

阅读官方文档可知: 链接可以放在 `index.html`头部。

在 `index.html` 的 `<head>` 标签中预置一个 `id` 为 `theme-link` 的链接，作为初始主题：

```html
<link id="theme-link" rel="stylesheet" href="/themes/lara-light-blue/theme.css">
```

选择不同主题会改变HTML头中的css文件链接

将所需主题从 `./node_modules/primereact/resources/themes`中复制到 `./public/themes`下

```bash
cp -r ./node_modules/primereact/resources/themes/lara-light-cyan ./public/themes/lara-light-cyan
cp -r ./node_modules/primereact/resources/themes/lara-dark-cyan ./public/themes/lara-dark-cyan
```

## 2. 自定义 Hook

创建 `useThemeSwicher.js`hook

```javascript
import { useState, useEffect } from "react";

export function useThemeSwitcher(initialTheme = "light") {
  const [currentTheme, setCurrentTheme] = useState(initialTheme);

  const toggleTheme = () => {
    setCurrentTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    // 获取现有的 link 标签或创建一个新的
    let link = document.getElementById("theme-link");
  
    if (!link) {
      link = document.createElement("link");
      link.id = "theme-link";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    // 根据当前状态更新 href 路径
    link.href = `/themes/lara-${currentTheme}-cyan/theme.css`;

  }, [currentTheme]);

  return { currentTheme, toggleTheme };
}
```

## 3. 在组件中使用

现在可以在导航栏（如 `NavBar.jsx`）中引入该 Hook，并通过 PrimeReact 的 `Button` 组件触发切换。

```jsx
import { useThemeSwitcher } from "../hook/useThemeSwitcher";
import { Button } from "primereact/button";

export default function NavBar() {
  const { currentTheme, toggleTheme } = useThemeSwitcher();

  return (
    <div className="navbar-container">
      {/* 其他导航内容 */}
  
      <Button
        icon={`pi pi-${currentTheme === "light" ? "sun" : "moon"}`}
        rounded
        text
        severity="secondary"
        aria-label="Toggle Theme"
        onClick={toggleTheme}
        style={{ marginLeft: "0.5rem" }}
      />
    </div>
  );
}
```

---

## 参考资料

https://primereact.org/theming/

https://stackoverflow.com/questions/68327342/how-can-one-have-a-theme-switcher-in-primereact
