/* 泰合礼 THL 礼金簿 — 统计汇总与历史对比 */
(function () {
  'use strict';
  var T = window.THL;
  var ui = T.ui;
  var COLORS = ['#9E2A2B', '#B9853F', '#547C64', '#5B6D8A', '#896C8F', '#A5694A', '#7B7F45'];

  T.views.stats = function () {
    var book = T.getActiveBook();
    if (!book) {
      return '<div class="page">' +
        T.emptyState('chart', '还没有可以统计的礼簿', '先创建礼簿并登记礼金，本场总额、关系占比和历史对比会自动生成。', '<button class="btn btn-primary" data-action="open-book-form">' + T.icon('plus') + ' 新建礼簿</button>') +
        '</div>';
    }
    var stats = T.calcStats(book.id);
    var history = T.allBooksStats();
    var rankLimit = ui.showAllRank ? stats.top.length : 10;
    var shownRank = stats.top.slice(0, rankLimit);
    var metric = ui.statsMetric || 'amount';
    var relationRows = stats.relations.map(function (rel) {
      var pct = stats.cash ? Math.round(rel.amount / stats.cash * 100) : 0;
      return '<div class="relation-row"><span class="name">' + T.esc(rel.name) + '</span><div class="rel-bar-wrap"><div class="rel-bar" style="width:' + Math.max(2, pct) + '%"></div></div><span class="rel-count">' + rel.count + ' 人</span><span class="rel-amount">' + T.esc(T.money(rel.amount)) + '</span></div>';
    }).join('');
    var rankingRows = shownRank.map(function (r, i) {
      return '<div class="rank-row"><span class="rank-medal' + (i < 3 ? ' r' + (i + 1) : '') + '">' + (i < 3 ? ['壹', '贰', '叁'][i] : i + 1) + '</span>' +
        T.avatar(r.name, 'sm', true) +
        '<div class="rank-main"><div class="rank-name">' + T.esc(r.name) + (r.relation ? '<span class="tag">' + T.esc(r.relation) + '</span>' : '') + '</div><div class="rank-sub">' + T.esc(T.fmtDate(r.date, 'short')) + ' · ' + (r.attended ? '已到场' : '未到场') + '</div></div>' +
        '<span class="rank-amount">' + T.esc(T.money(r.amount)) + '</span></div>';
    }).join('');
    var maxCash = Math.max.apply(null, history.map(function (h) { return h.cash; }).concat([1]));
    var historyRows = history.map(function (h) {
      var pct = Math.max(2, Math.round(h.cash / maxCash * 100));
      return '<div class="history-row' + (h.book.id === book.id ? ' current' : '') + '" data-action="switch-book" data-id="' + T.esc(h.book.id) + '" role="button" tabindex="0">' +
        '<div class="history-top"><b>' + T.esc(h.book.title) + '</b><span>' + T.esc(T.money(h.cash)) + '</span></div>' +
        '<div class="history-track"><div class="history-bar" style="width:' + pct + '%"></div></div>' +
        '<div class="history-meta"><span>' + T.esc((h.book.type || '喜事') + ' · ' + T.fmtDate(h.book.date)) + '</span><span>' + h.people + ' 人 · ' + h.count + ' 笔</span></div></div>';
    }).join('');
    var returnPct = stats.count ? Math.round(stats.returned / stats.count * 100) : 0;
    var thankPct = stats.count ? Math.round(stats.thanked / stats.count * 100) : 0;
    var hasRecords = stats.count > 0;

    return '<div class="page page-tight">' +
      '<section class="stats-hero">' +
      '<div class="stats-hero-top"><div><p class="stats-kicker">本场礼金统计</p><h2>' + T.esc(book.title) + '</h2></div><span class="stats-seal">' + T.esc(T.bookGlyph(book.type)) + '</span></div>' +
      '<div class="stats-total"><small>' + T.esc(T.currency()) + '</small>' + T.esc(T.plainAmount(stats.cash)) + '</div>' +
      '<div class="stats-hero-meta"><span>' + T.icon('users') + '宾客 ' + stats.people + ' 人</span><span>' + T.icon('list') + '共 ' + stats.count + ' 笔</span><span>' + T.icon('calendar') + T.esc(T.fmtDate(book.date)) + '</span></div>' +
      '</section>' +
      '<div class="stat-grid">' +
      statBox('users', '总人数', stats.people, '位', false) +
      statBox('list', '礼金笔数', stats.count, '笔', false) +
      statBox('yuan', '平均礼金', T.currency() + T.shortMoney(stats.average), '', true) +
      statBox('gift', '待回礼', stats.pendingReturn, '笔', false) +
      '</div>' +
      '<div class="mini-summary-row" style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap;color:var(--faint);font-size:.65rem;padding:0 3px">' +
      '<span>实收礼金 ' + T.esc(T.money(stats.cash)) + '</span><span>·</span><span>礼品估值 ' + T.esc(T.money(stats.giftValue)) + '</span><span>·</span><span>回礼支出 ' + T.esc(T.money(stats.returnedAmount)) + '</span>' +
      '</div>' +

      (hasRecords ? '' : '<div class="notice-strip">' + T.icon('info') + '<span>还没有礼金记录。登记第一笔后，这里会自动生成关系占比、送礼排行和历史对比。</span><button class="text-link" data-action="add-record" style="margin-left:auto">去登记 ' + T.icon('chevron-right') + '</button></div>') +

      '<section class="section"><div class="section-head"><div class="section-title">' + T.icon('chart') + '人群构成</div>' +
      '<div class="chart-metric"><button class="' + (metric === 'amount' ? 'active' : '') + '" data-action="stat-metric" data-metric="amount">金额</button><button class="' + (metric === 'count' ? 'active' : '') + '" data-action="stat-metric" data-metric="count">人数</button></div></div>' +
      '<div class="chart-card">' + donutChart(stats, metric) + '</div></section>' +

      '<section class="section"><div class="section-head"><div class="section-title">' + T.icon('check-circle') + '回礼与答谢进度</div></div>' +
      '<div class="progress-cards">' +
      '<div class="progress-card"><div class="pc-head"><span>回礼完成</span><span>' + returnPct + '%</span></div><div class="pc-num">' + stats.returned + ' <span>/ ' + stats.count + ' 笔</span></div><div class="progress-track"><div class="progress-fill red" style="width:' + returnPct + '%"></div></div></div>' +
      '<div class="progress-card"><div class="pc-head"><span>答谢完成</span><span>' + thankPct + '%</span></div><div class="pc-num">' + stats.thanked + ' <span>/ ' + stats.count + ' 笔</span></div><div class="progress-track"><div class="progress-fill" style="width:' + thankPct + '%"></div></div></div>' +
      '</div></section>' +

      '<section class="section"><div class="section-head"><div class="section-title">' + T.icon('award') + '送礼排行</div>' +
      (stats.top.length > 10 ? '<button class="text-link" data-action="rank-toggle">' + (ui.showAllRank ? '收起' : '查看全部') + T.icon('chevron-right') + '</button>' : '') + '</div>' +
      (shownRank.length ? '<div class="rank-card">' + rankingRows + '</div>' : T.emptyState('award', '还没有排行', '登记礼金后，这里会按金额从高到低展示。')) +
      '</section>' +

      '<section class="section"><div class="section-head"><div class="section-title">' + T.icon('users') + '关系分类</div><span class="section-sub">' + stats.relations.length + ' 类关系</span></div>' +
      (relationRows ? '<div class="relation-table">' + relationRows + '</div>' : '<div class="chart-empty">暂无关系分类数据</div>') +
      '</section>' +

      '<section class="section"><div class="section-head"><div class="section-title">' + T.icon('book') + '历史对比</div><span class="section-sub">共 ' + history.length + ' 场</span></div>' +
      '<div class="history-card">' + (historyRows || '<div class="chart-empty">暂无历史礼簿</div>') +
      '<button class="history-add" type="button" data-action="open-book-form">' + T.icon('plus') + ' 新建一场礼簿</button></div>' +
      '<p class="field-hint" style="margin:7px 3px 0">点击某一历史礼簿可切换查看它的统计。</p></section>' +
      '<div style="height:8px"></div>' +
      '</div>';
  };

  function statBox(icon, label, value, unit, accent) {
    return '<div class="stat-box' + (accent ? ' accent' : '') + '"><span>' + T.icon(icon) + label + '</span><b>' + T.esc(String(value)) + (unit ? '<em>' + unit + '</em>' : '') + '</b></div>';
  }

  function donutChart(stats, metric) {
    var total = metric === 'amount' ? stats.cash : stats.count;
    if (!total) {
      return '<div class="donut-wrap"><svg class="donut-svg" viewBox="0 0 160 160" role="img" aria-label="暂无数据"><circle cx="80" cy="80" r="64" fill="none" stroke="var(--surface-3)" stroke-width="22"/><text x="80" y="78" text-anchor="middle" class="donut-center-label">暂无数据</text><text x="80" y="92" text-anchor="middle" class="donut-center-extra">登记后自动生成</text></svg>' +
        '<div class="chart-legend"><div class="chart-empty" style="padding:0">按关系分类统计礼金占比</div></div></div>';
    }
    var raw = stats.relations.map(function (r, i) {
      return { name: r.name, value: metric === 'amount' ? r.amount : r.count, color: COLORS[i % COLORS.length] };
    }).filter(function (r) { return r.value > 0; });
    if (raw.length > 6) {
      var head = raw.slice(0, 5);
      var restVal = T.sum(raw.slice(5), function (r) { return r.value; });
      head.push({ name: '其他', value: restVal, color: COLORS[6] });
      raw = head;
    }
    var sum = T.sum(raw, function (r) { return r.value; });
    var circumference = 2 * Math.PI * 64;
    var offset = 0;
    var arcs = raw.map(function (r) {
      var len = r.value / sum * circumference;
      var gap = raw.length > 1 ? Math.min(3, len / 2) : 0;
      var seg = '<circle cx="80" cy="80" r="64" fill="none" stroke="' + r.color + '" stroke-width="22" stroke-dasharray="' + Math.max(0.1, len - gap) + ' ' + (circumference - len + gap) + '" stroke-dashoffset="' + (-offset) + '"></circle>';
      offset += len;
      return seg;
    }).join('');
    var legend = raw.map(function (r) {
      var pct = Math.round(r.value / sum * 100);
      return '<div class="legend-row"><span class="legend-dot" style="background:' + r.color + '"></span><span class="legend-name">' + T.esc(r.name) + '</span><span class="legend-pct">' + pct + '%</span><span class="legend-value">' + (metric === 'amount' ? T.esc(T.currency() + T.shortMoney(r.value)) : r.value + ' 人') + '</span></div>';
    }).join('');
    var centerValue = metric === 'amount' ? T.currency() + T.shortMoney(stats.cash) : stats.count + ' 笔';
    return '<div class="donut-wrap"><svg class="donut-svg" viewBox="0 0 160 160" role="img" aria-label="人群构成环形图"><g transform="rotate(-90 80 80)">' + arcs + '</g>' +
      '<text x="80" y="75" text-anchor="middle" class="donut-center-label">' + (metric === 'amount' ? '礼金总额' : '礼金笔数') + '</text>' +
      '<text x="80" y="93" text-anchor="middle" class="donut-center-value">' + T.esc(centerValue) + '</text>' +
      '<text x="80" y="106" text-anchor="middle" class="donut-center-extra">按关系分类</text></svg>' +
      '<div class="chart-legend">' + legend + '</div></div>';
  }

  T.registerAction('stat-metric', function (el) {
    var metric = el.getAttribute('data-metric');
    if (metric !== 'amount' && metric !== 'count') return;
    ui.statsMetric = metric;
    T.renderApp();
  });
  T.registerAction('rank-toggle', function () {
    ui.showAllRank = !ui.showAllRank;
    T.renderApp();
  });
})();
