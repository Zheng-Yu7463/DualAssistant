# Dual Ledger 双币账本

FastAPI + 原生 ES modules 的双币收支记录原型。账务语义是“只记录 CNY / USD 的收入和支出”：

- 不区分账户
- 不记录余额
- 保留轻量换汇记录，但换汇不计入收入 / 支出统计
- 按币种分别统计收入和支出

Stitch 导出的参考 HTML、截图和原始 MCP 返回保存在 `stitch_exports/`。

## Run

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

打开 `http://127.0.0.1:8000`。
