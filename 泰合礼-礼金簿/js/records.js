/* 泰合礼 THL 礼金簿 — 礼金明细、登记表单、批量操作 */
(function () {
  'use strict';
  var T = window.THL;
  var ui = T.ui;

  var SORT_LABELS = {
    newest: '最近登记',
    dateDesc: '礼金日期',
    amountDesc: '金额高→低',
    amountAsc: '金额低→高',
    name: '姓名排序'
  };
  var QUICK_FILTERS = [
    { id: 'all', label: '全部' },
    { id: 'return', label: '待回礼' },
    { id: 'thank', label: '待答谢' },
    { id: 'attended', label: '已到场' }
  ];

  function relationOptions() {
    var list = T.state.settings.relationTags.slice();
    T.state.records.forEach(function (r) {
      if (r.relation && list.indexOf(r.relation) < 0) list.push(r.relation);
    });
    return list;
  }

  function matchQuery(r, q) {
    if (!q) return true;
    var s = String(q).trim().toLowerCase();
    if (!s) return true;
    var blob = [r.name, r.relation, r.amount, r.gift, r.note, r.date, T.fmtDate(r.date)].join(' ').toLowerCase();
    return blob.indexOf(s) >= 0;
  }

  function filteredRecords() {
    var book = T.getActiveBook();
    if (!book) return [];
    var list = T.recordsOfBook(book.id);
    if (ui.listFilter === 'return') list = list.filter(function (r) { return !r.returned; });
    else if (ui.listFilter === 'thank') list = list.filter(function (r) { return !r.thanked; });
    else if (ui.listFilter === 'attended') list = list.filter(function (r) { return r.attended; });
    if (ui.listRelation) list = list.filter(function (r) { return r.relation === ui.listRelation; });
    if (ui.search) list = list.filter(function (r) { return matchQuery(r, ui.search); });
    list.sort(function (a, b) {
      switch (ui.listSort) {
        case 'amountDesc': return b.amount - a.amount || String(b.createdAt).localeCompare(String(a.createdAt));
        case 'amountAsc': return a.amount - b.amount || String(b.createdAt).localeCompare(String(a.createdAt));
        case 'name': return String(a.name).localeCompare(String(b.name), 'zh-CN');
        case 'dateDesc': return String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt));
        default: return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      }
    });
    return list;
  }
  T.filteredRecords = filteredRecords;

  function hasActiveFilter() {
    return !!(ui.search || ui.listRelation || ui.listFilter !== 'all' || ui.listSort !== 'newest');
  }

  T.views.records = function () {
    var book = T.getActiveBook();
    if (!book) {
      return '<div class="page">' +
        T.emptyState('book-plus', '还没有礼簿', '先创建一本礼簿，再开始登记礼金。每场喜事独立记账，清晰不乱。', '<button class="btn btn-primary" data-action="open-book-form">' + T.icon('plus') + ' 新建礼簿</button>') +
        '<div class="center" style="margin-top:12px"><button class="text-link" data-action="load-sample">' + T.icon('sparkles') + ' 载入示例体验</button></div></div>';
    }
    var chips = QUICK_FILTERS.map(function (f) {
      return '<button class="chip' + (ui.listFilter === f.id ? ' active' : '') + '" data-action="filter" data-filter="' + f.id + '">' + f.label + '</button>';
    }).join('');
    var result = renderResults();
    var batchBar = ui.batchMode ? renderBatchBar() : '';
    return '<div class="page page-tight records-page">' +
      '<div class="book-strip">' +
      '<span class="glyph">' + T.esc(T.bookGlyph(book.type)) + '</span>' +
      '<div class="book-strip-copy"><b>' + T.esc(book.title) + '</b><span>' + T.esc(T.fmtDate(book.date)) + (book.location ? ' · ' + T.esc(book.location) : '') + '</span></div>' +
      '<button class="book-switch-btn" data-action="open-book-menu">切换' + T.icon('chevron-down') + '</button>' +
      '<button class="icon-btn" data-action="open-export" aria-label="导出分享" style="width:34px;height:34px">' + T.icon('download') + '</button>' +
      '</div>' +
      '<div class="search-tools"><div class="search-box">' + T.icon('search') +
      '<input id="record-search" type="search" autocomplete="off" placeholder="搜姓名、金额、礼品或备注" value="' + T.esc(ui.search) + '" aria-label="搜索礼金">' +
      '<button class="search-clear" type="button" data-action="clear-record-search" aria-label="清空搜索"' + (ui.search ? '' : ' hidden') + '>' + T.icon('close') + '</button></div>' +
      '<button class="filter-btn' + (ui.listRelation ? ' has-filter' : '') + '" data-action="open-filter" aria-label="筛选与排序">' + T.icon('filter') + (ui.listRelation ? '<span class="filter-dot"></span>' : '') + '</button></div>' +
      '<div class="filter-row"><div class="filter-scroll">' + chips + '</div><div class="filter-actions">' +
      '<button class="filter-action' + (ui.listSort !== 'newest' ? ' active' : '') + '" data-action="open-filter">' + T.icon('sort') + T.esc(SORT_LABELS[ui.listSort] || '排序') + '</button>' +
      '<button class="filter-action' + (ui.batchMode ? ' active' : '') + '" data-action="toggle-batch">' + T.icon('check-circle') + (ui.batchMode ? '完成' : '批量') + '</button>' +
      '</div></div>' +
      '<div id="records-result" aria-live="polite">' + result + '</div>' +
      '<div id="batch-bar-root">' + batchBar + '</div>' +
      '</div>';
  };

  function renderResults() {
    var list = filteredRecords();
    var shown = list.slice(0, ui.recordLimit);
    var sum = T.sum(list, function (r) { return r.amount; });
    var summary = '<div class="record-summary"><span>' + (hasActiveFilter() ? '筛选出 ' : '共 ') + '<b>' + list.length + '</b> 笔' +
      (hasActiveFilter() ? ' <button class="text-link" style="font-size:.68rem;min-height:26px" data-action="clear-filters">清除</button>' : '') +
      '</span><span class="sum">' + T.esc(T.money(sum)) + '</span></div>';
    var body;
    if (!list.length) {
      if (ui.search || ui.listRelation || ui.listFilter !== 'all') {
        body = T.emptyState('search', '没有找到匹配的礼金', '换一个姓名或金额试试，或清除筛选条件。', '<button class="btn btn-secondary" data-action="clear-filters">清除筛选</button>');
      } else {
        body = T.emptyState('gift', '本场还没有礼金', '点“登记礼金”，把第一份心意记下来。可拍照存证、一键选常用金额。', '<button class="btn btn-primary" data-action="add-record">' + T.icon('plus') + ' 登记第一笔</button>');
      }
    } else {
      body = '<div class="record-list">' + shown.map(function (r) { return T.recordRow(r); }).join('') + '</div>';
      if (shown.length < list.length) {
        body += '<div class="load-more-wrap"><button class="btn btn-sm" data-action="load-more">显示更多（还有 ' + (list.length - shown.length) + ' 笔）</button></div>';
      }
    }
    return summary + body;
  }

  function updateRecordsResults() {
    var root = document.getElementById('records-result');
    if (!root) return;
    root.innerHTML = renderResults();
    var clear = document.querySelector('#record-search ~ .search-clear') || document.querySelector('[data-action="clear-record-search"]');
    if (clear) clear.hidden = !ui.search;
    var bar = document.getElementById('batch-bar-root');
    if (bar) bar.innerHTML = ui.batchMode ? renderBatchBar() : '';
  }
  T.views.updateRecordsResults = updateRecordsResults;

  function toggleSelect(id) {
    if (!ui.selected) ui.selected = new Set();
    if (ui.selected.has(id)) ui.selected.delete(id); else ui.selected.add(id);
    syncSelectionUI();
  }
  function syncSelectionUI() {
    T.qsa('#records-result .record-row').forEach(function (row) {
      var id = row.getAttribute('data-record-id');
      row.classList.toggle('selected', ui.selected.has(id));
    });
    var bar = document.getElementById('batch-bar-root');
    if (bar) bar.innerHTML = ui.batchMode ? renderBatchBar() : '';
  }
  function renderBatchBar() {
    var n = ui.selected.size;
    var all = filteredRecords();
    var allSelected = n > 0 && n >= all.length;
    return '<div class="batch-bar">' +
      '<button class="batch-count" data-action="batch-select-all" style="text-align:left">' + (allSelected ? '取消全选' : '全选') + ' · 已选 <b>' + n + '</b> 笔</button>' +
      '<div class="batch-actions">' +
      '<button class="batch-action" data-action="batch-mark-return">' + T.icon('gift') + '回礼</button>' +
      '<button class="batch-action" data-action="batch-mark-thank">' + T.icon('heart') + '答谢</button>' +
      '<button class="batch-action" data-action="batch-more">' + T.icon('more') + '更多</button>' +
      '<button class="batch-action text" data-action="toggle-batch">取消</button>' +
      '</div></div>';
  }
  function clearBatch() {
    ui.batchMode = false;
    ui.selected = new Set();
  }

  function openFilterSheet() {
    var rel = ui.listRelation;
    var sort = ui.listSort;
    var rels = relationOptions();
    var relChips = '<button class="chip' + (!rel ? ' active' : '') + '" data-rel-option="">全部关系</button>' +
      rels.map(function (r) { return '<button class="chip' + (rel === r ? ' active' : '') + '" data-rel-option="' + T.esc(r) + '">' + T.esc(r) + '</button>'; }).join('');
    var sortRows = Object.keys(SORT_LABELS).map(function (key) {
      return '<button class="option-row' + (sort === key ? ' active' : '') + '" data-sort-option="' + key + '"><span class="radio-dot"></span><span>' + SORT_LABELS[key] + '</span></button>';
    }).join('');
    T.openOverlay('<div class="sheet-head"><div class="head-copy"><p class="eyebrow">FILTER</p><h2>筛选与排序</h2><p class="sub">快速找到要核对的那一笔</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="filter-block"><h3>关系分类</h3><div class="chips" id="filter-rel-chips">' + relChips + '</div></div>' +
      '<div class="filter-block"><h3>排序方式</h3><div class="option-list" id="filter-sort-list">' + sortRows + '</div></div></div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" id="filter-reset">重置</button><button class="btn btn-primary primary-wide" type="button" id="filter-apply">应用筛选</button></div>',
      {
        label: '筛选与排序',
        sheetClass: 'small-sheet',
        onMount: function (sheet) {
          sheet.querySelector('#filter-rel-chips').addEventListener('click', function (e) {
            var chip = e.target.closest('[data-rel-option]');
            if (!chip) return;
            rel = chip.getAttribute('data-rel-option');
            sheet.querySelectorAll('#filter-rel-chips .chip').forEach(function (c) { c.classList.toggle('active', c === chip); });
          });
          sheet.querySelector('#filter-sort-list').addEventListener('click', function (e) {
            var row = e.target.closest('[data-sort-option]');
            if (!row) return;
            sort = row.getAttribute('data-sort-option');
            sheet.querySelectorAll('#filter-sort-list .option-row').forEach(function (r) { r.classList.toggle('active', r === row); });
          });
          sheet.querySelector('#filter-reset').addEventListener('click', function () {
            ui.listRelation = '';
            ui.listSort = 'newest';
            ui.recordLimit = 60;
            T.closeOverlay();
            T.renderApp();
          });
          sheet.querySelector('#filter-apply').addEventListener('click', function () {
            ui.listRelation = rel;
            ui.listSort = sort;
            ui.recordLimit = 60;
            T.closeOverlay();
            T.renderApp();
          });
        }
      });
  }

  function openBatchMore() {
    var ids = Array.from(ui.selected);
    if (!ids.length) { T.toast('请先勾选礼金记录'); return; }
    var rels = relationOptions();
    T.openOverlay('<div class="sheet-head"><div class="head-copy"><p class="eyebrow">BATCH EDIT</p><h2>批量操作</h2><p class="sub">已选 ' + ids.length + ' 笔礼金</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="filter-block"><h3>标记状态</h3><div class="chips"><button class="chip" data-batch-set="attended-true">' + T.icon('check') + '标记已到场</button><button class="chip" data-batch-set="attended-false">标记未到场</button><button class="chip" data-batch-set="return-false">取消回礼标记</button><button class="chip" data-batch-set="thank-false">取消答谢标记</button></div></div>' +
      '<div class="filter-block"><h3>批量修改关系</h3><div class="chips" id="batch-relations">' + rels.map(function (r) { return '<button class="chip" data-batch-rel="' + T.esc(r) + '">' + T.esc(r) + '</button>'; }).join('') + '</div><p class="field-hint">点选一个关系，立即应用到所选记录。</p></div>' +
      '<button class="btn btn-danger btn-block" type="button" id="batch-delete" style="margin-top:8px">' + T.icon('trash') + ' 删除所选 ' + ids.length + ' 笔礼金</button></div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>关闭</button></div>',
      {
        label: '批量操作',
        sheetClass: 'small-sheet',
        onMount: function (sheet) {
          sheet.querySelectorAll('[data-batch-set]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var v = btn.getAttribute('data-batch-set').split('-');
              var changes = {};
              changes[v[0]] = v[1] === 'true';
              T.batchUpdateRecords(ids, changes);
              clearBatch();
              T.closeOverlay();
              T.renderApp();
              T.toast('已批量更新 ' + ids.length + ' 笔', 'success');
            });
          });
          sheet.querySelector('#batch-relations').addEventListener('click', function (e) {
            var chip = e.target.closest('[data-batch-rel]');
            if (!chip) return;
            T.batchUpdateRecords(ids, { relation: chip.getAttribute('data-batch-rel') });
            clearBatch();
            T.closeOverlay();
            T.renderApp();
            T.toast('关系已批量更新', 'success');
          });
          sheet.querySelector('#batch-delete').addEventListener('click', function () {
            var ok = window.confirm('确定删除所选的 ' + ids.length + ' 笔礼金？\n\n删除前会自动建立恢复点。');
            if (!ok) return;
            T.makeSnapshot('批量删除前自动备份').catch(function () {});
            T.deleteRecords(ids, { batch: true });
            clearBatch();
            T.closeOverlay();
            T.renderApp();
            T.toast('已删除 ' + ids.length + ' 笔礼金', 'success');
          });
        }
      });
  }

  /* ---------------- 礼金详情 ---------------- */
  function openRecordDetail(id) {
    var r = T.getRecord(id);
    if (!r) { T.toast('记录不存在或已删除', 'error'); return; }
    var book = T.getBook(r.bookId);
    var statusLine = [
      r.attended ? '<span class="badge badge-green">已到场</span>' : '<span class="badge badge-muted">未到场</span>',
      r.returned ? '<span class="badge badge-green">已回礼</span>' : '<span class="badge badge-amber">待回礼</span>',
      r.thanked ? '<span class="badge badge-green">已答谢</span>' : '<span class="badge badge-amber">待答谢</span>'
    ].join('');
    var infoRows = '<div class="detail-info-row"><span class="label">所属礼簿</span><span class="val">' + T.esc(book ? book.title : '—') + '</span></div>' +
      '<div class="detail-info-row"><span class="label">礼金日期</span><span class="val">' + T.esc(T.fmtDate(r.date)) + '</span></div>' +
      '<div class="detail-info-row"><span class="label">礼品</span><span class="val">' + T.esc(r.gift || '—') + (r.giftValue ? '（估值 ' + T.esc(T.money(r.giftValue)) + '）' : '') + '</span></div>' +
      '<div class="detail-info-row"><span class="label">备注</span><span class="val">' + T.esc(r.note || '—') + '</span></div>';
    if (r.returned) {
      infoRows += '<div class="detail-info-row"><span class="label">回礼记录</span><span class="val">' +
        T.esc([r.returnGift, r.returnAmount ? '回礼金额 ' + T.money(r.returnAmount) : '', r.returnDate ? '回礼日期 ' + T.fmtDate(r.returnDate) : ''].filter(Boolean).join(' · ') || '已标记回礼，未填写明细') +
        '</span></div>';
    }
    infoRows += '<div class="detail-info-row"><span class="label">提醒日期</span><span class="val">' +
      T.esc([r.remindReturnAt ? '回礼 ' + T.fmtDate(r.remindReturnAt) : '', r.remindThankAt ? '答谢 ' + T.fmtDate(r.remindThankAt) : ''].filter(Boolean).join(' · ') || '未设置') + '</span></div>' +
      '<div class="detail-info-row"><span class="label">登记人</span><span class="val">' + T.esc(r.operator || '我') + ' · ' + T.esc(T.fmtDateTime(r.createdAt)) + '</span></div>' +
      (r.updatedAt && r.updatedAt !== r.createdAt ? '<div class="detail-info-row"><span class="label">最后修改</span><span class="val">' + T.esc(T.fmtDateTime(r.updatedAt)) + '</span></div>' : '');
    var photo = r.photoId ? '<div class="detail-photo" data-photo-id="' + T.esc(r.photoId) + '"><div class="detail-photo-head">' + T.icon('camera') + '红包 / 礼单存证</div><a data-photo-link href="#" target="_blank" rel="noopener"><img alt="红包或礼单照片" hidden><div data-photo-empty class="mini-empty">照片加载中…</div></a></div>' : '';
    var html = '<div class="sheet-head"><div class="head-copy"><p class="eyebrow">GIFT DETAIL</p><h2>礼金详情</h2></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="detail-hero">' + T.avatar(r.name, 'lg', true) +
      '<div class="detail-name">' + T.esc(r.name) + '</div>' +
      '<div class="detail-relation">' + T.esc(r.relation || '未分类') + '</div>' +
      '<div class="detail-amount">' + T.esc(T.money(r.amount)) + '</div>' +
      '<div class="detail-amount-label">礼金金额</div>' +
      '<div class="detail-statuses">' + statusLine + '</div></div>' +
      '<div class="detail-info">' + infoRows + '</div>' + photo +
      '<div class="detail-mini-actions">' +
      '<button class="btn btn-secondary" data-action="record-flag" data-id="' + T.esc(r.id) + '" data-flag="returned">' + T.icon('gift') + (r.returned ? '取消回礼' : '标记已回礼') + '</button>' +
      '<button class="btn btn-secondary" data-action="record-flag" data-id="' + T.esc(r.id) + '" data-flag="thanked">' + T.icon('heart') + (r.thanked ? '取消答谢' : '标记已答谢') + '</button>' +
      '</div></div>' +
      '<div class="sheet-footer"><button class="btn btn-secondary" type="button" data-action="record-edit" data-id="' + T.esc(r.id) + '">' + T.icon('edit') + ' 编辑记录</button><button class="btn btn-primary primary-wide" type="button" data-close-overlay>完成</button><button class="btn btn-danger btn-icon-only" type="button" data-action="record-delete" data-id="' + T.esc(r.id) + '" aria-label="删除">' + T.icon('trash') + '</button></div>';
    T.openOverlay(html, { label: '礼金详情', sheetClass: 'detail-sheet' });
    T.hydratePhotos(overlayOrDocument());
  }
  function overlayOrDocument() { return document.getElementById('overlay-root') || document; }

  function deleteRecordFlow(id) {
    var r = T.getRecord(id);
    if (!r) return;
    var ok = window.confirm('删除「' + r.name + '」的 ' + T.money(r.amount) + ' 礼金记录？\n\n删除前会自动建立恢复点。');
    if (!ok) return;
    T.makeSnapshot('删除礼金前自动备份').catch(function () {});
    T.closeOverlay();
    T.deleteRecords([id]);
    T.renderApp();
    T.toast('已删除这笔礼金', 'success');
  }

  /* ---------------- 登记 / 编辑表单 ---------------- */
  function openRecordForm(recordId, options) {
    options = options || {};
    var existing = recordId ? T.getRecord(recordId) : null;
    var book = existing ? T.getBook(existing.bookId) : T.getActiveBook();
    if (!book) {
      T.toast('请先创建一本礼簿', 'error');
      T.openBookForm();
      return;
    }
    var draft = null;
    var restoredDraft = false;
    if (!existing) {
      var d = T.getDraft();
      if (d && d.data && d.data.bookId === book.id) {
        var age = Date.now() - new Date(d.at).getTime();
        if (age < 7 * 86400000 && (d.data.name || d.data.amount || d.data.note || d.data.gift)) {
          draft = d;
          restoredDraft = true;
        }
      }
    }
    var source = existing || (draft ? Object.assign({
      date: book.date || T.todayISO(),
      attended: true,
      relation: options.presetRelation || '',
      name: options.presetName || ''
    }, draft.data) : {
      name: options.presetName || '',
      relation: options.presetRelation || '',
      amount: '',
      gift: '',
      giftValue: '',
      note: '',
      attended: true,
      returned: false,
      thanked: false,
      returnGift: '',
      returnAmount: '',
      returnDate: '',
      remindReturnAt: '',
      remindThankAt: '',
      date: book.date || T.todayISO()
    });
    var state = {
      attended: source.attended !== false,
      returned: !!source.returned,
      thanked: !!source.thanked
    };
    var selectedRelation = source.relation || '';
    var relations = relationOptions();
    if (selectedRelation && relations.indexOf(selectedRelation) < 0) relations.unshift(selectedRelation);
    var relChips = relations.map(function (r) {
      return '<button type="button" class="relation-chip' + (r === selectedRelation ? ' active' : '') + '" data-relation="' + T.esc(r) + '">' + T.esc(r) + '</button>';
    }).join('');
    var quickGuests = T.state.guests.slice().sort(function (a, b) {
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    }).slice(0, 8);
    var guestChips = quickGuests.map(function (g) {
      return '<button type="button" data-quick-guest="' + T.esc(g.name) + '" data-quick-relation="' + T.esc(g.relation || '') + '">' + T.esc(g.name) + '</button>';
    }).join('');
    var datalist = T.state.guests.map(function (g) { return '<option value="' + T.esc(g.name) + '">' + T.esc(g.relation || '') + '</option>'; }).join('');
    var quickAmounts = T.state.settings.quickAmounts.map(function (a) {
      return '<button type="button" class="quick-amount" data-quick-amount="' + a + '">' + T.esc(T.plainAmount(a)) + '</button>';
    }).join('');
    var hasPhoto = !!source.photoId;
    var photoInner = hasPhoto
      ? '<div class="photo-preview" data-photo-id="' + T.esc(source.photoId) + '"><span data-photo-empty>加载中…</span><img alt="红包存证" hidden></div>'
      : '<div class="photo-preview"><span class="icon">' + T.icon('camera') + '</span></div>';
    var html = '<form id="record-form" novalidate>' +
      '<div class="sheet-head"><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button>' +
      '<div class="head-copy"><p class="eyebrow">' + (existing ? 'EDIT GIFT' : 'NEW GIFT') + '</p><h2>' + (existing ? '编辑礼金' : '登记礼金') + '</h2><p class="sub">记入《' + T.esc(book.title) + '》</p></div></div>' +
      '<div class="sheet-body">' +
      (restoredDraft ? '<div class="draft-banner">' + T.icon('clock') + '<span>已恢复 ' + T.esc(T.fmtDateTime(draft.at)) + ' 未保存的草稿</span><button type="button" data-discard-draft>清空</button></div>' : '') +
      '<div class="form-section">' +
      '<div class="form-section-title">' + T.icon('user') + '宾客与关系<span class="req">* 姓名必填</span></div>' +
      '<div class="field" id="field-name"><label class="field-label" for="rec-name">宾客姓名</label><div class="name-input-wrap"><input class="input" id="rec-name" name="name" list="guest-names" value="' + T.esc(source.name || '') + '" maxlength="40" placeholder="请输入送礼人姓名" autocomplete="off" data-autofocus><span class="input-icon">' + T.icon('user') + '</span></div><span class="field-error" hidden></span><datalist id="guest-names">' + datalist + '</datalist>' +
      (guestChips ? '<div class="guest-quick-label field-hint" style="margin-top:2px">常用宾客：</div><div class="guest-quick">' + guestChips + '</div>' : '') +
      '</div>' +
      '<div class="field"><span class="field-label">关系标签</span><div class="relation-chips" id="rec-relations">' + relChips + '</div></div>' +
      '</div>' +
      '<div class="form-section">' +
      '<div class="form-section-title">' + T.icon('yuan') + '礼金金额</div>' +
      '<div class="field" id="field-amount"><label class="field-label" for="rec-amount">礼金 <span class="optional">金额与礼品至少填一项</span></label><div class="amount-input-wrap"><span class="currency">' + T.esc(T.currency()) + '</span><input class="input" id="rec-amount" name="amount" type="number" inputmode="decimal" min="0" step="0.01" value="' + T.esc(source.amount === 0 || source.amount == null ? '' : source.amount) + '" placeholder="输入金额"></div><span class="field-error" hidden></span>' +
      '<div class="quick-amounts">' + quickAmounts + '</div></div>' +
      '<div class="field"><label class="field-label" for="rec-date">礼金日期</label><input class="input" id="rec-date" name="date" type="date" value="' + T.esc(source.date || T.todayISO()) + '"></div>' +
      '</div>' +
      '<div class="form-section">' +
      '<div class="form-section-title">' + T.icon('gift') + '礼品与备注</div>' +
      '<div class="form-grid"><div class="field"><label class="field-label" for="rec-gift">礼品 <span class="optional">可选</span></label><input class="input" id="rec-gift" name="gift" value="' + T.esc(source.gift || '') + '" maxlength="120" placeholder="烟酒、摆件等"></div>' +
      '<div class="field"><label class="field-label" for="rec-gift-value">礼品估值</label><input class="input" id="rec-gift-value" name="giftValue" type="number" inputmode="decimal" min="0" step="0.01" value="' + T.esc(source.giftValue ? source.giftValue : '') + '" placeholder="可选"></div></div>' +
      '<div class="field"><label class="field-label" for="rec-note">备注</label><textarea class="textarea" id="rec-note" name="note" maxlength="500" placeholder="例如：舅舅一家、微信转账、专程从外地赶来…">' + T.esc(source.note || '') + '</textarea></div>' +
      '</div>' +
      '<div class="form-section">' +
      '<div class="form-section-title">' + T.icon('check-circle') + '状态与回礼</div>' +
      '<div class="toggle-list">' +
      toggleHtml('attended', '已到场', '宾客是否亲自到场', state.attended) +
      toggleHtml('returned', '已回礼', '是否已向对方回礼', state.returned) +
      toggleHtml('thanked', '已答谢', '是否已当面或电话答谢', state.thanked) +
      '</div>' +
      '<div class="return-fields" id="return-fields"' + (state.returned ? '' : ' hidden') + '>' +
      '<div class="form-grid"><div class="field"><label class="field-label" for="rec-return-amount">回礼金额</label><input class="input" id="rec-return-amount" type="number" inputmode="decimal" min="0" step="0.01" value="' + T.esc(source.returnAmount ? source.returnAmount : '') + '" placeholder="0"></div>' +
      '<div class="field"><label class="field-label" for="rec-return-date">回礼日期</label><input class="input" id="rec-return-date" type="date" value="' + T.esc(source.returnDate || '') + '"></div></div>' +
      '<div class="field"><label class="field-label" for="rec-return-gift">回礼礼品</label><input class="input" id="rec-return-gift" value="' + T.esc(source.returnGift || '') + '" maxlength="120" placeholder="例如：喜糖礼盒、回礼红包"></div></div>' +
      '</div>' +
      '<div class="form-section">' +
      '<div class="form-section-title">' + T.icon('bell') + '提醒与备注</div>' +
      '<div class="form-grid"><div class="field"><label class="field-label" for="rec-remind-return">回礼提醒日</label><input class="input" id="rec-remind-return" type="date" value="' + T.esc(source.remindReturnAt || '') + '"><div class="reminder-date-chips"><button type="button" data-remind="return" data-days="3">3天后</button><button type="button" data-remind="return" data-days="7">一周后</button></div></div>' +
      '<div class="field"><label class="field-label" for="rec-remind-thank">答谢提醒日</label><input class="input" id="rec-remind-thank" type="date" value="' + T.esc(source.remindThankAt || '') + '"><div class="reminder-date-chips"><button type="button" data-remind="thank" data-days="3">3天后</button><button type="button" data-remind="thank" data-days="7">一周后</button></div></div></div>' +
      '</div>' +
      '<div class="form-section">' +
      '<div class="form-section-title">' + T.icon('camera') + '红包存证 <span class="req">可选</span></div>' +
      '<div class="photo-box" id="photo-box">' + photoInner +
      '<div class="photo-copy"><b>' + (hasPhoto ? '已添加照片' : '拍下红包或礼单') + '</b><p>照片只保存在本机，可随时移除</p>' +
      '<div class="photo-actions"><button type="button" data-photo-source="camera">' + T.icon('camera') + ' 拍照</button><button type="button" data-photo-source="gallery">' + T.icon('image') + ' 相册</button><button type="button" class="remove" data-photo-remove hidden>' + T.icon('trash') + ' 移除</button></div>' +
      '</div></div>' +
      '<input type="file" id="photo-camera" accept="image/*" capture="environment" hidden><input type="file" id="photo-gallery" accept="image/*" hidden>' +
      '</div>' +
      '<p class="form-foot-note" id="draft-status">' + (existing ? '修改要点击保存才会生效' : (T.state.settings.autoSaveGuest !== false ? '保存后会同步到宾客档案 · 内容会自动保存为草稿' : '内容会自动保存为草稿')) + '</p>' +
      '</div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>取消</button>' +
      (existing ? '' : '<button class="btn btn-secondary" type="button" id="save-continue">保存并继续</button>') +
      '<button class="btn btn-primary primary-wide" type="submit" id="save-record">' + (existing ? '保存修改' : '保存礼金') + '</button></div>' +
      '</form>';

    var photoState = {
      existingId: source.photoId || null,
      removed: false,
      newBlob: null,
      newUrl: null
    };
    var dirty = false;
    var saving = false;
    var draftTimer = null;
    var closed = false;

    T.openOverlay(html, {
      sheetClass: 'full-sheet',
      label: existing ? '编辑礼金' : '登记礼金',
      onBeforeClose: function () {
        if (saving) return false;
        if (!dirty) return true;
        var ok = window.confirm(existing ? '放弃本次修改吗？' : '离开将丢失尚未保存的登记内容，确定离开吗？');
        if (ok) T.clearDraft();
        return ok;
      },
      onClose: function () {
        closed = true;
        if (draftTimer) clearTimeout(draftTimer);
        if (photoState.newUrl) URL.revokeObjectURL(photoState.newUrl);
      },
      onMount: function (sheet) {
        var form = sheet.querySelector('#record-form');
        var nameInput = sheet.querySelector('#rec-name');
        var amountInput = sheet.querySelector('#rec-amount');
        var amountError = sheet.querySelector('#field-amount .field-error');
        var nameError = sheet.querySelector('#field-name .field-error');
        var photoPreviewHolder = sheet.querySelector('.photo-preview');
        var removePhotoBtn = sheet.querySelector('[data-photo-remove]');
        var photoCopy = sheet.querySelector('.photo-copy b');

        function markDirty() {
          dirty = true;
          if (draftTimer) clearTimeout(draftTimer);
          if (!existing) {
            draftTimer = setTimeout(function () {
              if (closed) return;
              T.saveDraft(collectDraft());
              var status = sheet.querySelector('#draft-status');
              if (status) status.textContent = '草稿已自动保存 · 内容仅保存在本机';
            }, 700);
          }
        }

        function currentRelation() {
          var active = sheet.querySelector('#rec-relations .relation-chip.active');
          return active ? active.getAttribute('data-relation') : '';
        }
        function currentStatus() {
          return {
            attended: state.attended,
            returned: state.returned,
            thanked: state.thanked
          };
        }
        function collectDraft() {
          return {
            bookId: book.id,
            name: nameInput.value.trim(),
            relation: currentRelation(),
            amount: amountInput.value,
            gift: sheet.querySelector('#rec-gift').value,
            giftValue: sheet.querySelector('#rec-gift-value').value,
            note: sheet.querySelector('#rec-note').value,
            date: sheet.querySelector('#rec-date').value,
            attended: state.attended,
            returned: state.returned,
            thanked: state.thanked,
            returnGift: sheet.querySelector('#rec-return-gift').value,
            returnAmount: sheet.querySelector('#rec-return-amount').value,
            returnDate: sheet.querySelector('#rec-return-date').value,
            remindReturnAt: sheet.querySelector('#rec-remind-return').value,
            remindThankAt: sheet.querySelector('#rec-remind-thank').value
          };
        }

        function updateQuickAmount() {
          var v = Number(amountInput.value);
          sheet.querySelectorAll('[data-quick-amount]').forEach(function (b) {
            b.classList.toggle('selected', Number(b.getAttribute('data-quick-amount')) === v && amountInput.value !== '');
          });
        }
        function setError(fieldEl, errEl, msg) {
          if (fieldEl) fieldEl.classList.toggle('has-error', !!msg);
          if (errEl) { errEl.textContent = msg || ''; errEl.hidden = !msg; }
        }
        function clearErrors() {
          setError(sheet.querySelector('#field-name'), nameError, '');
          setError(sheet.querySelector('#field-amount'), amountError, '');
        }

        function showPhotoPreview(url) {
          photoPreviewHolder = sheet.querySelector('.photo-preview');
          if (!photoPreviewHolder) return;
          photoPreviewHolder.removeAttribute('data-photo-id');
          photoPreviewHolder.innerHTML = '<img alt="红包存证">';
          photoPreviewHolder.querySelector('img').src = url;
          if (removePhotoBtn) removePhotoBtn.hidden = false;
          photoCopy = sheet.querySelector('.photo-copy b');
          if (photoCopy) photoCopy.textContent = '已添加照片';
        }
        function clearPhotoPreview() {
          photoPreviewHolder = sheet.querySelector('.photo-preview');
          if (photoPreviewHolder) {
            photoPreviewHolder.removeAttribute('data-photo-id');
            photoPreviewHolder.innerHTML = '<span class="icon">' + T.icon('camera') + '</span>';
          }
          if (removePhotoBtn) removePhotoBtn.hidden = true;
          photoCopy = sheet.querySelector('.photo-copy b');
          if (photoCopy) photoCopy.textContent = '拍下红包或礼单';
        }
        if (source.photoId) {
          removePhotoBtn && (removePhotoBtn.hidden = false);
          T.hydratePhotos(sheet);
        }

        // 名称、关系、常用宾客
        nameInput.addEventListener('blur', function () {
          if (currentRelation()) return;
          var g = T.findGuestByName(nameInput.value);
          if (g && g.relation) selectRelation(g.relation);
        });
        nameInput.addEventListener('input', function () {
          setError(sheet.querySelector('#field-name'), nameError, '');
          markDirty();
        });
        function selectRelation(rel) {
          selectedRelation = rel;
          sheet.querySelectorAll('#rec-relations .relation-chip').forEach(function (c) {
            c.classList.toggle('active', c.getAttribute('data-relation') === rel);
          });
        }
        sheet.querySelector('#rec-relations').addEventListener('click', function (e) {
          var chip = e.target.closest('[data-relation]');
          if (!chip) return;
          selectRelation(chip.getAttribute('data-relation'));
          markDirty();
        });
        sheet.querySelectorAll('[data-quick-guest]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            nameInput.value = btn.getAttribute('data-quick-guest');
            var rel = btn.getAttribute('data-quick-relation');
            if (rel) {
              if (!sheet.querySelector('[data-relation="' + rel.replace(/"/g, '\\"') + '"]')) {
                // 自定义关系直接补一个
                var wrap = sheet.querySelector('#rec-relations');
                var extra = document.createElement('button');
                extra.type = 'button';
                extra.className = 'relation-chip';
                extra.setAttribute('data-relation', rel);
                extra.textContent = rel;
                wrap.appendChild(extra);
              }
              selectRelation(rel);
            }
            markDirty();
            amountInput.focus();
          });
        });

        // 金额
        sheet.querySelectorAll('[data-quick-amount]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            amountInput.value = btn.getAttribute('data-quick-amount');
            updateQuickAmount();
            setError(sheet.querySelector('#field-amount'), amountError, '');
            markDirty();
          });
        });
        amountInput.addEventListener('input', function () {
          updateQuickAmount();
          setError(sheet.querySelector('#field-amount'), amountError, '');
          markDirty();
        });
        updateQuickAmount();

        // 状态开关
        sheet.querySelectorAll('[data-state-toggle]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var key = btn.getAttribute('data-state-toggle');
            state[key] = !state[key];
            btn.classList.toggle('on', state[key]);
            btn.setAttribute('aria-checked', state[key] ? 'true' : 'false');
            if (key === 'returned') {
              var rf = sheet.querySelector('#return-fields');
              if (rf) rf.hidden = !state.returned;
              if (state.returned && !sheet.querySelector('#rec-return-date').value) {
                sheet.querySelector('#rec-return-date').value = T.todayISO();
              }
            }
            markDirty();
          });
        });

        // 提醒快捷日期
        sheet.querySelectorAll('[data-remind]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var type = btn.getAttribute('data-remind');
            var days = btn.getAttribute('data-days');
            var input = sheet.querySelector(type === 'return' ? '#rec-remind-return' : '#rec-remind-thank');
            input.value = T.addDays(T.todayISO(), Number(days));
            markDirty();
          });
        });

        // 照片
        var cameraInput = sheet.querySelector('#photo-camera');
        var galleryInput = sheet.querySelector('#photo-gallery');
        sheet.querySelectorAll('[data-photo-source]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (btn.getAttribute('data-photo-source') === 'camera') cameraInput.click(); else galleryInput.click();
          });
        });
        async function handlePhotoFile(input) {
          var file = input.files && input.files[0];
          input.value = '';
          if (!file) return;
          if (!/^image\//.test(file.type || '')) { T.toast('请选择图片文件', 'error'); return; }
          T.showLoading('正在处理照片…');
          try {
            var blob = await T.compressImage(file, 1500, 0.82);
            if (photoState.newUrl) URL.revokeObjectURL(photoState.newUrl);
            photoState.newBlob = blob;
            photoState.newUrl = URL.createObjectURL(blob);
            photoState.removed = false;
            showPhotoPreview(photoState.newUrl);
            markDirty();
            T.toast('照片已添加，保存后生效', 'success', 1800);
          } catch (e) {
            console.error(e);
            T.toast('照片处理失败，请换一张图片', 'error');
          } finally {
            T.hideLoading();
          }
        }
        cameraInput.addEventListener('change', function () { handlePhotoFile(cameraInput); });
        galleryInput.addEventListener('change', function () { handlePhotoFile(galleryInput); });
        if (removePhotoBtn) {
          removePhotoBtn.addEventListener('click', function () {
            if (photoState.newUrl) { URL.revokeObjectURL(photoState.newUrl); photoState.newUrl = null; }
            photoState.newBlob = null;
            photoState.removed = true;
            clearPhotoPreview();
            markDirty();
          });
        }

        // 草稿清空按钮
        var discardBtn = sheet.querySelector('[data-discard-draft]');
        if (discardBtn) {
          discardBtn.addEventListener('click', function () {
            T.clearDraft();
            nameInput.value = options.presetName || '';
            amountInput.value = '';
            sheet.querySelector('#rec-gift').value = '';
            sheet.querySelector('#rec-gift-value').value = '';
            sheet.querySelector('#rec-note').value = '';
            var banner = sheet.querySelector('.draft-banner');
            if (banner) banner.remove();
            updateQuickAmount();
            T.toast('草稿已清空');
          });
        }

        // 任何输入都标记为脏并自动存草稿
        form.addEventListener('input', function (e) {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') markDirty();
        });
        form.addEventListener('change', function () { markDirty(); });

        function validate() {
          clearErrors();
          var ok = true;
          var name = nameInput.value.trim();
          if (!name) {
            setError(sheet.querySelector('#field-name'), nameError, '请填写宾客姓名');
            nameInput.focus();
            ok = false;
          }
          var amount = T.num(amountInput.value);
          var gift = sheet.querySelector('#rec-gift').value.trim();
          var giftVal = T.num(sheet.querySelector('#rec-gift-value').value);
          if (!(amount > 0) && !gift && !(giftVal > 0)) {
            setError(sheet.querySelector('#field-amount'), amountError, '请填写礼金金额，或至少填写礼品');
            if (ok) amountInput.focus();
            ok = false;
          }
          return ok;
        }

        async function saveRecord(continueAfter) {
          if (saving) return;
          if (!validate()) return;
          saving = true;
          var submitBtn = sheet.querySelector('#save-record');
          var continueBtn = sheet.querySelector('#save-continue');
          if (submitBtn) submitBtn.disabled = true;
          if (continueBtn) continueBtn.disabled = true;
          try {
            var photoId = photoState.existingId;
            if (photoState.removed) photoId = null;
            if (photoState.newBlob) {
              T.showLoading('正在保存照片…');
              try {
                var stored = await T.storePhoto(photoState.newBlob);
                photoId = stored.id;
              } catch (err) {
                console.error(err);
                photoId = null;
                T.toast('照片保存失败，礼金记录将继续保存', 'error', 3800);
              } finally {
                T.hideLoading();
              }
            }
            var data = {
              bookId: book.id,
              name: nameInput.value.trim(),
              relation: currentRelation(),
              amount: T.num(amountInput.value),
              gift: sheet.querySelector('#rec-gift').value.trim(),
              giftValue: T.num(sheet.querySelector('#rec-gift-value').value),
              note: sheet.querySelector('#rec-note').value.trim(),
              attended: state.attended,
              returned: state.returned,
              thanked: state.thanked,
              returnGift: sheet.querySelector('#rec-return-gift').value.trim(),
              returnAmount: T.num(sheet.querySelector('#rec-return-amount').value),
              returnDate: sheet.querySelector('#rec-return-date').value,
              remindReturnAt: sheet.querySelector('#rec-remind-return').value,
              remindThankAt: sheet.querySelector('#rec-remind-thank').value,
              date: sheet.querySelector('#rec-date').value || T.todayISO(),
              photoId: photoId
            };
            if (existing) {
              T.updateRecord(existing.id, data);
              dirty = false;
              saving = false;
              T.clearDraft();
              T.closeOverlay();
              T.renderApp();
              T.toast('礼金记录已更新', 'success');
              return;
            }
            var rec = T.addRecord(data);
            dirty = false;
            T.clearDraft();
            if (continueAfter) {
              T.toast('已保存「' + rec.name + '」' + T.money(rec.amount) + '，继续登记下一位', 'success', 2300);
              if (photoState.newUrl) { URL.revokeObjectURL(photoState.newUrl); photoState.newUrl = null; }
              photoState.newBlob = null;
              photoState.removed = false;
              photoState.existingId = null;
              nameInput.value = '';
              amountInput.value = '';
              sheet.querySelector('#rec-gift').value = '';
              sheet.querySelector('#rec-gift-value').value = '';
              sheet.querySelector('#rec-note').value = '';
              sheet.querySelector('#rec-return-gift').value = '';
              sheet.querySelector('#rec-return-amount').value = '';
              sheet.querySelector('#rec-return-date').value = '';
              sheet.querySelector('#rec-remind-return').value = '';
              sheet.querySelector('#rec-remind-thank').value = '';
              state.returned = false;
              state.thanked = false;
              var rb = sheet.querySelector('[data-state-toggle="returned"]');
              var tb = sheet.querySelector('[data-state-toggle="thanked"]');
              if (rb) { rb.classList.remove('on'); rb.setAttribute('aria-checked', 'false'); }
              if (tb) { tb.classList.remove('on'); tb.setAttribute('aria-checked', 'false'); }
              var rf = sheet.querySelector('#return-fields');
              if (rf) rf.hidden = true;
              clearPhotoPreview();
              updateQuickAmount();
              sheet.querySelector('#draft-status').textContent = '已保存 · 草稿已清除';
              nameInput.focus();
              sheet.scrollTop = 0;
              return;
            }
            saving = false;
            T.closeOverlay();
            T.renderApp();
            T.toast('礼金已保存', 'success');
          } catch (err) {
            console.error(err);
            T.toast('保存失败：' + (err && err.message ? err.message : '请重试'), 'error', 4200);
          } finally {
            saving = false;
            if (submitBtn) submitBtn.disabled = false;
            if (continueBtn) continueBtn.disabled = false;
          }
        }

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          saveRecord(false);
        });
        var continueBtn = sheet.querySelector('#save-continue');
        if (continueBtn) continueBtn.addEventListener('click', function () { saveRecord(true); });
      }
    });
  }

  function toggleHtml(key, title, desc, on) {
    return '<div class="toggle-row"><div class="toggle-copy"><b>' + title + '</b><p>' + desc + '</p></div>' +
      '<button type="button" class="switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-state-toggle="' + key + '" aria-label="' + title + '"></button></div>';
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'record-search') {
      ui.search = e.target.value;
      ui.recordLimit = 60;
      ui.selected = new Set();
      updateRecordsResults();
    }
  });

  T.registerAction('add-record', function () {
    if (!T.getActiveBook()) {
      T.toast('请先创建一本礼簿');
      T.openBookForm();
      return;
    }
    openRecordForm(null);
  });
  T.registerAction('record-open', function (el) {
    var id = el.getAttribute('data-record-id');
    if (!id) return;
    if (ui.batchMode) {
      toggleSelect(id);
      return;
    }
    openRecordDetail(id);
  });
  T.registerAction('record-edit', function (el) {
    var id = el.getAttribute('data-record-id') || el.getAttribute('data-id');
    if (id) openRecordForm(id);
  });
  T.registerAction('record-delete', function (el) {
    var id = el.getAttribute('data-record-id') || el.getAttribute('data-id');
    if (id) deleteRecordFlow(id);
  });
  T.registerAction('record-flag', function (el) {
    var id = el.getAttribute('data-id');
    var flag = el.getAttribute('data-flag');
    var r = T.getRecord(id);
    if (!r || !flag) return;
    T.toggleRecordFlag(id, flag, !r[flag]);
    T.renderApp();
    if (ui.overlayOpen) openRecordDetail(id);
    T.toast(!r[flag] ? '已取消标记' : '已标记', 'success', 1500);
  });
  T.registerAction('filter', function (el) {
    var f = el.getAttribute('data-filter');
    if (!f) return;
    ui.listFilter = f;
    ui.recordLimit = 60;
    ui.selected = new Set();
    T.renderApp();
  });
  T.registerAction('clear-filters', function () {
    ui.search = '';
    ui.listFilter = 'all';
    ui.listRelation = '';
    ui.listSort = 'newest';
    ui.recordLimit = 60;
    ui.selected = new Set();
    T.renderApp();
  });
  T.registerAction('clear-record-search', function () {
    ui.search = '';
    var input = document.getElementById('record-search');
    if (input) input.value = '';
    updateRecordsResults();
  });
  T.registerAction('open-filter', function () { openFilterSheet(); });
  T.registerAction('load-more', function () {
    ui.recordLimit += 60;
    updateRecordsResults();
  });
  T.registerAction('toggle-batch', function () {
    if (!ui.batchMode) {
      if (!filteredRecords().length) { T.toast('本场还没有可以批量操作的记录'); return; }
      ui.batchMode = true;
      ui.selected = new Set();
    } else {
      ui.batchMode = false;
      ui.selected = new Set();
    }
    T.renderApp();
  });
  T.registerAction('batch-select-all', function () {
    var all = filteredRecords().map(function (r) { return r.id; });
    if (ui.selected.size >= all.length && all.length) ui.selected = new Set();
    else ui.selected = new Set(all);
    syncSelectionUI();
  });
  T.registerAction('batch-mark-return', function () {
    var ids = Array.from(ui.selected);
    if (!ids.length) { T.toast('请先勾选礼金记录'); return; }
    T.batchUpdateRecords(ids, { returned: true });
    clearBatch();
    T.renderApp();
    T.toast('已标记 ' + ids.length + ' 笔为已回礼', 'success');
  });
  T.registerAction('batch-mark-thank', function () {
    var ids = Array.from(ui.selected);
    if (!ids.length) { T.toast('请先勾选礼金记录'); return; }
    T.batchUpdateRecords(ids, { thanked: true });
    clearBatch();
    T.renderApp();
    T.toast('已标记 ' + ids.length + ' 笔为已答谢', 'success');
  });
  T.registerAction('batch-more', function () { openBatchMore(); });

  T.openRecordForm = openRecordForm;
  T.openRecordDetail = openRecordDetail;
})();
