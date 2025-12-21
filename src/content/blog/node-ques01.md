---
title: 使用 Node.js + Express + MySQL 实现动态字段映射的数据查询
description: 'Write your description here.'
publishDate: 2025-10-15 15:45:12
tags:
  - Node
---
## 🎯 项目目标

实现一个 RESTful API，具备以下功能：

1. 从数据库读取传感器数据
2. 根据字段映射表动态转换字段名
3. 返回格式化后的 JSON 数据给前端

## 🗄️ 数据库设计

### **1. 传感器数据表（`t_sensor_data`）**

用于存储传感器上报的原始数据：

```sql
CREATE TABLE `t_sensor_data` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键',
  `d_no` varchar(64) COMMENT '设备编码',
  `field1` varchar(255) COMMENT '预留字段1',
  `field2` varchar(255) COMMENT '预留字段2',
  `field3` varchar(255) COMMENT '预留字段3',
  `field4` varchar(255) COMMENT '预留字段4',
  `field5` varchar(255) COMMENT '预留字段5',
  -- ... field6-field10
  `c_time` datetime COMMENT '数据更新时间',
  `online` varchar(4) COMMENT '是否在线数据',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

### **2. 字段映射表（`t_sensor_field_mapper`）**

用于定义物理字段与前端显示名称的映射关系：

```sql
CREATE TABLE `t_sensor_field_mapper` (
  `id` int(11) NOT NULL,
  `f_name` varchar(255) NOT NULL COMMENT '前端显示名称',
  `db_name` varchar(255) NOT NULL COMMENT '数据库字段名',
  `p_name` varchar(255) NOT NULL COMMENT '物理层属性名',
  `visible` varchar(4) COMMENT '是否可见 0:不可见 1:可见',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

#### 启动MySQL服务

```shell
brew services start mysql
-- 创建数据库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS wusiqi CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
-- 写入数据库
mysql -u root -p wusiqi < wusiqi.sql   
```

#### 完整代码

```javascript
import express from 'express'
import mysql from 'mysql2/promise'
import cors from 'cors';

const app = express()
// 允许跨域请求
app.use(cors())

// 创建数据库连接池
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'wusiqi',
})

app.get('/api/sensor-data-formatted', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM t_sensor_field_mapper WHERE visible = "1"')
  const fieldMapping = {}
  rows.forEach((mapper) => {
    fieldMapping[mapper.db_name] = mapper.f_name
  })

  const [dataRows] = await db.query('SELECT * FROM t_sensor_data LIMIT 10')

  const formattedData = dataRows.map((row) => {
    const formatted = {
      "设备编码": row.d_no,
      "更新时间": row.c_time,
      "是否在线数据": row.online,
    }

    // 遍历映射表，将 field1-field10 转换为中文名称
    Object.keys(fieldMapping).forEach((dbName) => {
      // formatted['湿度'] = row['field1']  // '12'
      const chineseName = fieldMapping[dbName]
      formatted[chineseName] = row[dbName]
    })

    return formatted  // 将处理后的formatted对象放入新数组formattedData中
  })
  res.json(formattedData)  // 发送http响应返回给客户端
})

// 启动服务器
const PORT = 8081
app.listen(PORT, () => {
  console.log(`API 地址：`)
  console.log(`  - http://localhost:${PORT}/api/sensor-data-formatted`)
})

```

原始的 `dataRows`为

```shell
[
  {
    id: 4039,
    d_no: '2021',
    field1: '12',
    field2: '23',
    field3: '45',
    field4: '43',
    field5: null,
    field6: null,
    field7: null,
    field8: null,
    field9: null,
    field10: null,
    c_time: 2024-06-29T12:13:21.000Z,
    online: '实时数据'
  },
...
]
```

处理后的数据:

```shell
[{
    '设备编码': '2021',
    '更新时间': 2024-06-29T12:13:59.000Z,
    '是否在线数据': '保存数据',
    '水质2': '67',
    '水温2': '43',
    '水质1': '45',
    '湿度': '23'
  },
...
]
```

## 渲染到Element Plus表格组件

```shell
<el-table :data="tableData" stripe style="width: 100%">
      <el-table-column
        v-for="key in tableHeader"
        :key="key"
        :prop="key"
        :label="key"
      />
</el-table>
```



**`Object.keys(data[0])`** 提取数据对象的所有键名（属性名）, 当 prop 的值和数据对象的键名相同时，Element Plus 就能正确地取出对应的值

```
["设备编码", "更新时间", ”是否在线数据", ...]
```

**`v-for`** 循环这些键名，生成多个 `<el-table-column>` 组件

```javascript
// 数据对象的键
{
  "设备编码": "2021",  ← 键名
  "湿度": "12"         ← 键名
}

// 列组件的 prop
<el-table-column prop="设备编码" />  ← prop 值
<el-table-column prop="湿度" />      ← prop 值
```

