/* 泰合礼 THL 礼金簿 — 设置页 */
(function () {
  'use strict';
  var T = window.THL;
  var ui = T.ui;

  T.views.settings = function () {
    var s = T.state.settings;
    var lock = s.lock || {};
    var currentCode = s.currencyCode || 'CNY';
    if (!T.CURRENCIES.some(function (c) { return c.code === currentCode; })) currentCode = 'CUSTOM';
    var themeHtml = T.THEMES.map(function (th) {
      return '<button class="theme-option' + (s.theme === th.id ? ' active' : '') + '" data-action="set-theme" data-theme="' + th.id + '" type="button">' +
        '<span class="theme-preview ' + (th.id === 'light' ? 'light' : (th.id === 'dark' ? 'dark' : '')) + '"></span>' +
        '<b>' + th.name + '</b><span>' + th.desc + '</span><span class="check-mark">' + T.icon('check') + '</span></button>';
    }).join('');
    var currencyOptions = T.CURRENCIES.map(function (c) {
      return '<option value="' + c.code + '"' + (currentCode === c.code ? ' selected' : '') + '>' + T.esc(c.label || ('自定义')) + '</option>';
    }).join('');
    var bookRows = T.state.books.length ? T.state.books.map(function (b) {
      var st = T.calcStats(b.id);
      return '<div class="book-manage-item' + (b.id === T.state.activeBookId ? ' active' : '') + '">' +
        '<span class="book-pick-glyph" style="width:35px;height:35px;font-size:.96rem">' + T.esc(T.bookGlyph(b.type)) + '</span>' +
        '<div class="book-manage-copy"><b>' + T.esc(b.title) + '</b><span>' + (b.id === T.state.activeBookId ? '当前 · ' : '') + T.esc((b.type || '喜事') + ' · ' + T.fmtDate(b.date) + ' · ' + st.count + ' 笔 · ' + T.money(st.cash)) + '</span></div>' +
        '<div class="book-manage-actions">' +
        '<button type="button" data-action="book-edit" data-id="' + T.esc(b.id) + '" title="编辑">' + T.icon('edit') + '</button>' +
        '<button type="button" data-action="book-clear" data-id="' + T.esc(b.id) + '" title="清空礼金">清空</button>' +
        '<button type="button" class="danger" data-action="book-delete" data-id="' + T.esc(b.id) + '" title="删除礼簿">' + T.icon('trash') + '</button>' +
        '</div></div>';
    }).join('') : '<div class="mini-empty">还没有礼簿，先创建一本吧</div>';
    var quickAmounts = (s.quickAmounts || []).join(', ');
    var notifyPermission = ('Notification' in window) ? Notification.permission : 'unsupported';
    var notifyLabel = notifyPermission === 'unsupported' ? '浏览器不支持' : (notifyPermission === 'granted' && s.notifications ? '已开启' : (notifyPermission === 'denied' ? '已被系统拒绝' : '未开启'));
    var installed = T.isStandalone();
    var pinStatus = lock.enabled ? '已开启 · ' + (lock.autoLockMinutes === 0 ? '离开即锁定' : lock.autoLockMinutes + ' 分钟自动锁定') : '未设置';
    var autoLockOptions = [
      { v: 0, l: '离开立即锁定' },
      { v: 1, l: '1 分钟' },
      { v: 5, l: '5 分钟' },
      { v: 15, l: '15 分钟' },
      { v: 30, l: '30 分钟' },
      { v: 60, l: '60 分钟' }
    ];
    var autoLockHtml = autoLockOptions.map(function (o) {
      return '<option value="' + o.v + '"' + (Number(lock.autoLockMinutes) === o.v ? ' selected' : '') + '>' + o.l + '</option>';
    }).join('');
    var dataUsage = T.state.books.length + ' 本礼簿 · ' + T.state.records.length + ' 笔礼金 · ' + T.state.guests.length + ' 位宾客';

    return '<div class="page page-tight settings-page">' +
      '<div class="settings-profile"><img src="assets/icon-192.png" alt="泰合礼"><div><h2>泰合礼</h2><p>泰然存礼，和合记情 · ' + T.esc(s.operator || '我') + '</p></div><span class="version">v' + T.VERSION + '</span></div>' +

      '<section class="settings-section"><div class="settings-head">' + T.icon('palette') + '<h3>外观与易用</h3><span class="hint">长辈模式更清晰</span></div>' +
      '<div class="theme-options">' + themeHtml + '</div>' +
      '<div class="setting-row"><div class="setting-copy"><b>大字号显示</b><p>放大文字与按钮，长辈查看更省力</p></div><button class="switch' + (s.largeText ? ' on' : '') + '" data-action="toggle-large" role="switch" aria-checked="' + (s.largeText ? 'true' : 'false') + '" aria-label="大字号显示"></button></div>' +
      '<div class="setting-row"><div class="setting-copy"><b>货币单位</b><p>用于礼金金额显示与导出</p></div><div class="setting-control"><select class="select" id="currency-select" aria-label="货币单位">' + currencyOptions + '</select></div></div>' +
      (currentCode === 'CUSTOM' ? '<div class="setting-row"><div class="setting-copy"><b>自定义货币符号</b><p>最多 4 个字符，如“两”“文”</p></div><input class="input slim" id="custom-currency-input" maxlength="4" value="' + T.esc(s.currency) + '" aria-label="自定义货币符号"></div>' : '') +
      '<div class="setting-row"><div class="setting-copy"><b>记账人</b><p>操作日志与导出中的登记人</p></div><input class="input slim" id="operator-input" maxlength="20" value="' + T.esc(s.operator) + '" aria-label="记账人"></div>' +
      '</section>' +

      '<section class="settings-section" id="book-manage-section"><div class="settings-head">' + T.icon('book') + '<h3>礼簿管理</h3><span class="hint">共 ' + T.state.books.length + ' 本</span></div>' +
      '<div class="book-manage-list">' + bookRows + '<button class="add-book-inline" type="button" data-action="open-book-form">' + T.icon('plus') + ' 新建礼簿</button></div>' +
      '<p class="field-hint" style="padding:0 15px 13px">清空礼金会保留礼簿与宾客档案；删除会移除整本礼簿。删除前会自动建立恢复点。</p>' +
      '</section>' +

      '<section class="settings-section"><div class="settings-head">' + T.icon('sliders') + '<h3>记账偏好</h3><span class="hint">按您的习惯来</span></div>' +
      '<form data-form="quick-amounts" class="quick-amounts-edit"><label class="field-label" for="quick-amounts-input">快捷金额</label><input class="input" id="quick-amounts-input" value="' + T.esc(quickAmounts) + '" placeholder="200, 500, 800, 1000"><p class="field-hint">用逗号分隔，登记礼金时可一键点选。</p><div class="form-line"><button class="btn btn-secondary btn-sm" type="submit">保存快捷金额</button><button class="btn btn-ghost btn-sm" type="button" data-action="reset-quick-amounts">恢复默认</button></div></form>' +
      '<div class="tag-manage">' +
      renderTagManager('relation', '关系分类', s.relationTags) +
      renderTagManager('event', '喜事类型', s.eventTypes) +
      '</div></section>' +

      '<section class="settings-section"><div class="settings-head">' + T.icon('shield') + '<h3>隐私与提醒</h3></div>' +
      '<button class="setting-row tappable" type="button" data-action="open-lock-settings"><span class="setting-copy"><b>密码锁</b><p>' + T.esc(pinStatus) + '</p></span><span class="value">' + (lock.enabled ? '管理' : '设置') + T.icon('chevron-right') + '</span></button>' +
      (lock.enabled ? '<div class="setting-row"><div class="setting-copy"><b>自动锁定</b><p>离开或闲置一段时间后重新输入锁码</p></div><div class="setting-control"><select class="select" id="auto-lock-select" aria-label="自动锁定时间">' + autoLockHtml + '</select></div></div>' : '') +
      (lock.enabled ? '<button class="setting-row tappable" type="button" data-action="lock-now"><span class="setting-copy"><b>立即锁定</b><p>马上隐藏本机账目</p></span><span class="value">' + T.icon('lock') + '锁定</span></button>' : '') +
      '<button class="setting-row tappable" type="button" data-action="enable-notifications"><span class="setting-copy"><b>系统通知</b><p>打开 App 时提醒今日回礼与答谢</p></span><span class="value">' + notifyLabel + T.icon('chevron-right') + '</span></button>' +
      '<div class="setting-row"><div class="setting-copy"><b>隐私说明</b><p>密码锁只保护界面，数据仍保存在本机。请定期导出备份。</p></div></div>' +
      '</section>' +

      '<section class="settings-section"><div class="settings-head">' + T.icon('database') + '<h3>数据安全</h3><span class="hint">' + dataUsage + '</span></div>' +
      '<button class="setting-row tappable" type="button" data-action="export-backup"><span class="setting-copy"><b>导出完整备份（JSON）</b><p>包含礼簿、礼金、宾客、人情、日志与照片</p></span><span class="value">' + T.icon('download') + '</span></button>' +
      '<button class="setting-row tappable" type="button" data-action="restore-backup"><span class="setting-copy"><b>从备份恢复</b><p>覆盖本机数据前会自动建立恢复点</p></span><span class="value">' + T.icon('upload') + '</span></button>' +
      '<button class="setting-row tappable" type="button" data-action="open-snapshots"><span class="setting-copy"><b>自动恢复点</b><p>保留最近 8 个关键操作恢复点（不含照片）</p></span><span class="value">' + T.icon('refresh') + '</span></button>' +
      '<button class="setting-row tappable" type="button" data-action="import-excel"><span class="setting-copy"><b>从 Excel / CSV 导入</b><p>批量导入旧礼单，支持表头识别</p></span><span class="value">' + T.icon('file-spreadsheet') + '</span></button>' +
      '<button class="setting-row tappable" type="button" data-action="download-template"><span class="setting-copy"><b>下载导入模板</b><p>Excel 模板含示例与填写说明</p></span><span class="value">' + T.icon('file-text') + '</span></button>' +
      '<button class="setting-row tappable" type="button" data-action="open-logs"><span class="setting-copy"><b>操作日志</b><p>新增、修改、删除和批量操作都有记录</p></span><span class="value">' + T.icon('clock') + '</span></button>' +
      '<button class="setting-row tappable" type="button" data-action="reset-all-data"><span class="setting-copy"><b style="color:var(--danger)">清空全部数据</b><p>删除全部礼簿、礼金、照片和恢复点</p></span><span class="value" style="color:var(--danger)">' + T.icon('trash') + '</span></button>' +
      '</section>' +

      '<section class="settings-section"><div class="settings-head">' + T.icon('info') + '<h3>关于泰合礼</h3></div>' +
      '<div class="about-card"><img class="about-logo" src="assets/icon-512.png" alt="泰合礼标志"><div class="about-brand">泰合礼</div><p class="about-slogan">泰然存礼，和合记情</p><p class="about-meta">THL GIFT LEDGER · v' + T.VERSION + '<br>喜事礼金 · 人情往来 · 本地优先</p>' +
      '<div class="about-feature-chips"><span>多场次礼簿</span><span>人情双向账</span><span>Excel / 打印</span><span>密码锁</span><span>离线可用</span></div>' +
      '<div class="about-actions"><button class="btn btn-secondary" type="button" data-action="open-install">' + T.icon(installed ? 'check-circle' : 'download') + (installed ? ' 已安装到主屏幕' : ' 安装到手机主屏幕') + '</button>' +
      '<button class="btn btn-ghost" type="button" data-action="show-about-privacy">' + T.icon('shield') + ' 隐私与数据说明</button></div>' +
      '<div class="about-privacy">' + T.icon('lock') + '<span>所有账目默认只保存在本机浏览器。泰合礼没有账号系统、不会上传礼金数据，也无需联网。请定期通过“导出完整备份”留存一份文件。</span></div>' +
      '</div></section>' +

      '<footer class="settings-foot">泰合礼 THL · 一纸礼簿，记一生情分<br>愿每一份心意，都被温柔记住。</footer>' +
      '</div>';
  };

  function renderTagManager(kind, label, values) {
    var key = kind === 'relation' ? 'relation' : 'event';
    return '<div class="tag-manage-group"><div class="tag-manage-label"><span>' + label + '</span><span>点 × 删除</span></div><div class="tag-list">' +
      values.map(function (v) {
        return '<span class="tag-edit-chip">' + T.esc(v) + '<button type="button" data-action="remove-setting-tag" data-kind="' + key + '" data-value="' + T.esc(v) + '" aria-label="删除 ' + T.esc(v) + '">' + T.icon('close') + '</button></span>';
      }).join('') + '</div>' +
      '<form class="tag-add-form" data-form="add-setting-tag" data-kind="' + key + '"><input class="input" name="tag" maxlength="' + (key === 'relation' ? 8 : 12) + '" placeholder="新增' + label + '" aria-label="新增' + label + '"><button class="btn btn-secondary" type="submit">添加</button></form></div>';
  }

  function rerenderAtCurrentScroll() {
    var y = window.scrollY;
    T.renderApp();
    requestAnimationFrame(function () { window.scrollTo({ top: y, behavior: 'auto' }); });
  }

  function setTheme(theme) {
    if (['red', 'light', 'dark'].indexOf(theme) < 0) return;
    T.state.settings.theme = theme;
    T.save();
    T.applySettings();
    rerenderAtCurrentScroll();
    T.toast('已切换为' + (T.THEMES.filter(function (x) { return x.id === theme; })[0] || {}).name, 'success', 1600);
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'currency-select') {
      var code = t.value;
      T.state.settings.currencyCode = code;
      var preset = T.CURRENCIES.filter(function (c) { return c.code === code; })[0];
      if (preset && code !== 'CUSTOM') T.state.settings.currency = preset.symbol;
      T.save();
      T.applySettings();
      rerenderAtCurrentScroll();
      T.toast('货币单位已更新', 'success', 1600);
    } else if (t.id === 'custom-currency-input') {
      T.state.settings.currency = t.value.trim().slice(0, 4) || '¥';
      T.state.settings.currencyCode = 'CUSTOM';
      T.save();
      rerenderAtCurrentScroll();
      T.toast('货币符号已更新', 'success', 1600);
    } else if (t.id === 'operator-input') {
      T.state.settings.operator = t.value.trim().slice(0, 20) || '我';
      T.save();
      T.toast('记账人已保存', 'success', 1500);
    } else if (t.id === 'auto-lock-select') {
      var mins = T.num(t.value);
      T.state.settings.lock.autoLockMinutes = mins;
      T.save();
      rerenderAtCurrentScroll();
      T.toast('自动锁定已更新', 'success', 1600);
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.getAttribute) return;
    if (form.getAttribute('data-form') === 'quick-amounts') {
      e.preventDefault();
      var input = form.querySelector('#quick-amounts-input');
      var values = String(input ? input.value : '').split(/[,，\s]+/).map(function (v) { return T.num(v); }).filter(function (v) { return v > 0; });
      values = values.filter(function (v, i, arr) { return arr.indexOf(v) === i; }).slice(0, 12);
      if (!values.length) { T.toast('请至少填写一个快捷金额', 'error'); return; }
      T.state.settings.quickAmounts = values;
      T.save();
      rerenderAtCurrentScroll();
      T.toast('快捷金额已保存', 'success');
    } else if (form.getAttribute('data-form') === 'add-setting-tag') {
      e.preventDefault();
      var kind = form.getAttribute('data-kind');
      var tagInput = form.querySelector('input[name="tag"]');
      var val = tagInput ? tagInput.value.trim() : '';
      if (!val) { T.toast('请输入标签名称', 'error'); return; }
      var listKey = kind === 'relation' ? 'relationTags' : 'eventTypes';
      var list = T.state.settings[listKey];
      if (list.indexOf(val) >= 0) { T.toast('这个标签已经存在'); return; }
      if (list.length >= 24) { T.toast('标签最多添加 24 个', 'error'); return; }
      list.push(val);
      T.save();
      rerenderAtCurrentScroll();
      T.toast('已添加「' + val + '」', 'success', 1600);
    }
  });

  T.registerAction('set-theme', function (el) {
    setTheme(el.getAttribute('data-theme'));
  });
  T.registerAction('toggle-large', function () {
    T.state.settings.largeText = !T.state.settings.largeText;
    T.save();
    T.applySettings();
    rerenderAtCurrentScroll();
    T.toast(T.state.settings.largeText ? '已开启大字号' : '已恢复标准字号', 'success', 1600);
  });
  T.registerAction('remove-setting-tag', function (el) {
    var kind = el.getAttribute('data-kind');
    var value = el.getAttribute('data-value');
    var key = kind === 'relation' ? 'relationTags' : 'eventTypes';
    var list = T.state.settings[key];
    if (list.length <= 1) { T.toast('至少保留一个标签', 'error'); return; }
    T.state.settings[key] = list.filter(function (x) { return x !== value; });
    T.save();
    rerenderAtCurrentScroll();
    T.toast('已删除标签「' + value + '」', 'success', 1600);
  });
  T.registerAction('reset-quick-amounts', function () {
    T.state.settings.quickAmounts = T.DEFAULT_QUICK_AMOUNTS.slice();
    T.save();
    rerenderAtCurrentScroll();
    T.toast('已恢复默认快捷金额', 'success');
  });
})();
