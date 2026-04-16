<a id="top"></a>

<div align="center">
  <img src="app/static/assets/profile.png" width="112px" alt="Dual Ledger logo" />
  <br />
  <br />

  <h1>Dual Ledger 双币账本</h1>
  <p><strong>只记录人民币和美元的收入 / 支出，换汇单独保存，不混进收支统计。</strong></p>

  <p>
    <img alt="Python" src="https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square&logo=python&logoColor=white" />
    <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" />
    <img alt="SQLite" src="https://img.shields.io/badge/SQLite-local-003B57?style=flat-square&logo=sqlite&logoColor=white" />
    <img alt="Frontend" src="https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black" />
    <img alt="Mobile First" src="https://img.shields.io/badge/UI-Mobile--first-004900?style=flat-square" />
  </p>

  <p>
    <a href="#-welcome">Welcome</a> |
    <a href="#-features">Features</a> |
    <a href="#-quick-start">Quick Start</a> |
    <a href="#-deployment">Deployment</a> |
    <a href="#-data-storage">Data Storage</a> |
    <a href="#-api">API</a> |
    <a href="#-roadmap">Roadmap</a>
  </p>
</div>

> [!IMPORTANT]
>
> 这是一个轻量个人账本，不做账户余额管理，也不把所有金额强制折算成单一本位币。普通收入 / 支出按原币种保存，换汇作为独立记录保存。

<details>
  <summary><kbd>目录</kbd></summary>

- [Welcome](#-welcome)
- [What's New](#-whats-new)
- [Features](#-features)
- [Screens](#-screens)
- [Quick Start](#-quick-start)
- [Deployment](#-deployment)
- [Data Storage](#-data-storage)
- [API](#-api)
- [Project Structure](#-project-structure)
- [Development Notes](#-development-notes)
- [Roadmap](#-roadmap)
- [Acknowledgements](#-acknowledgements)

</details>

## 🧭 Welcome

**Dual Ledger 双币账本**是一个面向个人使用的双币收支记录应用。

它的目标很明确：

- 记录人民币收入 / 支出
- 记录美元收入 / 支出
- 记录 CNY 和 USD 之间的换汇
- 按币种分别统计，不强行折算成一个总余额

这个项目当前采用 **FastAPI + SQLite + 原生 HTML/CSS/JavaScript**，适合部署在自己的服务器上，作为一个简单、私有、可控的个人账本。

<p align="right"><a href="#top">Back to top</a></p>

## 🚀 What's New

- **[2026.04.11]** 去掉启动时自动生成示例收支数据的逻辑，避免服务器重启后出现 demo 记录。
- **[2026.04.11]** 统计页支持本月 / 本年 / 累计三种周期切换。
- **[2026.04.11]** 统计页新增换汇统计，展示累计 / 本月换汇笔数、方向、转出金额、转入金额和平均汇率。
- **[2026.04.11]** 流水支持编辑和删除普通收支记录、换汇记录。
- **[2026.04.11]** 记一笔页面支持收入、支出、换汇三种记录类型。
- **[2026.04.11]** 类别选择改为弹窗式圆形图标选择器。
- **[2026.04.11]** 移动端优化时间输入框宽度，和其他输入框保持一致。

<p align="right"><a href="#top">Back to top</a></p>

## ✨ Features

### 收支记录

- 支持 `CNY` 和 `USD`
- 支持 `income` 和 `expense`
- 记录金额、类别、备注、时间
- 不区分账户，不记录银行卡 / 支付宝 / 微信余额

### 换汇记录

- 支持 `CNY → USD`
- 支持 `USD → CNY`
- 保存转出金额、转入金额、汇率、备注、时间
- 换汇不计入收入 / 支出统计

### 统计

- 本月人民币收入 / 支出
- 本月美元收入 / 支出
- 本年人民币收入 / 支出
- 本年美元收入 / 支出
- 累计人民币收入 / 支出
- 累计美元收入 / 支出
- 类别维度统计
- 换汇方向统计

### 数据管理

- 普通收支可编辑、删除
- 换汇记录可编辑、删除
- 数据保存在本地 SQLite 文件中
- 前端刷新后从后端重新同步数据

<p align="right"><a href="#top">Back to top</a></p>

## 📱 Screens

当前主导航包含 4 个页面：

| 页面 | 用途 |
| --- | --- |
| 总览 | 查看本月 / 累计收入支出、记录数、最近流水 |
| 记一笔 | 新增收入、支出、换汇 |
| 流水 | 按类型筛选、编辑、删除记录 |
| 统计 | 按本月 / 本年 / 累计查看币种统计、类别统计、换汇统计 |

Stitch 导出的参考 HTML、截图和原始 MCP 返回保存在 `stitch_exports/`。该目录用于设计参考，不是运行应用的必要文件。

<p align="right"><a href="#top">Back to top</a></p>

## 🛠️ Quick Start

### 1. 创建环境

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 本地启动

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

打开：

```text
http://127.0.0.1:8000
```

<p align="right"><a href="#top">Back to top</a></p>

## 🚢 Deployment

### Docker 部署

项目已经包含 `Dockerfile` 和 `docker-compose.yml`，可以直接构建并后台运行：

```bash
docker compose up -d --build
```

默认映射端口：

```text
http://你的服务器IP:8002
```

查看日志：

```bash
docker compose logs -f dualassistant
```

停止服务：

```bash
docker compose down
```

SQLite 数据会保存在宿主机的 `data/` 目录里：

```text
data/dual_ledger.sqlite3
```

只要保留这个目录，重建镜像或重启容器都不会丢账本数据。

### 开发式部署

如果只是临时在服务器上跑：

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

公网访问：

```text
http://你的公网IP:8002
```

如果访问不了，先确认服务是否监听：

```bash
ss -lntp | grep 8002
```

看到 `0.0.0.0:8002` 代表 FastAPI 已经在监听公网网卡。

### 放行系统防火墙

如果服务器启用了 `ufw`：

```bash
ufw status
ufw allow 8002/tcp
ufw reload
```

### 放行云安全组

如果系统防火墙已经放行但公网仍然访问不了，需要去云服务器控制台添加入方向规则：

```text
协议：TCP
端口：8002
来源：0.0.0.0/0
```

更安全的做法是只允许你自己的公网 IP 访问。

> [!TIP]
>
> `--reload` 适合开发调试。长期部署建议使用 `systemd` 管理服务，或者用 Nginx 反向代理到 `127.0.0.1:8002`。

<p align="right"><a href="#top">Back to top</a></p>

## 🗄️ Data Storage

当前使用 SQLite 文件存储：

```text
data/dual_ledger.sqlite3
```

这个文件由 FastAPI 启动时自动创建。`.gitignore` 默认忽略 SQLite 数据文件，避免把个人账本数据提交到 Git。

### 表结构

#### `entries`

普通收入 / 支出记录：

| 字段 | 说明 |
| --- | --- |
| `id` | 记录 ID |
| `type` | `income` 或 `expense` |
| `currency` | `CNY` 或 `USD` |
| `amount` | 金额 |
| `category` | 类别 |
| `note` | 备注 |
| `occurred_at` | 发生时间 |
| `created_at` | 创建时间 |

#### `exchanges`

换汇记录：

| 字段 | 说明 |
| --- | --- |
| `id` | 换汇记录 ID |
| `from_currency` | 转出币种 |
| `to_currency` | 转入币种 |
| `from_amount` | 转出金额 |
| `to_amount` | 转入金额 |
| `exchange_rate` | 汇率快照 |
| `note` | 备注 |
| `occurred_at` | 发生时间 |
| `created_at` | 创建时间 |

### 备份

部署前或升级前建议备份数据库：

```bash
cp data/dual_ledger.sqlite3 data/dual_ledger.sqlite3.bak
```

<p align="right"><a href="#top">Back to top</a></p>

## 🔌 API

| Method | Path | 说明 |
| --- | --- | --- |
| `GET` | `/` | 返回前端页面 |
| `GET` | `/api/bootstrap` | 返回所有记录和统计数据 |
| `GET` | `/api/entries` | 获取普通收入 / 支出记录 |
| `POST` | `/api/entries` | 新增普通收入 / 支出记录 |
| `PUT` | `/api/entries/{entry_id}` | 更新普通收入 / 支出记录 |
| `DELETE` | `/api/entries/{entry_id}` | 删除普通收入 / 支出记录 |
| `GET` | `/api/exchanges` | 获取换汇记录 |
| `POST` | `/api/exchanges` | 新增换汇记录 |
| `PUT` | `/api/exchanges/{exchange_id}` | 更新换汇记录 |
| `DELETE` | `/api/exchanges/{exchange_id}` | 删除换汇记录 |
| `GET` | `/api/transactions` | 兼容式流水查询接口 |
| `POST` | `/api/transactions` | 兼容式新增普通收支接口 |
| `GET` | `/api/reports` | 返回统计数据 |

### 示例：新增人民币支出

```bash
curl -X POST http://127.0.0.1:8000/api/entries \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "currency": "CNY",
    "amount": 128.6,
    "category": "餐饮",
    "note": "晚餐",
    "occurred_at": "2026-04-11T18:09"
  }'
```

### 示例：新增换汇

```bash
curl -X POST http://127.0.0.1:8000/api/exchanges \
  -H "Content-Type: application/json" \
  -d '{
    "from_currency": "CNY",
    "to_currency": "USD",
    "from_amount": 7000,
    "to_amount": 965,
    "exchange_rate": 7.254,
    "note": "换美元",
    "occurred_at": "2026-04-11T18:09"
  }'
```

<p align="right"><a href="#top">Back to top</a></p>

## 📂 Project Structure

```text
.
├── app
│   ├── main.py                 # FastAPI app, SQLite schema, API routes
│   └── static
│       ├── index.html          # Mobile-first shell
│       ├── app.js              # Frontend routing and interactions
│       ├── styles.css          # UI styles
│       └── assets/profile.png  # App avatar / favicon
├── data
│   └── dual_ledger.sqlite3     # Runtime database, ignored by Git
├── stitch_exports              # Stitch reference exports, optional
├── requirements.txt
└── README.md
```

<p align="right"><a href="#top">Back to top</a></p>

## 🧩 Development Notes

- 统计数据不是单独存表，而是从 `entries` 和 `exchanges` 实时计算。
- 换汇记录不会影响收入 / 支出总额。
- 当前没有用户系统，适合单人私有部署。
- 当前没有账户余额模型，产品逻辑刻意保持为“记录收入 / 支出 / 换汇事实”。
- 当前没有自动汇率服务，换汇时使用手动输入的汇率快照。

<p align="right"><a href="#top">Back to top</a></p>

## 🔜 Roadmap

- [x] CNY / USD 收入支出记录
- [x] CNY / USD 换汇记录
- [x] 类别弹窗选择器
- [x] 流水编辑 / 删除
- [x] 本月 / 本年 / 累计周期统计
- [x] 换汇统计
- [x] 移动端时间输入框样式修复
- [ ] CSV 导出
- [ ] 数据库备份 / 恢复入口
- [ ] systemd 部署模板
- [ ] Nginx 反向代理示例
- [ ] 简单访问密码或登录保护

<p align="right"><a href="#top">Back to top</a></p>

## 🤝 Acknowledgements

- UI 原型参考来自 Stitch 导出的页面和截图。
- 后端使用 [FastAPI](https://fastapi.tiangolo.com/)。
- 数据存储使用 [SQLite](https://www.sqlite.org/)。

<p align="right"><a href="#top">Back to top</a></p>
