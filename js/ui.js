/* 泰合礼 THL 礼金簿 — 应用骨架、导航、弹层、锁屏 */
(function () {
  'use strict';
  var T = window.THL;
  var ui = T.ui;
  T.views = T.views || {};
  T.actions = T.actions || {};

  var ROUTES = ['home', 'records', 'stats', 'people', 'settings'];
  var PAGE_META = {
    home: { title: '礼簿', sub: '把每一份心意，妥帖安放' },
    records: { title: '礼金明细', sub: '按姓名、金额或备注查找' },
    stats: { title: '统计汇总', sub: '清楚每一笔，心里更有数' },
    people: { title: '人情往来', sub: '有来有往，情谊长存' },
    settings: { title: '设置与数据', sub: '隐私、备份与个性化' }
  };

  ui.recordLimit = 60;
  ui.returnRoute = 'home';
  ui.peopleTab = ui.peopleTab || 'ledger';
  ui.reminderFilter = 'all';
  ui.showAllRank = false;

  /* ---------------- 基础工具 ---------------- */
  T.icon = function (name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  };
  T.registerAction = function (name, fn) {
    T.actions[name] = fn;
  };
  T.qs = function (sel, root) { return (root || document).querySelector(sel); };
  T.qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  T.firstChar = function (name) {
    var chars = Array.from(String(name || '').trim());
    return chars[0] || '礼';
  };
  T.tone = function (name) {
    return Math.abs(T.hashCode(String(name || '礼'))) % 8;
  };
  T.avatar = function (name, size, round) {
    var cls = 'avatar tone-' + T.tone(name);
    if (size === 'sm') cls += ' avatar-sm';
    if (size === 'lg') cls += ' avatar-lg';
    if (round) cls += ' avatar-round';
    return '<span class="' + cls + '" aria-hidden="true">' + T.esc(T.firstChar(name)) + '</span>';
  };
  T.bookGlyph = function (type) {
    var map = { '婚礼': '囍', '寿宴': '寿', '乔迁': '乔', '满月': '喜', '升学': '学', '开业': '业' };
    return map[type] || (type ? Array.from(String(type))[0] : '礼');
  };
  T.currencyName = function () {
    var code = T.state.settings.currencyCode;
    var c = T.CURRENCIES.filter(function (x) { return x.code === code; })[0];
    return c && code !== 'CUSTOM' ? c.label : '自定义 ' + T.currency();
  };
  T.recordSubtitle = function (r) {
    var parts = [];
    if (r.gift) parts.push('礼品：' + r.gift);
    if (r.note) parts.push(r.note);
    return parts.join(' · ') || '—';
  };
  T.statusFlags = function (r, limit) {
    var items = [];
    if (r.attended) items.push('<span class="status-dot on">到场</span>');
    if (r.returned) items.push('<span class="status-dot on">已回礼</span>');
    else items.push('<span class="status-dot pending">待回礼</span>');
    if (r.thanked) items.push('<span class="status-dot on">已答谢</span>');
    else items.push('<span class="status-dot pending">待答谢</span>');
    if (limit) items = items.slice(0, limit);
    return items.join('');
  };
  T.emptyState = function (icon, title, desc, actions) {
    return '<div class="empty-state"><div class="empty-ico">' + T.icon(icon) + '</div><h3>' + T.esc(title) + '</h3><p>' + T.esc(desc) + '</p>' + (actions || '') + '</div>';
  };
  T.bookStatsLabel = function (book) {
    var st = T.calcStats(book.id);
    return st.count + ' 笔 · ' + T.money(st.cash);
  };
  T.isStandalone = function () {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  };

  T.recordRow = function (r, opts) {
    opts = opts || {};
    var book = opts.showBook ? T.getBook(r.bookId) : null;
    var flags = opts.compact ? T.statusFlags(r, 2) : T.statusFlags(r);
    var selected = ui.selected && ui.selected.has(r.id);
    var photo = r.photoId ? '<span class="photo-mark">' + T.icon('camera') + ' 存证</span>' : '';
    var bookTag = book ? '<span class="tag tag-gold">' + T.esc(book.title) + '</span>' : '';
    return '<div class="record-row' + (selected && ui.batchMode ? ' selected' : '') + '" data-action="record-open" data-record-id="' + T.esc(r.id) + '" role="button" tabindex="0" aria-label="' + T.esc(r.name + '，' + T.money(r.amount)) + '">' +
      (ui.batchMode ? '<span class="batch-check" aria-hidden="true">' + T.icon('check') + '</span>' : '') +
      T.avatar(r.name) +
      '<div class="record-main">' +
      '<div class="record-name-line"><span class="record-name">' + T.esc(r.name) + '</span>' + (r.relation ? '<span class="tag">' + T.esc(r.relation) + '</span>' : '') + bookTag + '</div>' +
      '<div class="record-sub">' + T.esc(T.recordSubtitle(r)) + '</div>' +
      '<div class="record-flags">' + flags + photo + '</div>' +
      '</div>' +
      '<div class="record-right"><span class="record-amount">' + T.esc(T.money(r.amount)) + '</span><span class="record-date">' + T.esc(T.fmtDate(r.date, 'md')) + '</span></div>' +
      '</div>';
  };

  T.recordRowKeyboard = function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var row = e.target.closest && e.target.closest('.record-row[data-record-id]');
    if (!row) return;
    e.preventDefault();
    row.click();
  };
  document.addEventListener('keydown', T.recordRowKeyboard);

  /* ---------------- Toast / Loading ---------------- */
  var toastTimers = [];
  T.toast = function (message, type, duration) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    type = type || 'info';
    duration = duration || (type === 'error' ? 3600 : 2500);
    while (root.children.length >= 3) root.removeChild(root.firstChild);
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    var ico = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info');
    el.innerHTML = T.icon(ico) + '<span></span>';
    el.querySelector('span').textContent = message;
    root.appendChild(el);
    var timer = setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 240);
    }, duration);
    toastTimers.push(timer);
  };

  var loadingCount = 0;
  T.showLoading = function (text) {
    loadingCount++;
    var root = document.getElementById('loading-root');
    var t = document.getElementById('loading-text');
    if (t) t.textContent = text || '正在处理…';
    if (root) root.hidden = false;
  };
  T.hideLoading = function () {
    loadingCount = Math.max(0, loadingCount - 1);
    if (loadingCount === 0) {
      var root = document.getElementById('loading-root');
      if (root) root.hidden = true;
    }
  };

  /* ---------------- 弹层 ---------------- */
  var overlayRoot = document.getElementById('overlay-root');
  var overlayPushed = false;
  var overlayBeforeClose = null;
  var overlayCloseCb = null;
  var overlaySeq = 0;
  var lastFocused = null;

  function overlaySheet() {
    return overlayRoot ? overlayRoot.querySelector('.modal-sheet') : null;
  }

  T.openOverlay = function (html, opts) {
    opts = opts || {};
    if (!overlayRoot) return;
    var wasOpen = ui.overlayOpen;
    if (wasOpen) {
      if (overlayCloseCb) {
        try { overlayCloseCb(); } catch (e) { /* ignore */ }
      }
      overlaySeq++;
    } else {
      lastFocused = document.activeElement;
      overlayRoot.hidden = false;
      document.body.classList.add('modal-open');
      var app = document.getElementById('app');
      if (app) app.inert = true;
      ui.overlayOpen = true;
      overlayPushed = true;
      try {
        if (history.state && history.state.thlOverlay) {
          // 复用尚未回退的弹层历史记录，避免多次开关后积压历史条目。
          history.replaceState({ thlOverlay: true }, '', location.href);
        } else {
          history.pushState({ thlOverlay: true }, '', location.href);
        }
      } catch (e) { overlayPushed = false; }
      overlaySeq++;
    }
    overlayBeforeClose = opts.onBeforeClose || null;
    overlayCloseCb = opts.onClose || null;
    var overlayCls = 'modal-overlay' + (opts.overlayClass ? ' ' + opts.overlayClass : '');
    var sheetCls = 'modal-sheet' + (opts.sheetClass ? ' ' + opts.sheetClass : '');
    overlayRoot.innerHTML = '<div class="' + overlayCls + '">' +
      '<div class="modal-backdrop" data-close-overlay></div>' +
      '<section class="' + sheetCls + '" role="dialog" aria-modal="true" tabindex="-1" aria-label="' + T.esc(opts.label || opts.title || '操作面板') + '">' +
      html + '</section></div>';
    var sheet = overlayRoot.querySelector('.modal-sheet');
    if (opts.onMount) {
      try { opts.onMount(sheet, overlayRoot); } catch (err) { console.error(err); }
    }
    requestAnimationFrame(function () {
      if (!sheet) return;
      if (opts.scrollTop !== false) sheet.scrollTop = 0;
      if (opts.autoFocus !== false) {
        var target = sheet.querySelector('[data-autofocus]') || (opts.focusClose ? sheet.querySelector('[data-close-overlay]') : null) || sheet;
        try { target.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    });
  };

  function hideOverlay() {
    if (!ui.overlayOpen) return;
    var closeCb = overlayCloseCb;
    overlayCloseCb = null;
    overlayBeforeClose = null;
    if (overlayRoot) {
      overlayRoot.hidden = true;
      overlayRoot.innerHTML = '';
    }
    ui.overlayOpen = false;
    overlayPushed = false;
    document.body.classList.remove('modal-open');
    var app = document.getElementById('app');
    if (app) app.inert = !!ui.locked;
    if (closeCb) {
      try { closeCb(); } catch (e) { /* ignore */ }
    }
    if (lastFocused && document.contains(lastFocused) && !ui.locked) {
      try { lastFocused.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    lastFocused = null;
  }

  T.closeOverlay = function (options) {
    if (!ui.overlayOpen) return;
    options = options || {};
    if (!options.fromHistory && overlayBeforeClose) {
      var proceed = false;
      try { proceed = overlayBeforeClose(); } catch (e) { proceed = true; }
      if (proceed === false) return;
      overlayBeforeClose = null;
    }
    var shouldGoBack = !!(overlayPushed && history.state && history.state.thlOverlay);
    // 先关闭界面，确保即使浏览器忽略 history 回退也不会把用户困在弹层里。
    overlaySeq++;
    hideOverlay();
    if (shouldGoBack) {
      try { history.back(); } catch (e) { /* ignore */ }
    }
  };

  T.hideOverlayImmediately = function () {
    if (ui.overlayOpen) {
      overlaySeq++;
      hideOverlay();
    }
  };

  document.addEventListener('click', function (e) {
    var closeEl = e.target.closest && e.target.closest('[data-close-overlay]');
    if (closeEl) {
      e.preventDefault();
      T.closeOverlay();
    }
  });

  T.registerAction('nav-back', function () {
    var target = ui.returnRoute && ROUTES.indexOf(ui.returnRoute) >= 0 ? ui.returnRoute : 'home';
    T.navigate(target);
  });

  // 动作分发（视图模块通过 registerAction 注册）
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var fn = T.actions[action];
    if (fn) {
      e.preventDefault();
      try {
        fn(el, e);
      } catch (err) {
        console.error('Action failed:', action, err);
        T.toast('操作没有完成，请重试', 'error');
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (ui.locked) return;
    if (!ui.overlayOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      T.closeOverlay();
      return;
    }
    if (e.key === 'Tab') {
      var sheet = overlaySheet();
      if (!sheet) return;
      var focusables = T.qsa('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', sheet).filter(function (x) {
        return x.offsetWidth > 0 || x.offsetHeight > 0;
      });
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  window.addEventListener('popstate', function () {
    if (ui.overlayOpen) {
      hideOverlay();
    }
  });

  /* ---------------- 路由与渲染 ---------------- */
  function hashRoute() {
    var raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES.indexOf(raw) >= 0 ? raw : 'home';
  }
  T.hashRoute = hashRoute;

  T.navigate = function (route, options) {
    options = options || {};
    if (ROUTES.indexOf(route) < 0) route = 'home';
    if (ui.overlayOpen) T.hideOverlayImmediately();
    if (route !== 'settings') {
      // no-op
    } else if (ui.route !== 'settings') {
      ui.returnRoute = ui.route || 'home';
    }
    if (ui.route !== route) ui.route = route;
    var target = '#/' + route;
    if (location.hash !== target) {
      if (options.replace) {
        history.replaceState(history.state, '', target);
        T.renderApp({ scrollTop: true });
      } else {
        location.hash = target;
      }
    } else {
      T.renderApp({ scrollTop: options.scrollTop !== false });
    }
  };

  T.renderApp = function (options) {
    options = options || {};
    var route = hashRoute();
    var previous = ui.route;
    ui.route = route;
    if (previous !== route && route !== 'records') {
      ui.batchMode = false;
      ui.selected = new Set();
    }
    document.body.setAttribute('data-route', route);
    var app = document.getElementById('app');
    var topbar = document.getElementById('topbar');
    var view = document.getElementById('view');
    var tabbar = document.getElementById('tabbar');
    if (!app || !topbar || !view || !tabbar) return;
    app.classList.toggle('no-tabbar', route === 'settings');
    topbar.className = 'topbar' + (route === 'home' ? ' topbar-home' : '');
    topbar.innerHTML = renderTopbar(route);
    tabbar.innerHTML = renderTabbar(route);
    var renderer = T.views[route];
    try {
      view.innerHTML = renderer ? renderer() : T.views.home();
    } catch (err) {
      console.error('Render failed:', err);
      view.innerHTML = '<div class="page">' + T.emptyState('alert-circle', '页面加载遇到问题', '请返回首页后重试。数据已经安全保存在本机。', '<button class="btn btn-primary" data-action="retry-render">重新加载</button>') + '</div>';
    }
    app.inert = !!ui.locked || ui.overlayOpen;
    if (options.scrollTop) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    T.hydratePhotos && T.hydratePhotos(view);
  };

  T.registerAction('retry-render', function () { T.renderApp({ scrollTop: true }); });

  function renderTopbar(route) {
    var activeBook = T.getActiveBook();
    var actions = '';
    var bellCount = T.reminderBadgeCount();
    var bell = '<button class="icon-btn" data-action="open-reminders" aria-label="人情提醒' + (bellCount ? '，' + bellCount + ' 项待办' : '') + '">' + T.icon('bell') + (bellCount ? '<span class="bell-dot">' + (bellCount > 9 ? '9+' : bellCount) + '</span>' : '') + '</button>';
    var gear = '<a class="icon-btn" href="#/settings" aria-label="设置">' + T.icon('settings') + '</a>';
    if (route === 'settings') {
      return '<div class="topbar-inner">' +
        '<button class="icon-btn back-btn" data-action="nav-back" aria-label="返回">' + T.icon('arrow-left') + '</button>' +
        '<div class="page-heading"><h1>设置与数据</h1><p>隐私、备份与个性化</p></div>' +
        (T.state.settings.lock && T.state.settings.lock.enabled ? '<button class="icon-btn" data-action="lock-now" aria-label="立即锁定">' + T.icon('lock') + '</button>' : '') +
        '</div>';
    }
    if (route === 'home') {
      return '<div class="topbar-inner">' +
        '<a class="brand-lockup" href="#/home" aria-label="泰合礼首页">' +
        '<img class="brand-mark" src="assets/icon-192.png" alt="泰合礼标志">' +
        '<div class="brand-copy"><span class="brand-name">泰合礼</span><span class="brand-slogan">泰然存礼，和合记情</span></div></a>' +
        '<div class="top-actions">' + bell + gear + '</div>' +
        '</div>';
    }
    var title = PAGE_META[route] ? PAGE_META[route].title : '泰合礼';
    var sub = activeBook ? activeBook.title : '还没有礼簿';
    if (route === 'people') sub = '人情账本 · 宾客档案 · 回礼提醒';
    if (route === 'records') sub = activeBook ? activeBook.title : '先新建一本礼簿吧';
    return '<div class="topbar-inner">' +
      '<div class="page-heading"><h1>' + T.esc(title) + '</h1><p>' + T.esc(sub) + '</p></div>' +
      '<div class="top-actions">' + bell + gear + '</div>' +
      '</div>';
  }

  function renderTabbar(route) {
    if (route === 'settings') return '';
    function item(id, href, icon, label) {
      return '<a class="nav-item' + (route === id ? ' active' : '') + '" href="' + href + '" aria-current="' + (route === id ? 'page' : 'false') + '">' + T.icon(icon) + '<span>' + label + '</span></a>';
    }
    return item('home', '#/home', 'home', '礼簿') +
      item('records', '#/records', 'list', '明细') +
      '<div class="nav-add-wrap"><button class="nav-fab" data-action="add-record" aria-label="登记一笔礼金">' + T.icon('plus') + '</button><span class="nav-add-label">记一笔</span></div>' +
      item('stats', '#/stats', 'chart', '统计') +
      item('people', '#/people', 'heart-handshake', '人情');
  }

  T.openReminders = function () {
    ui.peopleTab = 'reminders';
    T.navigate('people');
  };
  T.registerAction('open-reminders', T.openReminders);

  /* ---------------- 锁屏 ---------------- */
  var lockBuffer = '';
  var lockBusy = false;
  var lockAttempts = 0;
  var lockBlockedUntil = 0;
  var lockTimer = null;
  var lastActivity = Date.now();
  var hiddenAt = 0;

  function lockConfig() {
    return (T.state && T.state.settings && T.state.settings.lock) || { enabled: false, pinLength: 4, autoLockMinutes: 5 };
  }
  function lockLength() {
    var len = lockConfig().pinLength || 4;
    return Math.max(4, Math.min(8, len));
  }
  function renderLockDots() {
    var dots = document.getElementById('lock-dots');
    if (!dots) return;
    var len = lockLength();
    var html = '';
    for (var i = 0; i < len; i++) {
      html += '<span class="lock-dot' + (i < lockBuffer.length ? ' filled' : '') + '"></span>';
    }
    dots.innerHTML = html;
  }
  function renderLockKeypad() {
    var pad = document.getElementById('lock-keypad');
    if (!pad) return;
    var html = '';
    for (var i = 1; i <= 9; i++) html += '<button type="button" data-lock-key="' + i + '" aria-label="' + i + '">' + i + '</button>';
    html += '<button type="button" class="blank" tabindex="-1" aria-hidden="true"></button>';
    html += '<button type="button" data-lock-key="0" aria-label="0">0</button>';
    html += '<button type="button" class="del" data-lock-key="del" aria-label="删除">⌫</button>';
    pad.innerHTML = html;
  }
  function lockError(msg) {
    var el = document.getElementById('lock-error');
    if (el) el.textContent = msg || '';
  }
  function shakeLock() {
    var screen = document.getElementById('lock-screen');
    if (!screen) return;
    screen.classList.remove('shake');
    void screen.offsetWidth;
    screen.classList.add('shake');
    setTimeout(function () { screen.classList.remove('shake'); }, 380);
  }
  function blockCountdown() {
    var remain = Math.ceil((lockBlockedUntil - Date.now()) / 1000);
    if (remain <= 0) {
      lockBlockedUntil = 0;
      lockAttempts = 0;
      T.qsa('#lock-keypad button').forEach(function (b) { b.disabled = false; });
      lockError('');
      return;
    }
    lockError('尝试次数过多，请 ' + remain + ' 秒后再试');
    T.qsa('#lock-keypad button').forEach(function (b) { b.disabled = true; });
    setTimeout(blockCountdown, 1000);
  }
  async function tryUnlock() {
    if (lockBusy) return;
    if (lockBlockedUntil > Date.now()) return;
    if (lockBuffer.length < lockLength()) return;
    lockBusy = true;
    var ok = false;
    try {
      ok = await T.verifyPIN(lockBuffer);
    } catch (e) {
      ok = false;
    }
    lockBusy = false;
    if (ok) {
      lockAttempts = 0;
      lockBuffer = '';
      unlockApp();
    } else {
      lockAttempts++;
      lockBuffer = '';
      renderLockDots();
      if (lockAttempts >= 5) {
        lockBlockedUntil = Date.now() + 30000;
        shakeLock();
        blockCountdown();
      } else {
        lockError('锁码不正确，请重试');
        shakeLock();
      }
    }
  }
  function appendLockDigit(k) {
    if (ui.locked === false) return;
    if (lockBlockedUntil > Date.now()) return;
    lockError('');
    if (lockBuffer.length < lockLength()) {
      lockBuffer += String(k);
      renderLockDots();
      if (lockBuffer.length >= lockLength()) setTimeout(tryUnlock, 120);
    }
  }
  function deleteLockDigit() {
    if (lockBlockedUntil > Date.now()) return;
    lockBuffer = lockBuffer.slice(0, -1);
    lockError('');
    renderLockDots();
  }
  function lockApp() {
    var cfg = lockConfig();
    if (!cfg.enabled || ui.locked) return;
    ui.locked = true;
    lockBuffer = '';
    lockError('');
    lockAttempts = 0;
    lockBlockedUntil = 0;
    renderLockDots();
    renderLockKeypad();
    var screen = document.getElementById('lock-screen');
    if (screen) screen.hidden = false;
    var app = document.getElementById('app');
    if (app) app.inert = true;
    document.body.classList.add('locked');
    if (T.hideLoading) { loadingCount = 0; var lr = document.getElementById('loading-root'); if (lr) lr.hidden = true; }
    setTimeout(function () {
      var first = document.querySelector('#lock-keypad button:not(.blank)');
      if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
    }, 80);
  }
  function unlockApp() {
    ui.locked = false;
    lockBuffer = '';
    lockError('');
    var screen = document.getElementById('lock-screen');
    if (screen) screen.hidden = true;
    var app = document.getElementById('app');
    if (app) app.inert = ui.overlayOpen;
    document.body.classList.remove('locked');
    lastActivity = Date.now();
    T.toast('欢迎回来', 'success', 1400);
    try { T.checkDueNotifications && T.checkDueNotifications(); } catch (e) { /* ignore */ }
    T.renderApp();
  }
  T.lockApp = lockApp;

  document.getElementById('lock-keypad') && document.getElementById('lock-keypad').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-lock-key]');
    if (!btn || btn.disabled) return;
    var key = btn.getAttribute('data-lock-key');
    if (key === 'del') deleteLockDigit(); else appendLockDigit(key);
  });

  document.getElementById('lock-screen') && document.getElementById('lock-screen').addEventListener('keydown', function (e) {
    if (!ui.locked) return;
    if (/^\d$/.test(e.key)) { e.preventDefault(); appendLockDigit(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); deleteLockDigit(); }
  });

  document.addEventListener('keydown', function (e) {
    if (!ui.locked) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (/^\d$/.test(e.key)) { e.preventDefault(); appendLockDigit(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); deleteLockDigit(); }
  });

  var forgotBtn = document.getElementById('lock-forgot');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', function () {
      var ok = window.confirm('如果忘记锁码，只能清除本机全部账本和照片后重新使用。\n\n建议以后定期在设置中导出备份。\n\n确定清除全部本机数据并重置吗？');
      if (!ok) return;
      var ok2 = window.confirm('再次确认：所有礼簿、礼金、宾客、人情记录和照片都将被删除，且无法恢复。');
      if (!ok2) return;
      T.wipeAllLocalData().then(function () {
        ui.locked = false;
        var screen = document.getElementById('lock-screen');
        if (screen) screen.hidden = true;
        document.body.classList.remove('locked');
        var app = document.getElementById('app');
        if (app) app.inert = false;
        ui.overlayOpen = false;
        document.body.classList.remove('modal-open');
        var or = document.getElementById('overlay-root');
        if (or) { or.hidden = true; or.innerHTML = ''; }
        T.applySettings();
        T.renderApp({ scrollTop: true });
        T.toast('已清除并重置', 'success');
      });
    });
  }

  /* ---------------- 自动锁定 ---------------- */
  function markActivity() {
    lastActivity = Date.now();
  }
  ['pointerdown', 'touchstart', 'keydown', 'scroll'].forEach(function (ev) {
    document.addEventListener(ev, markActivity, { passive: true });
  });
  setInterval(function () {
    var cfg = lockConfig();
    if (!cfg.enabled || ui.locked) return;
    if (cfg.autoLockMinutes > 0 && Date.now() - lastActivity > cfg.autoLockMinutes * 60000) {
      lockApp();
    }
  }, 15000);
  document.addEventListener('visibilitychange', function () {
    var cfg = lockConfig();
    if (!cfg.enabled) return;
    if (document.hidden) {
      hiddenAt = Date.now();
      if (cfg.autoLockMinutes === 0) lockApp();
    } else {
      if (hiddenAt && cfg.autoLockMinutes > 0 && Date.now() - hiddenAt > cfg.autoLockMinutes * 60000) lockApp();
      hiddenAt = 0;
      markActivity();
    }
  });

  /* ---------------- 照片水合 ---------------- */
  T.hydratePhotos = function (root) {
    var els = T.qsa('[data-photo-id]', root);
    els.forEach(function (el) {
      if (el.getAttribute('data-photo-loaded') === '1') return;
      el.setAttribute('data-photo-loaded', '1');
      var id = el.getAttribute('data-photo-id');
      T.getPhotoSrc(id).then(function (url) {
        if (!url) {
          var empty = el.querySelector('[data-photo-empty]');
          if (empty) empty.textContent = '照片未找到';
          return;
        }
        if (el.tagName === 'IMG') {
          el.src = url;
          return;
        }
        var img = el.querySelector('img');
        if (img) { img.src = url; img.hidden = false; }
        var emptyEl = el.querySelector('[data-photo-empty]');
        if (emptyEl) emptyEl.hidden = true;
        var link = el.querySelector('[data-photo-link]');
        if (link) link.href = url;
      }).catch(function () {
        var empty = el.querySelector('[data-photo-empty]');
        if (empty) empty.textContent = '照片读取失败';
      });
    });
  };

  T.setPhotoElement = function (container, photoId) {
    if (!container) return;
    container.innerHTML = '<div class="photo-preview" data-photo-id="' + T.esc(photoId) + '"><span data-photo-empty>加载中…</span><img alt="红包存证" hidden></div>';
    T.hydratePhotos(container);
  };

  /* ---------------- 启动 ---------------- */
  function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      ui.deferredInstall = e;
      if (ui.route === 'settings') T.renderApp();
    });
    window.addEventListener('appinstalled', function () {
      ui.deferredInstall = null;
      T.toast('泰合礼已安装到手机', 'success');
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      // 有新版本时静默等待下一次启动
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }).catch(function (err) {
      console.warn('Service worker registration failed:', err);
    });
  }

  T.wipeAllLocalData = async function () {
    try {
      var photos = await T.idbAll('photos');
      for (var i = 0; i < photos.length; i++) await T.idbDelete('photos', photos[i].id);
    } catch (e) { /* ignore */ }
    try {
      var snaps = await T.idbAll('snapshots');
      for (var j = 0; j < snaps.length; j++) await T.idbDelete('snapshots', snaps[j].id);
    } catch (e) { /* ignore */ }
    try {
      var keys = [];
      for (var k = 0; k < localStorage.length; k++) {
        var key = localStorage.key(k);
        if (key && (key.indexOf(T.LS_PHOTO_PREFIX) === 0 || key.indexOf('thl_snapshot_') === 0)) keys.push(key);
      }
      keys.forEach(function (key) { localStorage.removeItem(key); });
    } catch (e) { /* ignore */ }
    T.resetAll(false);
    ui.recordLimit = 60;
    ui.search = '';
    ui.batchMode = false;
    ui.selected = new Set();
    T.clearDraft();
    try { localStorage.removeItem('thl_notify_day'); } catch (e) { /* ignore */ }
  };

  T.checkDueNotifications = async function () {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!T.state.settings.notifications) return;
    var tasks = T.upcomingReminders().filter(function (r) { return r.date <= T.todayISO(); });
    if (!tasks.length) return;
    var today = T.todayISO();
    try {
      if (localStorage.getItem('thl_notify_day') === today) return;
      localStorage.setItem('thl_notify_day', today);
    } catch (e) { /* ignore */ }
    var body = '有 ' + tasks.length + ' 项人情提醒：' + tasks.slice(0, 3).map(function (t) { return t.record.name + (t.type === 'return' ? ' 待回礼' : ' 待答谢'); }).join('、') + (tasks.length > 3 ? ' 等' : '');
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        var reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification('泰合礼 · 今日人情提醒', { body: body, tag: 'thl-reminder-today', icon: 'assets/icon-192.png', badge: 'assets/icon-64.png' });
          return;
        }
      }
    } catch (e) { /* ignore */ }
    try {
      new Notification('泰合礼 · 今日人情提醒', { body: body, icon: 'assets/icon-192.png', tag: 'thl-reminder-today' });
    } catch (e) { /* ignore */ }
  };

  T.start = function () {
    var loaded = T.loadState();
    T.applySettings();
    renderLockKeypad();
    renderLockDots();
    setupInstallPrompt();
    if (!location.hash) {
      try { history.replaceState(null, '', '#/home'); } catch (e) { /* ignore */ }
    }
    var route = hashRoute();
    ui.route = route;
    var initialLocked = !!(T.state.settings.lock && T.state.settings.lock.enabled);
    if (initialLocked) {
      ui.locked = true;
      renderLockDots();
      var ls = document.getElementById('lock-screen');
      if (ls) ls.hidden = false;
      document.body.classList.add('locked');
    }
    T.ensureColors();
    T.renderApp({ scrollTop: true });
    if (initialLocked) {
      var app = document.getElementById('app');
      if (app) app.inert = true;
    }
    registerServiceWorker();
    T.autoDailySnapshot().catch(function () { /* ignore */ });
    setTimeout(function () {
      T.checkDueNotifications().catch(function () { /* ignore */ });
    }, 1500);
    if (loaded && loaded.error) T.toast(loaded.error, 'error', 5200);
    if (loaded && loaded.warning) setTimeout(function () { T.toast(loaded.warning, 'error', 5200); }, 500);

    window.addEventListener('hashchange', function () {
      if (ui.overlayOpen) hideOverlay();
      var next = hashRoute();
      if (next === 'settings' && ui.route !== 'settings') ui.returnRoute = ui.route || 'home';
      T.renderApp({ scrollTop: true });
    });

    document.addEventListener('click', function (e) {
      var nav = e.target.closest && e.target.closest('[data-nav-route]');
      if (!nav) return;
      e.preventDefault();
      T.navigate(nav.getAttribute('data-nav-route'));
    });
  };
})();
