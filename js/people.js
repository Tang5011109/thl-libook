/* 泰合礼 THL 礼金簿 — 人情往来、宾客档案与提醒 */
(function () {
  'use strict';
  var T = window.THL;
  var ui = T.ui;

  var TAB_LABELS = { ledger: '人情账本', guests: '宾客档案', reminders: '回礼提醒' };

  T.views.people = function () {
    var tab = ui.peopleTab || 'ledger';
    if (!TAB_LABELS[tab]) tab = 'ledger';
    var tasks = T.pendingTasks();
    var tabHtml = '<div class="segmented page-tabs" role="tablist">' +
      tabButton('ledger', '人情账本', tab) +
      tabButton('guests', '宾客档案', tab) +
      tabButton('reminders', '提醒' + (tasks.length ? ' · ' + tasks.length : ''), tab) +
      '</div>';
    var content = tab === 'guests' ? renderGuestsTab() : (tab === 'reminders' ? renderRemindersTab() : renderLedgerTab());
    return '<div class="page page-tight people-page">' + tabHtml + content + '</div>';
  };

  function tabButton(id, label, current) {
    return '<button class="' + (current === id ? 'active' : '') + '" data-action="people-tab" data-tab="' + id + '" role="tab" aria-selected="' + (current === id ? 'true' : 'false') + '">' + label + '</button>';
  }

  function totalsAll() {
    var received = T.sum(T.state.records, function (r) { return r.amount; });
    var sent = T.sum(T.state.outgoing, function (o) { return o.amount; });
    return { received: received, sent: sent, balance: received - sent };
  }
  function balanceText(n) {
    var sign = n > 0 ? '+' : (n < 0 ? '-' : '');
    return sign + T.money(Math.abs(n));
  }

  /* ---------------- 人情账本 ---------------- */
  function renderLedgerTab() {
    var ledger = T.ledger();
    var totals = totalsAll();
    var pending = T.pendingTasks().length;
    return '<section class="people-summary">' +
      '<div class="people-summary-title"><h2>人情往来总览</h2><span>跨礼簿累计</span></div>' +
      '<div class="people-summary-grid">' +
      '<div><span>累计收礼</span><b class="red">' + T.esc(T.currency() + T.shortMoney(totals.received)) + '</b></div>' +
      '<div><span>累计随出</span><b class="green">' + T.esc(T.currency() + T.shortMoney(totals.sent)) + '</b></div>' +
      '<div><span>往来差额</span><b>' + T.esc(T.currency() + T.shortMoney(totals.balance)) + '</b></div>' +
      '</div>' +
      '<div class="people-summary-note"><span>共 ' + ledger.length + ' 位亲友 · 按姓名自动合并多场礼簿</span><span>' + (pending ? pending + ' 项待办' : '暂无待办') + '</span></div>' +
      '</section>' +
      '<div class="people-toolbar"><div class="search-box">' + T.icon('search') + '<input id="ledger-search" type="search" autocomplete="off" placeholder="搜姓名、关系或电话" value="' + T.esc(ui.ledgerSearch || '') + '"><button class="search-clear" data-action="clear-ledger-search" aria-label="清空搜索"' + (ui.ledgerSearch ? '' : ' hidden') + '>' + T.icon('close') + '</button></div>' +
      '<button class="btn btn-primary" data-action="outgoing-new">' + T.icon('plus') + ' 记随出</button></div>' +
      '<div id="people-results">' + renderLedgerResults() + '</div>' +
      '<div class="notice-strip">' + T.icon('info') + '<span>“收礼”来自各场礼簿登记，“随出”是您送给对方的人情。差额为正，表示收到的略多；为负，表示随出的略多。人情往来，重在常来常往。</span></div>';
  }

  function renderLedgerResults() {
    var ledger = T.ledger();
    var q = String(ui.ledgerSearch || '').trim().toLowerCase();
    if (q) {
      ledger = ledger.filter(function (p) {
        return [p.name, p.relation, p.phone, p.tags.join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    var outgoing = T.state.outgoing.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var recentSent = q ? [] : outgoing.slice(0, 5);
    if (!ledger.length) {
      return T.emptyState('heart-handshake', q ? '没有找到这位亲友' : '还没有人情往来', q ? '换个姓名或电话搜搜看。' : '登记礼金、新增宾客或记一笔随出，都会汇聚成长期的人情账本。', '<div class="button-row"><button class="btn btn-secondary" data-action="guest-new">' + T.icon('user-plus') + ' 新增宾客</button><button class="btn btn-primary" data-action="outgoing-new">' + T.icon('plus') + ' 记随出</button></div>');
    }
    var rows = ledger.map(function (p) {
      var sub = [];
      if (p.receivedCount) sub.push('收 ' + p.receivedCount + ' 笔');
      if (p.sentCount) sub.push('随 ' + p.sentCount + ' 笔');
      if (!sub.length) sub.push('尚无往来');
      return '<div class="person-row" data-action="person-open" data-name="' + T.esc(p.name) + '" role="button" tabindex="0" aria-label="查看 ' + T.esc(p.name) + ' 的人情往来">' +
        T.avatar(p.name, 'sm', true) +
        '<div class="person-main"><div class="person-name">' + T.esc(p.name) + (p.relation ? '<span class="tag">' + T.esc(p.relation) + '</span>' : '') + '</div><div class="person-sub">' + T.esc(sub.join(' · ')) + '</div></div>' +
        '<div class="person-money"><div><span>收礼</span><b class="recv">' + T.esc(T.currency() + T.shortMoney(p.received)) + '</b></div><div><span>随出</span><b class="sent">' + T.esc(T.currency() + T.shortMoney(p.sent)) + '</b></div></div>' +
        '<div class="person-balance"><span>差额</span><b class="' + (p.balance > 0 ? 'positive' : (p.balance < 0 ? 'negative' : '')) + '">' + T.esc(balanceText(p.balance)) + '</b></div>' +
        '</div>';
    }).join('');
    var recentHtml = '';
    if (recentSent.length) {
      recentHtml = '<div class="section-split">最近随出</div><div class="outgoing-list">' + recentSent.map(function (o) {
        return '<div class="outgoing-row" data-action="person-open" data-name="' + T.esc(o.name) + '" role="button" tabindex="0">' +
          '<div class="outgoing-main"><b>' + T.esc(o.name) + '</b><p>' + T.esc([o.event, T.fmtDate(o.date, 'short'), o.note].filter(Boolean).join(' · ')) + '</p></div>' +
          '<span class="outgoing-amount">-' + T.esc(T.money(o.amount)) + '</span>' + T.icon('chevron-right') + '</div>';
      }).join('') + '</div>';
    }
    return '<div class="person-list">' + rows + '</div>' + recentHtml;
  }

  /* ---------------- 宾客档案 ---------------- */
  function renderGuestsTab() {
    var guests = T.state.guests;
    var ledger = T.ledger();
    var byName = {};
    ledger.forEach(function (p) { byName[p.name.trim().toLowerCase()] = p; });
    var tagSet = [];
    guests.forEach(function (g) {
      g.tags.forEach(function (t) { if (tagSet.indexOf(t) < 0) tagSet.push(t); });
      if (g.relation && tagSet.indexOf(g.relation) < 0) tagSet.push(g.relation);
    });
    var tags = '<button class="chip' + (!ui.guestTag ? ' active' : '') + '" data-action="guest-tag" data-tag="">全部</button>' +
      tagSet.map(function (t) { return '<button class="chip' + (ui.guestTag === t ? ' active' : '') + '" data-action="guest-tag" data-tag="' + T.esc(t) + '">' + T.esc(t) + '</button>'; }).join('');
    var supportsContacts = !!(navigator.contacts && navigator.contacts.select);
    return '<div class="guest-import-card">' +
      '<span class="gic-icon">' + T.icon('user-plus') + '</span>' +
      '<div><b>从手机通讯录导入</b><p>' + (supportsContacts ? '一次选择多位亲友，自动建立档案' : '安卓 Chrome 可直接读取，其他浏览器请手动添加') + '</p></div>' +
      '<button class="btn btn-secondary btn-sm" data-action="import-contacts">' + (supportsContacts ? '导入' : '了解') + '</button></div>' +
      '<div class="people-toolbar"><div class="search-box">' + T.icon('search') + '<input id="guest-search" type="search" autocomplete="off" placeholder="搜姓名、电话、标签" value="' + T.esc(ui.peopleSearch || '') + '"><button class="search-clear" data-action="clear-guest-search" aria-label="清空搜索"' + (ui.peopleSearch ? '' : ' hidden') + '>' + T.icon('close') + '</button></div>' +
      '<button class="btn btn-primary" data-action="guest-new">' + T.icon('plus') + ' 新增</button></div>' +
      (tagSet.length ? '<div class="chips-scroll tag-filter">' + tags + '</div>' : '') +
      '<div id="people-results">' + renderGuestResults(byName) + '</div>' +
      '<p class="contact-note">' + (supportNote()) + '</p>';
  }
  function supportNote() {
    if (navigator.contacts && navigator.contacts.select) {
      return '通讯录仅在您主动选择时读取姓名和电话，数据只保存在本机。';
    }
    if (location.protocol === 'file:') return '当前通过本地文件打开，部分浏览器不支持通讯录接口。可手动新增宾客，所有宾客都可以在登记礼金时快速选择。';
    return '通讯录导入需要 Android Chrome 且通过 HTTPS 打开。您随时可以手动新增宾客。';
  }

  function renderGuestResults(byName) {
    var guests = T.state.guests.slice();
    var q = String(ui.peopleSearch || '').trim().toLowerCase();
    if (ui.guestTag) {
      guests = guests.filter(function (g) { return g.tags.indexOf(ui.guestTag) >= 0 || g.relation === ui.guestTag; });
    }
    if (q) {
      guests = guests.filter(function (g) {
        return [g.name, g.phone, g.relation, g.tags.join(' '), g.note].join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    guests.sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
    if (!guests.length) {
      return T.emptyState('users', q || ui.guestTag ? '没有找到宾客' : '还没有宾客档案', q || ui.guestTag ? '换个关键词或标签试试看。' : '保存亲友联系方式，下次办酒席时直接选择，不用重新输入。', '<button class="btn btn-primary" data-action="guest-new">' + T.icon('user-plus') + ' 新增宾客</button>');
    }
    var rows = guests.map(function (g) {
      var p = byName[g.name.trim().toLowerCase()] || { received: 0, sent: 0, receivedCount: 0, sentCount: 0 };
      var tags = g.tags.length ? g.tags : (g.relation ? [g.relation] : []);
      return '<div class="guest-row" data-action="person-open" data-name="' + T.esc(g.name) + '" role="button" tabindex="0">' +
        T.avatar(g.name, '', true) +
        '<div class="guest-main"><div class="guest-name-line"><span class="guest-name">' + T.esc(g.name) + '</span>' + tags.slice(0, 2).map(function (t) { return '<span class="tag">' + T.esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="guest-sub">' + (g.phone ? '<span>' + T.icon('phone') + T.esc(g.phone) + '</span>' : '') + (g.receivedCount || p.receivedCount ? '<span>' + T.icon('gift') + '收 ' + (p.receivedCount || g.receivedCount || 0) + ' 笔</span>' : '') + (p.sentCount ? '<span>' + T.icon('heart') + '随 ' + p.sentCount + ' 笔</span>' : '') + '</div></div>' +
        '<div class="guest-total"><span>累计收礼</span><b>' + T.esc(T.currency() + T.shortMoney(p.received)) + '</b></div>' +
        T.icon('chevron-right') +
        '</div>';
    }).join('');
    return '<div class="guest-grid">' + rows + '</div>';
  }

  function updatePeopleResults() {
    var tab = ui.peopleTab;
    var root = document.getElementById('people-results');
    if (!root) return;
    if (tab === 'ledger') {
      root.innerHTML = renderLedgerResults();
    } else if (tab === 'guests') {
      var ledger = T.ledger();
      var byName = {};
      ledger.forEach(function (p) { byName[p.name.trim().toLowerCase()] = p; });
      root.innerHTML = renderGuestResults(byName);
    }
    var clear = document.querySelector('[data-action="clear-ledger-search"], [data-action="clear-guest-search"]');
    if (clear) clear.hidden = !(ui.peopleSearch || ui.ledgerSearch);
  }
  T.views.updatePeopleResults = updatePeopleResults;

  /* ---------------- 提醒中心 ---------------- */
  function renderRemindersTab() {
    var tasks = T.pendingTasks();
    var returns = tasks.filter(function (t) { return t.type === 'return'; });
    var thanks = tasks.filter(function (t) { return t.type === 'thank'; });
    var filter = ui.reminderFilter || 'all';
    var filtered = filter === 'return' ? returns : (filter === 'thank' ? thanks : tasks);
    var permission = ('Notification' in window) ? Notification.permission : 'unsupported';
    var notificationsOn = permission === 'granted' && T.state.settings.notifications;
    var taskHtml = filtered.length ? '<div class="task-list">' + filtered.map(renderTask).join('') + '</div>' :
      T.emptyState('check-circle', filter === 'all' && !tasks.length ? '所有回礼和答谢都完成了' : '这里暂时没有待办', filter === 'all' && !tasks.length ? '人情有来有往，您都记在心里。新的待办会自动出现在这里。' : '换一个筛选条件看看。');
    return '<section class="reminder-summary">' +
      '<h2>' + T.icon('bell') + '人情提醒</h2><p>把回礼和答谢放在心上，也记在账上。设好日期，打开 App 时会提醒您。</p>' +
      '<div class="reminder-counts">' +
      '<div class="reminder-count"><span>待回礼</span><b>' + returns.length + '<em>笔</em></b></div>' +
      '<div class="reminder-count"><span>待答谢</span><b>' + thanks.length + '<em>笔</em></b></div>' +
      '<div class="reminder-count"><span>已设提醒日</span><b>' + tasks.filter(function (t) { return !!(t.type === 'return' ? t.record.remindReturnAt : t.record.remindThankAt); }).length + '<em>项</em></b></div>' +
      '</div>' +
      '<div class="reminder-tools">' +
      (permission === 'unsupported' ? '<button class="btn btn-ghost btn-sm" disabled>当前浏览器不支持通知</button>' :
        '<button class="btn btn-secondary btn-sm" data-action="enable-notifications">' + T.icon('bell') + (notificationsOn ? '通知已开启' : '开启系统通知') + '</button>') +
      '<button class="btn btn-secondary btn-sm" data-action="export-ics">' + T.icon('calendar') + ' 导出到手机日历</button>' +
      '</div></section>' +
      '<div class="chips-scroll" style="margin-top:12px">' +
      '<button class="chip' + (filter === 'all' ? ' active' : '') + '" data-action="reminder-filter" data-filter="all">全部 ' + tasks.length + '</button>' +
      '<button class="chip' + (filter === 'return' ? ' active' : '') + '" data-action="reminder-filter" data-filter="return">待回礼 ' + returns.length + '</button>' +
      '<button class="chip' + (filter === 'thank' ? ' active' : '') + '" data-action="reminder-filter" data-filter="thank">待答谢 ' + thanks.length + '</button>' +
      '</div>' + taskHtml +
      '<div class="notice-strip" style="margin-top:14px">' + T.icon('info') + '<span>离线状态下，系统通知仅在打开 App 时发出。若希望关掉 App 也能收到提醒，请使用“导出到手机日历”，将提醒加入系统日历。</span></div>';
  }

  function renderTask(t) {
    var r = t.record;
    var book = T.getBook(r.bookId);
    var isReturn = t.type === 'return';
    var reminderDate = isReturn ? r.remindReturnAt : r.remindThankAt;
    var dueClass = '';
    var dueText = '';
    if (reminderDate) {
      var diff = T.daysBetween(T.todayISO(), reminderDate);
      if (diff < 0) { dueClass = 'overdue'; dueText = '已逾期 ' + Math.abs(diff) + ' 天'; }
      else if (diff === 0) { dueClass = 'due'; dueText = '就是今天'; }
      else if (diff === 1) { dueClass = 'due'; dueText = '明天'; }
      else if (diff <= 7) { dueClass = 'due'; dueText = diff + ' 天后'; }
      else { dueText = T.fmtDate(reminderDate, 'short'); }
    }
    return '<article class="task-card">' +
      '<div class="task-top"><div class="task-type ' + (isReturn ? '' : 'thank') + '">' + T.icon(isReturn ? 'gift' : 'heart') + '</div>' +
      '<div class="task-main"><div class="task-name-line"><span class="task-name">' + T.esc(r.name) + '</span><span class="badge ' + (isReturn ? 'badge-amber' : 'badge-gold') + '">' + (isReturn ? '待回礼' : '待答谢') + '</span></div>' +
      '<div class="task-sub">' + T.esc((book ? book.title : '') + ' · ' + T.money(r.amount)) + '</div>' +
      '</div><span class="task-date ' + dueClass + '">' + (reminderDate ? dueText + '<br><span class="faint">' + T.esc(T.fmtDate(reminderDate, 'short')) + '</span>' : '未设提醒日') + '</span></div>' +
      '<div class="task-bottom"><span class="hint">' + T.icon('clock') + (reminderDate ? '提醒：' + T.esc(T.fmtDate(reminderDate)) : '设置提醒日后可收到提示') + '</span>' +
      '<span class="actions"><button class="btn btn-ghost" data-action="task-remind" data-id="' + T.esc(r.id) + '" data-kind="' + t.type + '">设提醒</button>' +
      '<button class="btn btn-primary" data-action="task-done" data-id="' + T.esc(r.id) + '" data-kind="' + t.type + '">' + (isReturn ? '标记已回礼' : '标记已答谢') + '</button></span></div>' +
      '</article>';
  }

  /* ---------------- 亲友详情 ---------------- */
  function openPersonDetail(name) {
    var data = T.personLedger(name);
    if (!data) return;
    var guest = data.guest;
    var relation = (guest && guest.relation) || (data.received[0] && data.received[0].relation) || (data.sent[0] && data.sent[0].relation) || '';
    var phone = (guest && guest.phone) || (data.sent[0] && data.sent[0].phone) || '';
    var tags = guest && guest.tags ? guest.tags : [];
    var receivedRows = data.received.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).map(function (r) {
      var book = T.getBook(r.bookId);
      return '<div class="mini-record" data-action="record-open" data-record-id="' + T.esc(r.id) + '" role="button" tabindex="0">' +
        '<div class="mini-record-main"><b>' + T.esc(book ? book.title : '礼金记录') + '</b><span>' + T.esc(T.fmtDate(r.date) + (r.gift ? ' · ' + r.gift : '')) + '</span></div>' +
        '<span class="mini-record-amount">+' + T.esc(T.money(r.amount)) + '</span>' + T.icon('chevron-right') + '</div>';
    }).join('');
    var sentRows = data.sent.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).map(function (o) {
      return '<div class="mini-record">' +
        '<div class="mini-record-main"><b>' + T.esc(o.event || '随礼') + '</b><span>' + T.esc(T.fmtDate(o.date) + (o.gift ? ' · ' + o.gift : '') + (o.note ? ' · ' + o.note : '')) + '</span></div>' +
        '<span class="mini-record-amount sent">-' + T.esc(T.money(o.amount)) + '</span>' +
        '<button class="mini-record-del" data-action="outgoing-delete" data-id="' + T.esc(o.id) + '" data-name="' + T.esc(name) + '" aria-label="删除随出记录">' + T.icon('trash') + '</button></div>';
    }).join('');
    var html = '<div class="sheet-head"><div class="head-copy"><p class="eyebrow">RELATIONSHIP</p><h2>人情往来</h2></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body">' +
      '<div class="person-detail-head">' + T.avatar(name, 'lg', true) +
      '<div style="min-width:0"><h2>' + T.esc(data.name) + '</h2><p>' + T.esc([relation, phone].filter(Boolean).join(' · ') || '尚无备注') + '</p>' +
      (tags.length ? '<div class="chips" style="margin-top:5px">' + tags.map(function (t) { return '<span class="tag">' + T.esc(t) + '</span>'; }).join('') + '</div>' : '') +
      '</div>' + (phone ? '<a class="icon-btn" href="tel:' + T.esc(phone) + '" aria-label="拨打电话">' + T.icon('phone') + '</a>' : '') + '</div>' +
      '<div class="person-detail-stats"><div><span>我收他/她</span><b>' + T.esc(T.money(data.receivedTotal)) + '</b></div><div><span>我随他/她</span><b class="green">' + T.esc(T.money(data.sentTotal)) + '</b></div><div><span>往来差额</span><b class="dark">' + T.esc(balanceText(data.balance)) + '</b></div></div>' +
      '<div class="person-detail-actions">' +
      '<button class="btn btn-secondary" data-action="person-add-record" data-name="' + T.esc(name) + '" data-relation="' + T.esc(relation) + '">' + T.icon('gift') + ' 记收礼</button>' +
      '<button class="btn btn-primary" data-action="person-add-outgoing" data-name="' + T.esc(name) + '">' + T.icon('heart') + ' 记随出</button>' +
      '</div>' +
      (guest ? '<div style="display:flex;gap:7px;margin-bottom:13px"><button class="btn btn-ghost btn-block btn-sm" data-action="guest-edit" data-id="' + T.esc(guest.id) + '">' + T.icon('edit') + ' 编辑宾客档案</button><button class="btn btn-ghost btn-sm" data-action="person-delete-guest" data-id="' + T.esc(guest.id) + '">' + T.icon('trash') + ' 删除档案</button></div>' : '<button class="btn btn-secondary btn-block btn-sm" data-action="guest-new" data-name="' + T.esc(name) + '" data-relation="' + T.esc(relation) + '" data-phone="' + T.esc(phone) + '" style="margin-bottom:13px">' + T.icon('user-plus') + ' 保存为宾客档案</button>') +
      '<div class="mini-section-title"><span>收到的礼金 · ' + data.received.length + ' 笔</span><span>' + T.esc(T.money(data.receivedTotal)) + '</span></div>' +
      '<div class="mini-list">' + (receivedRows || '<div class="mini-empty">还没有收礼记录</div>') + '</div>' +
      '<div class="mini-section-title"><span>我随出的 · ' + data.sent.length + ' 笔</span><span>' + T.esc(T.money(data.sentTotal)) + '</span></div>' +
      '<div class="mini-list">' + (sentRows || '<div class="mini-empty">还没有随出记录</div>') + '</div>' +
      (guest && guest.note ? '<div class="notice-strip" style="margin-top:13px">' + T.icon('info') + '<span>' + T.esc(guest.note) + '</span></div>' : '') +
      '</div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>关闭</button></div>';
    T.openOverlay(html, { label: '人情往来', sheetClass: 'small-sheet' });
  }

  function openGuestForm(guestId, preset) {
    preset = preset || {};
    var guest = guestId ? T.getGuest(guestId) : null;
    var source = guest || {
      name: preset.name || '',
      phone: preset.phone || '',
      relation: preset.relation || '',
      tags: preset.tags || [],
      note: ''
    };
    var relations = T.state.settings.relationTags.slice();
    if (source.relation && relations.indexOf(source.relation) < 0) relations.unshift(source.relation);
    var relationChips = relations.map(function (r) {
      return '<button type="button" class="relation-chip' + (r === source.relation ? ' active' : '') + '" data-guest-relation="' + T.esc(r) + '">' + T.esc(r) + '</button>';
    }).join('');
    var selectedRelation = source.relation || '';
    var html = '<form id="guest-form" novalidate>' +
      '<div class="sheet-head"><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button>' +
      '<div class="head-copy"><p class="eyebrow">' + (guest ? 'EDIT CONTACT' : 'NEW CONTACT') + '</p><h2>' + (guest ? '编辑宾客' : '新增宾客') + '</h2><p class="sub">保存联系人，下次办酒直接选</p></div></div>' +
      '<div class="sheet-body">' +
      '<div class="form-section"><div class="form-section-title">' + T.icon('user') + '宾客资料</div>' +
      '<div class="field"><label class="field-label" for="guest-name">姓名 <span class="optional">必填</span></label><input class="input" id="guest-name" value="' + T.esc(source.name) + '" maxlength="40" placeholder="亲友姓名" data-autofocus></div>' +
      '<div class="field"><label class="field-label" for="guest-phone">手机号 <span class="optional">可选</span></label><input class="input" id="guest-phone" type="tel" inputmode="tel" value="' + T.esc(source.phone || '') + '" maxlength="30" placeholder="方便联系时拨号"></div>' +
      '<div class="field"><span class="field-label">关系分类</span><div class="relation-chips" id="guest-relations">' + relationChips + '</div></div>' +
      '<div class="field"><label class="field-label" for="guest-tags">自定义标签 <span class="optional">用逗号分隔</span></label><input class="input" id="guest-tags" value="' + T.esc(source.tags && source.tags.length ? source.tags.join('、') : '') + '" placeholder="如：大学同学、老邻居"></div>' +
      '<div class="field"><label class="field-label" for="guest-note">备注</label><textarea class="textarea" id="guest-note" maxlength="500" placeholder="例如：住在城西，孩子今年上小学">' + T.esc(source.note || '') + '</textarea></div>' +
      '</div><p class="form-foot-note">宾客档案可以跨礼簿使用，不会被绑定到某一本礼簿。</p></div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>取消</button><button class="btn btn-primary primary-wide" type="submit">' + (guest ? '保存修改' : '保存宾客') + '</button></div>' +
      '</form>';
    T.openOverlay(html, {
      sheetClass: 'full-sheet',
      label: guest ? '编辑宾客' : '新增宾客',
      onMount: function (sheet) {
        sheet.querySelector('#guest-relations').addEventListener('click', function (e) {
          var chip = e.target.closest('[data-guest-relation]');
          if (!chip) return;
          selectedRelation = chip.getAttribute('data-guest-relation');
          sheet.querySelectorAll('[data-guest-relation]').forEach(function (c) { c.classList.toggle('active', c === chip); });
        });
        sheet.querySelector('#guest-form').addEventListener('submit', function (e) {
          e.preventDefault();
          var name = sheet.querySelector('#guest-name').value.trim();
          if (!name) { T.toast('请填写宾客姓名', 'error'); sheet.querySelector('#guest-name').focus(); return; }
          var tagText = sheet.querySelector('#guest-tags').value;
          var tags = tagText.split(/[,，、\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
          var data = {
            name: name,
            phone: sheet.querySelector('#guest-phone').value.trim(),
            relation: selectedRelation,
            tags: tags,
            note: sheet.querySelector('#guest-note').value.trim()
          };
          if (guest) T.updateGuest(guest.id, data);
          else T.addGuest(data);
          T.closeOverlay();
          T.renderApp();
          T.toast(guest ? '宾客档案已更新' : '宾客档案已保存', 'success');
        });
      }
    });
  }

  function openOutgoingForm(presetName) {
    var guest = presetName ? T.findGuestByName(presetName) : null;
    var relations = T.state.settings.relationTags.slice();
    var selectedRelation = guest ? guest.relation : '';
    var relationChips = relations.map(function (r) { return '<button type="button" class="relation-chip' + (r === selectedRelation ? ' active' : '') + '" data-out-relation="' + T.esc(r) + '">' + T.esc(r) + '</button>'; }).join('');
    var quick = [200, 300, 500, 600, 800, 1000, 2000].map(function (n) { return '<button type="button" class="quick-amount" data-out-amount="' + n + '">' + n + '</button>'; }).join('');
    var html = '<form id="outgoing-form" novalidate>' +
      '<div class="sheet-head"><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button>' +
      '<div class="head-copy"><p class="eyebrow">GIFT OUT</p><h2>记录我随出</h2><p class="sub">别人办事，我随了多少</p></div></div>' +
      '<div class="sheet-body">' +
      '<div class="form-section"><div class="form-section-title">' + T.icon('user') + '随给谁</div>' +
      '<div class="field"><label class="field-label" for="out-name">姓名 <span class="optional">必填</span></label><input class="input" id="out-name" list="out-guests" value="' + T.esc(presetName || '') + '" maxlength="40" placeholder="亲友姓名" data-autofocus><datalist id="out-guests">' + T.state.guests.map(function (g) { return '<option value="' + T.esc(g.name) + '"></option>'; }).join('') + '</datalist></div>' +
      '<div class="field"><span class="field-label">关系分类</span><div class="relation-chips" id="out-relations">' + relationChips + '</div></div></div>' +
      '<div class="form-section"><div class="form-section-title">' + T.icon('yuan') + '礼金与事由</div>' +
      '<div class="field"><label class="field-label" for="out-amount">随出金额</label><div class="amount-input-wrap"><span class="currency">' + T.esc(T.currency()) + '</span><input class="input" id="out-amount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0"></div><div class="quick-amounts">' + quick + '</div></div>' +
      '<div class="field"><label class="field-label" for="out-event">事由 <span class="optional">可选</span></label><input class="input" id="out-event" maxlength="60" placeholder="例如：乔迁之喜、孩子满月"></div>' +
      '<div class="form-grid"><div class="field"><label class="field-label" for="out-date">日期</label><input class="input" id="out-date" type="date" value="' + T.todayISO() + '"></div><div class="field"><label class="field-label" for="out-gift">礼品 <span class="optional">可选</span></label><input class="input" id="out-gift" maxlength="120" placeholder="可选"></div></div>' +
      '<div class="field"><label class="field-label" for="out-note">备注</label><textarea class="textarea" id="out-note" maxlength="500" placeholder="补充一点人情细节…"></textarea></div></div>' +
      '<p class="form-foot-note">随出记录会计入对应亲友的人情账本。</p></div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>取消</button><button class="btn btn-primary primary-wide" type="submit">保存随出</button></div>' +
      '</form>';
    T.openOverlay(html, {
      sheetClass: 'full-sheet',
      label: '记录我随出',
      onMount: function (sheet) {
        var selected = selectedRelation;
        sheet.querySelector('#out-relations').addEventListener('click', function (e) {
          var chip = e.target.closest('[data-out-relation]');
          if (!chip) return;
          selected = chip.getAttribute('data-out-relation');
          sheet.querySelectorAll('[data-out-relation]').forEach(function (c) { c.classList.toggle('active', c === chip); });
        });
        sheet.querySelectorAll('[data-out-amount]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            sheet.querySelector('#out-amount').value = btn.getAttribute('data-out-amount');
          });
        });
        sheet.querySelector('#out-name').addEventListener('blur', function () {
          var g = T.findGuestByName(sheet.querySelector('#out-name').value);
          if (g) {
            if (!selected && g.relation) {
              selected = g.relation;
              sheet.querySelectorAll('[data-out-relation]').forEach(function (c) { c.classList.toggle('active', c.getAttribute('data-out-relation') === selected); });
            }
          }
        });
        sheet.querySelector('#outgoing-form').addEventListener('submit', function (e) {
          e.preventDefault();
          var name = sheet.querySelector('#out-name').value.trim();
          var amount = T.num(sheet.querySelector('#out-amount').value);
          if (!name) { T.toast('请填写姓名', 'error'); sheet.querySelector('#out-name').focus(); return; }
          if (!(amount > 0)) { T.toast('请填写随出金额', 'error'); sheet.querySelector('#out-amount').focus(); return; }
          T.addOutgoing({
            name: name,
            relation: selected,
            amount: amount,
            gift: sheet.querySelector('#out-gift').value.trim(),
            event: sheet.querySelector('#out-event').value.trim(),
            date: sheet.querySelector('#out-date').value || T.todayISO(),
            note: sheet.querySelector('#out-note').value.trim()
          });
          T.closeOverlay();
          T.renderApp();
          T.toast('随出记录已保存', 'success');
        });
      }
    });
  }

  /* ---------------- 提醒日期 ---------------- */
  function openReminderDateForm(recordId, kind) {
    var r = T.getRecord(recordId);
    if (!r) return;
    var field = kind === 'return' ? 'remindReturnAt' : 'remindThankAt';
    var current = r[field] || '';
    var label = kind === 'return' ? '回礼提醒' : '答谢提醒';
    var quick = [3, 7, 15, 30].map(function (d) { return '<button type="button" class="chip" data-remind-days="' + d + '">' + d + ' 天后</button>'; }).join('');
    T.openOverlay('<div class="sheet-head"><div class="head-copy"><p class="eyebrow">REMINDER</p><h2>设置' + label + '日</h2><p class="sub">' + T.esc(r.name) + ' · ' + T.esc(T.money(r.amount)) + '</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="field"><label class="field-label" for="remind-date">提醒日期</label><input class="input" id="remind-date" type="date" value="' + T.esc(current) + '"></div>' +
      '<div class="chips">' + quick + '</div><p class="field-hint" style="margin-top:8px">到日期后，提醒中心会优先显示该事项；打开通知后可在打开 App 时收到系统提示。关掉 App 也能提醒的建议导出到手机日历。</p></div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>取消</button>' + (current ? '<button class="btn btn-secondary" id="remind-remove">清除提醒</button>' : '') + '<button class="btn btn-primary primary-wide" id="remind-save">保存提醒</button></div>',
      {
        label: '设置提醒',
        onMount: function (sheet) {
          sheet.querySelectorAll('[data-remind-days]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              sheet.querySelector('#remind-date').value = T.addDays(T.todayISO(), Number(btn.getAttribute('data-remind-days')));
            });
          });
          var remove = sheet.querySelector('#remind-remove');
          if (remove) remove.addEventListener('click', function () {
            r[field] = '';
            T.save();
            T.closeOverlay();
            T.renderApp();
            T.toast('提醒已清除', 'success');
          });
          sheet.querySelector('#remind-save').addEventListener('click', function () {
            var val = sheet.querySelector('#remind-date').value;
            if (!val) { T.toast('请选择提醒日期', 'error'); return; }
            r[field] = val;
            T.addLog('设置提醒', '为「' + r.name + '」设置' + label + '日 ' + T.fmtDate(val), r.bookId);
            T.save();
            T.closeOverlay();
            T.renderApp();
            T.toast('提醒日已保存', 'success');
          });
        }
      });
  }

  /* ---------------- 通讯录 ---------------- */
  function openContactHelp(reason) {
    T.openOverlay('<div class="sheet-head"><div class="head-copy"><p class="eyebrow">CONTACTS</p><h2>从通讯录导入</h2></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="notice-strip" style="margin-top:0">' + T.icon('info') + '<span>' + T.esc(reason || '当前浏览器不支持读取通讯录。') + '</span></div>' +
      '<div class="welcome-features" style="grid-template-columns:1fr;margin:14px 0 0">' +
      '<div class="welcome-feature"><div class="wf-icon">' + T.icon('phone') + '</div><div><b>安卓 Chrome</b><span>通过 HTTPS 或已安装的 PWA 打开，可直接调用系统通讯录选择器。</span></div></div>' +
      '<div class="welcome-feature"><div class="wf-icon">' + T.icon('user-plus') + '</div><div><b>手动添加同样方便</b><span>保存宾客后，登记礼金时可直接点选姓名，自动带出关系。</span></div></div>' +
      '</div></div>' +
      '<div class="sheet-footer"><button class="btn btn-secondary" type="button" data-close-overlay>知道了</button><button class="btn btn-primary primary-wide" data-action="guest-new">' + T.icon('plus') + ' 手动新增宾客</button></div>',
      { label: '通讯录导入说明' });
  }

  async function importContacts() {
    if (!navigator.contacts || !navigator.contacts.select) {
      openContactHelp(location.protocol === 'file:' ? '本地文件模式不支持通讯录接口。请改用 HTTPS 安装版，或直接手动新增宾客。' : '当前浏览器不支持通讯录选择器。推荐使用安卓 Chrome，并通过 HTTPS 打开。');
      return;
    }
    try {
      var contacts = await navigator.contacts.select(['name', 'tel'], { multiple: true });
      if (!contacts || !contacts.length) return;
      var added = 0, updated = 0;
      contacts.forEach(function (c) {
        var name = (c.name && c.name[0]) || '';
        var phone = (c.tel && c.tel[0]) || '';
        name = String(name).trim();
        if (!name) return;
        var existing = T.findGuestByName(name);
        if (existing) {
          if (phone && !existing.phone) { existing.phone = phone; updated++; }
          return;
        }
        T.addGuest({ name: name, phone: phone });
        added++;
      });
      T.renderApp();
      T.toast('已导入 ' + added + ' 位宾客' + (updated ? '，更新 ' + updated + ' 位' : ''), 'success');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error(err);
      openContactHelp('通讯录读取没有完成：' + (err && err.message ? err.message : '未获得权限') + '。您可以直接手动新增宾客。');
    }
  }

  /* ---------------- 事件与动作 ---------------- */
  document.addEventListener('input', function (e) {
    if (!e.target) return;
    if (e.target.id === 'ledger-search') {
      ui.ledgerSearch = e.target.value;
      updatePeopleResults();
    } else if (e.target.id === 'guest-search') {
      ui.peopleSearch = e.target.value;
      updatePeopleResults();
    }
  });

  T.registerAction('people-tab', function (el) {
    var tab = el.getAttribute('data-tab');
    if (!TAB_LABELS[tab]) return;
    ui.peopleTab = tab;
    T.renderApp({ scrollTop: false });
  });
  T.registerAction('clear-ledger-search', function () {
    ui.ledgerSearch = '';
    var input = document.getElementById('ledger-search');
    if (input) input.value = '';
    updatePeopleResults();
  });
  T.registerAction('clear-guest-search', function () {
    ui.peopleSearch = '';
    var input = document.getElementById('guest-search');
    if (input) input.value = '';
    updatePeopleResults();
  });
  T.registerAction('guest-tag', function (el) {
    ui.guestTag = el.getAttribute('data-tag') || '';
    T.renderApp({ scrollTop: false });
  });
  T.registerAction('person-open', function (el) {
    var name = el.getAttribute('data-name');
    if (name) openPersonDetail(name);
  });
  T.registerAction('guest-new', function (el) {
    openGuestForm(null, {
      name: el.getAttribute('data-name') || '',
      relation: el.getAttribute('data-relation') || '',
      phone: el.getAttribute('data-phone') || ''
    });
  });
  T.registerAction('guest-edit', function (el) {
    var id = el.getAttribute('data-id');
    if (id) openGuestForm(id);
  });
  T.registerAction('outgoing-new', function (el) {
    openOutgoingForm(el && el.getAttribute('data-name') ? el.getAttribute('data-name') : '');
  });
  T.registerAction('person-add-record', function (el) {
    T.openRecordForm(null, {
      presetName: el.getAttribute('data-name') || '',
      presetRelation: el.getAttribute('data-relation') || ''
    });
  });
  T.registerAction('person-add-outgoing', function (el) {
    openOutgoingForm(el.getAttribute('data-name') || '');
  });
  T.registerAction('person-delete-guest', function (el) {
    var id = el.getAttribute('data-id');
    var guest = T.getGuest(id);
    if (!guest) return;
    var ok = window.confirm('删除「' + guest.name + '」的宾客档案？\n\n相关的礼金和随出记录会保留，人情账本仍会显示姓名。');
    if (!ok) return;
    T.deleteGuest(id);
    T.closeOverlay();
    T.renderApp();
    T.toast('宾客档案已删除', 'success');
  });
  T.registerAction('outgoing-delete', function (el) {
    var id = el.getAttribute('data-id');
    var name = el.getAttribute('data-name') || '';
    var item = T.getOutgoing(id);
    if (!item) return;
    var ok = window.confirm('删除向「' + item.name + '」随出的 ' + T.money(item.amount) + ' 记录？');
    if (!ok) return;
    T.deleteOutgoing(id);
    T.renderApp();
    if (ui.overlayOpen) openPersonDetail(name);
    T.toast('随出记录已删除', 'success');
  });
  T.registerAction('task-done', function (el) {
    var id = el.getAttribute('data-id');
    var kind = el.getAttribute('data-kind');
    if (!id) return;
    T.toggleRecordFlag(id, kind === 'return' ? 'returned' : 'thanked', true);
    T.renderApp({ scrollTop: false });
    T.toast(kind === 'return' ? '已标记为已回礼' : '已标记为已答谢', 'success');
  });
  T.registerAction('task-remind', function (el) {
    openReminderDateForm(el.getAttribute('data-id'), el.getAttribute('data-kind'));
  });
  T.registerAction('reminder-filter', function (el) {
    var f = el.getAttribute('data-filter');
    ui.reminderFilter = f || 'all';
    T.renderApp({ scrollTop: false });
  });
  T.registerAction('import-contacts', function () {
    importContacts();
  });
  T.registerAction('export-ics', function () {
    var res = T.downloadReminderICS();
    if (res && res.count) T.toast('已生成 ' + res.count + ' 项日历提醒', 'success', 3000);
  });
  T.registerAction('enable-notifications', async function () {
    if (!('Notification' in window)) { T.toast('当前浏览器不支持系统通知', 'error'); return; }
    if (Notification.permission === 'denied') {
      T.toast('通知已被拒绝，请在浏览器或系统设置中重新允许', 'error', 4200);
      return;
    }
    try {
      var permission = await Notification.requestPermission();
      if (permission === 'granted') {
        T.state.settings.notifications = true;
        T.save();
        T.renderApp({ scrollTop: false });
        T.toast('通知已开启。打开 App 时会提示今日人情待办', 'success', 3000);
      } else {
        T.state.settings.notifications = false;
        T.save();
        T.renderApp({ scrollTop: false });
        T.toast('未开启通知，仍可在提醒中心查看待办', 'info');
      }
    } catch (e) {
      T.toast('通知开启失败，请使用安卓 Chrome 或安装版', 'error');
    }
  });

  T.openPersonDetail = openPersonDetail;
  T.openGuestForm = openGuestForm;
  T.openOutgoingForm = openOutgoingForm;
  T.openReminderDateForm = openReminderDateForm;
})();
