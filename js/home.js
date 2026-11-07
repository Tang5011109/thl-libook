/* 泰合礼 THL 礼金簿 — 首页与礼簿管理 */
(function () {
  'use strict';
  var T = window.THL;
  var ui = T.ui;

  T.views.home = function () {
    var state = T.state;
    var active = T.getActiveBook();
    if (!state.books.length || !active) {
      return renderWelcome();
    }
    var stats = T.calcStats(active.id);
    var tasks = T.pendingTasks(active.id);
    var returnTasks = tasks.filter(function (t) { return t.type === 'return'; });
    var thankTasks = tasks.filter(function (t) { return t.type === 'thank'; });
    var recent = stats.records.slice().sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }).slice(0, 4);
    var dayNote = T.relativeDay(active.date);
    var dateText = active.date ? T.fmtDate(active.date) : '日期未设置';
    var books = T.allBooksStats();

    return '<div class="page home-page">' +
      '<div class="home-greet">' +
      '<div><div class="greet-text">' + T.esc(T.greet()) + (state.settings.operator && state.settings.operator !== '我' ? '，' + T.esc(state.settings.operator) : '') + '</div>' +
      '<div class="greet-title">把每一份心意，记成一本温暖的账。</div></div>' +
      '</div>' +
      renderHero(active, stats, dateText, dayNote) +
      renderQuickActions() +
      renderPending(returnTasks, thankTasks) +
      renderRecent(recent) +
      renderShelf(books) +
      '<footer class="home-foot"><div class="seal-line"><span class="line"></span>泰然存礼 · 和合记情<span class="line"></span></div><div>泰合礼 THL · 本地记账，数据只属于你</div></footer>' +
      '</div>';
  };

  function renderWelcome() {
    return '<div class="page home-page">' +
      '<section class="welcome">' +
      '<div class="welcome-logo-wrap"><img class="welcome-logo" src="assets/icon-512.png" alt="泰合礼标志"></div>' +
      '<h1 class="welcome-brand">泰合礼</h1>' +
      '<p class="welcome-en">THL · GIFT LEDGER</p>' +
      '<p class="welcome-slogan">泰然存礼，和合记情</p>' +
      '<p class="welcome-desc">把每一场喜事、每一份人情，妥帖记下。<br>多本礼簿互不打扰，数据只保存在你的手机里。</p>' +
      '<div class="welcome-features">' +
      feature('book-plus', '多场次礼簿', '婚礼、寿宴、乔迁分开记') +
      feature('heart-handshake', '人情账本', '收礼与随礼双向记') +
      feature('chart', '清晰统计', '总额、排行、关系占比') +
      feature('shield', '隐私安全', '本地存储 · 密码锁 · 备份') +
      '</div>' +
      '<div class="welcome-actions">' +
      '<button class="btn btn-primary btn-lg btn-block" data-action="open-book-form">' + T.icon('book-plus') + ' 创建第一本礼簿</button>' +
      '<button class="btn btn-secondary btn-block" data-action="load-sample">' + T.icon('sparkles') + ' 先看看示例效果</button>' +
      '</div>' +
      '<div class="welcome-divider">已有备份？</div>' +
      '<button class="text-link" data-action="restore-backup" style="min-height:34px;justify-content:center;width:100%">' + T.icon('upload') + ' 从 JSON 备份恢复</button>' +
      '<p class="welcome-note">支持添加到安卓主屏幕 · 无账号 · 无广告 · 离线可用</p>' +
      '</section></div>';
  }

  function feature(icon, title, desc) {
    return '<div class="welcome-feature"><div class="wf-icon">' + T.icon(icon) + '</div><div><b>' + title + '</b><span>' + desc + '</span></div></div>';
  }

  function renderHero(book, stats, dateText, dayNote) {
    var metaBits = [];
    if (book.location) metaBits.push('<span>' + T.icon('map-pin') + T.esc(book.location) + '</span>');
    if (book.host) metaBits.push('<span>' + T.icon('users') + '主人 ' + T.esc(book.host) + '</span>');
    return '<section class="book-hero" data-glyph="' + T.esc(T.bookGlyph(book.type)) + '">' +
      '<div class="book-topline">' +
      '<span class="event-type">' + T.esc(book.type || '喜事') + '</span>' +
      '<span class="event-date">' + T.icon('calendar') + T.esc(dateText) + (dayNote ? ' · ' + T.esc(dayNote) : '') + '</span>' +
      '<span class="book-spacer"></span>' +
      '<button class="hero-more-btn" data-action="open-book-menu">换一本 ' + T.icon('chevron-down') + '</button>' +
      '</div>' +
      '<h1 class="book-title">' + T.esc(book.title) + '</h1>' +
      (metaBits.length ? '<div class="book-meta">' + metaBits.join('') + '</div>' : '') +
      '<div class="book-total">' +
      '<div class="book-total-label"><span class="seal-mini">礼</span>本场实收礼金' + (stats.average ? ' · 人均 ' + T.esc(T.money(stats.average)) : '') + '</div>' +
      '<div class="book-total-line"><span class="currency-mark">' + T.esc(T.currency()) + '</span><span class="book-total-amount">' + T.esc(T.plainAmount(stats.cash)) + '</span><span class="book-total-note">' + stats.count + ' 笔</span></div>' +
      '<div class="book-mini-stats">' +
      '<div><b>' + stats.people + '</b><span>宾客人数</span></div>' +
      '<div><b>' + stats.count + '</b><span>礼金笔数</span></div>' +
      '<div><b>' + stats.pendingReturn + '</b><span>待回礼</span></div>' +
      '<div><b>' + stats.pendingThank + '</b><span>待答谢</span></div>' +
      '</div>' +
      '</div>' +
      '<div class="hero-actions">' +
      '<button class="btn btn-primary" data-action="add-record">' + T.icon('plus') + ' 登记礼金</button>' +
      '<button class="btn btn-secondary" data-action="open-export">' + T.icon('share') + ' 导出 / 分享</button>' +
      '</div>' +
      '</section>';
  }

  function renderQuickActions() {
    return '<section class="quick-grid">' +
      '<a class="quick-item" href="#/records">' + '<span class="quick-ico">' + T.icon('search') + '</span><span>搜礼金</span></a>' +
      '<a class="quick-item" href="#/stats">' + '<span class="quick-ico gold">' + T.icon('chart') + '</span><span>看统计</span></a>' +
      '<button class="quick-item" data-action="open-export"><span class="quick-ico green">' + T.icon('print') + '</span><span>打印导出</span></button>' +
      '<button class="quick-item" data-action="open-reminders"><span class="quick-ico blue">' + T.icon('bell') + '</span><span>人情提醒</span></button>' +
      '</section>';
  }

  function namesLine(tasks, n) {
    var names = [];
    tasks.forEach(function (t) {
      if (names.indexOf(t.name) < 0) names.push(t.name);
    });
    return names.slice(0, n).map(function (x) { return '<span class="name-pill">' + T.esc(x) + '</span>'; }).join('');
  }

  function renderPending(returnTasks, thankTasks) {
    if (!returnTasks.length && !thankTasks.length) return '';
    var html = '<section class="section"><div class="section-head"><div class="section-title">' + T.icon('bell') + '回礼与答谢</div>' +
      '<button class="text-link" data-action="open-reminders">去处理' + T.icon('chevron-right') + '</button></div>' +
      '<div class="pending-card">';
    if (returnTasks.length) {
      html += '<div class="pending-group" data-action="open-reminders" role="button" tabindex="0">' +
        '<div class="pending-glyph">' + T.icon('gift') + '</div>' +
        '<div class="pending-body"><b>' + returnTasks.length + ' 笔礼金待回礼</b><p>随一份心意，记得把人情还上</p>' +
        (namesLine(returnTasks, 3) ? '<div class="pending-names">' + namesLine(returnTasks, 3) + '</div>' : '') +
        '</div><span class="pending-arrow">' + T.icon('chevron-right') + '</span></div>';
    }
    if (thankTasks.length) {
      html += '<div class="pending-group" style="' + (returnTasks.length ? 'margin-top:4px' : '') + '" data-action="open-reminders" role="button" tabindex="0">' +
        '<div class="pending-glyph">' + T.icon('heart') + '</div>' +
        '<div class="pending-body"><b>' + thankTasks.length + ' 笔礼金待答谢</b><p>一句感谢，也是一份礼数</p>' +
        (namesLine(thankTasks, 3) ? '<div class="pending-names">' + namesLine(thankTasks, 3) + '</div>' : '') +
        '</div><span class="pending-arrow">' + T.icon('chevron-right') + '</span></div>';
    }
    html += '<div class="mini-bell-row">' + T.icon('clock') + '可在提醒中心设置提醒日，或导出到手机日历</div></div></section>';
    return html;
  }

  function renderRecent(recent) {
    return '<section class="section"><div class="section-head"><div class="section-title">' + T.icon('list') + '最近登记</div>' +
      (recent.length ? '<a class="text-link" href="#/records">全部明细' + T.icon('chevron-right') + '</a>' : '') + '</div>' +
      (recent.length ? '<div class="recent-card recent-list">' + recent.map(function (r) { return T.recordRow(r, { compact: true }); }).join('') +
        '<a class="view-all" href="#/records">查看本场全部礼金 ' + T.icon('chevron-right') + '</a></div>' :
        T.emptyState('gift', '还没有礼金记录', '点“登记礼金”，把第一份心意记下来。', '<button class="btn btn-primary" data-action="add-record">' + T.icon('plus') + ' 登记第一笔</button>')) +
      '</section>';
  }

  function renderShelf(books) {
    var html = '<section class="section"><div class="section-head"><div class="section-title">' + T.icon('book') + '我的礼簿<span class="section-sub">' + books.length + ' 本</span></div>' +
      '<a class="text-link" href="#/settings">管理' + T.icon('chevron-right') + '</a></div><div class="book-shelf">';
    books.forEach(function (b) {
      var active = b.book.id === T.state.activeBookId;
      html += '<button class="book-shelf-card' + (active ? ' active' : '') + '" data-action="switch-book" data-id="' + T.esc(b.book.id) + '">' +
        '<div class="book-shelf-glyph">' + T.esc(T.bookGlyph(b.book.type)) + '</div>' +
        '<div class="book-shelf-title">' + T.esc(b.book.title) + '</div>' +
        '<div class="book-shelf-meta"><span>' + T.esc(T.fmtDate(b.book.date, 'short')) + ' · ' + b.people + ' 人</span><b>' + T.esc(T.shortMoney(b.cash)) + '</b></div>' +
        '</button>';
    });
    html += '<button class="book-shelf-add" data-action="open-book-form">' + T.icon('plus') + '<span>新建礼簿</span></button></div></section>';
    return html;
  }

  /* ---------- 切换礼簿 ---------- */
  function openBookMenu() {
    var books = T.allBooksStats();
    var rows = books.map(function (b) {
      return '<button class="book-pick-row' + (b.book.id === T.state.activeBookId ? ' active' : '') + '" data-action="switch-book" data-id="' + T.esc(b.book.id) + '">' +
        '<span class="book-pick-glyph">' + T.esc(T.bookGlyph(b.book.type)) + '</span>' +
        '<span class="book-pick-copy"><b>' + T.esc(b.book.title) + '</b><p>' + T.esc((b.book.type || '喜事') + ' · ' + T.fmtDate(b.book.date)) + '</p></span>' +
        '<span class="book-pick-total">' + T.esc(T.money(b.cash)) + '<span>' + b.count + ' 笔 · ' + b.people + ' 人</span></span>' +
        (b.book.id === T.state.activeBookId ? '<span class="book-pick-actions">' + T.icon('check-circle') + '</span>' : '') +
        '</button>';
    }).join('');
    T.openOverlay('<div class="sheet-grabber"></div>' +
      '<div class="sheet-head"><div class="head-copy"><p class="eyebrow">MY LEDGERS</p><h2>切换礼簿</h2><p class="sub">每场喜事独立记账，互不打扰</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="book-pick-list">' + rows + '</div>' +
      '<button class="add-book-inline" type="button" data-action="open-book-form" style="margin-top:10px;min-height:46px">' + T.icon('plus') + ' 新建一本礼簿</button>' +
      '<p class="contact-note">切换后，首页与统计会同步显示所选礼簿。可在「设置」中编辑、清空或删除礼簿。</p></div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>关闭</button></div>',
      { label: '切换礼簿', sheetClass: 'small-sheet' });
  }

  /* ---------- 礼簿表单 ---------- */
  function openBookForm(bookId) {
    var existing = bookId ? T.getBook(bookId) : null;
    var settings = T.state.settings;
    var initial = existing || {
      title: '',
      type: settings.eventTypes[0] || '婚礼',
      date: T.todayISO(),
      location: '',
      host: '',
      note: ''
    };
    var selectedType = initial.type || '婚礼';
    var types = settings.eventTypes.slice();
    if (selectedType && types.indexOf(selectedType) < 0) types.unshift(selectedType);
    var typeChips = types.map(function (t) {
      return '<button type="button" class="relation-chip' + (t === selectedType ? ' active' : '') + '" data-book-type="' + T.esc(t) + '">' + T.esc(t) + '</button>';
    }).join('');
    var html = '<form id="book-form" novalidate>' +
      '<div class="sheet-head"><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button>' +
      '<div class="head-copy"><p class="eyebrow">' + (existing ? 'EDIT LEDGER' : 'NEW LEDGER') + '</p><h2>' + (existing ? '编辑礼簿' : '新建礼簿') + '</h2><p class="sub">一场喜事，一本礼簿</p></div></div>' +
      '<div class="sheet-body">' +
      '<div class="form-section">' +
      '<div class="form-section-title">' + T.icon('book') + '礼簿信息</div>' +
      '<div class="field"><label class="field-label" for="book-title">礼簿标题 <span class="optional">必填</span></label><input class="input" id="book-title" name="title" value="' + T.esc(initial.title) + '" maxlength="60" placeholder="例如：志远 & 晓雅 婚礼礼簿" data-autofocus></div>' +
      '<div class="field"><span class="field-label">喜事类型</span><div class="relation-chips" id="book-types">' + typeChips + '</div></div>' +
      '<div class="form-grid"><div class="field"><label class="field-label" for="book-date">宴席日期</label><input class="input" id="book-date" name="date" type="date" value="' + T.esc(initial.date || T.todayISO()) + '"></div>' +
      '<div class="field"><label class="field-label" for="book-host">主人 / 东家</label><input class="input" id="book-host" name="host" value="' + T.esc(initial.host || '') + '" maxlength="40" placeholder="可选"></div></div>' +
      '</div>' +
      '<div class="form-section">' +
      '<div class="form-section-title">' + T.icon('map-pin') + '宴席信息</div>' +
      '<div class="field"><label class="field-label" for="book-location">地点</label><input class="input" id="book-location" name="location" value="' + T.esc(initial.location || '') + '" maxlength="80" placeholder="酒店、宴会厅或家中地址"></div>' +
      '<div class="field"><label class="field-label" for="book-note">礼簿寄语 <span class="optional">可选</span></label><textarea class="textarea" id="book-note" name="note" maxlength="500" placeholder="写下一句对这场喜事的祝福…">' + T.esc(initial.note || '') + '</textarea></div>' +
      '</div>' +
      '<p class="form-foot-note">' + (existing ? '修改会同步到这本礼簿的信息。' : '创建后可在「设置」里随时编辑或清空。') + '</p>' +
      '</div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>取消</button><button class="btn btn-primary primary-wide" type="submit">' + (existing ? '保存修改' : '创建礼簿') + '</button></div>' +
      '</form>';
    T.openOverlay(html, {
      sheetClass: 'full-sheet',
      label: existing ? '编辑礼簿' : '新建礼簿',
      onMount: function (sheet) {
        var typesWrap = sheet.querySelector('#book-types');
        typesWrap.addEventListener('click', function (e) {
          var chip = e.target.closest('[data-book-type]');
          if (!chip) return;
          selectedType = chip.getAttribute('data-book-type');
          typesWrap.querySelectorAll('[data-book-type]').forEach(function (c) { c.classList.toggle('active', c === chip); });
        });
        sheet.querySelector('#book-form').addEventListener('submit', function (e) {
          e.preventDefault();
          var title = sheet.querySelector('#book-title').value.trim();
          if (!title) {
            title = (selectedType || '喜事') + '礼簿';
          }
          var data = {
            title: title,
            type: selectedType || '婚礼',
            date: sheet.querySelector('#book-date').value || T.todayISO(),
            host: sheet.querySelector('#book-host').value.trim(),
            location: sheet.querySelector('#book-location').value.trim(),
            note: sheet.querySelector('#book-note').value.trim()
          };
          if (existing) {
            T.updateBook(existing.id, data);
            T.setActiveBook(existing.id);
            T.closeOverlay();
            T.renderApp();
            T.toast('礼簿信息已更新', 'success');
          } else {
            var book = T.addBook(data);
            T.closeOverlay();
            T.renderApp({ scrollTop: true });
            T.toast('《' + book.title + '》已创建', 'success');
          }
        });
      }
    });
  }

  /* ---------- 操作 ---------- */
  T.registerAction('open-book-menu', function () {
    openBookMenu();
  });
  T.registerAction('open-book-form', function () {
    openBookForm();
  });
  T.registerAction('book-edit', function (el) {
    var id = el.getAttribute('data-id');
    if (id) openBookForm(id);
  });
  T.registerAction('switch-book', function (el) {
    var id = el.getAttribute('data-id');
    if (!id || !T.getBook(id)) return;
    if (id !== T.state.activeBookId) {
      ui.batchMode = false;
      ui.selected = new Set();
      ui.search = '';
      ui.listFilter = 'all';
      ui.listRelation = '';
    }
    T.setActiveBook(id);
    T.closeOverlay();
    T.renderApp({ scrollTop: true });
    T.toast('已切换到《' + T.getBook(id).title + '》', 'success');
  });
  T.registerAction('load-sample', function () {
    if (T.state.books.length || T.state.records.length) {
      var ok = window.confirm('载入示例会替换当前的礼簿与记录数据。\n\n建议先导出备份。确定继续吗？');
      if (!ok) return;
      T.makeSnapshot('载入示例前自动备份').catch(function () {});
    }
    T.loadSampleData();
    T.renderApp({ scrollTop: true });
    T.toast('示例礼簿已载入，所有功能都可以体验', 'success', 3000);
  });
  T.registerAction('book-clear', function (el) {
    var id = el.getAttribute('data-id');
    var book = T.getBook(id);
    if (!book) return;
    var count = T.recordsOfBook(id).length;
    var ok = window.confirm('清空《' + book.title + '》中的 ' + count + ' 笔礼金？\n\n宾客档案、人情往来和操作日志会保留。清空前会自动建立一个恢复点。');
    if (!ok) return;
    T.makeSnapshot('清空礼簿前自动备份').catch(function () {});
    T.deleteBook(id, 'clear');
    T.renderApp();
    T.toast('本场礼金已清空', 'success');
  });
  T.registerAction('book-delete', function (el) {
    var id = el.getAttribute('data-id');
    var book = T.getBook(id);
    if (!book) return;
    var count = T.recordsOfBook(id).length;
    var ok = window.confirm('删除《' + book.title + '》及其中 ' + count + ' 笔礼金？\n\n删除前会自动建立恢复点，可在「恢复点」中找回（不含照片）。');
    if (!ok) return;
    T.makeSnapshot('删除礼簿前自动备份').catch(function () {});
    T.deleteBook(id, 'delete');
    T.renderApp();
    T.toast('礼簿已删除', 'success');
  });

  T.openBookForm = openBookForm;
  T.openBookMenu = openBookMenu;
})();
