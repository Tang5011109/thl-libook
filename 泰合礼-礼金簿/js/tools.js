/* 泰合礼 THL 礼金簿 — 导出、导入、备份、锁码与安装 */
(function () {
  'use strict';
  var T = window.THL;
  var ui = T.ui;

  function activeBook() {
    var b = T.getActiveBook();
    if (!b) T.toast('请先创建一本礼簿', 'error');
    return b;
  }

  function pickFile(accept) {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      var done = false;
      function finish(file) {
        if (done) return;
        done = true;
        setTimeout(function () { if (input.parentNode) input.parentNode.removeChild(input); }, 500);
        resolve(file || null);
      }
      input.addEventListener('change', function () { finish(input.files && input.files[0]); });
      input.addEventListener('cancel', function () { finish(null); });
      input.click();
    });
  }

  /* ---------------- 导出与分享 ---------------- */
  function openExportSheet() {
    var book = activeBook();
    if (!book) return;
    var stats = T.calcStats(book.id);
    var html = '<div class="sheet-head"><div class="head-copy"><p class="eyebrow">EXPORT & SHARE</p><h2>导出与分享</h2><p class="sub">' + T.esc(book.title) + ' · ' + stats.count + ' 笔</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="export-options">' +
      exportOption('export-excel', 'file-spreadsheet', 'Excel 礼金明细', '生成 .xlsx，包含明细和统计汇总，可用电脑修改打印', 'green') +
      exportOption('export-images', 'image', '图片礼单', '生成清晰的长图礼单，适合直接发微信或保存', 'red') +
      exportOption('export-print', 'print', '打印礼簿', '传统竖版 / 现代横版两种 A4 模板，可打印或存为 PDF', 'blue') +
      exportOption('export-readonly', 'file-text', '只读分享网页', '生成家人可查看、无法修改的离线礼簿页面', 'gold') +
      '</div>' +
      '<div class="export-note">' + T.icon('shield') + '<span>所有文件都在您的手机上即时生成，不会上传到服务器。Excel 与图片可直接通过微信发送；只读网页请作为文件发送给家人。</span></div>' +
      '</div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>关闭</button></div>';
    T.openOverlay(html, { label: '导出与分享', sheetClass: 'small-sheet' });
  }

  function exportOption(action, icon, title, desc, color) {
    return '<button type="button" class="export-option" data-action="' + action + '"><span class="eo-ico ' + color + '">' + T.icon(icon) + '</span><span class="eo-copy"><b>' + title + '</b><p>' + desc + '</p></span>' + T.icon('chevron-right', 'chev') + '</button>';
  }

  T.registerAction('open-export', openExportSheet);

  T.registerAction('export-excel', function () {
    var book = activeBook();
    if (!book) return;
    var records = T.recordsOfBook(book.id);
    try {
      var name = T.exportBookExcel(book, records);
      T.toast('Excel 已生成：' + name, 'success', 3500);
    } catch (err) {
      console.error(err);
      T.toast('Excel 生成失败，请重试', 'error');
    }
  });

  /* 打印预览（使用 iframe，避免 App 样式干扰打印） */
  T.openPrintPreview = function (book, records, template) {
    if (!book) return;
    var current = template === 'modern' ? 'modern' : 'traditional';
    var html = T.buildPrintHtml(book, records || T.recordsOfBook(book.id), current);
    var inner = '<div class="sheet-head"><div class="head-copy"><p class="eyebrow">PRINT PREVIEW</p><h2>打印礼簿</h2><p class="sub">' + T.esc(book.title) + '</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="print-toolbar"><div class="segmented compact" id="print-template-switch">' +
      '<button type="button" data-print-template="traditional" class="' + (current === 'traditional' ? 'active' : '') + '">传统竖版</button>' +
      '<button type="button" data-print-template="modern" class="' + (current === 'modern' ? 'active' : '') + '">现代横版</button></div>' +
      '<button class="btn btn-secondary btn-sm print-window-btn" type="button" data-print-window aria-label="在新窗口打开打印页" title="在新窗口打开">' + T.icon('external') + '</button>' +
      '<button class="btn btn-primary btn-sm" type="button" data-print-now>' + T.icon('print') + ' 打印 / 存为 PDF</button></div>' +
      '<div class="print-frame-wrap"><iframe class="print-frame" id="print-frame" title="打印预览" srcdoc="' + T.esc(html) + '"></iframe></div>' +
      '<p class="print-hint">提示：在浏览器打印面板中选择「另存为 PDF」即可保存电子版。传统竖版建议 A4 纵向，现代横版建议 A4 横向；如预览为空白，请点“打印”后重试。</p>';
    T.openOverlay(inner, {
      sheetClass: 'print-modal',
      overlayClass: 'print-overlay',
      label: '打印礼簿',
      scrollTop: false,
      onMount: function (sheet) {
        var frame = sheet.querySelector('#print-frame');
        sheet.querySelector('#print-template-switch').addEventListener('click', function (e) {
          var btn = e.target.closest('[data-print-template]');
          if (!btn) return;
          current = btn.getAttribute('data-print-template');
          frame.srcdoc = T.buildPrintHtml(book, records || T.recordsOfBook(book.id), current);
          sheet.querySelectorAll('[data-print-template]').forEach(function (b) { b.classList.toggle('active', b === btn); });
        });
        sheet.querySelector('[data-print-window]').addEventListener('click', function () {
          var blob = new Blob([T.buildPrintHtml(book, records || T.recordsOfBook(book.id), current)], { type: 'text/html;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        });
        sheet.querySelector('[data-print-now]').addEventListener('click', function () {
          try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
          } catch (err) {
            console.error(err);
            try {
              var blob = new Blob([T.buildPrintHtml(book, records || T.recordsOfBook(book.id), current)], { type: 'text/html;charset=utf-8' });
              var url = URL.createObjectURL(blob);
              window.open(url, '_blank');
              setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
              T.toast('已在新窗口打开打印页', 'info');
            } catch (e2) {
              T.toast('当前环境无法调起打印，请使用安卓 Chrome 打开', 'error');
            }
          }
        });
      }
    });
  };

  T.registerAction('export-print', function () {
    var book = activeBook();
    if (!book) return;
    T.openPrintPreview(book, T.recordsOfBook(book.id), 'traditional');
  });

  /* 图片礼单 */
  async function showGiftImages() {
    var book = activeBook();
    if (!book) return;
    var records = T.recordsOfBook(book.id);
    T.showLoading('正在生成高清图片礼单…');
    try {
      var pages = await T.generateGiftImages(book, records);
      T.hideLoading();
      var previews = pages.map(function (p, i) {
        return '<div class="image-preview-item"><img src="' + p.url + '" alt="礼单第' + (i + 1) + '页"><div class="caption"><span>第 ' + (i + 1) + ' / ' + pages.length + ' 页 · ' + p.name + '</span><a href="' + p.url + '" download="' + T.esc(p.name) + '">保存本页</a></div></div>';
      }).join('');
      var inner = '<div class="sheet-head"><div class="head-copy"><p class="eyebrow">GIFT LIST IMAGE</p><h2>图片礼单</h2><p class="sub">共 ' + pages.length + ' 张 · 适合发微信</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
        '<div class="sheet-body"><div class="image-preview-list">' + previews + '</div><div class="export-note" style="margin-top:12px">' + T.icon('info') + '<span>图片已排版并包含本场统计。建议点击“分享到微信”直接调起系统分享；也可长按图片保存。</span></div></div>' +
        '<div class="sheet-footer"><button class="btn btn-ghost" type="button" id="save-all-images">保存全部</button><button class="btn btn-primary primary-wide" type="button" id="share-images">' + T.icon('share') + ' 分享到微信</button></div>';
      var urls = pages.map(function (p) { return p.url; });
      T.openOverlay(inner, {
        sheetClass: 'full-sheet',
        label: '图片礼单',
        onMount: function (sheet) {
          sheet.querySelector('#save-all-images').addEventListener('click', function () {
            pages.forEach(function (p, i) { setTimeout(function () { T.downloadBlob(p.blob, p.name); }, i * 320); });
            T.toast('正在保存 ' + pages.length + ' 张图片，请在下载目录查看', 'success', 3200);
          });
          sheet.querySelector('#share-images').addEventListener('click', async function () {
            var files = [];
            try {
              pages.forEach(function (p) { files.push(new File([p.blob], p.name, { type: 'image/png' })); });
            } catch (e) { files = []; }
            if (files.length && navigator.canShare && navigator.canShare({ files: files }) && navigator.share) {
              try {
                await navigator.share({ files: files, title: '泰合礼 · ' + book.title });
                return;
              } catch (err) {
                if (err && err.name === 'AbortError') return;
              }
            }
            pages.forEach(function (p, i) { setTimeout(function () { T.downloadBlob(p.blob, p.name); }, i * 320); });
            T.toast('当前浏览器不支持直接分享，已保存图片到手机', 'info', 3200);
          });
        },
        onClose: function () {
          urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } });
        }
      });
    } catch (err) {
      console.error(err);
      T.hideLoading();
      T.toast('图片生成失败：' + (err && err.message ? err.message : '请重试'), 'error', 4000);
    }
  }
  T.registerAction('export-images', showGiftImages);

  /* 只读分享 */
  T.registerAction('export-readonly', function () {
    var book = activeBook();
    if (!book) return;
    var result;
    try {
      result = T.exportReadonlyShare(book, T.recordsOfBook(book.id));
    } catch (err) {
      console.error(err);
      T.toast('只读礼簿生成失败', 'error');
      return;
    }
    var url = URL.createObjectURL(result.file);
    var sizeKb = Math.max(1, Math.round(result.file.size / 1024));
    var inner = '<div class="sheet-head"><div class="head-copy"><p class="eyebrow">READ-ONLY SHARE</p><h2>只读分享礼簿</h2><p class="sub">' + T.esc(book.title) + '</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="share-card"><div class="share-icon">' + T.icon('file-text') + '</div><h3>只读礼簿已生成</h3><p>这是一个独立的 HTML 文件，家人打开即可查看本场礼金与统计，页面没有编辑入口。文件约 ' + sizeKb + ' KB。</p>' +
      '<div class="button-row"><button class="btn btn-secondary" type="button" id="readonly-preview">预览</button><button class="btn btn-primary" type="button" id="readonly-share">' + T.icon('share') + ' 分享给家人</button></div>' +
      '<button class="btn btn-ghost btn-block" type="button" id="readonly-download" style="margin-top:8px">' + T.icon('download') + ' 保存只读礼簿文件</button></div>' +
      '<div class="readonly-info">' + T.icon('info') + ' 在微信中直接发送 HTML 文件后，家人点击文件用浏览器打开即可查看。若微信内无法打开，请选择“用其他应用打开”或先保存到手机文件。只读页面不含编辑功能，账目以导出时为准。</div></div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>关闭</button></div>';
    T.openOverlay(inner, {
      label: '只读分享',
      onMount: function (sheet) {
        var preview = sheet.querySelector('#readonly-preview');
        var share = sheet.querySelector('#readonly-share');
        var download = sheet.querySelector('#readonly-download');
        preview.addEventListener('click', function () { window.open(url, '_blank'); });
        download.addEventListener('click', function () {
          T.downloadBlob(result.file, result.name);
          T.toast('只读礼簿已保存', 'success');
        });
        share.addEventListener('click', async function () {
          try {
            if (navigator.canShare && navigator.canShare({ files: [result.file] }) && navigator.share) {
              await navigator.share({ files: [result.file], title: '泰合礼 · ' + book.title });
              return;
            }
          } catch (err) {
            if (err && err.name === 'AbortError') return;
          }
          T.downloadBlob(result.file, result.name);
          T.toast('已保存文件，请在微信中作为文件发送给家人', 'info', 3600);
        });
      },
      onClose: function () {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
      }
    });
  });

  /* ---------------- Excel 导入 ---------------- */
  T.registerAction('import-excel', async function () {
    if (!T.state.books.length) {
      T.toast('请先新建一本礼簿，再导入表格', 'error');
      T.openBookForm();
      return;
    }
    var file = await pickFile('.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv');
    if (!file) return;
    T.showLoading('正在读取表格…');
    var parsed;
    try {
      parsed = await T.parseImportFile(file);
    } catch (err) {
      console.error(err);
      T.hideLoading();
      T.toast(err && err.message ? err.message : '表格读取失败', 'error', 4600);
      return;
    }
    T.hideLoading();
    openImportPreview(parsed, file.name);
  });

  function openImportPreview(parsed, filename) {
    var records = parsed.records || [];
    var errors = parsed.errors || [];
    var rows = records.slice(0, 8).map(function (r) {
      return '<tr><td>' + T.esc(r.name) + '</td><td>' + T.esc(r.relation || '—') + '</td><td>' + T.esc(T.money(r.amount)) + '</td><td>' + T.esc(r.gift || '—') + '</td><td>' + T.esc(r.date) + '</td></tr>';
    }).join('');
    var bookOptions = T.state.books.map(function (b) {
      return '<option value="' + T.esc(b.id) + '"' + (b.id === T.state.activeBookId ? ' selected' : '') + '>' + T.esc(b.title) + '</option>';
    }).join('');
    var inner = '<div class="sheet-head"><div class="head-copy"><p class="eyebrow">IMPORT PREVIEW</p><h2>导入预览</h2><p class="sub">' + T.esc(filename) + ' · 工作表 ' + T.esc(parsed.sheetName || 'Sheet1') + '</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body">' +
      '<div class="import-target"><div class="import-target-label">导入到哪本礼簿？</div><select class="select" id="import-book-select">' + bookOptions + '</select></div>' +
      '<div class="import-summary"><div class="import-stat"><span>可导入</span><b>' + records.length + ' 笔</b></div><div class="import-stat"><span>跳过 / 错误</span><b>' + errors.length + ' 项</b></div><div class="import-stat"><span>表头</span><b>' + T.esc((parsed.headers || []).slice(0, 3).join(' / ') || '自动识别') + '</b></div></div>' +
      (records.length ? '<div style="overflow-x:auto"><table class="import-preview-table"><thead><tr><th>姓名</th><th>关系</th><th>礼金</th><th>礼品</th><th>日期</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="notice-strip">' + T.icon('alert-circle') + '<span>没有可导入的数据。请检查表格是否包含“姓名”和“礼金金额”列，或先下载标准模板。</span></div>') +
      (errors.length ? '<div class="import-errors">' + errors.slice(0, 6).map(function (e) { return T.esc(e); }).join('<br>') + (errors.length > 6 ? '<br>…另有 ' + (errors.length - 6) + ' 项' : '') + '</div>' : '') +
      '<p class="import-hint">支持 .xlsx 和 .csv；日期会自动转换为标准格式；“是/否”可识别为到场、回礼、答谢状态。导入不会自动去重，请避免重复导入同一份旧礼单。</p>' +
      '</div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>取消</button><button class="btn btn-primary primary-wide" type="button" id="do-import"' + (records.length ? '' : ' disabled') + '>导入 ' + records.length + ' 笔礼金</button></div>';
    T.openOverlay(inner, {
      label: '导入预览',
      sheetClass: 'small-sheet',
      onMount: function (sheet) {
        var btn = sheet.querySelector('#do-import');
        if (!btn) return;
        btn.addEventListener('click', async function () {
          var target = sheet.querySelector('#import-book-select').value;
          if (!target) { T.toast('请选择目标礼簿', 'error'); return; }
          btn.disabled = true;
          btn.textContent = '正在导入…';
          T.showLoading('正在导入礼金…');
          try {
            T.makeSnapshot('导入 Excel 前自动备份').catch(function () {});
            var count = T.importRecordsToBook(target, records);
            T.setActiveBook(target);
            T.hideLoading();
            T.closeOverlay();
            T.renderApp({ scrollTop: true });
            T.toast('已导入 ' + count + ' 笔礼金', 'success', 3000);
            setTimeout(function () { T.navigate('records', { scrollTop: true }); }, 300);
          } catch (err) {
            console.error(err);
            T.hideLoading();
            btn.disabled = false;
            btn.textContent = '导入 ' + records.length + ' 笔礼金';
            T.toast('导入失败：' + (err && err.message ? err.message : '请重试'), 'error');
          }
        });
      }
    });
  }

  T.registerAction('download-template', function () {
    try {
      var blob = T.buildTemplateXlsx();
      T.downloadBlob(blob, '泰合礼_礼金导入模板.xlsx');
      T.toast('Excel 导入模板已生成', 'success');
    } catch (err) {
      console.error(err);
      T.toast('模板生成失败', 'error');
    }
  });

  /* ---------------- 备份与恢复 ---------------- */
  T.registerAction('export-backup', async function () {
    var photos = 0;
    T.state.records.forEach(function (r) { if (r.photoId) photos++; });
    T.showLoading(photos ? '正在整理数据和照片…' : '正在生成备份…');
    try {
      var res = await T.exportBackup(true);
      T.hideLoading();
      T.toast('备份已生成：' + res.name + (res.photoCount ? '（含 ' + res.photoCount + ' 张照片）' : ''), 'success', 3600);
    } catch (err) {
      console.error(err);
      T.hideLoading();
      T.toast('备份生成失败：' + (err && err.message ? err.message : '请重试'), 'error');
    }
  });

  T.registerAction('restore-backup', async function () {
    var file = await pickFile('.json,application/json');
    if (!file) return;
    T.showLoading('正在读取备份…');
    var parsed;
    try {
      parsed = await T.parseBackupFile(file);
    } catch (err) {
      T.hideLoading();
      T.toast(err && err.message ? err.message : '备份文件读取失败', 'error', 4400);
      return;
    }
    T.hideLoading();
    var state = parsed.state;
    var totalRecords = state.records.length;
    var totalBooks = state.books.length;
    var totalGuests = state.guests.length;
    var html = '<div class="sheet-head"><div class="head-copy"><p class="eyebrow">RESTORE BACKUP</p><h2>恢复备份</h2><p class="sub">' + T.esc(file.name) + '</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="import-summary"><div class="import-stat"><span>礼簿</span><b>' + totalBooks + ' 本</b></div><div class="import-stat"><span>礼金记录</span><b>' + totalRecords + ' 笔</b></div><div class="import-stat"><span>照片</span><b>' + parsed.photoCount + ' 张</b></div></div>' +
      '<div class="detail-info" style="margin-top:2px"><div class="detail-info-row"><span class="label">备份时间</span><span class="val">' + T.esc(parsed.exportedAt ? T.fmtDateTime(parsed.exportedAt) : '未知') + '</span></div><div class="detail-info-row"><span class="label">数据内容</span><span class="val">' + totalBooks + ' 本礼簿、' + totalRecords + ' 笔礼金、' + totalGuests + ' 位宾客、' + state.outgoing.length + ' 笔随出</span></div><div class="detail-info-row"><span class="label">应用版本</span><span class="val">' + T.esc(parsed.version || '—') + '</span></div></div>' +
      '<div class="notice-strip">' + T.icon('alert-circle') + '<span>恢复会覆盖本机当前数据。系统会先自动建立一个恢复点，但备份中的照片仅在这份 JSON 中存在，请妥善保存文件。</span></div></div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>取消</button><button class="btn btn-primary primary-wide" type="button" id="confirm-restore">覆盖并恢复</button></div>';
    T.openOverlay(html, {
      label: '恢复备份',
      sheetClass: 'small-sheet',
      onMount: function (sheet) {
        sheet.querySelector('#confirm-restore').addEventListener('click', async function () {
          var ok = window.confirm('确定用备份覆盖本机数据吗？\n\n当前数据会先保存到恢复点（不含照片）。');
          if (!ok) return;
          T.showLoading('正在恢复数据与照片…');
          try {
            await T.restoreBackup(parsed);
            T.applySettings();
            T.hideLoading();
            T.closeOverlay();
            T.renderApp({ scrollTop: true });
            T.toast('备份恢复完成', 'success', 3000);
          } catch (err) {
            console.error(err);
            T.hideLoading();
            T.toast('恢复失败：' + (err && err.message ? err.message : '请检查文件'), 'error');
          }
        });
      }
    });
  });

  /* 恢复点 */
  T.registerAction('open-snapshots', async function () {
    T.showLoading('正在读取恢复点…');
    var list;
    try {
      list = await T.listSnapshots();
    } catch (e) {
      list = [];
    }
    T.hideLoading();
    var rows = list.length ? list.map(function (snap) {
      var st = snap.state || {};
      var counts = (st.books ? st.books.length : 0) + ' 本礼簿 · ' + (st.records ? st.records.length : 0) + ' 笔礼金';
      return '<div class="snapshot-row"><span class="snapshot-icon">' + T.icon('refresh') + '</span><div class="snapshot-main"><b>' + T.esc(snap.label || '恢复点') + '</b><p>' + T.esc(T.fmtDateTime(snap.at)) + ' · ' + counts + '</p></div><button class="btn btn-secondary" data-snapshot-restore="' + T.esc(snap.id) + '">恢复</button></div>';
    }).join('') : '<div class="mini-empty">还没有自动恢复点。每日首次打开或执行清空、删除、导入前会自动创建。</div>';
    var html = '<div class="sheet-head"><div class="head-copy"><p class="eyebrow">RECOVERY POINTS</p><h2>自动恢复点</h2><p class="sub">最近 8 个关键节点 · 不含照片</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="snapshot-row" style="border:1px solid var(--line);border-radius:12px;margin-bottom:12px"><span class="snapshot-icon">' + T.icon('shield') + '</span><div class="snapshot-main"><b>手动建立当前恢复点</b><p>在操作前留一个还原点</p></div><button class="btn btn-primary" id="create-snapshot">新建</button></div><div class="mini-list">' + rows + '</div>' +
      '<div class="notice-strip">' + T.icon('info') + '<span>恢复点只保存在本机浏览器中，不含红包照片。为了避免浏览器清理缓存造成丢失，仍建议定期导出完整 JSON 备份。</span></div></div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>关闭</button></div>';
    T.openOverlay(html, {
      label: '自动恢复点',
      sheetClass: 'small-sheet',
      onMount: function (sheet) {
        sheet.querySelector('#create-snapshot').addEventListener('click', async function () {
          T.showLoading('正在创建恢复点…');
          try {
            await T.makeSnapshot('手动恢复点');
            T.hideLoading();
            T.closeOverlay();
            T.toast('恢复点已创建', 'success');
            setTimeout(function () { T.actions['open-snapshots'](); }, 350);
          } catch (e) {
            T.hideLoading();
            T.toast('恢复点创建失败', 'error');
          }
        });
        sheet.querySelectorAll('[data-snapshot-restore]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            var id = btn.getAttribute('data-snapshot-restore');
            var snap = list.filter(function (s) { return s.id === id; })[0];
            if (!snap) return;
            var ok = window.confirm('恢复到 ' + T.fmtDateTime(snap.at) + ' 的状态？\n\n当前数据会先自动保存为新的恢复点。照片不在恢复点中，可能显示缺失。');
            if (!ok) return;
            T.showLoading('正在恢复…');
            try {
              await T.restoreSnapshotData(snap);
              T.applySettings();
              T.hideLoading();
              T.closeOverlay();
              T.renderApp({ scrollTop: true });
              T.toast('已恢复到所选时间点', 'success');
            } catch (e) {
              T.hideLoading();
              T.toast('恢复失败', 'error');
            }
          });
        });
      }
    });
  });

  /* 操作日志 */
  T.registerAction('open-logs', function () {
    var logs = T.state.logs.slice(0, 300);
    var rows = logs.length ? logs.map(function (l) {
      var book = l.bookId ? T.getBook(l.bookId) : null;
      return '<div class="log-row"><span class="log-dot"></span><div class="log-main"><b>' + T.esc(l.action) + '</b><p>' + T.esc(l.detail) + '</p><div class="log-meta"><span>' + T.esc(T.fmtDateTime(l.at)) + '</span><span>操作人：' + T.esc(l.operator || '我') + '</span>' + (book ? '<span>' + T.esc(book.title) + '</span>' : '') + '</div></div></div>';
    }).join('') : '<div class="mini-empty">还没有操作记录。新增、修改、删除礼金时会自动记录。</div>';
    T.openOverlay('<div class="sheet-head"><div class="head-copy"><p class="eyebrow">ACTIVITY LOG</p><h2>操作日志</h2><p class="sub">共 ' + T.state.logs.length + ' 条 · 显示最近 300 条</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="log-list">' + rows + '</div></div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>关闭</button>' + (logs.length ? '<button class="btn btn-danger" type="button" id="clear-logs">清空日志</button>' : '') + '</div>',
      {
        label: '操作日志',
        sheetClass: 'small-sheet',
        onMount: function (sheet) {
          var clear = sheet.querySelector('#clear-logs');
          if (clear) clear.addEventListener('click', function () {
            var ok = window.confirm('清空全部操作日志？账目数据不会受影响。');
            if (!ok) return;
            T.clearLogs();
            T.closeOverlay();
            T.renderApp();
            T.toast('操作日志已清空', 'success');
          });
        }
      });
  });

  /* ---------------- 密码锁管理 ---------------- */
  T.registerAction('open-lock-settings', function () {
    var lock = T.state.settings.lock;
    var enabled = !!(lock && lock.enabled);
    var inner = '<form id="lock-form" novalidate><div class="sheet-head"><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button><div class="head-copy"><p class="eyebrow">APP LOCK</p><h2>密码锁</h2><p class="sub">' + (enabled ? '管理本机访问锁码' : '4–8 位数字，保护礼金隐私') + '</p></div></div>' +
      '<div class="sheet-body">' +
      (enabled ? '<div class="notice-strip" style="margin-top:0">' + T.icon('shield') + '<span>锁码只保护界面访问，不会加密本机数据。请同时使用手机系统锁屏与定期备份。</span></div><div class="field" style="margin-top:12px"><label class="field-label" for="pin-current">当前锁码</label><input class="input" id="pin-current" type="password" inputmode="numeric" maxlength="8" autocomplete="current-password" placeholder="输入当前锁码" data-autofocus></div>' : '') +
      '<div class="field"' + (enabled ? '' : ' style="margin-top:2px"') + '><label class="field-label" for="pin-new">' + (enabled ? '新锁码' : '设置锁码') + '</label><input class="input" id="pin-new" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password" placeholder="4–8 位数字" ' + (enabled ? '' : 'data-autofocus') + '></div>' +
      '<div class="field"><label class="field-label" for="pin-confirm">确认' + (enabled ? '新锁码' : '锁码') + '</label><input class="input" id="pin-confirm" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password" placeholder="再次输入"></div>' +
      '<p class="form-foot-note" style="text-align:left">忘记锁码只能清除本机数据后重新使用，请先设置自己容易记住的数字。设置后下次打开 App 会要求输入锁码。</p>' +
      '</div><div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>取消</button>' + (enabled ? '<button class="btn btn-danger" type="button" id="disable-lock">关闭锁码</button>' : '') + '<button class="btn btn-primary primary-wide" type="submit">' + (enabled ? '更新锁码' : '开启锁码') + '</button></div></form>';
    T.openOverlay(inner, {
      sheetClass: 'full-sheet',
      label: '密码锁',
      onMount: function (sheet) {
        var currentEl = sheet.querySelector('#pin-current');
        var newEl = sheet.querySelector('#pin-new');
        var confirmEl = sheet.querySelector('#pin-confirm');
        sheet.querySelector('#lock-form').addEventListener('submit', async function (e) {
          e.preventDefault();
          var current = currentEl ? currentEl.value : '';
          var next = newEl.value;
          var confirm = confirmEl.value;
          if (!/^\d{4,8}$/.test(next)) { T.toast('新锁码需为 4–8 位数字', 'error'); newEl.focus(); return; }
          if (next !== confirm) { T.toast('两次输入的锁码不一致', 'error'); confirmEl.focus(); return; }
          if (enabled) {
            var ok = await T.verifyPIN(current);
            if (!ok) { T.toast('当前锁码不正确', 'error'); currentEl.focus(); return; }
          }
          T.setPIN(next);
          T.closeOverlay();
          T.renderApp();
          T.toast(enabled ? '锁码已更新' : '密码锁已开启', 'success');
        });
        var disable = sheet.querySelector('#disable-lock');
        if (disable) disable.addEventListener('click', async function () {
          var current = currentEl ? currentEl.value : '';
          if (!current) { T.toast('请先输入当前锁码', 'error'); currentEl.focus(); return; }
          var ok = await T.disablePIN(current);
          if (!ok) { T.toast('当前锁码不正确', 'error'); return; }
          T.closeOverlay();
          T.renderApp();
          T.toast('密码锁已关闭', 'success');
        });
      }
    });
  });

  T.registerAction('lock-now', function () {
    if (!T.state.settings.lock.enabled) { T.toast('请先设置密码锁'); return; }
    if (ui.overlayOpen) T.hideOverlayImmediately();
    T.lockApp();
  });

  /* ---------------- 清空与隐私 ---------------- */
  T.registerAction('reset-all-data', function () {
    var ok = window.confirm('这会永久删除本机的全部礼簿、礼金、宾客、人情记录、照片和恢复点。\n\n此操作无法撤销，建议先导出完整备份。\n\n确定清空全部数据吗？');
    if (!ok) return;
    var ok2 = window.confirm('再次确认：删除后没有恢复点可以找回本机数据。继续吗？');
    if (!ok2) return;
    T.showLoading('正在清除本机数据…');
    T.wipeAllLocalData().then(function () {
      T.hideLoading();
      T.applySettings();
      T.hideOverlayIfAny && T.hideOverlayIfAny();
      T.navigate('home', { replace: true });
      T.renderApp({ scrollTop: true });
      T.toast('本机数据已全部清空', 'success', 3200);
    }).catch(function (err) {
      console.error(err);
      T.hideLoading();
      T.toast('清空没有完成，请重试', 'error');
    });
  });

  T.registerAction('show-about-privacy', function () {
    T.openOverlay('<div class="sheet-head"><div class="head-copy"><p class="eyebrow">PRIVACY</p><h2>隐私与数据说明</h2></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="notice-strip" style="margin-top:0">' + T.icon('shield') + '<span>泰合礼是一个本地优先的礼金簿。没有账号、没有云端上传、没有广告追踪。</span></div>' +
      '<div class="detail-info" style="margin-top:12px"><div class="detail-info-row"><span class="label">保存位置</span><span class="val">礼簿与联系方式保存在本机浏览器 localStorage；红包照片保存在本机 IndexedDB。清理浏览器数据、卸载浏览器或更换手机可能导致数据丢失。</span></div><div class="detail-info-row"><span class="label">密码锁</span><span class="val">锁码以加盐哈希保存，只用于阻止他人直接查看界面，并不加密本地存储。设备被解锁或被专业工具读取时，仍需依赖手机系统安全。</span></div><div class="detail-info-row"><span class="label">导出文件</span><span class="val">Excel、图片、只读网页、JSON 备份均由设备本地生成，请自行妥善保管这些文件。分享前确认接收对象。</span></div><div class="detail-info-row"><span class="label">通讯录</span><span class="val">只有在您点击“从通讯录导入”并确认系统选择后，才会读取您选中的姓名和电话；不会上传。</span></div><div class="detail-info-row"><span class="label">备份建议</span><span class="val">每次宴席后导出一份完整 JSON 备份，并存到电脑或私人云盘。恢复点只保留在本机，不能替代外部备份。</span></div></div>' +
      '<div class="notice-strip" style="margin-top:12px">' + T.icon('info') + '<span>如果更换手机，请先在旧手机导出完整备份，再在新手机打开泰合礼的“从备份恢复”。照片恢复需要确保备份包含照片。</span></div></div>' +
      '<div class="sheet-footer"><button class="btn btn-primary btn-block" type="button" data-close-overlay>知道了</button></div>', { label: '隐私说明', sheetClass: 'small-sheet' });
  });

  T.hideOverlayIfAny = function () { if (ui.overlayOpen) T.hideOverlayImmediately(); };

  /* ---------------- 安装 ---------------- */
  T.registerAction('open-install', async function () {
    if (T.isStandalone()) { T.toast('已经在主屏幕独立运行模式中', 'success'); return; }
    if (ui.deferredInstall) {
      try {
        var evt = ui.deferredInstall;
        ui.deferredInstall = null;
        evt.prompt();
        var choice = await evt.userChoice;
        if (choice && choice.outcome === 'accepted') T.toast('安装已开始', 'success');
      } catch (e) { /* ignore */ }
      return;
    }
    var isFile = location.protocol === 'file:';
    T.openOverlay('<div class="sheet-head"><div class="head-copy"><p class="eyebrow">INSTALL</p><h2>安装到安卓主屏幕</h2><p class="sub">像 App 一样打开，离线也能记账</p></div><button class="icon-btn" type="button" data-close-overlay aria-label="关闭">' + T.icon('close') + '</button></div>' +
      '<div class="sheet-body"><div class="welcome-features" style="grid-template-columns:1fr;margin:0">' +
      feature('download', '方式一：Chrome 安装 PWA', '把文件夹部署到 HTTPS 地址（如 GitHub Pages、Netlify），用安卓 Chrome 打开，点右上角菜单“安装应用”或“添加到主屏幕”。') +
      feature('file-text', '方式二：直接打开单文件', '把《泰合礼-礼金簿.html》发送到手机，用 Chrome 打开文件即可使用全部记账功能。此方式无法安装为独立 PWA，但无需联网。') +
      feature('smartphone', '方式三：电脑本地演示', '文件夹启动本地服务器后，在电脑浏览器打开；安卓手机可在同一局域网访问，但安装功能需要 HTTPS。') +
      '</div>' +
      (isFile ? '<div class="notice-strip">' + T.icon('info') + '<span>检测到您正通过本地文件打开。部分浏览器限制通讯录、通知与安装能力，建议把本文件夹部署到 HTTPS 或使用单文件离线版。</span></div>' : '') +
      '<div class="export-note">' + T.icon('shield') + '<span>安装后的 App 仍然只在本机保存数据，不会上传礼金账目。安装不会删除已有数据。</span></div></div>' +
      '<div class="sheet-footer"><button class="btn btn-ghost" type="button" data-close-overlay>关闭</button><button class="btn btn-secondary" type="button" data-action="install-browser-help">查看浏览器方法</button></div>',
      { label: '安装说明', sheetClass: 'small-sheet' });
  });

  T.registerAction('install-browser-help', function () {
    window.alert('请用安卓 Chrome 打开应用地址，点右上角“⋮”菜单，选择“安装应用”或“添加到主屏幕”。\n\n如果当前是本地 HTML 文件，请直接使用文件即可，Chrome 不支持把本地文件安装为 PWA。');
  });

  function feature(icon, title, desc) {
    return '<div class="welcome-feature"><div class="wf-icon">' + T.icon(icon) + '</div><div><b>' + title + '</b><span>' + desc + '</span></div></div>';
  }

  T.openExportSheet = openExportSheet;
})();
