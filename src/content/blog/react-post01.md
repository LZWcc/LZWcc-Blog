---
title: （一）初识React Router
description: 'React Router 系列第一篇：安装 v7，用 createBrowserRouter 和 RouterProvider 配置路由，以及 element 和 Component 两种写法的区别。'
publishDate: 2026-02-12 02:31:13
tags:
  - React
category: study
---
## 基本配置

安装React Router

```bash
pnpm add react-router #V7不再需要 react-router-dom
```

配置路由 `src/main.jsx`

```jsx
import { BrowserRouter, Routes, Route } from "react-router";
import { createBrowserRouter, RouterProvider } from "react-router";
// v6 引入，v7 依然保留。需要写成 JSX 标签 <Component />
const router = createBrowserRouter([
  {
    path: "/",
    element: <Root title="首页" /> // 优点：可以直接传 props
  }
]);

// v7 新增。直接传入组件函数名，不需要写尖括号
const router = createBrowserRouter([
  { 
    path: "/", 
    Component: Root // 注意：属性名 C 大写，且不能直接传 props
  }
]);

// 无论用哪种写法，最后都要通过 RouterProvider 渲染
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
```

---

## **官方文档**

[Installation | React Router](https://reactrouter.com/start/data/installation)

[Routing | React Router](https://reactrouter.com/start/data/routing)
