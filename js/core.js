/* 泰合礼 THL 礼金簿 — 数据与基础能力（无第三方依赖） */
(function () {
  'use strict';

  var THL = window.THL = window.THL || {};
  THL.VERSION = '1.0.0';
  THL.BRAND = '泰合礼';
  THL.BRAND_EN = 'THL GIFT LEDGER';
  THL.SLOGAN = '泰然存礼，和合记情';
  THL.LS_STATE = 'thl_giftbook_state_v1';
  THL.LS_DRAFT = 'thl_giftbook_draft_v1';
  THL.LS_LAST_SNAPSHOT = 'thl_last_snapshot_day';
  THL.LS_PHOTO_PREFIX = 'thl_photo_';
  THL.DB_NAME = 'thl_giftbook_db';
  THL.DB_VERSION = 1;

  THL.DEFAULT_RELATIONS = ['亲戚', '朋友', '同事', '同学', '邻居', '其他'];
  THL.DEFAULT_EVENT_TYPES = ['婚礼', '寿宴', '乔迁', '满月', '升学', '开业', '其他'];
  THL.DEFAULT_QUICK_AMOUNTS = [100, 200, 300, 500, 600, 800, 1000, 2000];
  THL.CURRENCIES = [
    { code: 'CNY', symbol: '¥', label: '人民币 ¥' },
    { code: 'HKD', symbol: 'HK$', label: '港币 HK$' },
    { code: 'USD', symbol: '$', label: '美元 $' },
    { code: 'EUR', symbol: '€', label: '欧元 €' },
    { code: 'GBP', symbol: '£', label: '英镑 £' },
    { code: 'CUSTOM', symbol: '', label: '自定义符号' }
  ];
  THL.RELATION_COLORS = ['#9E2A2B', '#B9853F', '#547C64', '#5B6D8A', '#896C8F', '#A5694A', '#7B7F45', '#8A6A58'];
  THL.THEMES = [
    { id: 'red', name: '喜庆红', desc: '国风朱砂，礼序温情' },
    { id: 'light', name: '雅致白', desc: '简约浅色，清爽不刺眼' },
    { id: 'dark', name: '夜色黑', desc: '低亮深色，夜里更舒心' }
  ];

  var hasStorage = (function () {
    try {
      var k = '__thl_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();
  THL.hasStorage = hasStorage;
  THL.memoryState = null;

  THL.ui = {
    route: 'home',
    lockVisible: false,
    overlayOpen: false,
    saving: false,
    search: '',
    listFilter: 'all',
    listRelation: '',
    listSort: 'newest',
    batchMode: false,
    selected: new Set(),
    statsMetric: 'amount',
    peopleTab: 'ledger',
    peopleSearch: '',
    guestTag: '',
    ledgerSearch: '',
    lastTab: 'home',
    deferredInstall: null
  };

  function uid(prefix) {
    var s = '';
    if (window.crypto && crypto.getRandomValues) {
      var a = new Uint8Array(8);
      crypto.getRandomValues(a);
      s = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    } else {
      s = Math.random().toString(16).slice(2, 12);
    }
    return (prefix || 'id') + '_' + Date.now().toString(36) + s.slice(0, 8);
  }
  THL.uid = uid;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowISO() { return new Date().toISOString(); }
  function addDays(dateStr, days) {
    var d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    d.setDate(d.getDate() + Number(days || 0));
    return todayISO(d);
  }
  function daysBetween(a, b) {
    if (!a || !b) return null;
    var d1 = new Date(a + 'T00:00:00');
    var d2 = new Date(b + 'T00:00:00');
    return Math.round((d2 - d1) / 86400000);
  }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function num(v, fallback) {
    var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }
  function sum(arr, fn) {
    return arr.reduce(function (acc, x) { return acc + (fn ? fn(x) : x); }, 0);
  }
  function uniq(arr) {
    var seen = new Set();
    return arr.filter(function (x) {
      var k = String(x).trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nl2br(v) { return esc(v).replace(/\n/g, '<br>'); }
  function hashCode(str) {
    var h = 5381, i = str.length;
    while (i) h = (h * 33) ^ str.charCodeAt(--i);
    return (h >>> 0).toString(16);
  }
  function safeFileName(name, ext, fallback) {
    var base = String(name || fallback || '泰合礼').replace(/[\\/:*?"<>|\r\n\t]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60);
    return (base || '泰合礼') + (ext ? '.' + ext : '');
  }

  function currency() {
    var s = THL.state && THL.state.settings;
    return s && s.currency ? s.currency : '¥';
  }
  function money(n, opts) {
    opts = opts || {};
    var val = num(n);
    var decimals = opts.decimals != null ? opts.decimals : (Math.abs(val % 1) > 0.000001 ? 2 : 0);
    var text = val.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
    if (opts.noSymbol) return text;
    return currency() + text;
  }
  function shortMoney(n) {
    var v = num(n);
    if (Math.abs(v) >= 100000) return (v / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    if (Math.abs(v) >= 10000 && v % 1000 === 0) return (v / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  }
  function plainAmount(n) {
    return num(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  }
  function parseLocalDate(s) {
    if (!s) return null;
    var d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d.getTime())) d = new Date(s + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtDate(s, style) {
    var d = parseLocalDate(s);
    if (!d) return s || '—';
    if (style === 'dot') return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
    if (style === 'short') return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    if (style === 'md') return pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    if (style === 'week') {
      var wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
      return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + wd;
    }
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function relativeDay(dateStr) {
    if (!dateStr) return '';
    var diff = daysBetween(todayISO(), dateStr);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === 2) return '后天';
    if (diff === -1) return '昨天';
    if (diff > 2 && diff < 30) return diff + '天后';
    if (diff < -1 && diff > -30) return Math.abs(diff) + '天前';
    return '';
  }
  function greet() {
    var h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function createDefaultState() {
    var t = nowISO();
    return {
      version: 1,
      createdAt: t,
      updatedAt: t,
      activeBookId: null,
      settings: {
        theme: 'red',
        currency: '¥',
        currencyCode: 'CNY',
        largeText: false,
        operator: '我',
        quickAmounts: THL.DEFAULT_QUICK_AMOUNTS.slice(),
        relationTags: THL.DEFAULT_RELATIONS.slice(),
        eventTypes: THL.DEFAULT_EVENT_TYPES.slice(),
        autoSaveGuest: true,
        lock: { enabled: false, salt: '', hash: '', pinLength: 4, autoLockMinutes: 5 },
        notifications: false
      },
      books: [],
      records: [],
      guests: [],
      outgoing: [],
      logs: []
    };
  }
  THL.createDefaultState = createDefaultState;

  function normalizeState(raw) {
    var d = createDefaultState();
    if (!raw || typeof raw !== 'object') return d;
    var s = raw;
    d.version = 1;
    d.createdAt = s.createdAt || d.createdAt;
    d.updatedAt = s.updatedAt || d.updatedAt;
    var ss = s.settings && typeof s.settings === 'object' ? s.settings : {};
    var ds = d.settings;
    d.settings = {
      theme: ['red', 'light', 'dark'].indexOf(ss.theme) >= 0 ? ss.theme : ds.theme,
      currency: typeof ss.currency === 'string' && ss.currency.slice(0, 8) ? ss.currency : ds.currency,
      currencyCode: typeof ss.currencyCode === 'string' ? ss.currencyCode : ds.currencyCode,
      largeText: !!ss.largeText,
      operator: String(ss.operator || '').trim().slice(0, 20) || '我',
      quickAmounts: Array.isArray(ss.quickAmounts) ? ss.quickAmounts.map(function (x) { return num(x); }).filter(function (x) { return x > 0; }).slice(0, 12) : ds.quickAmounts,
      relationTags: Array.isArray(ss.relationTags) ? uniq(ss.relationTags.map(function (x) { return String(x).trim().slice(0, 8); })).slice(0, 24) : ds.relationTags,
      eventTypes: Array.isArray(ss.eventTypes) ? uniq(ss.eventTypes.map(function (x) { return String(x).trim().slice(0, 12); })).slice(0, 24) : ds.eventTypes,
      autoSaveGuest: ss.autoSaveGuest !== false,
      lock: {
        enabled: !!(ss.lock && ss.lock.enabled && ss.lock.hash),
        salt: ss.lock && typeof ss.lock.salt === 'string' ? ss.lock.salt : '',
        hash: ss.lock && typeof ss.lock.hash === 'string' ? ss.lock.hash : '',
        pinLength: clamp(num(ss.lock && ss.lock.pinLength, 4), 4, 8),
        autoLockMinutes: clamp(num(ss.lock && ss.lock.autoLockMinutes, 5), 0, 60)
      },
      notifications: !!ss.notifications
    };
    if (!d.settings.relationTags.length) d.settings.relationTags = THL.DEFAULT_RELATIONS.slice();
    if (!d.settings.eventTypes.length) d.settings.eventTypes = THL.DEFAULT_EVENT_TYPES.slice();
    if (!d.settings.quickAmounts.length) d.settings.quickAmounts = THL.DEFAULT_QUICK_AMOUNTS.slice();
    d.books = (Array.isArray(s.books) ? s.books : []).filter(function (b) { return b && b.id; }).map(function (b) {
      return {
        id: String(b.id),
        title: String(b.title || '未命名礼簿').slice(0, 60),
        type: String(b.type || '婚礼').slice(0, 20),
        date: b.date || todayISO(),
        location: String(b.location || '').slice(0, 80),
        host: String(b.host || '').slice(0, 40),
        note: String(b.note || '').slice(0, 500),
        createdAt: b.createdAt || nowISO(),
        updatedAt: b.updatedAt || nowISO()
      };
    });
    var bookIds = new Set(d.books.map(function (b) { return b.id; }));
    var currentBook = s.activeBookId;
    if (!bookIds.has(currentBook)) currentBook = d.books[0] ? d.books[0].id : null;
    d.activeBookId = currentBook;
    d.records = (Array.isArray(s.records) ? s.records : []).filter(function (r) { return r && r.id && bookIds.has(r.bookId); }).map(function (r) {
      return {
        id: String(r.id),
        bookId: String(r.bookId),
        name: String(r.name || '').trim().slice(0, 40),
        relation: String(r.relation || '').trim().slice(0, 20),
        amount: Math.max(0, num(r.amount)),
        gift: String(r.gift || '').slice(0, 120),
        giftValue: Math.max(0, num(r.giftValue)),
        note: String(r.note || '').slice(0, 500),
        attended: r.attended !== false,
        returned: !!r.returned,
        thanked: !!r.thanked,
        returnGift: String(r.returnGift || '').slice(0, 120),
        returnAmount: Math.max(0, num(r.returnAmount)),
        returnDate: r.returnDate || '',
        remindReturnAt: r.remindReturnAt || '',
        remindThankAt: r.remindThankAt || '',
        date: r.date || todayISO(),
        photoId: r.photoId || null,
        createdAt: r.createdAt || nowISO(),
        updatedAt: r.updatedAt || nowISO(),
        operator: String(r.operator || '我').slice(0, 20)
      };
    });
    d.guests = (Array.isArray(s.guests) ? s.guests : []).filter(function (g) { return g && g.id && g.name; }).map(function (g) {
      return {
        id: String(g.id),
        name: String(g.name).trim().slice(0, 40),
        phone: String(g.phone || '').slice(0, 30),
        relation: String(g.relation || '').slice(0, 20),
        tags: Array.isArray(g.tags) ? uniq(g.tags.map(function (x) { return String(x).trim().slice(0, 12); })).slice(0, 10) : [],
        note: String(g.note || '').slice(0, 500),
        createdAt: g.createdAt || nowISO(),
        updatedAt: g.updatedAt || nowISO()
      };
    });
    d.outgoing = (Array.isArray(s.outgoing) ? s.outgoing : []).filter(function (o) { return o && o.id && o.name; }).map(function (o) {
      return {
        id: String(o.id),
        name: String(o.name).trim().slice(0, 40),
        phone: String(o.phone || '').slice(0, 30),
        relation: String(o.relation || '').slice(0, 20),
        amount: Math.max(0, num(o.amount)),
        gift: String(o.gift || '').slice(0, 120),
        event: String(o.event || '随礼').slice(0, 60),
        date: o.date || todayISO(),
        note: String(o.note || '').slice(0, 500),
        createdAt: o.createdAt || nowISO(),
        operator: String(o.operator || '我').slice(0, 20)
      };
    });
    d.logs = (Array.isArray(s.logs) ? s.logs : []).filter(function (l) { return l && l.at; }).slice(0, 800).map(function (l) {
      return {
        id: String(l.id || uid('log')),
        at: l.at,
        operator: String(l.operator || '我').slice(0, 20),
        action: String(l.action || '操作').slice(0, 30),
        detail: String(l.detail || '').slice(0, 240),
        bookId: l.bookId || null
      };
    });
    return d;
  }
  THL.normalizeState = normalizeState;

  THL.loadState = function () {
    if (!hasStorage) {
      THL.state = THL.memoryState || createDefaultState();
      return { state: THL.state, warning: '当前环境不支持本地存储，数据仅在本次打开期间保留，请及时备份。' };
    }
    var raw = null;
    try { raw = localStorage.getItem(THL.LS_STATE); } catch (e) { raw = null; }
    if (!raw) {
      THL.state = createDefaultState();
      return { state: THL.state, fresh: true };
    }
    try {
      THL.state = normalizeState(JSON.parse(raw));
      THL.memoryState = THL.state;
      return { state: THL.state };
    } catch (e) {
      var backup = null;
      try { backup = localStorage.getItem(THL.LS_STATE + '_broken'); } catch (err) { /* ignore */ }
      THL.state = createDefaultState();
      return { state: THL.state, error: '本地账本数据读取失败，已开启空白账本。请尝试从备份恢复。', broken: raw };
    }
  };

  THL.save = function () {
    if (!THL.state) return false;
    THL.state.updatedAt = nowISO();
    THL.state.activeBookId = THL.state.activeBookId || null;
    if (!hasStorage) {
      THL.memoryState = THL.state;
      return false;
    }
    try {
      localStorage.setItem(THL.LS_STATE, JSON.stringify(THL.state));
      THL.memoryState = THL.state;
      return true;
    } catch (e) {
      try { console.warn('save failed', e); } catch (err) { /* ignore */ }
      return false;
    }
  };

  THL.applySettings = function () {
    if (!THL.state) return;
    var s = THL.state.settings;
    document.documentElement.setAttribute('data-theme', s.theme || 'red');
    document.documentElement.setAttribute('data-large', s.largeText ? 'true' : 'false');
    var color = s.theme === 'dark' ? '#17100D' : (s.theme === 'light' ? '#F8F6F1' : '#8B1E24');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', color);
  };

  THL.getActiveBook = function () {
    if (!THL.state) return null;
    return THL.state.books.find(function (b) { return b.id === THL.state.activeBookId; }) || THL.state.books[0] || null;
  };
  THL.getBook = function (id) {
    return THL.state.books.find(function (b) { return b.id === id; }) || null;
  };
  THL.getRecord = function (id) {
    return THL.state.records.find(function (r) { return r.id === id; }) || null;
  };
  THL.getGuest = function (id) {
    return THL.state.guests.find(function (g) { return g.id === id; }) || null;
  };
  THL.getOutgoing = function (id) {
    return THL.state.outgoing.find(function (o) { return o.id === id; }) || null;
  };
  THL.recordsOfBook = function (bookId) {
    return THL.state.records.filter(function (r) { return r.bookId === bookId; });
  };
  THL.findGuestByName = function (name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    return THL.state.guests.find(function (g) { return g.name.trim().toLowerCase() === n; }) || null;
  };

  THL.setActiveBook = function (id) {
    if (!THL.getBook(id)) return;
    THL.state.activeBookId = id;
    THL.save();
  };

  THL.addBook = function (data) {
    var t = nowISO();
    var book = {
      id: uid('book'),
      title: String(data.title || '未命名礼簿').trim().slice(0, 60),
      type: String(data.type || '婚礼').trim().slice(0, 20),
      date: data.date || todayISO(),
      location: String(data.location || '').trim().slice(0, 80),
      host: String(data.host || '').trim().slice(0, 40),
      note: String(data.note || '').trim().slice(0, 500),
      createdAt: t,
      updatedAt: t
    };
    THL.state.books.unshift(book);
    THL.state.activeBookId = book.id;
    THL.addLog('新建礼簿', '创建《' + book.title + '》', book.id);
    THL.save();
    return book;
  };

  THL.updateBook = function (id, data) {
    var b = THL.getBook(id);
    if (!b) return null;
    ['title', 'type', 'date', 'location', 'host', 'note'].forEach(function (k) {
      if (data[k] != null) b[k] = String(data[k]).trim().slice(0, k === 'note' ? 500 : 80);
    });
    if (!b.title) b.title = '未命名礼簿';
    b.updatedAt = nowISO();
    THL.addLog('编辑礼簿', '更新《' + b.title + '》信息', b.id);
    THL.save();
    return b;
  };

  THL.deleteBook = function (id, mode) {
    var b = THL.getBook(id);
    if (!b) return;
    var records = THL.recordsOfBook(id);
    if (mode === 'clear') {
      THL.state.records = THL.state.records.filter(function (r) { return r.bookId !== id; });
      THL.addLog('清空礼簿', '清空《' + b.title + '》的 ' + records.length + ' 笔礼金', id);
    } else {
      THL.state.books = THL.state.books.filter(function (x) { return x.id !== id; });
      THL.state.records = THL.state.records.filter(function (r) { return r.bookId !== id; });
      THL.addLog('删除礼簿', '删除《' + b.title + '》及 ' + records.length + ' 笔礼金', null);
    }
    if (THL.state.activeBookId === id) THL.state.activeBookId = THL.state.books[0] ? THL.state.books[0].id : null;
    THL.save();
  };

  THL.addLog = function (action, detail, bookId) {
    if (!THL.state) return;
    THL.state.logs.unshift({
      id: uid('log'),
      at: nowISO(),
      operator: (THL.state.settings.operator || '我').slice(0, 20),
      action: String(action || '操作').slice(0, 30),
      detail: String(detail || '').slice(0, 240),
      bookId: bookId || null
    });
    if (THL.state.logs.length > 800) THL.state.logs.length = 800;
  };

  THL.addRecord = function (data, opts) {
    opts = opts || {};
    var t = nowISO();
    var bookId = data.bookId || THL.state.activeBookId;
    if (!THL.getBook(bookId)) return null;
    var rec = {
      id: uid('rec'),
      bookId: bookId,
      name: String(data.name || '').trim().slice(0, 40),
      relation: String(data.relation || '').trim().slice(0, 20),
      amount: Math.max(0, num(data.amount)),
      gift: String(data.gift || '').trim().slice(0, 120),
      giftValue: Math.max(0, num(data.giftValue)),
      note: String(data.note || '').trim().slice(0, 500),
      attended: data.attended !== false,
      returned: !!data.returned,
      thanked: !!data.thanked,
      returnGift: String(data.returnGift || '').trim().slice(0, 120),
      returnAmount: Math.max(0, num(data.returnAmount)),
      returnDate: data.returnDate || '',
      remindReturnAt: data.remindReturnAt || '',
      remindThankAt: data.remindThankAt || '',
      date: data.date || todayISO(),
      photoId: data.photoId || null,
      createdAt: t,
      updatedAt: t,
      operator: THL.state.settings.operator || '我'
    };
    THL.state.records.unshift(rec);
    if (THL.state.settings.autoSaveGuest !== false) THL.upsertGuestFromRecord(rec);
    THL.addLog('新增礼金', '为「' + rec.name + '」登记 ' + THL.money(rec.amount), bookId);
    THL.save();
    return rec;
  };

  THL.updateRecord = function (id, data) {
    var rec = THL.getRecord(id);
    if (!rec) return null;
    var before = rec.amount;
    var fields = ['bookId', 'name', 'relation', 'gift', 'note', 'returnGift', 'returnDate', 'remindReturnAt', 'remindThankAt', 'date'];
    fields.forEach(function (k) { if (data[k] != null) rec[k] = String(data[k]).trim().slice(0, k === 'note' ? 500 : 120); });
    ['amount', 'giftValue', 'returnAmount'].forEach(function (k) { if (data[k] != null) rec[k] = Math.max(0, num(data[k])); });
    ['attended', 'returned', 'thanked'].forEach(function (k) { if (data[k] != null) rec[k] = !!data[k]; });
    if (data.photoId !== undefined) rec.photoId = data.photoId || null;
    rec.updatedAt = nowISO();
    rec.operator = THL.state.settings.operator || '我';
    if (THL.state.settings.autoSaveGuest !== false) THL.upsertGuestFromRecord(rec);
    THL.addLog('修改礼金', '「' + rec.name + '」礼金 ' + THL.money(before) + (before !== rec.amount ? ' → ' + THL.money(rec.amount) : ''), rec.bookId);
    THL.save();
    return rec;
  };

  THL.deleteRecords = function (ids, opts) {
    opts = opts || {};
    var set = new Set(ids);
    var removed = [];
    THL.state.records = THL.state.records.filter(function (r) {
      if (set.has(r.id)) { removed.push(r); return false; }
      return true;
    });
    if (removed.length) {
      var names = removed.slice(0, 3).map(function (r) { return r.name; }).join('、') + (removed.length > 3 ? ' 等' : '');
      THL.addLog(opts.batch ? '批量删除礼金' : '删除礼金', '删除 ' + removed.length + ' 笔（' + names + '）', removed[0].bookId);
    }
    THL.save();
    return removed;
  };

  THL.toggleRecordFlag = function (id, key, value) {
    var rec = THL.getRecord(id);
    if (!rec) return;
    rec[key] = value == null ? !rec[key] : !!value;
    if (key === 'returned' && rec.returned && !rec.returnDate) rec.returnDate = todayISO();
    rec.updatedAt = nowISO();
    rec.operator = THL.state.settings.operator || '我';
    THL.addLog('更新状态', '「' + rec.name + '」' + ({ attended: '到场', returned: '回礼', thanked: '答谢' }[key] || key) + '：' + (rec[key] ? '是' : '否'), rec.bookId);
    THL.save();
    return rec;
  };

  THL.batchUpdateRecords = function (ids, changes) {
    var set = new Set(ids);
    var count = 0;
    var t = nowISO();
    THL.state.records.forEach(function (r) {
      if (!set.has(r.id)) return;
      if (changes.returned != null) {
        r.returned = !!changes.returned;
        if (r.returned && !r.returnDate) r.returnDate = todayISO();
      }
      if (changes.thanked != null) r.thanked = !!changes.thanked;
      if (changes.attended != null) r.attended = !!changes.attended;
      if (changes.relation) r.relation = String(changes.relation).slice(0, 20);
      r.updatedAt = t;
      r.operator = THL.state.settings.operator || '我';
      count++;
    });
    if (count) {
      var label = [];
      if (changes.returned != null) label.push('回礼=' + (changes.returned ? '是' : '否'));
      if (changes.thanked != null) label.push('答谢=' + (changes.thanked ? '是' : '否'));
      if (changes.attended != null) label.push('到场=' + (changes.attended ? '是' : '否'));
      if (changes.relation) label.push('关系=' + changes.relation);
      THL.addLog('批量修改礼金', '更新 ' + count + ' 笔（' + label.join('，') + '）', THL.state.activeBookId);
      THL.save();
    }
    return count;
  };

  THL.upsertGuestFromRecord = function (rec) {
    if (!rec || !rec.name) return null;
    var g = THL.findGuestByName(rec.name);
    if (g) {
      if (!g.relation && rec.relation) g.relation = rec.relation;
      g.updatedAt = nowISO();
      return g;
    }
    var guest = {
      id: uid('guest'),
      name: rec.name,
      phone: '',
      relation: rec.relation || '',
      tags: [],
      note: '',
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    THL.state.guests.unshift(guest);
    return guest;
  };

  THL.addGuest = function (data) {
    var name = String(data.name || '').trim();
    if (!name) return null;
    var existing = THL.findGuestByName(name);
    if (existing) {
      THL.updateGuest(existing.id, data);
      return existing;
    }
    var guest = {
      id: uid('guest'),
      name: name.slice(0, 40),
      phone: String(data.phone || '').trim().slice(0, 30),
      relation: String(data.relation || '').trim().slice(0, 20),
      tags: Array.isArray(data.tags) ? uniq(data.tags.map(function (x) { return String(x).trim(); }).filter(Boolean)).slice(0, 10) : [],
      note: String(data.note || '').trim().slice(0, 500),
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    THL.state.guests.unshift(guest);
    THL.addLog('新增宾客', '保存宾客「' + guest.name + '」', THL.state.activeBookId);
    THL.save();
    return guest;
  };

  THL.updateGuest = function (id, data) {
    var g = THL.getGuest(id);
    if (!g) return null;
    if (data.name != null) g.name = String(data.name).trim().slice(0, 40) || g.name;
    if (data.phone != null) g.phone = String(data.phone).trim().slice(0, 30);
    if (data.relation != null) g.relation = String(data.relation).trim().slice(0, 20);
    if (data.tags != null) g.tags = Array.isArray(data.tags) ? uniq(data.tags.map(function (x) { return String(x).trim(); }).filter(Boolean)).slice(0, 10) : [];
    if (data.note != null) g.note = String(data.note).trim().slice(0, 500);
    g.updatedAt = nowISO();
    THL.addLog('编辑宾客', '更新宾客「' + g.name + '」资料', THL.state.activeBookId);
    THL.save();
    return g;
  };

  THL.deleteGuest = function (id) {
    var g = THL.getGuest(id);
    if (!g) return;
    THL.state.guests = THL.state.guests.filter(function (x) { return x.id !== id; });
    THL.addLog('删除宾客', '删除宾客「' + g.name + '」（礼金记录保留）', THL.state.activeBookId);
    THL.save();
  };

  THL.addOutgoing = function (data) {
    var t = nowISO();
    var item = {
      id: uid('out'),
      name: String(data.name || '').trim().slice(0, 40),
      phone: String(data.phone || '').trim().slice(0, 30),
      relation: String(data.relation || '').trim().slice(0, 20),
      amount: Math.max(0, num(data.amount)),
      gift: String(data.gift || '').trim().slice(0, 120),
      event: String(data.event || '随礼').trim().slice(0, 60),
      date: data.date || todayISO(),
      note: String(data.note || '').trim().slice(0, 500),
      createdAt: t,
      operator: THL.state.settings.operator || '我'
    };
    if (!item.name) return null;
    THL.state.outgoing.unshift(item);
    var g = THL.findGuestByName(item.name);
    if (!g) {
      THL.addGuest({ name: item.name, phone: item.phone, relation: item.relation });
    } else {
      if (!g.phone && item.phone) g.phone = item.phone;
      if (!g.relation && item.relation) g.relation = item.relation;
    }
    THL.addLog('记录随出', '向「' + item.name + '」随礼 ' + THL.money(item.amount), THL.state.activeBookId);
    THL.save();
    return item;
  };

  THL.deleteOutgoing = function (id) {
    var item = THL.getOutgoing(id);
    if (!item) return;
    THL.state.outgoing = THL.state.outgoing.filter(function (x) { return x.id !== id; });
    THL.addLog('删除随出', '删除向「' + item.name + '」随礼 ' + THL.money(item.amount) + ' 的记录', THL.state.activeBookId);
    THL.save();
  };

  THL.calcStats = function (bookId) {
    var records = THL.recordsOfBook(bookId);
    var people = uniq(records.map(function (r) { return r.name; })).length;
    var cash = sum(records, function (r) { return r.amount; });
    var giftValue = sum(records, function (r) { return r.giftValue; });
    var returned = records.filter(function (r) { return r.returned; });
    var thanked = records.filter(function (r) { return r.thanked; });
    var attended = records.filter(function (r) { return r.attended; });
    var relations = {};
    records.forEach(function (r) {
      var key = r.relation || '未分类';
      if (!relations[key]) relations[key] = { name: key, count: 0, amount: 0 };
      relations[key].count++;
      relations[key].amount += r.amount;
    });
    var relArr = Object.keys(relations).map(function (k) { return relations[k]; }).sort(function (a, b) { return b.amount - a.amount; });
    var top = records.slice().sort(function (a, b) { return b.amount - a.amount || String(a.name).localeCompare(String(b.name), 'zh-CN'); });
    return {
      records: records,
      count: records.length,
      people: people,
      cash: cash,
      giftValue: giftValue,
      totalValue: cash + giftValue,
      average: records.length ? cash / records.length : 0,
      max: top[0] ? top[0].amount : 0,
      attended: attended.length,
      returned: returned.length,
      thanked: thanked.length,
      pendingReturn: records.length - returned.length,
      pendingThank: records.length - thanked.length,
      returnedAmount: sum(returned, function (r) { return r.returnAmount; }),
      relations: relArr,
      top: top,
      returnedRecords: returned,
      thankedRecords: thanked
    };
  };

  THL.allBooksStats = function () {
    return THL.state.books.map(function (b) {
      var st = THL.calcStats(b.id);
      return { book: b, ...st };
    }).sort(function (a, b) {
      return String(b.book.date || '').localeCompare(String(a.book.date || ''));
    });
  };

  THL.ledger = function () {
    var map = {};
    function ensure(name) {
      var k = String(name || '').trim().toLowerCase();
      if (!k) return null;
      if (!map[k]) {
        map[k] = { name: String(name).trim(), received: 0, sent: 0, receivedCount: 0, sentCount: 0, relation: '', phone: '', guestId: '', tags: [], lastDate: '', bookIds: [] };
      }
      return map[k];
    }
    THL.state.guests.forEach(function (g) {
      var p = ensure(g.name);
      if (!p) return;
      p.guestId = g.id;
      p.phone = p.phone || g.phone;
      p.relation = p.relation || g.relation;
      p.tags = g.tags.slice();
    });
    THL.state.records.forEach(function (r) {
      var p = ensure(r.name);
      if (!p) return;
      p.received += r.amount;
      p.receivedCount++;
      p.relation = p.relation || r.relation;
      if (String(r.date) > String(p.lastDate)) p.lastDate = r.date;
      if (p.bookIds.indexOf(r.bookId) < 0) p.bookIds.push(r.bookId);
    });
    THL.state.outgoing.forEach(function (o) {
      var p = ensure(o.name);
      if (!p) return;
      p.sent += o.amount;
      p.sentCount++;
      p.relation = p.relation || o.relation;
      p.phone = p.phone || o.phone;
      if (String(o.date) > String(p.lastDate)) p.lastDate = o.date;
    });
    return Object.keys(map).map(function (k) {
      var p = map[k];
      p.balance = p.received - p.sent;
      return p;
    }).sort(function (a, b) {
      return (b.received + b.sent) - (a.received + a.sent) || String(b.lastDate).localeCompare(String(a.lastDate));
    });
  };

  THL.personLedger = function (name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    var guest = THL.findGuestByName(name);
    var received = THL.state.records.filter(function (r) { return r.name.trim().toLowerCase() === n; });
    var sent = THL.state.outgoing.filter(function (o) { return o.name.trim().toLowerCase() === n; });
    var rSum = sum(received, function (r) { return r.amount; });
    var sSum = sum(sent, function (o) { return o.amount; });
    return {
      name: guest ? guest.name : (received[0] && received[0].name) || (sent[0] && sent[0].name) || name,
      guest: guest,
      received: received,
      sent: sent,
      receivedTotal: rSum,
      sentTotal: sSum,
      balance: rSum - sSum,
      count: received.length + sent.length
    };
  };

  THL.pendingTasks = function (bookId) {
    var records = bookId ? THL.recordsOfBook(bookId) : THL.state.records;
    var tasks = [];
    records.forEach(function (r) {
      if (!r.returned) {
        tasks.push({
          id: r.id + ':return', recordId: r.id, type: 'return', name: r.name,
          amount: r.amount, date: r.remindReturnAt || r.date, bookId: r.bookId,
          record: r, overdue: !!(r.remindReturnAt && daysBetween(todayISO(), r.remindReturnAt) < 0)
        });
      }
      if (!r.thanked) {
        tasks.push({
          id: r.id + ':thank', recordId: r.id, type: 'thank', name: r.name,
          amount: r.amount, date: r.remindThankAt || r.date, bookId: r.bookId,
          record: r, overdue: !!(r.remindThankAt && daysBetween(todayISO(), r.remindThankAt) < 0)
        });
      }
    });
    return tasks.sort(function (a, b) {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return String(a.date || '').localeCompare(String(b.date || ''));
    });
  };

  THL.upcomingReminders = function () {
    var list = [];
    THL.state.records.forEach(function (r) {
      var book = THL.getBook(r.bookId);
      if (r.remindReturnAt && !r.returned) {
        list.push({ record: r, book: book, type: 'return', date: r.remindReturnAt, label: '回礼提醒' });
      }
      if (r.remindThankAt && !r.thanked) {
        list.push({ record: r, book: book, type: 'thank', date: r.remindThankAt, label: '答谢提醒' });
      }
    });
    return list.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  };

  THL.reminderBadgeCount = function () {
    return THL.pendingTasks().length;
  };

  THL.ensureColors = function () {
    if (!THL.state) return;
    var changed = false;
    THL.state.records.forEach(function (r) {
      if (!r.relation) { r.relation = '未分类'; changed = true; }
    });
    if (changed) THL.save();
  };

  /* ---------- 照片 IndexedDB ---------- */
  var idbPromise = null;
  function openDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('no-indexeddb')); return; }
      var req = indexedDB.open(THL.DB_NAME, THL.DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('idb-open-failed')); };
    });
    return idbPromise;
  }
  function idbRequest(mode, store, action) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, mode);
        var os = tx.objectStore(store);
        var req = action(os);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  THL.idbPut = function (store, value) { return idbRequest('readwrite', store, function (os) { return os.put(value); }); };
  THL.idbGet = function (store, id) { return idbRequest('readonly', store, function (os) { return os.get(id); }); };
  THL.idbAll = function (store) { return idbRequest('readonly', store, function (os) { return os.getAll(); }); };
  THL.idbDelete = function (store, id) { return idbRequest('readwrite', store, function (os) { return os.delete(id); }); };

  var photoUrls = {};
  function blobToDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(blob);
    });
  }
  function dataURLToBlob(dataURL) {
    var parts = String(dataURL).split(',');
    var mimeMatch = /data:([^;]+)/.exec(parts[0] || '');
    var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    var binary = atob(parts[1] || '');
    var arr = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  THL.blobToDataURL = blobToDataURL;
  THL.dataURLToBlob = dataURLToBlob;

  THL.compressImage = function (file, maxSide, quality) {
    maxSide = maxSide || 1500;
    quality = quality || 0.82;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type || '')) { reject(new Error('not-image')); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) throw new Error('bad-image');
          var scale = Math.min(1, maxSide / Math.max(w, h));
          var cw = Math.round(w * scale);
          var ch = Math.round(h * scale);
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FBF7EE';
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (blob) resolve(blob); else reject(new Error('compress-failed'));
          }, 'image/jpeg', quality);
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image-load-failed')); };
      img.src = url;
    });
  };

  THL.storePhoto = async function (blob) {
    var id = uid('photo');
    try {
      await THL.idbPut('photos', { id: id, blob: blob, createdAt: nowISO() });
      return { id: id, fallback: false };
    } catch (e) {
      var dataURL = await blobToDataURL(blob);
      try {
        localStorage.setItem(THL.LS_PHOTO_PREFIX + id, dataURL);
        return { id: id, fallback: true };
      } catch (err) {
        throw new Error('photo-storage-full');
      }
    }
  };

  THL.getPhotoSrc = async function (id) {
    if (!id) return null;
    if (photoUrls[id]) return photoUrls[id];
    try {
      var item = await THL.idbGet('photos', id);
      if (item && item.blob) {
        var url = URL.createObjectURL(item.blob);
        photoUrls[id] = url;
        return url;
      }
    } catch (e) { /* ignore */ }
    try {
      var data = localStorage.getItem(THL.LS_PHOTO_PREFIX + id);
      if (data) { photoUrls[id] = data; return data; }
    } catch (e) { /* ignore */ }
    return null;
  };

  THL.deletePhoto = async function (id) {
    if (!id) return;
    try { await THL.idbDelete('photos', id); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(THL.LS_PHOTO_PREFIX + id); } catch (e) { /* ignore */ }
    if (photoUrls[id]) {
      if (String(photoUrls[id]).indexOf('blob:') === 0) URL.revokeObjectURL(photoUrls[id]);
      delete photoUrls[id];
    }
  };

  THL.exportPhotos = async function (ids) {
    var out = {};
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (!id || out[id]) continue;
      try {
        var item = await THL.idbGet('photos', id);
        if (item && item.blob) {
          out[id] = { dataURL: await blobToDataURL(item.blob), createdAt: item.createdAt || nowISO() };
          continue;
        }
      } catch (e) { /* ignore */ }
      try {
        var data = localStorage.getItem(THL.LS_PHOTO_PREFIX + id);
        if (data) out[id] = { dataURL: data, createdAt: nowISO() };
      } catch (e) { /* ignore */ }
    }
    return out;
  };

  THL.importPhotos = async function (photos) {
    var count = 0;
    var keys = Object.keys(photos || {});
    for (var i = 0; i < keys.length; i++) {
      var id = keys[i];
      var item = photos[id];
      if (!item || !item.dataURL) continue;
      try {
        var blob = dataURLToBlob(item.dataURL);
        await THL.idbPut('photos', { id: id, blob: blob, createdAt: item.createdAt || nowISO() });
        count++;
      } catch (e) { /* ignore */ }
    }
    return count;
  };

  /* ---------- 快照恢复 ---------- */
  THL.makeSnapshot = async function (label) {
    if (!THL.state) return null;
    var snap = {
      id: uid('snap'),
      at: nowISO(),
      label: label || '手动备份',
      state: JSON.parse(JSON.stringify(THL.state))
    };
    try {
      await THL.idbPut('snapshots', snap);
      try { localStorage.setItem(THL.LS_LAST_SNAPSHOT, todayISO()); } catch (e) { /* ignore */ }
      var all = await THL.idbAll('snapshots');
      all.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
      if (all.length > 8) {
        for (var i = 8; i < all.length; i++) THL.idbDelete('snapshots', all[i].id).catch(function () {});
      }
      return snap;
    } catch (e) {
      try {
        var key = 'thl_snapshot_' + Date.now();
        localStorage.setItem(key, JSON.stringify(snap));
      } catch (err) { /* ignore */ }
      return null;
    }
  };

  THL.listSnapshots = async function () {
    var list = [];
    try { list = await THL.idbAll('snapshots'); } catch (e) { list = []; }
    list.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    return list;
  };

  THL.autoDailySnapshot = async function () {
    if (!THL.state || !THL.state.records.length) return;
    var last = null;
    try { last = localStorage.getItem(THL.LS_LAST_SNAPSHOT); } catch (e) { /* ignore */ }
    if (last === todayISO()) return;
    await THL.makeSnapshot('每日自动备份');
  };

  THL.restoreSnapshotData = async function (snap) {
    if (!snap || !snap.state) throw new Error('bad-snapshot');
    THL.makeSnapshot('恢复前自动备份').catch(function () {});
    THL.state = normalizeState(snap.state);
    THL.save();
  };

  /* ---------- 操作日志 ---------- */
  THL.clearLogs = function () {
    THL.state.logs = [];
    THL.addLog('清空日志', '清除了所有操作日志');
    THL.save();
  };

  /* ---------- PIN 锁 ---------- */
  function randomSalt() {
    if (window.crypto && crypto.getRandomValues) {
      var a = new Uint8Array(12);
      crypto.getRandomValues(a);
      return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  async function sha256(text) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      var data = new TextEncoder().encode(text);
      var hash = await crypto.subtle.digest('SHA-256', data);
      return Array.prototype.map.call(new Uint8Array(hash), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }
    return 'h' + hashCode(text) + 'h' + hashCode(text.split('').reverse().join(''));
  }
  THL.hashPIN = async function (pin, salt) {
    return sha256('thl::' + salt + '::' + pin);
  };
  THL.setPIN = async function (pin) {
    var salt = randomSalt();
    var hash = await THL.hashPIN(pin, salt);
    THL.state.settings.lock = {
      enabled: true,
      salt: salt,
      hash: hash,
      pinLength: Math.max(4, Math.min(8, String(pin).length)),
      autoLockMinutes: (THL.state.settings.lock && THL.state.settings.lock.autoLockMinutes) || 5
    };
    THL.save();
  };
  THL.verifyPIN = async function (pin) {
    var lock = THL.state.settings.lock;
    if (!lock || !lock.enabled) return true;
    var hash = await THL.hashPIN(pin, lock.salt);
    return hash === lock.hash;
  };
  THL.disablePIN = async function (pin) {
    var ok = await THL.verifyPIN(pin);
    if (!ok) return false;
    THL.state.settings.lock = { enabled: false, salt: '', hash: '', pinLength: 4, autoLockMinutes: 5 };
    THL.save();
    return true;
  };

  THL.getDraft = function () {
    try {
      var raw = localStorage.getItem(THL.LS_DRAFT);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || !d.at || !d.data) return null;
      return d;
    } catch (e) { return null; }
  };
  THL.saveDraft = function (data) {
    try {
      localStorage.setItem(THL.LS_DRAFT, JSON.stringify({ at: nowISO(), data: data }));
    } catch (e) { /* ignore */ }
  };
  THL.clearDraft = function () {
    try { localStorage.removeItem(THL.LS_DRAFT); } catch (e) { /* ignore */ }
  };

  /* ---------- 示例数据 ---------- */
  THL.loadSampleData = function () {
    var base = createDefaultState();
    var today = todayISO();
    var weddingDate = addDays(today, 3);
    var birthdayDate = addDays(today, -118);
    var bookWedding = {
      id: uid('book'),
      title: '志远 & 晓雅 婚礼礼簿',
      type: '婚礼',
      date: weddingDate,
      location: '杭州 · 西湖国宾馆 紫薇厅',
      host: '陈志远 · 林晓雅',
      note: '良辰吉日，感谢每一位亲友的见证与祝福。',
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    var bookBirthday = {
      id: uid('book'),
      title: '父亲七十大寿礼簿',
      type: '寿宴',
      date: birthdayDate,
      location: '老家 · 福满楼',
      host: '陈家',
      note: '福如东海，寿比南山。',
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    var weddingNames = [
      ['张建国', '亲戚', 2000, '茅台两瓶', '大舅一家', true, true, true],
      ['王秀兰', '亲戚', 1200, '', '二姨', true, false, true],
      ['李伟', '同事', 800, '', '产品部', true, false, false],
      ['赵敏', '同学', 600, '茶具一套', '大学室友', true, true, true],
      ['周强', '朋友', 1000, '', '发小，专程从上海赶来', true, false, false],
      ['吴静', '同事', 500, '', '', true, false, false],
      ['孙海洋', '朋友', 666, '', '祝新婚快乐', true, false, false],
      ['刘芳', '亲戚', 1600, '金手镯', '小姨', true, true, true],
      ['陈晓东', '同学', 800, '', '高中同学', true, false, false],
      ['杨丽', '朋友', 300, '', '', false, false, false],
      ['黄志明', '同事', 600, '红酒一箱', '', true, false, false],
      ['徐婷婷', '同学', 500, '', '', true, false, false],
      ['马俊', '朋友', 888, '', '微信转账', true, false, false],
      ['朱红', '亲戚', 1000, '', '表姐', true, false, true],
      ['胡兵', '同事', 400, '', '', true, false, false],
      ['郭美玲', '邻居', 300, '', '楼上邻居', true, false, false],
      ['林志强', '朋友', 1200, '', '大学同学', true, false, false],
      ['何雪', '同事', 500, '', '', false, false, false],
      ['高伟', '亲戚', 2000, '字画一幅', '表哥', true, true, true],
      ['罗琳', '朋友', 600, '', '', true, false, false]
    ];
    var birthdayNames = [
      ['张建国', '亲戚', 1000, '寿桃礼盒', '', true, true, true],
      ['刘芳', '亲戚', 800, '', '', true, true, true],
      ['高伟', '亲戚', 1200, '', '', true, true, true],
      ['李伟', '同事', 500, '', '', true, false, true],
      ['吴静', '同事', 300, '', '', true, false, false],
      ['周强', '朋友', 600, '', '', true, false, true],
      ['赵敏', '同学', 500, '', '', true, false, true],
      ['郭美玲', '邻居', 300, '', '', true, true, true],
      ['王秀兰', '亲戚', 500, '', '', true, true, true],
      ['林志强', '朋友', 600, '', '', true, false, false],
      ['杨丽', '朋友', 200, '', '', false, false, false],
      ['朱红', '亲戚', 800, '', '', true, true, true]
    ];
    function rec(bookId, arr, idx) {
      var name = arr[0], relation = arr[1], amount = arr[2], gift = arr[3], note = arr[4], attended = arr[5], returned = arr[6], thanked = arr[7];
      var dt = bookId === bookWedding.id ? weddingDate : birthdayDate;
      return {
        id: uid('rec'),
        bookId: bookId,
        name: name,
        relation: relation,
        amount: amount,
        gift: gift,
        giftValue: 0,
        note: note,
        attended: attended,
        returned: returned,
        thanked: thanked,
        returnGift: returned ? '回礼一份喜糖礼盒' : '',
        returnAmount: 0,
        returnDate: returned ? addDays(dt, 7) : '',
        remindReturnAt: '',
        remindThankAt: !thanked ? addDays(dt, 10) : '',
        date: dt,
        photoId: null,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        operator: '我'
      };
    }
    var weddingRecords = weddingNames.map(function (a) { return rec(bookWedding.id, a); });
    var birthdayRecords = birthdayNames.map(function (a) { return rec(bookBirthday.id, a); });
    var guests = [];
    uniq(weddingNames.concat(birthdayNames).map(function (a) { return a[0]; })).forEach(function (name) {
      var source = weddingNames.find(function (a) { return a[0] === name; }) || birthdayNames.find(function (a) { return a[0] === name; });
      guests.push({
        id: uid('guest'),
        name: name,
        phone: '',
        relation: source ? source[1] : '',
        tags: source ? [source[1]] : [],
        note: '',
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
    });
    var outgoing = [
      { name: '李伟', relation: '同事', amount: 600, event: '乔迁之喜', date: addDays(today, -32), note: '新房入伙' },
      { name: '周强', relation: '朋友', amount: 800, event: '孩子满月', date: addDays(today, -75), note: '' },
      { name: '赵敏', relation: '同学', amount: 500, event: '升职宴', date: addDays(today, -160), note: '' },
      { name: '罗琳', relation: '朋友', amount: 300, event: '生日会', date: addDays(today, -210), note: '' },
      { name: '张建国', relation: '亲戚', amount: 1000, event: '六十大寿', date: addDays(today, -300), note: '' }
    ].map(function (o) {
      return {
        id: uid('out'),
        name: o.name,
        phone: '',
        relation: o.relation,
        amount: o.amount,
        gift: '',
        event: o.event,
        date: o.date,
        note: o.note,
        createdAt: nowISO(),
        operator: '我'
      };
    });
    base.books = [bookWedding, bookBirthday];
    base.records = weddingRecords.concat(birthdayRecords);
    base.guests = guests;
    base.outgoing = outgoing;
    base.activeBookId = bookWedding.id;
    base.logs = [{
      id: uid('log'), at: nowISO(), operator: '我', action: '载入示例',
      detail: '载入 2 本礼簿、' + base.records.length + ' 笔礼金的体验数据', bookId: bookWedding.id
    }];
    THL.state = base;
    THL.save();
    return base;
  };

  THL.resetAll = function (keepSettings) {
    var s = THL.state ? THL.state.settings : null;
    THL.state = createDefaultState();
    if (keepSettings && s) {
      THL.state.settings = {
        ...THL.state.settings,
        theme: s.theme,
        currency: s.currency,
        currencyCode: s.currencyCode,
        largeText: s.largeText,
        operator: s.operator,
        quickAmounts: s.quickAmounts.slice(),
        relationTags: s.relationTags.slice(),
        eventTypes: s.eventTypes.slice(),
        autoSaveGuest: s.autoSaveGuest
      };
    }
    THL.save();
  };

  THL.normalizeName = function (s) { return String(s || '').trim().toLowerCase(); };
  THL.daysBetween = daysBetween;
  THL.todayISO = todayISO;
  THL.nowISO = nowISO;
  THL.addDays = addDays;
  THL.fmtDate = fmtDate;
  THL.fmtDateTime = fmtDateTime;
  THL.relativeDay = relativeDay;
  THL.greet = greet;
  THL.money = money;
  THL.shortMoney = shortMoney;
  THL.plainAmount = plainAmount;
  THL.esc = esc;
  THL.nl2br = nl2br;
  THL.safeFileName = safeFileName;
  THL.uid = uid;
  THL.sum = sum;
  THL.uniq = uniq;
  THL.num = num;
  THL.clamp = clamp;
  THL.currency = currency;
  THL.sha256 = sha256;
  THL.hashCode = hashCode;
})();
