---
title: （三）动态路由及SearchParams
description: 'No description'
publishDate: 2026-02-12 02:34:08
tags:
  - React
---
## 动态路由

如果路径段以冒号 `:` 开头，则它就成为一个“动态段”。当路由与 URL 匹配时，动态段将从 URL 中解析出来，并作为 `params` 提供给其他路由 API。

```jsx
<Route path="/memo/:memoId" element={<MemoItem />} />
```

```jsx
import { useParams } from "react-router"
// 例如当url为http://localhost:5174/memo/114514
const { memoId } = useParams() // memoId = '114514'
```

## `useSearchParams()`--用于查询参数

```jsx
import { useSearchParams } from "react-router"
```

查询参数位于URL中 `?`之后。为键值对，常用于过滤、排序或分页等操作。一个常见的URL可能如下所示：

```
/products?category=books&page=2
```

### 获取参数值

```jsx
import { useSearchParams } from 'react-router';

const ProductList = () => {
    const [searchParams] = useSearchParams();
    // 获取参数值
    const category = searchParams.get('category'); // 'books'
    const page = searchParams.get('page'); // '2'

    return (
        <div>
            <h1>Category: {category}</h1>
            <p>Page: {page}</p>
        </div>
    );
};
```

### 更新单个参数值

```jsx
setSearchParams('q', 'react router');
```

### 同时更新多个参数值

```jsx
setSearchParams({ q: 'react router', lang: 'fr' });
```

## 实战 -- 将输入框和查询参数双向绑定

`Search.jsx`

```jsx
import { TextField } from "@mui/material"
import MemoList from "./MemoList"
import { useState } from "react"
import { useSearchParams } from "react-router"
function Search() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [searchItem, setSearchItem] = useState(searchParams.get("q") || "")

    function onChange(event) {
        const { value } = event.target
        setSearchItem(value)
        setSearchParams({ q: value })
    }
    return (
        <>
        <TextField
            id="outlined-basic"
            label="Memo Title"
            variant="outlined"
            value={searchItem}
            onChange={onChange}
            />
        <MemoList searchItem={searchItem} />
        </>
    )
}
export default Search
```

---

## 参考资料

[Routing | React Router](https://reactrouter.com/start/data/routing#dynamic-segments)

[Understanding useParams() and useSearchParams() in React Router — A Beginner&#39;s Guide | by Soham Dave | Medium](https://medium.com/@SohamDave08/understanding-useparams-and-usesearchparams-in-react-router-a-beginners-guide-6faaf0534187)
