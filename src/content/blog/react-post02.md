---
title: （二）路由导航和路由嵌套
description: 'No description'
publishDate: 2026-02-12 02:32:57
tags:
  - React
---
## 基本模板

`src/main.jsx`

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.jsx`

```jsx
import { BrowserRouter, Routes, Route } from 'react-router'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

---

## 嵌套路由

`App.jsx`

```jsx
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

**`<AppLayout />` 是父路由(布局路由)：** 它没有 `path`。它的作用是渲染通用的 UI 结构。

`AppLayout.jsx`

```jsx
import { Outlet, useLocation, useNavigate } from "react-router"
function AppLayout() {
  const location = useLocation()
  const pathname = location.pathname
  const navigate = useNavigate()

  function toggle() {
    if (pathname === "/") {
      navigate("/about")
    } else {
      navigate("/")
    }
  }
  
  return (
    <>
      <button onClick={toggle}>Toggle</button>
      <Outlet />
    </>
  )
}

export default AppLayout
```

**1. 核心组件：`<Outlet />` (占位符)**

- **定义**：嵌套路由的**占位组件**。
- **作用**：在父组件（如 `AppLayout`）中预留一块区域，动态渲染匹配到的**子路由组件**（如 `Home` 或 `About`）。

**2. 路由核心 Hooks**

- **`useLocation()`**：获取当前 URL 信息。
  - `location.pathname`：获取当前路径（如 `"/"`）。
- **`useNavigate()`**：执行跳转指令。
  - `navigate("/about")`：**编程式导航**，跳转到指定路径。

---

## 参考资料

[Outlet | React Router --- Outlet | React Router](https://reactrouter.com/api/components/Outlet#outlet)

[useLocation | React Router](https://reactrouter.com/api/hooks/useLocation)
