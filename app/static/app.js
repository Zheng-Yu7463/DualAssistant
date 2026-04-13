const app = document.querySelector("#app");
const navItems = document.querySelectorAll(".nav-item");
const refreshButton = document.querySelector("#refreshButton");

const routes = {
  dashboard: renderDashboard,
  add: renderAdd,
  transactions: renderTransactions,
  reports: renderReports,
};

let state = {
  route: "dashboard",
  entryCurrency: "CNY",
  entryType: "expense",
  exchangeDirection: "CNY_USD",
  selectedCategory: "餐饮",
  categoryPickerOpen: false,
  editingRecord: null,
  transactionFilter: "all",
  reportPeriod: "monthly",
  data: null,
};

const categoryCatalog = {
  income: [
    ["工资", "工"],
    ["奖金", "奖"],
    ["咨询", "咨"],
    ["投资", "投"],
    ["退款", "退"],
    ["礼金", "礼"],
    ["利息", "息"],
    ["报销", "报"],
    ["兼职", "兼"],
    ["其他收入", "其"],
  ],
  expense: [
    ["餐饮", "餐"],
    ["购物", "购"],
    ["交通", "行"],
    ["居住", "住"],
    ["订阅", "订"],
    ["学习", "学"],
    ["医疗", "医"],
    ["旅行", "旅"],
    ["娱乐", "娱"],
    ["家庭", "家"],
    ["礼物", "礼"],
    ["其他支出", "其"],
  ],
};

const reportPeriods = [
  ["monthly", "本月"],
  ["yearly", "本年"],
  ["all_time", "累计"],
];

const fmt = {
  money(value, currency) {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  },
  rate(value) {
    return new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(Number(value || 0));
  },
  date(value) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  },
  inputDate(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  },
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    let detail = "请求失败";
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {
      detail = response.statusText;
    }
    throw new Error(Array.isArray(detail) ? detail.map((item) => item.msg).join("; ") : detail);
  }
  return response.json();
}

async function load() {
  state.data = await api("/api/bootstrap");
  render();
}

function setData(payload) {
  state.data = payload;
  render();
}

function toast(message) {
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  document.body.appendChild(element);
  setTimeout(() => element.remove(), 2400);
}

function setRoute(route) {
  state.route = route;
  state.categoryPickerOpen = false;
  state.editingRecord = null;
  navItems.forEach((item) => item.classList.toggle("active", item.dataset.route === route));
  render();
}

function activeCategories() {
  return categoryCatalog[state.entryType];
}

function normalizeSelectedCategory() {
  const categories = activeCategories().map(([name]) => name);
  if (!categories.includes(state.selectedCategory)) {
    state.selectedCategory = categories[0];
  }
}

function render() {
  if (!state.data) {
    app.innerHTML = `<div class="empty">加载中</div>`;
    return;
  }
  routes[state.route]();
  if (state.editingRecord) {
    app.insertAdjacentHTML("beforeend", renderEditModal());
  }
}

function renderPageTitle(title, copy) {
  return "";
}

function renderEntry(entry) {
  if (entry.kind === "exchange") {
    return `
      <article class="entry exchange">
        <div class="row">
          <div>
            <div class="label">换汇 · ${fmt.date(entry.occurred_at)}</div>
            <strong>${entry.from_currency} → ${entry.to_currency}</strong>
            <p class="supporting">汇率 ${Number(entry.exchange_rate).toFixed(4)}${entry.note ? ` · ${escapeHtml(entry.note)}` : ""}</p>
          </div>
          ${renderRecordActions("exchange", entry.id)}
        </div>
        <div class="flow">
          <div class="node">
            <div class="label">转出</div>
            <div class="amount expense">-${fmt.money(entry.from_amount, entry.from_currency)}</div>
          </div>
          <div class="arrow">→</div>
          <div class="node">
            <div class="label">转入</div>
            <div class="amount income">+${fmt.money(entry.to_amount, entry.to_currency)}</div>
          </div>
        </div>
      </article>
    `;
  }
  const sign = entry.type === "income" ? "+" : "-";
  const tone = entry.type === "income" ? "income" : "expense";
  const kind = entry.type === "income" ? "收入" : "支出";
  return `
    <article class="entry">
      <div class="row">
        <div>
          <div class="label">${entry.currency} · ${kind} · ${fmt.date(entry.occurred_at)}</div>
          <strong>${escapeHtml(entry.category)}</strong>
          <p class="supporting">${escapeHtml(entry.note || "无备注")}</p>
        </div>
        <div class="entry-side">
          <div class="amount ${tone}">${sign}${fmt.money(entry.amount, entry.currency)}</div>
          ${renderRecordActions("entry", entry.id)}
        </div>
      </div>
    </article>
  `;
}

function renderRecordActions(kind, id) {
  return `
    <div class="record-actions">
      <button class="mini-button" data-edit-kind="${kind}" data-edit-id="${escapeHtml(id)}" type="button">编辑</button>
      <button class="mini-button danger" data-delete-kind="${kind}" data-delete-id="${escapeHtml(id)}" type="button">删除</button>
    </div>
  `;
}

function findRecord(kind, id) {
  const list = kind === "exchange" ? state.data.exchanges : state.data.entries;
  return list.find((item) => item.id === id);
}

function categoryOptions(type, selected) {
  return categoryCatalog[type].map(([name]) => `
    <option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>
  `).join("");
}

function renderEditModal() {
  const { kind, id } = state.editingRecord;
  const record = findRecord(kind, id);
  if (!record) {
    state.editingRecord = null;
    return "";
  }
  return kind === "exchange" ? renderEditExchangeModal(record) : renderEditEntryModal(record);
}

function renderEditEntryModal(record) {
  return `
    <div class="modal-backdrop" data-close-edit-modal="true">
      <section class="category-modal" role="dialog" aria-modal="true" aria-label="编辑记录">
        <div class="modal-handle"></div>
        <div class="row">
          <div>
            <h3>编辑记录</h3>
            <p class="supporting">修改后会重新统计收入和支出</p>
          </div>
          <button class="ghost-button" data-close-edit-modal="true" type="button">关闭</button>
        </div>
        <form id="editEntryForm" class="form" data-record-id="${escapeHtml(record.id)}">
          <div class="grid two">
            <div class="field">
              <label for="edit-entry-currency">币种</label>
              <select id="edit-entry-currency" name="currency">
                <option value="CNY" ${record.currency === "CNY" ? "selected" : ""}>CNY</option>
                <option value="USD" ${record.currency === "USD" ? "selected" : ""}>USD</option>
              </select>
            </div>
            <div class="field">
              <label for="edit-entry-type">类型</label>
              <select id="edit-entry-type" name="type">
                <option value="income" ${record.type === "income" ? "selected" : ""}>收入</option>
                <option value="expense" ${record.type === "expense" ? "selected" : ""}>支出</option>
              </select>
            </div>
            <div class="field">
              <label for="edit-entry-amount">金额</label>
              <input id="edit-entry-amount" name="amount" type="number" min="0" step="0.01" value="${Number(record.amount)}" required />
            </div>
            <div class="field">
              <label for="edit-entry-category">类别</label>
              <select id="edit-entry-category" name="category">
                ${categoryOptions(record.type, record.category)}
              </select>
            </div>
          </div>
          <div class="field">
            <label for="edit-entry-note">备注</label>
            <textarea id="edit-entry-note" name="note">${escapeHtml(record.note || "")}</textarea>
          </div>
          <div class="field">
            <label for="edit-entry-date">时间</label>
            <input id="edit-entry-date" name="occurred_at" type="datetime-local" value="${fmt.inputDate(record.occurred_at)}" required />
          </div>
          <button class="primary-button" type="submit">保存修改</button>
        </form>
      </section>
    </div>
  `;
}

function renderEditExchangeModal(record) {
  const direction = `${record.from_currency}_${record.to_currency}`;
  return `
    <div class="modal-backdrop" data-close-edit-modal="true">
      <section class="category-modal" role="dialog" aria-modal="true" aria-label="编辑换汇">
        <div class="modal-handle"></div>
        <div class="row">
          <div>
            <h3>编辑换汇</h3>
            <p class="supporting">换汇不会计入收入 / 支出统计</p>
          </div>
          <button class="ghost-button" data-close-edit-modal="true" type="button">关闭</button>
        </div>
        <form id="editExchangeForm" class="form" data-record-id="${escapeHtml(record.id)}">
          <div class="field">
            <label for="edit-exchange-direction">方向</label>
            <select id="edit-exchange-direction" name="direction">
              <option value="CNY_USD" ${direction === "CNY_USD" ? "selected" : ""}>CNY → USD</option>
              <option value="USD_CNY" ${direction === "USD_CNY" ? "selected" : ""}>USD → CNY</option>
            </select>
          </div>
          <div class="grid three">
            <div class="field">
              <label for="edit-exchange-from">转出金额</label>
              <input id="edit-exchange-from" name="from_amount" type="number" min="0" step="0.01" value="${Number(record.from_amount)}" required />
            </div>
            <div class="field">
              <label for="edit-exchange-rate">汇率 CNY/USD</label>
              <input id="edit-exchange-rate" name="exchange_rate" type="number" min="0" step="0.0001" value="${Number(record.exchange_rate)}" required />
            </div>
            <div class="field">
              <label for="edit-exchange-to">转入金额</label>
              <input id="edit-exchange-to" name="to_amount" type="number" min="0" step="0.01" value="${Number(record.to_amount)}" required />
            </div>
          </div>
          <div class="field">
            <label for="edit-exchange-note">备注</label>
            <textarea id="edit-exchange-note" name="note">${escapeHtml(record.note || "")}</textarea>
          </div>
          <div class="field">
            <label for="edit-exchange-date">时间</label>
            <input id="edit-exchange-date" name="occurred_at" type="datetime-local" value="${fmt.inputDate(record.occurred_at)}" required />
          </div>
          <button class="primary-button" type="submit">保存修改</button>
        </form>
      </section>
    </div>
  `;
}

function totalCard(currency, title) {
  const emptyTotals = { income: 0, expense: 0, net: 0 };
  const monthlyData = state.data.summary.monthly?.[currency] || emptyTotals;
  const dailyData = state.data.summary.daily?.[currency] || emptyTotals;
  return `
    <article class="card ${currency === "CNY" ? "hero-card" : ""}">
      <div class="balance-line">
        <div>
          <p class="label">${title}</p>
          <div class="balance">${fmt.money(monthlyData.expense, currency)}</div>
          <div class="balance-fields">
            <p class="supporting">今日支出 ${fmt.money(dailyData.expense, currency)}</p>
            <p class="supporting">本月收入 ${fmt.money(monthlyData.income, currency)}</p>
          </div>
        </div>
        <span class="currency-chip ${currency === "USD" ? "green" : ""}">${currency}</span>
      </div>
    </article>
  `;
}

function renderDashboard() {
  const summary = state.data.summary;
  app.innerHTML = `
    ${renderPageTitle("收入支出总览", "这里只记录人民币和美元的收入 / 支出，不区分账户，也不计算余额。")}
    <section class="dashboard-grid">
      ${totalCard("CNY", "本月人民币支出")}
      ${totalCard("USD", "本月美元支出")}
    </section>
    <section class="stack">
      <div class="row">
        <h3>最近记录</h3>
        <button class="ghost-button" data-route-jump="transactions" type="button">查看全部</button>
      </div>
      ${summary.recent_entries.length ? summary.recent_entries.map(renderEntry).join("") : `<div class="empty">还没有记录</div>`}
    </section>
  `;
}

function renderAdd() {
  if (state.entryType !== "exchange") normalizeSelectedCategory();
  app.innerHTML = `
    ${renderPageTitle("记一笔", "收入和支出按原币种记录；换汇单独保存，不计入收支统计。")}
    <section class="card stack">
      <div class="segmented" aria-label="记录类型">
        <button class="${state.entryType === "income" ? "active" : ""}" data-entry-type="income" type="button">收入</button>
        <button class="${state.entryType === "expense" ? "active" : ""}" data-entry-type="expense" type="button">支出</button>
        <button class="${state.entryType === "exchange" ? "active" : ""}" data-entry-type="exchange" type="button">换汇</button>
      </div>
      ${state.entryType === "exchange" ? renderExchangeForm() : renderEntryForm()}
    </section>
    ${state.categoryPickerOpen ? renderCategoryPicker() : ""}
  `;
}

function renderEntryForm() {
  return `
      <form id="entryForm" class="form">
        <div class="segmented" aria-label="币种">
          <button class="${state.entryCurrency === "CNY" ? "active" : ""}" data-entry-currency="CNY" type="button">人民币 CNY</button>
          <button class="${state.entryCurrency === "USD" ? "active" : ""}" data-entry-currency="USD" type="button">美元 USD</button>
        </div>
        <div class="grid two">
          <div class="field">
            <label for="entry-amount">金额</label>
            <input id="entry-amount" name="amount" type="number" min="0" step="0.01" placeholder="0.00" required />
          </div>
          <div class="field">
            <label for="entry-category">类别</label>
            <input id="entry-category" name="category" type="hidden" value="${escapeHtml(state.selectedCategory)}" required />
            <button class="category-select" data-open-category-picker="true" type="button">
              <span class="category-icon">${escapeHtml(activeCategories().find(([name]) => name === state.selectedCategory)?.[1] || "类")}</span>
              <span>
                <strong>${escapeHtml(state.selectedCategory)}</strong>
                <small>点击选择类别</small>
              </span>
            </button>
          </div>
        </div>
        <div class="field">
          <label for="entry-note">备注</label>
          <textarea id="entry-note" name="note" placeholder="可选"></textarea>
        </div>
        <div class="field">
          <label for="entry-date">时间</label>
          <input id="entry-date" name="occurred_at" type="datetime-local" value="${fmt.inputDate()}" required />
        </div>
        <button class="primary-button" type="submit">保存${state.entryCurrency === "CNY" ? "人民币" : "美元"}${state.entryType === "income" ? "收入" : "支出"}</button>
      </form>
  `;
}

function renderExchangeForm() {
  const fromCurrency = state.exchangeDirection === "CNY_USD" ? "CNY" : "USD";
  const toCurrency = state.exchangeDirection === "CNY_USD" ? "USD" : "CNY";
  return `
    <form id="exchangeForm" class="form">
      <div class="segmented" aria-label="换汇方向">
        <button class="${state.exchangeDirection === "CNY_USD" ? "active" : ""}" data-exchange-direction="CNY_USD" type="button">CNY → USD</button>
        <button class="${state.exchangeDirection === "USD_CNY" ? "active" : ""}" data-exchange-direction="USD_CNY" type="button">USD → CNY</button>
      </div>
      <div class="grid three">
        <div class="field">
          <label for="exchange-from-amount">转出金额 ${fromCurrency}</label>
          <input id="exchange-from-amount" name="from_amount" type="number" min="0" step="0.01" placeholder="0.00" required />
        </div>
        <div class="field">
          <label for="exchange-rate">汇率 CNY/USD</label>
          <input id="exchange-rate" name="exchange_rate" type="number" min="0" step="0.0001" placeholder="7.20" required />
        </div>
        <div class="field">
          <label for="exchange-to-amount">转入金额 ${toCurrency}</label>
          <input id="exchange-to-amount" name="to_amount" type="number" min="0" step="0.01" placeholder="自动计算" required />
        </div>
      </div>
      <div class="field">
        <label for="exchange-note">备注</label>
        <textarea id="exchange-note" name="note" placeholder="例如：换美元旅行"></textarea>
      </div>
      <div class="field">
        <label for="exchange-date">时间</label>
        <input id="exchange-date" name="occurred_at" type="datetime-local" value="${fmt.inputDate()}" required />
      </div>
      <button class="primary-button" type="submit">保存换汇</button>
    </form>
  `;
}

function renderCategoryPicker() {
  const title = state.entryType === "income" ? "选择收入类别" : "选择支出类别";
  return `
    <div class="modal-backdrop" data-close-category-picker="true">
      <section class="category-modal" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="modal-handle"></div>
        <div class="row">
          <div>
            <h3>${title}</h3>
            <p class="supporting">选中后会写入这笔记录</p>
          </div>
          <button class="ghost-button" data-close-category-picker="true" type="button">关闭</button>
        </div>
        <div class="category-grid">
          ${activeCategories().map(([name, icon]) => `
            <button class="category-option ${state.selectedCategory === name ? "active" : ""}" data-category="${escapeHtml(name)}" type="button">
              <span class="category-icon">${escapeHtml(icon)}</span>
              <span>${escapeHtml(name)}</span>
            </button>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderTransactions() {
  const filters = [
    ["all", "全部"],
    ["cny_income", "人民币收入"],
    ["cny_expense", "人民币支出"],
    ["usd_income", "美元收入"],
    ["usd_expense", "美元支出"],
    ["exchange", "换汇"],
  ];
  const entries = state.transactionFilter === "exchange"
    ? state.data.exchanges
    : state.data.records.filter((entry) => {
      if (state.transactionFilter === "all") return true;
      if (entry.kind === "exchange") return false;
      const key = `${entry.currency.toLowerCase()}_${entry.type}`;
      return key === state.transactionFilter;
    });
  app.innerHTML = `
    ${renderPageTitle("收入支出记录", "按币种和收支方向筛选；换汇作为独立记录展示。")}
    <section class="stack">
      <div class="filter-row">
        ${filters.map(([value, label]) => `<button class="${state.transactionFilter === value ? "active" : ""}" data-filter="${value}" type="button">${label}</button>`).join("")}
      </div>
      ${entries.length ? entries.map(renderEntry).join("") : `<div class="empty">没有符合条件的记录</div>`}
    </section>
  `;
}

function getExchangeDirectionStats(stats, key) {
  const [fromCurrency, toCurrency] = key.split("_");
  return stats?.directions?.[key] || {
    key,
    label: `${fromCurrency} → ${toCurrency}`,
    from_currency: fromCurrency,
    to_currency: toCurrency,
    count: 0,
    from_total: 0,
    to_total: 0,
    avg_rate: 0,
  };
}

function renderExchangeDirectionStats(direction) {
  return `
    <article class="entry exchange-stat">
      <div class="row">
        <div>
          <div class="label">${direction.label}</div>
          <strong>${direction.count} 笔</strong>
          <p class="supporting">平均汇率 CNY/USD ${direction.count ? fmt.rate(direction.avg_rate) : "暂无"}</p>
        </div>
        <span class="pill">${direction.from_currency} → ${direction.to_currency}</span>
      </div>
      <div class="flow">
        <div class="node">
          <div class="label">累计转出</div>
          <div class="amount expense">${fmt.money(direction.from_total, direction.from_currency)}</div>
        </div>
        <div class="arrow">→</div>
        <div class="node">
          <div class="label">累计转入</div>
          <div class="amount income">${fmt.money(direction.to_total, direction.to_currency)}</div>
        </div>
      </div>
      <p class="supporting">合计 ${fmt.money(direction.from_total, direction.from_currency)} → ${fmt.money(direction.to_total, direction.to_currency)}</p>
    </article>
  `;
}

function exchangeStatsForPeriod(summary, periodKey) {
  if (periodKey === "monthly") return summary.monthly_exchange_stats || { count: 0, directions: {} };
  if (periodKey === "yearly") return summary.yearly_exchange_stats || { count: 0, directions: {} };
  return summary.exchange_stats || { count: 0, directions: {} };
}

function renderExchangeStats(periodKey, periodLabel) {
  const stats = exchangeStatsForPeriod(state.data.summary, periodKey);
  const directionKeys = ["CNY_USD", "USD_CNY"];
  return `
    <section class="card stack exchange-stats">
      <div class="row">
        <div>
          <h3>换汇统计</h3>
          <p class="supporting">${periodLabel}换汇单独统计，不计入收入和支出</p>
        </div>
        <span class="pill">${stats.count} 笔</span>
      </div>
      <div class="stat-strip">
        <div>
          <span class="label">${periodLabel}换汇</span>
          <strong>${stats.count} 笔</strong>
        </div>
        <div>
          <span class="label">统计口径</span>
          <strong>${periodLabel}</strong>
        </div>
      </div>
      ${stats.count
        ? directionKeys.map((key) => renderExchangeDirectionStats(getExchangeDirectionStats(stats, key))).join("")
        : `<div class="empty">暂无换汇统计</div>`}
    </section>
  `;
}

function categoryTotalsForPeriod(summary, periodKey) {
  return summary.category_totals_by_period?.[periodKey] || summary.category_totals || [];
}

function renderReports() {
  const summary = state.data.summary;
  const periodKey = state.reportPeriod;
  const periodLabel = reportPeriods.find(([key]) => key === periodKey)?.[1] || "本月";
  const periodSummary = summary[periodKey] || summary.monthly;
  const categoryTotals = categoryTotalsForPeriod(summary, periodKey);
  const categoryGroups = {
    CNY: categoryTotals.filter((item) => item.currency === "CNY"),
    USD: categoryTotals.filter((item) => item.currency === "USD"),
  };
  app.innerHTML = `
    ${renderPageTitle("收支统计", "只统计收入和支出，不做汇率折算。")}
    <section class="segmented report-period" aria-label="统计周期">
      ${reportPeriods.map(([key, label]) => `
        <button class="${periodKey === key ? "active" : ""}" data-report-period="${key}" type="button">${label}</button>
      `).join("")}
    </section>
    <section class="grid two">
      ${["CNY", "USD"].map((currency) => `
        <article class="card stack">
          <div class="row">
            <h3>${currency === "CNY" ? "人民币" : "美元"}</h3>
            <span class="pill">${currency}</span>
          </div>
          <div class="grid two">
            <div class="card soft metric">
              <span class="label">${periodLabel}收入</span>
              <strong>${fmt.money(periodSummary[currency].income, currency)}</strong>
              <small>净额 ${fmt.money(periodSummary[currency].net, currency)}</small>
            </div>
            <div class="card soft metric">
              <span class="label">${periodLabel}支出</span>
              <strong>${fmt.money(periodSummary[currency].expense, currency)}</strong>
              <small>净额 ${fmt.money(periodSummary[currency].net, currency)}</small>
            </div>
          </div>
          <h3>${periodLabel}类别</h3>
          ${categoryGroups[currency].length ? categoryGroups[currency].map((item) => `
            <div class="entry">
              <div class="row">
                <div>
                  <strong>${escapeHtml(item.category)}</strong>
                  <p class="supporting">${item.type === "income" ? "收入" : "支出"}</p>
                </div>
                <div class="amount ${item.type === "income" ? "income" : "expense"}">${fmt.money(item.total, currency)}</div>
              </div>
            </div>
          `).join("") : `<div class="empty">暂无类别统计</div>`}
        </article>
      `).join("")}
    </section>
    ${renderExchangeStats(periodKey, periodLabel)}
  `;
}

document.addEventListener("click", (event) => {
  if (event.target.dataset.closeCategoryPicker) {
    state.categoryPickerOpen = false;
    render();
    return;
  }
  if (event.target.dataset.closeEditModal) {
    state.editingRecord = null;
    render();
    return;
  }

  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.openCategoryPicker) {
    state.categoryPickerOpen = true;
    render();
    return;
  }
  if (target.dataset.category) {
    state.selectedCategory = target.dataset.category;
    state.categoryPickerOpen = false;
    render();
    return;
  }
  if (target.dataset.editKind && target.dataset.editId) {
    state.editingRecord = { kind: target.dataset.editKind, id: target.dataset.editId };
    state.categoryPickerOpen = false;
    render();
    return;
  }
  if (target.dataset.deleteKind && target.dataset.deleteId) {
    deleteRecord(target.dataset.deleteKind, target.dataset.deleteId);
    return;
  }
  if (target.dataset.route) setRoute(target.dataset.route);
  if (target.dataset.routeJump) setRoute(target.dataset.routeJump);
  if (target.dataset.entryCurrency) {
    state.entryCurrency = target.dataset.entryCurrency;
    render();
  }
  if (target.dataset.entryType) {
    state.entryType = target.dataset.entryType;
    state.categoryPickerOpen = false;
    if (state.entryType !== "exchange") normalizeSelectedCategory();
    render();
  }
  if (target.dataset.exchangeDirection) {
    state.exchangeDirection = target.dataset.exchangeDirection;
    render();
  }
  if (target.dataset.filter) {
    state.transactionFilter = target.dataset.filter;
    render();
  }
  if (target.dataset.reportPeriod) {
    state.reportPeriod = target.dataset.reportPeriod;
    render();
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === "entryForm") {
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.type = state.entryType;
      payload.currency = state.entryCurrency;
      payload.amount = Number(payload.amount);
      setData(await api("/api/entries", { method: "POST", body: JSON.stringify(payload) }));
      toast("记录已保存");
    }
    if (form.id === "exchangeForm") {
      const payload = Object.fromEntries(new FormData(form).entries());
      const [fromCurrency, toCurrency] = state.exchangeDirection.split("_");
      payload.from_currency = fromCurrency;
      payload.to_currency = toCurrency;
      payload.from_amount = Number(payload.from_amount);
      payload.to_amount = Number(payload.to_amount);
      payload.exchange_rate = Number(payload.exchange_rate);
      setData(await api("/api/exchanges", { method: "POST", body: JSON.stringify(payload) }));
      toast("换汇已保存");
    }
    if (form.id === "editEntryForm") {
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.amount = Number(payload.amount);
      setData(await api(`/api/entries/${form.dataset.recordId}`, { method: "PUT", body: JSON.stringify(payload) }));
      state.editingRecord = null;
      toast("记录已更新");
    }
    if (form.id === "editExchangeForm") {
      const payload = Object.fromEntries(new FormData(form).entries());
      const [fromCurrency, toCurrency] = payload.direction.split("_");
      delete payload.direction;
      payload.from_currency = fromCurrency;
      payload.to_currency = toCurrency;
      payload.from_amount = Number(payload.from_amount);
      payload.to_amount = Number(payload.to_amount);
      payload.exchange_rate = Number(payload.exchange_rate);
      setData(await api(`/api/exchanges/${form.dataset.recordId}`, { method: "PUT", body: JSON.stringify(payload) }));
      state.editingRecord = null;
      toast("换汇已更新");
    }
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener("input", (event) => {
  if (!["exchange-from-amount", "exchange-rate", "exchange-to-amount"].includes(event.target.id)) return;
  updateExchangeAmounts(event.target.id);
});

function updateExchangeAmounts(sourceId) {
  const fromInput = document.querySelector("#exchange-from-amount");
  const toInput = document.querySelector("#exchange-to-amount");
  const rateInput = document.querySelector("#exchange-rate");
  if (!fromInput || !toInput || !rateInput) return;

  const fromAmount = Number(fromInput.value);
  const toAmount = Number(toInput.value);
  const rate = Number(rateInput.value);
  if (!rate) return;

  if (sourceId !== "exchange-to-amount" && fromAmount > 0) {
    toInput.value = state.exchangeDirection === "CNY_USD"
      ? (fromAmount / rate).toFixed(2)
      : (fromAmount * rate).toFixed(2);
  }
  if (sourceId === "exchange-to-amount" && toAmount > 0) {
    fromInput.value = state.exchangeDirection === "CNY_USD"
      ? (toAmount * rate).toFixed(2)
      : (toAmount / rate).toFixed(2);
  }
}

async function deleteRecord(kind, id) {
  const label = kind === "exchange" ? "这条换汇记录" : "这条收入/支出记录";
  if (!window.confirm(`确定删除${label}吗？`)) return;
  try {
    const path = kind === "exchange" ? `/api/exchanges/${id}` : `/api/entries/${id}`;
    setData(await api(path, { method: "DELETE" }));
    toast("已删除");
  } catch (error) {
    toast(error.message);
  }
}

refreshButton.addEventListener("click", async () => {
  await load();
  toast("已同步");
});

load().catch((error) => {
  app.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});
