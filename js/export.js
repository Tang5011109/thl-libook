/* 泰合礼 THL 礼金簿 — 打印、图片礼单、只读分享 */
(function () {
  'use strict';
  var THL = window.THL = window.THL || {};

  function esc(v) { return THL.esc(v); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------- 打印模板 ---------------- */
  function printRowsTraditional(records) {
    if (!records.length) {
      return '<tr><td colspan="5" class="empty-row">暂无礼金记录</td></tr>';
    }
    return records.map(function (r, i) {
      return '<tr>' +
        '<td class="idx">' + (i + 1) + '</td>' +
        '<td class="name">' + esc(r.name) + '</td>' +
        '<td class="rel">' + esc(r.relation || '—') + '</td>' +
        '<td class="amount">' + esc(THL.money(r.amount)) + '</td>' +
        '<td class="gift">' + esc([r.gift, r.note].filter(Boolean).join('；') || '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  function printRowsModern(records) {
    if (!records.length) {
      return '<tr><td colspan="8" class="empty-row">暂无礼金记录</td></tr>';
    }
    return records.map(function (r, i) {
      return '<tr>' +
        '<td class="idx">' + (i + 1) + '</td>' +
        '<td class="name">' + esc(r.name) + '</td>' +
        '<td>' + esc(r.relation || '—') + '</td>' +
        '<td class="amount">' + esc(THL.money(r.amount)) + '</td>' +
        '<td>' + esc(r.gift || '—') + '</td>' +
        '<td class="center">' + (r.attended ? '✓' : '—') + '</td>' +
        '<td class="center">' + (r.returned ? '✓' : '—') + '</td>' +
        '<td class="note">' + esc(r.note || '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  function traditionalDoc(book, records, stats) {
    var meta = [];
    if (book.date) meta.push(THL.fmtDate(book.date));
    if (book.location) meta.push(book.location);
    if (book.host) meta.push('主人：' + book.host);
    return '<div class="sheet traditional-sheet">' +
      '<div class="ornament-border">' +
      '<header class="trad-head">' +
      '<div class="trad-seal"><span>泰</span><span>合</span><span>礼</span><b>THL</b></div>' +
      '<div class="trad-title-block">' +
      '<p class="trad-eyebrow">THL · 礼金簿</p>' +
      '<h1>礼 金 簿</h1>' +
      '<p class="trad-slogan">泰然存礼 · 和合记情</p>' +
      '</div>' +
      '<div class="trad-meta">' +
      '<p class="meta-title">' + esc(book.title) + '</p>' +
      '<p>' + esc(meta.join('　·　')) + '</p>' +
      '</div>' +
      '</header>' +
      '<div class="trad-summary">' +
      '<span>宾客 <b>' + stats.people + '</b> 位</span>' +
      '<span>礼金笔数 <b>' + stats.count + '</b> 笔</span>' +
      '<span>礼金合计 <b>' + esc(THL.money(stats.cash)) + '</b></span>' +
      '<span>待回礼 <b>' + stats.pendingReturn + '</b> 笔</span>' +
      '</div>' +
      '<table class="trad-table">' +
      '<thead><tr><th class="idx">序</th><th class="name">宾客姓名</th><th class="rel">关系</th><th class="amount">礼金</th><th class="gift">礼品 · 备注</th></tr></thead>' +
      '<tbody>' + printRowsTraditional(records) + '</tbody>' +
      '</table>' +
      '<footer class="trad-foot">' +
      '<div class="signature">记账人：' + esc(book.host || THL.state.settings.operator || '') + '<span>日期：' + esc(THL.fmtDate(THL.todayISO())) + '</span></div>' +
      '<div class="print-brand">泰合礼 THL · 一纸礼簿，记一生情分</div>' +
      '</footer>' +
      '</div></div>';
  }

  function modernDoc(book, records, stats) {
    var meta = [THL.fmtDate(book.date), book.location, book.host ? '主人：' + book.host : ''].filter(Boolean).join(' · ');
    return '<div class="sheet modern-sheet">' +
      '<header class="modern-head">' +
      '<div class="modern-brandbar"><div class="modern-logo">THL</div><div><b>泰合礼</b><span>THL GIFT LEDGER</span></div><div class="modern-slogan">泰然存礼，和合记情</div></div>' +
      '<div class="modern-title-row"><div><p class="modern-eyebrow">GIFT MONEY LEDGER</p><h1>' + esc(book.title) + '</h1><p class="modern-meta">' + esc(meta) + '</p></div>' +
      '<div class="modern-total"><span>礼金总额</span><strong>' + esc(THL.money(stats.cash)) + '</strong><em>共 ' + stats.people + ' 位宾客</em></div></div>' +
      '</header>' +
      '<section class="modern-stats">' +
      '<div><span>宾客人数</span><b>' + stats.people + '</b><em>位</em></div>' +
      '<div><span>礼金笔数</span><b>' + stats.count + '</b><em>笔</em></div>' +
      '<div><span>平均礼金</span><b>' + esc(THL.money(stats.average)) + '</b></div>' +
      '<div><span>已回礼</span><b>' + stats.returned + '</b><em>笔</em></div>' +
      '<div><span>待回礼</span><b>' + stats.pendingReturn + '</b><em>笔</em></div>' +
      '</section>' +
      '<table class="modern-table">' +
      '<thead><tr><th>#</th><th>宾客姓名</th><th>关系</th><th class="amount">礼金</th><th>礼品</th><th class="center">到场</th><th class="center">回礼</th><th>备注</th></tr></thead>' +
      '<tbody>' + printRowsModern(records) + '</tbody>' +
      '<tfoot><tr><td colspan="3">本场合计</td><td class="amount">' + esc(THL.money(stats.cash)) + '</td><td colspan="4">共 ' + stats.count + ' 笔 · 已回礼 ' + stats.returned + ' 笔 · 待回礼 ' + stats.pendingReturn + ' 笔</td></tr></tfoot>' +
      '</table>' +
      '<footer class="modern-foot"><span>泰合礼 THL · 礼金簿</span><span>打印日期：' + esc(THL.fmtDate(THL.todayISO())) + '</span></footer>' +
      '</div>';
  }

  THL.buildPrintHtml = function (book, records, template) {
    template = template === 'modern' ? 'modern' : 'traditional';
    var stats = THL.calcStats(book.id);
    var sorted = (records || []).slice().sort(function (a, b) {
      return String(a.date || '').localeCompare(String(b.date || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    var css = [
      '@page{size:A4 ' + (template === 'modern' ? 'landscape' : 'portrait') + ';margin:' + (template === 'modern' ? '9mm' : '11mm') + '}',
      '*{box-sizing:border-box}',
      'html,body{margin:0;padding:0;background:#e9e2d6;color:#34261f;font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.screen-wrap{min-height:100vh;padding:18px}',
      '.sheet{background:#fffdf8;margin:0 auto;box-shadow:0 8px 40px rgba(50,30,20,.18);position:relative;overflow:hidden}',
      '.traditional-sheet{width:794px;max-width:100%;min-height:1123px;padding:22px;background:#fdfaf2}',
      '.ornament-border{border:2px solid #8b1e24;padding:10px;position:relative;min-height:calc(100vh - 44px)}',
      '.ornament-border:before{content:"";position:absolute;inset:5px;border:1px solid #c8a45d;pointer-events:none}',
      '.ornament-border:after{content:"";position:absolute;left:50%;top:-4px;transform:translateX(-50%);width:120px;height:8px;background:linear-gradient(90deg,transparent,#c8a45d,transparent)}',
      '.trad-head{text-align:center;padding:20px 24px 12px;color:#6d1a1f;position:relative}',
      '.trad-seal{position:absolute;right:24px;top:18px;width:54px;border:1.5px solid #a52a2a;color:#a52a2a;padding:4px 2px;line-height:1.12;transform:rotate(2deg);display:flex;flex-wrap:wrap;justify-content:center;gap:0 2px;font-family:STKaiti,KaiTi,serif}',
      '.trad-seal span{font-size:13px;font-weight:700}.trad-seal b{width:100%;text-align:center;font:400 8px/1.4 Georgia,serif;letter-spacing:1px}',
      '.trad-eyebrow{font:400 9px/1.4 Georgia,serif;letter-spacing:4px;color:#b08b4d;margin:0}',
      '.trad-title-block h1{font-family:STKaiti,KaiTi,"Noto Serif SC",serif;font-size:48px;letter-spacing:14px;text-indent:14px;margin:8px 0 2px;color:#7e1c21;font-weight:700}',
      '.trad-slogan{font-family:STKaiti,KaiTi,serif;font-size:13px;letter-spacing:3px;color:#9f7d43;margin:0 0 16px}',
      '.trad-meta{border-top:1px solid #dfcdaa;border-bottom:1px solid #dfcdaa;padding:9px 0;margin:0 auto;max-width:610px;font-family:STKaiti,KaiTi,serif;color:#5d4434;font-size:13px}',
      '.trad-meta p{margin:3px 0;line-height:1.5}.meta-title{font-size:17px!important;font-weight:700;color:#7e1c21;letter-spacing:.5px}',
      '.trad-summary{display:flex;justify-content:center;flex-wrap:wrap;gap:5px 0;padding:12px 0 8px;color:#6e5845;font-size:11px}',
      '.trad-summary span{padding:0 16px;border-right:1px solid #e2d3b8}.trad-summary span:last-child{border-right:0}.trad-summary b{color:#8b1e24;font-size:13px}',
      '.trad-table{border-collapse:collapse;width:100%;font-family:STKaiti,KaiTi,"Noto Serif SC",serif;font-size:13px}',
      '.trad-table th{background:#8b1e24;color:#f7e8c4;font-weight:600;padding:8px 7px;border:1px solid #d8c5a2;letter-spacing:1px;font-size:12px}',
      '.trad-table td{border:1px solid #decfb5;padding:7px;line-height:1.5;vertical-align:middle;word-break:break-all}',
      '.trad-table tbody tr:nth-child(even){background:#faf4e7}',
      '.trad-table thead{display:table-header-group}.trad-table tr{page-break-inside:avoid;break-inside:avoid}',
      '.trad-table .idx{width:38px;text-align:center;color:#8b7765}.trad-table .name{width:104px;text-align:center;font-weight:700;font-size:14px;color:#3d2a20}',
      '.trad-table .rel{width:70px;text-align:center}.trad-table .amount{width:100px;text-align:right;color:#8b1e24;font-weight:700;white-space:nowrap}',
      '.trad-table .gift{font-size:12px;color:#6c5a4b}',
      '.trad-foot{display:flex;justify-content:space-between;gap:16px;padding:18px 4px 2px;color:#8c7967;font-family:STKaiti,KaiTi,serif;font-size:11px;align-items:flex-end}',
      '.signature{display:flex;gap:22px}.signature span{color:#6d5a49}.print-brand{text-align:right;font-size:10px;letter-spacing:.5px}',
      '.empty-row{text-align:center;padding:28px!important;color:#9d8a76}',
      '.modern-sheet{width:1123px;max-width:100%;min-height:794px;padding:28px 30px 22px}',
      '.modern-head{background:#8b1e24;color:#fff9ed;margin:-28px -30px 0;padding:18px 30px 22px;position:relative;overflow:hidden}',
      '.modern-head:after{content:"";position:absolute;right:-80px;top:-120px;width:360px;height:360px;border:1px solid rgba(224,193,130,.25);border-radius:50%;box-shadow:0 0 0 22px rgba(224,193,130,.05),0 0 0 52px rgba(224,193,130,.04)}',
      '.modern-brandbar{display:flex;align-items:center;gap:10px;position:relative;z-index:1;border-bottom:1px solid rgba(238,213,166,.28);padding-bottom:11px}',
      '.modern-logo{width:34px;height:34px;border:1px solid #d5b378;display:grid;place-items:center;font:700 10px/1 Georgia,serif;color:#e8cf9c;letter-spacing:.5px}',
      '.modern-brandbar b{display:block;font-family:STKaiti,KaiTi,serif;font-size:17px;letter-spacing:2px}.modern-brandbar span{display:block;font:400 7px/1.4 Georgia,serif;letter-spacing:1.6px;color:#d8bd8b}',
      '.modern-slogan{margin-left:auto;font-family:STKaiti,KaiTi,serif;font-size:11px;color:#e8d3a8;letter-spacing:2px}',
      '.modern-title-row{position:relative;z-index:1;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding-top:16px}',
      '.modern-eyebrow{font:400 8px/1.5 Georgia,serif;letter-spacing:2.5px;color:#d7bd91;margin:0}',
      '.modern-title-row h1{font-family:STKaiti,KaiTi,"Noto Serif SC",serif;font-size:30px;margin:4px 0 5px;letter-spacing:1px}',
      '.modern-meta{margin:0;font-size:10px;color:#eadbc3;letter-spacing:.4px}',
      '.modern-total{text-align:right;min-width:170px}.modern-total span{display:block;font-size:9px;color:#d9c19b;letter-spacing:2px}.modern-total strong{display:block;font:700 29px/1.2 Georgia,"Times New Roman",serif;color:#fff3d8;white-space:nowrap}.modern-total em{font-style:normal;font-size:10px;color:#d8c2a1}',
      '.modern-stats{display:flex;border-bottom:1px solid #e5d7c0;margin-bottom:12px}',
      '.modern-stats div{flex:1;padding:12px 10px;border-right:1px solid #eee3d2}.modern-stats div:last-child{border-right:0}',
      '.modern-stats span{display:block;font-size:9px;color:#8e7b68;letter-spacing:.5px}.modern-stats b{font:700 17px/1.5 Georgia,serif;color:#7e1c21;margin-right:2px}.modern-stats em{font-style:normal;font-size:9px;color:#8b7765}',
      '.modern-table{width:100%;border-collapse:collapse;font-size:10px}.modern-table th{background:#f4ead8;color:#6f4a36;font-weight:700;border-bottom:1px solid #d9c5a8;padding:7px 6px;text-align:left;letter-spacing:.5px}',
      '.modern-table td{padding:6px;border-bottom:1px solid #eee5d7;vertical-align:middle;color:#4c3b2e}.modern-table tbody tr:nth-child(even){background:#fcf8f0}',
      '.modern-table thead{display:table-header-group}.modern-table tr{page-break-inside:avoid;break-inside:avoid}.modern-table .idx{color:#a4927e;text-align:center;width:26px}',
      '.modern-table .name{font-weight:700;white-space:nowrap}.modern-table .amount{text-align:right;color:#8b1e24;font-weight:700;white-space:nowrap}.modern-table .center{text-align:center}.modern-table .note{color:#7e6b5b}',
      '.modern-table tfoot td{padding:9px 6px;border-top:1.5px solid #8b1e24;border-bottom:0;background:#faf1e1;color:#6d4d38;font-size:10px;font-weight:700}.modern-table tfoot .amount{font-size:13px}',
      '.modern-foot{display:flex;justify-content:space-between;border-top:1px solid #eadfce;padding-top:9px;margin-top:14px;color:#a08d7a;font-size:8.5px;letter-spacing:.4px}',
      '.screen-wrap{padding:20px;min-height:100vh;display:flex;justify-content:center;align-items:flex-start}',
      '@media screen and (max-width:860px){.screen-wrap{padding:4px;min-height:0;display:flex;justify-content:center;align-items:flex-start;overflow:hidden}.traditional-sheet{width:794px;max-width:none;min-height:1123px;flex:none;zoom:.46}.modern-sheet{width:1123px;max-width:none;min-height:794px;flex:none;zoom:.34}}',
      '@media screen and (min-width:520px) and (max-width:860px){.traditional-sheet{zoom:.62}.modern-sheet{zoom:.48}}',
      '@media screen and (max-width:380px){.traditional-sheet{zoom:.40}.modern-sheet{zoom:.29}}',
      '@media print{html,body{background:#fff!important}.screen-wrap{padding:0!important;display:block!important;min-height:0}.sheet{width:auto!important;max-width:none!important;min-height:0!important;margin:0!important;box-shadow:none!important;background:#fffdf8!important;padding:0!important;overflow:visible!important}.modern-head{margin:0!important;padding:16px 18px 18px!important}.traditional-sheet{padding:0!important}.ornament-border{padding:8px!important;min-height:0!important}.trad-head{padding-top:14px!important}.trad-title-block h1{font-size:38px!important}.modern-sheet{padding:0!important}.modern-head{margin:0 -0px!important}.modern-brandbar{padding-top:0!important}.screen-only{display:none!important}}'
    ].join('\n');
    var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc('泰合礼_' + book.title + '_' + (template === 'modern' ? '现代横版' : '传统竖版')) + '</title><style>' + css + '</style></head><body><div class="screen-wrap">' + (template === 'modern' ? modernDoc(book, sorted, stats) : traditionalDoc(book, sorted, stats)) + '</div></body></html>';
    return html;
  };

  THL.openPrintPreview = function (book, records, template) {
    if (!book) return;
    var tpl = template === 'modern' ? 'modern' : 'traditional';
    var overlay = document.getElementById('overlay-root');
    if (!overlay) return;
    var frameId = 'print-frame-' + Date.now();
    var html = THL.buildPrintHtml(book, records, tpl);
    var wrapper = document.createElement('div');
    wrapper.className = 'modal-overlay print-overlay';
    wrapper.innerHTML = '<div class="modal-sheet print-modal">' +
      '<div class="sheet-head"><div><p class="eyebrow">打印预览</p><h2>' + esc(book.title) + '</h2></div><button class="icon-btn" data-close-overlay aria-label="关闭">' + THL.icon('close') + '</button></div>' +
      '<div class="print-toolbar">' +
      '<div class="segmented compact" id="print-template-switch">' +
      '<button data-print-template="traditional" class="' + (tpl === 'traditional' ? 'active' : '') + '">传统竖版</button>' +
      '<button data-print-template="modern" class="' + (tpl === 'modern' ? 'active' : '') + '">现代横版</button>' +
      '</div>' +
      '<button class="btn btn-primary btn-sm" data-print-now>' + THL.icon('print') + ' 打印 / 存为 PDF</button>' +
      '</div>' +
      '<div class="print-frame-wrap"><iframe id="' + frameId + '" class="print-frame" title="打印预览" srcdoc="' + esc(html) + '"></iframe></div>' +
      '<p class="print-hint">提示：在打印面板中选择「另存为 PDF」即可保存电子版；打印传统竖版建议 A4 纵向，现代横版建议 A4 横向。</p>' +
      '</div>';
    overlay.innerHTML = '';
    overlay.appendChild(wrapper);
    overlay.hidden = false;
    overlay.classList.add('open');
    document.body.classList.add('modal-open');
    THL.ui.overlayOpen = true;
    wrapper.addEventListener('click', function (e) {
      if (e.target === wrapper) THL.closeOverlay();
    });
    wrapper.querySelector('[data-close-overlay]').addEventListener('click', function () { THL.closeOverlay(); });
    wrapper.addEventListener('click', function (e) {
      var t = e.target.closest('[data-print-template]');
      if (t) {
        var next = t.getAttribute('data-print-template');
        var fresh = THL.buildPrintHtml(book, records, next);
        var iframe = wrapper.querySelector('iframe');
        iframe.srcdoc = fresh;
        wrapper.querySelectorAll('[data-print-template]').forEach(function (b) { b.classList.toggle('active', b === t); });
        return;
      }
      if (e.target.closest('[data-print-now]')) {
        var f = wrapper.querySelector('iframe');
        try {
          f.contentWindow.focus();
          f.contentWindow.print();
        } catch (err) {
          THL.toast('当前环境无法直接调起打印，请换用 Chrome 浏览器');
        }
      }
    });
  };

  /* ---------------- 图片礼单 ---------------- */
  function drawRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fitText(ctx, text, maxWidth) {
    text = String(text || '');
    if (ctx.measureText(text).width <= maxWidth) return text;
    var ellipsis = '…';
    var lo = 0, hi = text.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) lo = mid; else hi = mid - 1;
    }
    return text.slice(0, lo) + ellipsis;
  }

  async function renderImagePage(book, records, pageIndex, pageCount, stats) {
    var width = 1080;
    var headerH = 305;
    var statsH = 108;
    var tableHeadH = 66;
    var rowH = 56;
    var footerH = 110;
    var height = headerH + statsH + tableHeadH + Math.max(1, records.length) * rowH + footerH;
    var canvas = document.createElement('canvas');
    var dpr = 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#FBF6EA';
    ctx.fillRect(0, 0, width, height);

    // 顶部朱红区域
    var grad = ctx.createLinearGradient(0, 0, width, headerH);
    grad.addColorStop(0, '#74161C');
    grad.addColorStop(0.55, '#8F1F26');
    grad.addColorStop(1, '#5E1015');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, headerH);
    // 金色装饰圆环
    ctx.save();
    ctx.strokeStyle = 'rgba(215,183,122,0.22)';
    ctx.lineWidth = 1.5;
    [80, 140, 200, 260].forEach(function (r, i) {
      ctx.beginPath();
      ctx.arc(width - 140, 40, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
    // 顶部金色细线
    ctx.fillStyle = '#D7B77A';
    ctx.fillRect(0, 0, width, 5);
    ctx.fillStyle = 'rgba(215,183,122,0.32)';
    ctx.fillRect(0, headerH - 1, width, 1);
    // 品牌章
    ctx.save();
    ctx.strokeStyle = '#E0C286';
    ctx.lineWidth = 2;
    ctx.strokeRect(56, 48, 72, 72);
    ctx.fillStyle = '#E0C286';
    ctx.font = '700 26px "KaiTi","STKaiti","Microsoft YaHei",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('泰', 92, 75);
    ctx.font = '700 15px "KaiTi","STKaiti",serif';
    ctx.fillText('合礼', 92, 101);
    // 品牌文字
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFF6E3';
    ctx.font = '700 40px "KaiTi","STKaiti","Songti SC","Microsoft YaHei",serif';
    ctx.fillText('泰合礼', 152, 82);
    ctx.fillStyle = '#DCC08A';
    ctx.font = '400 14px Georgia,"Times New Roman",serif';
    ctx.fillText('THL GIFT LEDGER', 154, 108);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#DCC08A';
    ctx.font = '400 17px "KaiTi","STKaiti",serif';
    ctx.fillText('泰然存礼 · 和合记情', width - 55, 78);
    // 礼簿标题
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFF9EC';
    ctx.font = '700 44px "KaiTi","STKaiti","Songti SC","Microsoft YaHei",serif';
    var title = fitText(ctx, book.title, width - 110);
    ctx.fillText(title, 56, 182);
    var meta = [book.type, THL.fmtDate(book.date), book.location].filter(Boolean).join('  ·  ');
    ctx.fillStyle = 'rgba(255,244,222,0.78)';
    ctx.font = '400 20px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(fitText(ctx, meta, width - 110), 58, 220);
    ctx.fillStyle = '#E3C58E';
    ctx.fillRect(56, 244, 92, 3);
    ctx.fillStyle = 'rgba(255,246,227,0.7)';
    ctx.font = '400 17px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('礼金明细 · 共 ' + stats.count + ' 笔', 164, 249);

    // 汇总卡片
    var sy = headerH + 22;
    ctx.fillStyle = '#FFFFFF';
    drawRoundRect(ctx, 40, sy, width - 80, statsH - 24, 14);
    ctx.fill();
    ctx.strokeStyle = '#EADDC6';
    ctx.lineWidth = 1;
    ctx.stroke();
    var cells = [
      ['宾客人数', stats.people + ' 位'],
      ['礼金合计', THL.money(stats.cash)],
      ['已回礼', stats.returned + ' 笔'],
      ['待回礼', stats.pendingReturn + ' 笔']
    ];
    cells.forEach(function (c, i) {
      var x = 40 + (width - 80) / 4 * i;
      if (i) { ctx.strokeStyle = '#EFE5D5'; ctx.beginPath(); ctx.moveTo(x, sy + 16); ctx.lineTo(x, sy + statsH - 48); ctx.stroke(); }
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8B7560';
      ctx.font = '400 17px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(c[0], x + 28, sy + 30);
      ctx.fillStyle = i === 1 ? '#8B1E24' : '#3B2B21';
      ctx.font = i === 1 ? '700 30px Georgia,"Times New Roman",serif' : '700 25px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(fitText(ctx, c[1], (width - 80) / 4 - 50), x + 28, sy + 64);
    });

    // 表头
    var thy = headerH + statsH;
    ctx.fillStyle = '#F1E4CF';
    ctx.fillRect(40, thy, width - 80, tableHeadH);
    ctx.fillStyle = '#7A4D36';
    ctx.font = '600 20px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('序', 62, thy + 42);
    ctx.fillText('宾客姓名', 135, thy + 42);
    ctx.fillText('关系', 390, thy + 42);
    ctx.textAlign = 'right';
    ctx.fillText('礼金', 720, thy + 42);
    ctx.textAlign = 'left';
    ctx.fillText('礼品 / 备注', 775, thy + 42);
    ctx.fillStyle = '#D9C6AA';
    ctx.fillRect(40, thy + tableHeadH - 2, width - 80, 2);

    // 行
    var startY = thy + tableHeadH;
    if (!records.length) {
      ctx.fillStyle = '#9D8975';
      ctx.font = '400 22px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无礼金记录', width / 2, startY + 80);
    }
    records.forEach(function (r, i) {
      var y = startY + i * rowH;
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.66)';
        ctx.fillRect(40, y, width - 80, rowH);
      }
      ctx.fillStyle = '#EADDC8';
      ctx.fillRect(40, y + rowH - 1, width - 80, 1);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9A8775';
      ctx.font = '400 17px Georgia,"Times New Roman",serif';
      var globalIdx = pageIndex * 100 + i + 1;
      ctx.fillText(String(globalIdx), 62, y + 35);
      ctx.fillStyle = '#2F231C';
      ctx.font = '600 23px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(fitText(ctx, r.name, 220), 135, y + 35);
      ctx.fillStyle = '#705B48';
      ctx.font = '400 18px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(fitText(ctx, r.relation || '—', 100), 390, y + 35);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#8B1E24';
      ctx.font = '700 24px Georgia,"Times New Roman",serif';
      ctx.fillText(THL.money(r.amount), 720, y + 35);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#786654';
      ctx.font = '400 16px "PingFang SC","Microsoft YaHei",sans-serif';
      var desc = [r.gift, r.note].filter(Boolean).join('；') || '—';
      ctx.fillText(fitText(ctx, desc, width - 775 - 42), 775, y + 34);
    });

    // 底部
    var fy = height - footerH;
    ctx.fillStyle = '#F6EEE0';
    ctx.fillRect(0, fy, width, footerH);
    ctx.fillStyle = '#D8C5A7';
    ctx.fillRect(0, fy, width, 1);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9C846C';
    ctx.font = '400 16px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('泰合礼 THL  ·  一纸礼簿，记一生情分', 56, fy + 44);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#A28B73';
    ctx.font = '400 15px Georgia,"Times New Roman",serif';
    ctx.fillText('第 ' + (pageIndex + 1) + ' / ' + pageCount + ' 页  ·  ' + THL.fmtDate(THL.todayISO()), width - 56, fy + 44);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#C4AC8B';
    ctx.font = '400 13px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('长按图片保存 · 分享给家人一起看账', width / 2, fy + 76);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) { reject(new Error('图片生成失败')); return; }
        resolve(blob);
      }, 'image/png');
    });
  }

  THL.generateGiftImages = async function (book, records) {
    var stats = THL.calcStats(book.id);
    var sorted = (records || []).slice().sort(function (a, b) {
      return String(a.date || '').localeCompare(String(b.date || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    var pageSize = 100;
    var pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    var pages = [];
    for (var i = 0; i < pageCount; i++) {
      var chunk = sorted.slice(i * pageSize, (i + 1) * pageSize);
      var blob = await renderImagePage(book, chunk, i, pageCount, stats);
      var safe = THL.safeFileName(book.title + '_礼单' + (pageCount > 1 ? '_第' + (i + 1) + '页' : ''), 'png');
      pages.push({ blob: blob, url: URL.createObjectURL(blob), name: safe, index: i });
    }
    return pages;
  };

  /* ---------------- 只读分享网页 ---------------- */
  THL.buildReadonlyHtml = function (book, records) {
    var stats = THL.calcStats(book.id);
    var sorted = (records || []).slice().sort(function (a, b) {
      return String(a.date || '').localeCompare(String(b.date || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    var rows = sorted.map(function (r, i) {
      var detail = [r.gift, r.note].filter(Boolean).join('；');
      var status = [r.attended ? '已到场' : '', r.returned ? '已回礼' : '待回礼', r.thanked ? '已答谢' : '待答谢'].filter(Boolean).join(' · ');
      return '<tr><td class="idx">' + (i + 1) + '</td><td class="name">' + esc(r.name) + '<span class="mobile-sub">' + esc(detail || '—') + '<em>' + esc(status) + '</em></span></td><td>' + esc(r.relation || '—') + '</td><td class="amount">' + esc(THL.money(r.amount)) + '</td><td>' + esc(detail || '—') + '</td><td class="center">' + (r.attended ? '✓' : '—') + '</td><td class="center">' + (r.returned ? '✓' : '—') + '</td><td class="center">' + (r.thanked ? '✓' : '—') + '</td></tr>';
    }).join('');
    var rels = stats.relations.map(function (r) {
      return '<span>' + esc(r.name) + ' <b>' + r.count + '</b> 人 · ' + esc(THL.money(r.amount)) + '</span>';
    }).join('');
    var meta = [book.type, THL.fmtDate(book.date), book.location, book.host ? '主人：' + book.host : ''].filter(Boolean).join(' · ');
    var css = 'html{background:#F4EDE1}body{margin:0;color:#3B2C22;font-family:"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif;background:#F4EDE1}' +
      '.page{max-width:1000px;margin:0 auto;background:#FBF6EA;min-height:100vh;box-shadow:0 0 50px rgba(70,40,20,.12)}' +
      '.hero{background:linear-gradient(135deg,#7D191F,#9C272D 55%,#671217);color:#FFF6E2;padding:34px 34px 30px;position:relative;overflow:hidden}' +
      '.hero:before{content:"礼";position:absolute;right:28px;top:-38px;font-family:"KaiTi","STKaiti",serif;font-size:220px;color:rgba(226,192,133,.08);line-height:1}' +
      '.brand{display:flex;align-items:center;gap:12px;margin-bottom:34px}.seal{width:62px;height:62px;border:1.5px solid #E0C286;display:grid;place-items:center;font-family:"KaiTi","STKaiti",serif;font-size:20px;line-height:1.1;text-align:center;color:#F1D7A3;letter-spacing:1px}' +
      '.brand-name{font-family:"KaiTi","STKaiti",serif;font-size:25px;letter-spacing:3px;font-weight:700}.brand-en{font:400 10px/1.5 Georgia,serif;letter-spacing:2px;color:#D8BD8D}' +
      '.brand-slogan{margin-left:auto;font-family:"KaiTi","STKaiti",serif;font-size:13px;color:#E0C69A;letter-spacing:2px}' +
      '.eyebrow{font:400 10px/1.4 Georgia,serif;letter-spacing:3px;color:#D7BD91;margin:0}' +
      '.hero h1{font-family:"KaiTi","STKaiti","Songti SC",serif;font-size:38px;margin:8px 0 10px;font-weight:700;letter-spacing:2px}' +
      '.meta{font-size:13px;color:#E9D8BB;line-height:1.8;margin:0}' +
      '.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:0;background:#FFFDF7;border-bottom:1px solid #E6D7C0}' +
      '.summary div{padding:22px 24px;border-right:1px solid #EFE4D3}.summary div:last-child{border:0}.summary span{display:block;color:#8D7965;font-size:12px;margin-bottom:6px}.summary b{font:700 25px/1.2 Georgia,"Times New Roman",serif;color:#8B1E24}.summary em{font:400 12px/1 "PingFang SC",sans-serif;color:#9C8773;font-style:normal;margin-left:4px}' +
      '.content{padding:26px 32px 38px}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.toolbar h2{font-size:17px;margin:0;color:#5C3A28;letter-spacing:1px}.toolbar button{background:#8B1E24;color:#FFF5E4;border:0;border-radius:8px;padding:9px 16px;font-size:13px;cursor:pointer}table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}.th{background:#F2E7D5;color:#6F4B35;font-weight:600;text-align:left;padding:11px 9px;border-bottom:1px solid #DCC9AE;font-size:12px}td{padding:10px 9px;border-bottom:1px solid #EFE6D9;color:#4A392C;line-height:1.5}tbody tr:nth-child(even){background:#FCF9F3}.name{font-weight:600;color:#35251C}.amount{text-align:right;color:#8B1E24;font-weight:700;white-space:nowrap}.center{text-align:center;color:#8A7664}.idx{color:#AB9885;text-align:center;width:38px}.relations{padding:16px 0 6px;display:flex;flex-wrap:wrap;gap:8px;color:#7B6552;font-size:12px}.relations span{background:#F5EBDC;border:1px solid #EBDCC4;border-radius:999px;padding:6px 11px}.relations b{color:#8B1E24}' +
      '.footer{margin-top:28px;padding-top:16px;border-top:1px solid #E7D9C3;color:#A08A75;font-size:11px;display:flex;justify-content:space-between;gap:15px;line-height:1.7}.readonly{display:inline-flex;align-items:center;gap:5px;background:#F1E7D8;color:#8B6A4B;border-radius:999px;padding:4px 10px;font-size:11px;margin-bottom:14px}.dot{width:5px;height:5px;background:#A67D4D;border-radius:50%}.note{margin-top:22px;padding:12px 15px;border-left:2px solid #C8A45D;background:#F7EFE2;color:#806A56;font-size:12px;line-height:1.8}.mobile-sub{display:none}' +
      '@media(max-width:600px){.hero{padding:24px 20px}.brand-slogan{display:none}.hero h1{font-size:29px}.brand{margin-bottom:24px}.summary{grid-template-columns:repeat(2,1fr)}.summary div{border-bottom:1px solid #EFE4D3}.content{padding:18px 14px 28px}.table-wrap{overflow-x:auto}table{min-width:0;width:100%;table-layout:auto;font-size:12px}th,td{padding:9px 6px}.footer{flex-direction:column}.brand-en{display:none}.mobile-sub{display:block;font-size:10.5px;color:#8D7965;font-weight:400;margin-top:2px;line-height:1.5;max-width:150px;white-space:normal}.mobile-sub em{display:block;font-style:normal;color:#A08A75;font-size:9.5px;margin-top:1px}.toolbar button{padding:8px 12px;font-size:12px}.toolbar h2{font-size:15px}th:nth-child(5),td:nth-child(5),th:nth-child(6),td:nth-child(6),th:nth-child(7),td:nth-child(7),th:nth-child(8),td:nth-child(8){display:none}.idx{width:24px}.name{min-width:100px}.amount{min-width:74px}}' +
      '@media print{html,body{background:#fff}.page{max-width:none;box-shadow:none}.toolbar button{display:none}.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}.summary{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{page-break-inside:avoid}}';
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#8B1E24"><link rel="icon" href="data:,"><title>' + esc(book.title + ' · 只读礼簿 · 泰合礼') + '</title><style>' + css + '</style></head><body><div class="page">' +
      '<header class="hero"><div class="brand"><div class="seal">泰合<br>礼</div><div><div class="brand-name">泰合礼</div><div class="brand-en">THL GIFT LEDGER</div></div><div class="brand-slogan">泰然存礼 · 和合记情</div></div>' +
      '<p class="eyebrow">GIFT MONEY LEDGER · 只读分享</p><h1>' + esc(book.title) + '</h1><p class="meta">' + esc(meta || '喜事礼金簿') + '</p>' +
      (book.note ? '<p class="meta" style="opacity:.8;margin-top:5px">' + esc(book.note) + '</p>' : '') +
      '</header>' +
      '<section class="summary"><div><span>礼金总额</span><b>' + esc(THL.money(stats.cash)) + '</b></div><div><span>宾客人数</span><b>' + stats.people + '</b><em>位</em></div><div><span>礼金笔数</span><b>' + stats.count + '</b><em>笔</em></div><div><span>已回礼 / 待回礼</span><b>' + stats.returned + '</b><em>/ ' + stats.pendingReturn + ' 笔</em></div></section>' +
      '<div class="content"><div class="readonly"><span class="dot"></span>只读礼簿 · 无法修改账目</div><div class="toolbar"><h2>礼金明细</h2><button onclick="window.print()">打印 / 存为 PDF</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th class="idx">#</th><th>宾客姓名</th><th>关系</th><th style="text-align:right">礼金</th><th>礼品 / 备注</th><th style="text-align:center">到场</th><th style="text-align:center">回礼</th><th style="text-align:center">答谢</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8" style="text-align:center;color:#9D8975;padding:30px">暂无礼金记录</td></tr>') + '</tbody></table></div>' +
      '<div class="relations">' + (rels || '<span>暂无关系分类</span>') + '</div>' +
      '<div class="note">此页面由「泰合礼 THL 礼金簿」只读导出。页面不包含编辑入口，可安全转发给家人查看。如需修改账目，请回到原设备的 App 操作。数据以导出时为准 · ' + esc(THL.fmtDate(THL.todayISO())) + '</div>' +
      '<footer class="footer"><span>泰合礼 THL · 泰然存礼，和合记情</span><span>一纸礼簿，记一生情分</span></footer></div></div></body></html>';
  };

  THL.exportReadonlyShare = function (book, records) {
    var html = THL.buildReadonlyHtml(book, records);
    var name = THL.safeFileName('泰合礼只读礼簿_' + book.title, 'html');
    var file = new File([html], name, { type: 'text/html;charset=utf-8' });
    return { file: file, name: name, html: html };
  };

  /* ---------------- 日历提醒 .ics ---------------- */
  function icsEsc(v) {
    return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }
  function icsDate(dateStr) {
    return String(dateStr || THL.todayISO()).replace(/-/g, '');
  }
  THL.buildReminderICS = function () {
    var reminders = [];
    THL.state.records.forEach(function (r) {
      var book = THL.getBook(r.bookId);
      if (r.remindReturnAt && !r.returned) {
        reminders.push({ date: r.remindReturnAt, title: '回礼提醒 · ' + r.name, desc: '《' + (book ? book.title : '礼簿') + '》宾客 ' + r.name + ' 的礼金 ' + THL.money(r.amount) + '，记得回礼。打开泰合礼查看详情。' });
      }
      if (r.remindThankAt && !r.thanked) {
        reminders.push({ date: r.remindThankAt, title: '答谢提醒 · ' + r.name, desc: '《' + (book ? book.title : '礼簿') + '》宾客 ' + r.name + ' 的礼金 ' + THL.money(r.amount) + '，记得答谢。打开泰合礼查看详情。' });
      }
    });
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//THL//泰合礼礼金簿//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:泰合礼 · 人情提醒'];
    reminders.forEach(function (r, i) {
      var d = icsDate(r.date);
      lines.push('BEGIN:VEVENT');
      lines.push('UID:thl-' + Date.now() + '-' + i + '@taoheli.local');
      lines.push('DTSTAMP:' + stamp);
      lines.push('DTSTART:' + d + 'T090000');
      lines.push('DTEND:' + d + 'T093000');
      lines.push('SUMMARY:' + icsEsc(r.title));
      lines.push('DESCRIPTION:' + icsEsc(r.desc));
      lines.push('TRANSP:TRANSPARENT');
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT0M');
      lines.push('ACTION:DISPLAY');
      lines.push('DESCRIPTION:' + icsEsc(r.title));
      lines.push('END:VALARM');
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return { text: lines.join('\r\n') + '\r\n', count: reminders.length };
  };

  THL.downloadReminderICS = function () {
    var ics = THL.buildReminderICS();
    if (!ics.count) {
      THL.toast('还没有设置回礼 / 答谢提醒日，先在提醒中心设置日期吧');
      return { count: 0 };
    }
    var blob = new Blob([ics.text], { type: 'text/calendar;charset=utf-8' });
    var name = THL.safeFileName('泰合礼_人情提醒_' + THL.todayISO(), 'ics');
    THL.downloadBlob(blob, name);
    return { count: ics.count, name: name };
  };
})();
