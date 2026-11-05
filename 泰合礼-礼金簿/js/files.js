/* 泰合礼 THL 礼金簿 — Excel / CSV / 备份文件能力（无第三方依赖） */
(function () {
  'use strict';
  var THL = window.THL = window.THL || {};

  /* ---------------- 基础下载 ---------------- */
  THL.downloadBlob = function (blob, filename) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 1200);
      return true;
    } catch (e) {
      return false;
    }
  };

  THL.downloadText = function (text, filename, mime) {
    return THL.downloadBlob(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }), filename);
  };

  THL.shareOrDownload = async function (files, title) {
    try {
      if (files && files.length && navigator.canShare && navigator.canShare({ files: files }) && navigator.share) {
        await navigator.share({ files: files, title: title || THL.BRAND });
        return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
    files.forEach(function (f) { THL.downloadBlob(f, f.name); });
    return 'downloaded';
  };

  /* ---------------- CRC32 / ZIP(Store) ---------------- */
  var crcTable = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  THL.crc32 = crc32;

  function dosDateTime(date) {
    date = date || new Date();
    var year = Math.max(1980, date.getFullYear());
    var time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
    var day = (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
    return { time: time, date: day };
  }

  function zipStore(entries) {
    var enc = new TextEncoder();
    var parts = [];
    var central = [];
    var offset = 0;
    var dt = dosDateTime(new Date());
    entries.forEach(function (entry) {
      var nameBytes = enc.encode(entry.name);
      var data = entry.data instanceof Uint8Array ? entry.data : enc.encode(String(entry.data));
      var crc = crc32(data);
      var local = new Uint8Array(30 + nameBytes.length);
      var dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, dt.time, true);
      dv.setUint16(12, dt.date, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      parts.push(local, data);

      var cen = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dt.time, true);
      cv.setUint16(14, dt.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      cen.set(nameBytes, 46);
      central.push(cen);
      offset += local.length + data.length;
    });
    var centralSize = central.reduce(function (n, c) { return n + c.length; }, 0);
    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [eocd]), { type: 'application/zip' });
  }
  THL.zipStore = zipStore;

  /* ---------------- Excel 生成（OOXML） ---------------- */
  function xmlEsc(v) {
    return String(v == null ? '' : v)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function colName(n) {
    var s = '';
    n = Number(n) || 0;
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s || 'A';
  }
  function cellText(ref, value, style) {
    return '<c r="' + ref + '" s="' + (style || 0) + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(value) + '</t></is></c>';
  }
  function cellNum(ref, value, style) {
    return '<c r="' + ref + '" s="' + (style || 0) + '"><v>' + (isFinite(Number(value)) ? Number(value) : 0) + '</v></c>';
  }
  function rowXml(n, cells, height) {
    return '<row r="' + n + '"' + (height ? ' ht="' + height + '" customHeight="1"' : '') + '>' + cells.join('') + '</row>';
  }

  function styleXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>' +
      '<fonts count="5">' +
      '<font><sz val="11"/><color rgb="FF3B3029"/><name val="微软雅黑"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="微软雅黑"/></font>' +
      '<font><b/><sz val="16"/><color rgb="FF8B1E24"/><name val="微软雅黑"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF5B3A29"/><name val="微软雅黑"/></font>' +
      '<font><sz val="10"/><color rgb="FF7B6A5C"/><name val="微软雅黑"/></font>' +
      '</fonts>' +
      '<fills count="4">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF8B1E24"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF4EAD7"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left style="thin"><color rgb="FFE7DAC4"/></left><right style="thin"><color rgb="FFE7DAC4"/></right><top style="thin"><color rgb="FFE7DAC4"/></top><bottom style="thin"><color rgb="FFE7DAC4"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="8">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
      '<xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles>' +
      '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>' +
      '</styleSheet>';
  }

  var XLSX_HEADERS = ['序号', '姓名', '关系', '礼金金额', '礼品', '礼品估值', '是否到场', '是否回礼', '是否答谢', '回礼金额', '回礼日期', '回礼礼品', '礼金日期', '备注', '登记人'];
  var XLSX_WIDTHS = [6, 12, 10, 12, 18, 10, 10, 10, 10, 11, 12, 16, 13, 30, 10];

  function sheetHeader(title, meta, headerRow, colCount) {
    var last = colName(colCount);
    var rows = [];
    rows.push(rowXml(1, [cellText('A1', title, 4)], 28));
    rows.push(rowXml(2, [cellText('A2', meta, 5)], 20));
    rows.push(rowXml(3, XLSX_HEADERS.slice(0, colCount).map(function (h, i) { return cellText(colName(i + 1) + '3', h, 1); }), 26));
    return rows.join('');
  }

  function sheetCols() {
    return '<cols>' + XLSX_WIDTHS.map(function (w, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
    }).join('') + '</cols>';
  }

  THL.buildBookXlsx = function (book, records, stats) {
    stats = stats || THL.calcStats(book.id);
    var sorted = (records || []).slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    var rows = [];
    rows.push(rowXml(1, [cellText('A1', '泰合礼 · ' + book.title, 4)], 30));
    var meta = '宴席日期：' + THL.fmtDate(book.date) + '    地点：' + (book.location || '—') + '    主人：' + (book.host || '—') + '    共 ' + sorted.length + ' 笔，礼金合计 ' + THL.money(stats.cash);
    rows.push(rowXml(2, [cellText('A2', meta, 5)], 22));
    rows.push(rowXml(3, XLSX_HEADERS.map(function (h, i) { return cellText(colName(i + 1) + '3', h, 1); }), 28));
    sorted.forEach(function (r, idx) {
      var n = idx + 4;
      var cells = [
        cellText('A' + n, idx + 1, 2),
        cellText('B' + n, r.name, 2),
        cellText('C' + n, r.relation || '', 2),
        cellNum('D' + n, r.amount, 3),
        cellText('E' + n, r.gift || '', 2),
        cellNum('F' + n, r.giftValue || 0, 3),
        cellText('G' + n, r.attended ? '是' : '否', 2),
        cellText('H' + n, r.returned ? '是' : '否', 2),
        cellText('I' + n, r.thanked ? '是' : '否', 2),
        cellNum('J' + n, r.returnAmount || 0, 3),
        cellText('K' + n, r.returnDate || '', 2),
        cellText('L' + n, r.returnGift || '', 2),
        cellText('M' + n, r.date || '', 2),
        cellText('N' + n, r.note || '', 2),
        cellText('O' + n, r.operator || '', 2)
      ];
      rows.push(rowXml(n, cells, 22));
    });
    var totalRow = sorted.length + 4;
    rows.push(rowXml(totalRow, [
      cellText('A' + totalRow, '合计', 6),
      cellText('B' + totalRow, stats.people + ' 位宾客', 6),
      cellText('C' + totalRow, '', 6),
      cellNum('D' + totalRow, stats.cash, 7),
      cellText('E' + totalRow, '', 6),
      cellNum('F' + totalRow, stats.giftValue, 7),
      cellText('G' + totalRow, stats.attended + ' 位到场', 6),
      cellText('H' + totalRow, stats.returned + ' 笔', 6),
      cellText('I' + totalRow, stats.thanked + ' 笔', 6),
      cellNum('J' + totalRow, stats.returnedAmount, 7),
      cellText('K' + totalRow, '已回礼支出', 6),
      cellText('L' + totalRow, '', 6),
      cellText('M' + totalRow, '', 6),
      cellText('N' + totalRow, '', 6),
      cellText('O' + totalRow, '', 6)
    ], 24));
    var dim = 'A1:O' + totalRow;
    var sheet1 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="' + dim + '"/>' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A4" sqref="A4"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="20"/>' + sheetCols() +
      '<sheetData>' + rows.join('') + '</sheetData>' +
      '<autoFilter ref="A3:O' + (sorted.length + 3) + '"/>' +
      '<mergeCells count="2"><mergeCell ref="A1:O1"/><mergeCell ref="A2:O2"/></mergeCells>' +
      '<printOptions horizontalCentered="1"/>' +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>' +
      '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
      '</worksheet>';

    var summaryRows = [];
    var sr = 0;
    summaryRows.push(rowXml(1, [cellText('A1', '礼簿统计汇总', 4)], 30));
    summaryRows.push(rowXml(2, [cellText('A2', book.title + ' · ' + (book.type || '喜事') + ' · ' + THL.fmtDate(book.date), 5)], 22));
    summaryRows.push(rowXml(3, [cellText('A3', '统计项目', 1), cellText('B3', '数值', 1), cellText('C3', '说明', 1)], 26));
    var data = [
      ['礼金总额', stats.cash, '已登记现金礼金合计'],
      ['礼品估值', stats.giftValue, '实物礼品估值合计'],
      ['礼金与礼品合计', stats.totalValue, '现金 + 礼品估值'],
      ['宾客人数', stats.people, '按姓名去重'],
      ['礼金笔数', stats.count, '登记记录数'],
      ['平均礼金', stats.average, '现金总额 ÷ 礼金笔数'],
      ['到场人数', stats.attended, '标记为已到场的记录'],
      ['已回礼笔数', stats.returned, '已登记回礼的记录'],
      ['待回礼笔数', stats.pendingReturn, '尚未回礼的记录'],
      ['已答谢笔数', stats.thanked, '已登记答谢的记录'],
      ['待答谢笔数', stats.pendingThank, '尚未答谢的记录'],
      ['回礼支出金额', stats.returnedAmount, '已登记的回礼金额合计']
    ];
    data.forEach(function (row, i) {
      var n = i + 4;
      summaryRows.push(rowXml(n, [
        cellText('A' + n, row[0], 6),
        typeof row[1] === 'number' ? cellNum('B' + n, row[1], 7) : cellText('B' + n, row[1], 6),
        cellText('C' + n, row[2], 2)
      ], 22));
      sr = n;
    });
    var relStart = sr + 2;
    summaryRows.push(rowXml(relStart, [cellText('A' + relStart, '关系分类', 1), cellText('B' + relStart, '礼金合计', 1), cellText('C' + relStart, '笔数', 1)], 26));
    stats.relations.forEach(function (rel, i) {
      var n = relStart + i + 1;
      summaryRows.push(rowXml(n, [
        cellText('A' + n, rel.name, 6),
        cellNum('B' + n, rel.amount, 7),
        cellNum('C' + n, rel.count, 6)
      ], 22));
      sr = n;
    });
    var sheet2 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:C' + sr + '"/>' +
      '<sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="20"/>' +
      '<cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="3" width="40" customWidth="1"/></cols>' +
      '<sheetData>' + summaryRows.join('') + '</sheetData>' +
      '<mergeCells count="2"><mergeCell ref="A1:C1"/><mergeCell ref="A2:C2"/></mergeCells>' +
      '<pageMargins left="0.7" right="0.7" top="0.7" bottom="0.7" header="0.2" footer="0.2"/>' +
      '</worksheet>';

    var workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="18000"/></bookViews>' +
      '<sheets><sheet name="礼金明细" sheetId="1" r:id="rId1"/><sheet name="统计汇总" sheetId="2" r:id="rId2"/></sheets>' +
      '<calcPr calcId="191029"/></workbook>';
    var wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';
    var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>';
    var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    return zipStore([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rootRels },
      { name: 'xl/workbook.xml', data: workbook },
      { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
      { name: 'xl/styles.xml', data: styleXml() },
      { name: 'xl/worksheets/sheet1.xml', data: sheet1 },
      { name: 'xl/worksheets/sheet2.xml', data: sheet2 }
    ]);
  };

  THL.exportBookExcel = function (book, records) {
    var blob = THL.buildBookXlsx(book, records || THL.recordsOfBook(book.id));
    var name = THL.safeFileName('泰合礼_' + book.title + '_礼金明细', 'xlsx');
    THL.downloadBlob(blob, name);
    return name;
  };

  THL.buildTemplateXlsx = function () {
    var headers = ['姓名', '关系', '礼金金额', '礼品', '礼品估值', '是否到场', '是否回礼', '是否答谢', '礼金日期', '备注'];
    var samples = [
      ['张三', '亲戚', 1000, '喜酒两瓶', 300, '是', '否', '否', THL.todayISO(), '示例行，导入时可删除'],
      ['李四', '同事', 500, '', 0, '是', '是', '是', THL.todayISO(), '示例行，导入时可删除']
    ];
    var rows = [];
    rows.push(rowXml(1, [cellText('A1', '泰合礼 · 礼金批量导入模板', 4)], 30));
    rows.push(rowXml(2, [cellText('A2', '请保留表头；每行一位宾客，至少填写“姓名”；日期格式 YYYY-MM-DD；“是/否”也可写 1/0。', 5)], 22));
    rows.push(rowXml(3, headers.map(function (h, i) { return cellText(colName(i + 1) + '3', h, 1); }), 26));
    samples.forEach(function (row, i) {
      var n = i + 4;
      rows.push(rowXml(n, row.map(function (v, j) {
        return j === 2 || j === 4 ? cellNum(colName(j + 1) + n, v, 3) : cellText(colName(j + 1) + n, v, 2);
      }), 22));
    });
    var colWidths = [12, 10, 12, 18, 10, 10, 10, 10, 13, 30];
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:J6"/>' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="20"/>' +
      '<cols>' + colWidths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>' +
      '<sheetData>' + rows.join('') + '</sheetData>' +
      '<mergeCells count="2"><mergeCell ref="A1:J1"/><mergeCell ref="A2:J2"/></mergeCells>' +
      '<pageMargins left="0.7" right="0.7" top="0.7" bottom="0.7" header="0.2" footer="0.2"/>' +
      '</worksheet>';
    var workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="导入模板" sheetId="1" r:id="rId1"/></sheets></workbook>';
    var wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';
    var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>';
    var rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    return zipStore([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rootRels },
      { name: 'xl/workbook.xml', data: workbook },
      { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
      { name: 'xl/styles.xml', data: styleXml() },
      { name: 'xl/worksheets/sheet1.xml', data: sheet }
    ]);
  };

  /* ---------------- ZIP 解包（用于读取 xlsx） ---------------- */
  async function inflateRaw(bytes) {
    if (!window.DecompressionStream) throw new Error('当前浏览器不支持解压 Excel 文件，请升级 Chrome 或改用 CSV 导入。');
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    var buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function unzip(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var eocd = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 .xlsx 文件');
    var count = dv.getUint16(eocd + 10, true);
    var cdOffset = dv.getUint32(eocd + 16, true);
    var entries = {};
    var pos = cdOffset;
    for (var n = 0; n < count; n++) {
      if (dv.getUint32(pos, true) !== 0x02014b50) break;
      var method = dv.getUint16(pos + 10, true);
      var compSize = dv.getUint32(pos + 20, true);
      var nameLen = dv.getUint16(pos + 28, true);
      var extraLen = dv.getUint16(pos + 30, true);
      var commentLen = dv.getUint16(pos + 32, true);
      var localOffset = dv.getUint32(pos + 42, true);
      var nameBytes = bytes.slice(pos + 46, pos + 46 + nameLen);
      var name = new TextDecoder('utf-8').decode(nameBytes);
      var localNameLen = dv.getUint16(localOffset + 26, true);
      var localExtraLen = dv.getUint16(localOffset + 28, true);
      var dataStart = localOffset + 30 + localNameLen + localExtraLen;
      var compressed = bytes.slice(dataStart, dataStart + compSize);
      if (method === 0) {
        entries[name] = compressed;
      } else if (method === 8) {
        entries[name] = await inflateRaw(compressed);
      }
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  function decodeUtf8(bytes) {
    return new TextDecoder('utf-8').decode(bytes);
  }
  function xmlDoc(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Excel 内部 XML 解析失败');
    return doc;
  }
  function tags(node, localName) {
    var all = node.getElementsByTagName('*');
    var out = [];
    for (var i = 0; i < all.length; i++) if (all[i].localName === localName) out.push(all[i]);
    return out;
  }
  function firstTag(node, localName) {
    var list = tags(node, localName);
    return list[0] || null;
  }

  var HEADER_ALIASES = {
    name: ['姓名', '宾客', '宾客姓名', '名字', '客人', '送礼人', '姓名（必填）'],
    relation: ['关系', '关系分类', '类别', '身份', '关系标签'],
    amount: ['礼金金额', '礼金', '金额', '现金', '礼金（元）', '礼金(元)', '金额（元）'],
    gift: ['礼品', '礼物', '实物', '赠礼', '礼品名称'],
    giftValue: ['礼品估值', '礼品价值', '实物估值', '礼品金额'],
    note: ['备注', '说明', '备注信息', '其他'],
    attended: ['是否到场', '到场', '出席', '到场情况'],
    returned: ['是否回礼', '回礼', '已回礼', '回礼状态'],
    thanked: ['是否答谢', '答谢', '已答谢', '答谢状态'],
    date: ['礼金日期', '日期', '送礼日期', '登记日期', '时间'],
    returnAmount: ['回礼金额'],
    returnGift: ['回礼礼品'],
    returnDate: ['回礼日期'],
    phone: ['电话', '手机', '手机号', '联系方式']
  };
  function normalizeHeader(h) {
    return String(h || '').replace(/\s+/g, '').replace(/[：:]/g, '').replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim();
  }
  function headerKey(h) {
    var n = normalizeHeader(h);
    for (var key in HEADER_ALIASES) {
      if (HEADER_ALIASES[key].indexOf(n) >= 0) return key;
    }
    return null;
  }
  function truthy(v, fallback) {
    if (v == null || v === '') return fallback;
    var s = String(v).trim().toLowerCase();
    if (['否', '不是', 'no', 'n', 'false', '0', '未', '未回礼', '未答谢', '未到场', 'no '].indexOf(s) >= 0) return false;
    if (['是', '有', 'yes', 'y', 'true', '1', '已', '已回礼', '已答谢', '到场', '已到场'].indexOf(s) >= 0) return true;
    return fallback;
  }
  function parseSpreadsheetNumber(v) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).replace(/[,\s，￥¥$€£]/g, '').replace(/元/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function excelDate(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v).trim())) {
      var serial = Number(v);
      if (serial > 20000 && serial < 80000) {
        var ms = Math.round((serial - 25569) * 86400 * 1000);
        var d = new Date(ms);
        return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
      }
    }
    var s = String(v).trim();
    if (/^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/.test(s)) {
      var m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
      if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
    }
    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/.test(s)) {
      var m2 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
      if (m2) return m2[3] + '-' + String(m2[1]).padStart(2, '0') + '-' + String(m2[2]).padStart(2, '0');
    }
    if (/^\d{1,2}[\/\-.]\d{1,2}$/.test(s)) {
      var m3 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
      return new Date().getFullYear() + '-' + String(m3[1]).padStart(2, '0') + '-' + String(m3[2]).padStart(2, '0');
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }

  function rowsToRecords(matrix) {
    var headerIndex = -1;
    var headers = [];
    for (var i = 0; i < Math.min(matrix.length, 12); i++) {
      var raw = (matrix[i] || []).map(normalizeHeader);
      var matched = raw.map(headerKey);
      if (matched.indexOf('name') >= 0 && matched.indexOf('amount') >= 0) {
        headerIndex = i;
        headers = raw;
        break;
      }
    }
    if (headerIndex < 0) {
      // 若没有表头但有列，按模板默认顺序
      if (matrix.length && matrix[0] && matrix[0].length >= 3) {
        headerIndex = -1;
        headers = ['姓名', '关系', '礼金金额', '礼品', '备注'];
      } else {
        throw new Error('未找到表头，请确保表中包含“姓名”和“礼金金额”列');
      }
    }
    var keyMap = headers.map(headerKey);
    var records = [];
    var errors = [];
    for (var r = headerIndex + 1; r < matrix.length; r++) {
      var row = matrix[r] || [];
      var obj = {};
      keyMap.forEach(function (key, idx) {
        if (key) obj[key] = row[idx];
      });
      var name = String(obj.name == null ? '' : obj.name).trim();
      var amount = parseSpreadsheetNumber(obj.amount);
      var gift = String(obj.gift == null ? '' : obj.gift).trim();
      var giftValue = parseSpreadsheetNumber(obj.giftValue);
      if (!name) {
        if (row.some(function (c) { return String(c == null ? '' : c).trim(); })) errors.push('第 ' + (r + 1) + ' 行：姓名为空，已跳过');
        continue;
      }
      if (!amount && !gift && !giftValue) {
        errors.push('第 ' + (r + 1) + ' 行「' + name + '」：金额为空，已跳过');
        continue;
      }
      if (amount < 0) amount = 0;
      records.push({
        name: name.slice(0, 40),
        relation: String(obj.relation || '').trim().slice(0, 20),
        amount: amount,
        gift: gift.slice(0, 120),
        giftValue: giftValue,
        note: String(obj.note || '').trim().slice(0, 500),
        attended: truthy(obj.attended, true),
        returned: truthy(obj.returned, false),
        thanked: truthy(obj.thanked, false),
        date: excelDate(obj.date) || THL.todayISO(),
        phone: String(obj.phone || '').trim().slice(0, 30),
        returnGift: String(obj.returnGift || '').trim().slice(0, 120),
        returnAmount: parseSpreadsheetNumber(obj.returnAmount),
        returnDate: excelDate(obj.returnDate)
      });
    }
    return { records: records, errors: errors, headers: headers };
  }

  async function parseXlsx(arrayBuffer) {
    var entries = await unzip(arrayBuffer);
    if (!entries['xl/workbook.xml']) throw new Error('文件缺少工作簿信息，可能不是有效的 .xlsx');
    var workbook = xmlDoc(decodeUtf8(entries['xl/workbook.xml']));
    var sheetEl = firstTag(workbook, 'sheet');
    var sheetName = sheetEl ? sheetEl.getAttribute('name') : 'Sheet1';
    var rid = sheetEl ? (sheetEl.getAttribute('r:id') || sheetEl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')) : null;
    var sheetPath = 'xl/worksheets/sheet1.xml';
    if (rid && entries['xl/_rels/workbook.xml.rels']) {
      var rels = xmlDoc(decodeUtf8(entries['xl/_rels/workbook.xml.rels']));
      var rel = tags(rels, 'Relationship').find(function (x) { return x.getAttribute('Id') === rid; });
      if (rel) {
        var target = rel.getAttribute('Target');
        sheetPath = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      }
    }
    if (!entries[sheetPath]) throw new Error('无法读取第一个工作表');
    var shared = [];
    if (entries['xl/sharedStrings.xml']) {
      var ss = xmlDoc(decodeUtf8(entries['xl/sharedStrings.xml']));
      tags(ss, 'si').forEach(function (si) {
        var txt = tags(si, 't').map(function (t) { return t.textContent || ''; }).join('');
        shared.push(txt);
      });
    }
    var sheet = xmlDoc(decodeUtf8(entries[sheetPath]));
    var rowEls = tags(sheet, 'row');
    var matrix = [];
    rowEls.forEach(function (rowEl) {
      var rnum = parseInt(rowEl.getAttribute('r') || String(matrix.length + 1), 10) - 1;
      var arr = matrix[rnum] || [];
      tags(rowEl, 'c').forEach(function (c) {
        var ref = c.getAttribute('r') || '';
        var colMatch = ref.match(/^([A-Z]+)/);
        var col = 0;
        if (colMatch) {
          for (var i = 0; i < colMatch[1].length; i++) col = col * 26 + (colMatch[1].charCodeAt(i) - 64);
          col -= 1;
        }
        var type = c.getAttribute('t');
        var vEl = firstTag(c, 'v');
        var value = vEl ? (vEl.textContent || '') : '';
        if (type === 's') {
          value = shared[parseInt(value, 10)] != null ? shared[parseInt(value, 10)] : '';
        } else if (type === 'inlineStr') {
          value = tags(c, 't').map(function (t) { return t.textContent || ''; }).join('');
        } else if (type === 'str' || type === 'b') {
          value = value;
        } else {
          value = value === '' ? '' : value;
        }
        arr[col] = value;
      });
      matrix[rnum] = arr;
    });
    var compact = matrix.filter(function (row) { return row && row.some(function (c) { return String(c == null ? '' : c).trim(); }); });
    var parsed = rowsToRecords(compact);
    parsed.sheetName = sheetName;
    return parsed;
  }

  function parseCsvText(text) {
    var rows = [];
    var row = [];
    var cell = '';
    var inQuotes = false;
    text = String(text || '').replace(/^\uFEFF/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cell += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (ch === '\r') { /* skip */ }
        else cell += ch;
      }
    }
    row.push(cell);
    rows.push(row);
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }

  THL.parseImportFile = async function (file) {
    var name = String(file.name || '').toLowerCase();
    if (/\.xlsx$/.test(name)) {
      var parsed = await parseXlsx(await file.arrayBuffer());
      return parsed;
    }
    if (/\.csv$/.test(name) || /\.txt$/.test(name)) {
      var buffer = await file.arrayBuffer();
      var text = '';
      if (buffer.byteLength > 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
        text = new TextDecoder('utf-16le').decode(buffer.slice(2));
      } else if (buffer.byteLength > 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        text = new TextDecoder('utf-8').decode(buffer.slice(3));
      } else {
        text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
        var bad = (text.match(/\uFFFD/g) || []).length;
        if (bad > Math.max(3, text.length * 0.01)) {
          try { text = new TextDecoder('gb18030').decode(buffer); } catch (e) { /* ignore */ }
        }
      }
      var parsedCsv = rowsToRecords(parseCsvText(text));
      parsedCsv.sheetName = 'CSV';
      return parsedCsv;
    }
    if (/\.xls$/.test(name)) throw new Error('暂不支持旧版 .xls 格式，请在 Excel 中另存为 .xlsx 或 .csv 后再导入。');
    throw new Error('请选择 .xlsx 或 .csv 格式的表格');
  };

  THL.importRecordsToBook = function (bookId, rows) {
    var book = THL.getBook(bookId);
    if (!book) throw new Error('目标礼簿不存在');
    var count = 0;
    rows.forEach(function (row) {
      var rec = THL.addRecord({
        bookId: bookId,
        name: row.name,
        relation: row.relation || '其他',
        amount: row.amount,
        gift: row.gift,
        giftValue: row.giftValue,
        note: row.note,
        attended: row.attended,
        returned: row.returned,
        thanked: row.thanked,
        date: row.date,
        returnGift: row.returnGift,
        returnAmount: row.returnAmount,
        returnDate: row.returnDate
      });
      if (rec) {
        if (row.phone) {
          var guest = THL.findGuestByName(rec.name);
          if (guest && !guest.phone) guest.phone = row.phone;
        }
        count++;
      }
    });
    if (count) {
      THL.addLog('批量导入', '向《' + book.title + '》导入 ' + count + ' 笔礼金', bookId);
      THL.save();
    }
    return count;
  };

  /* ---------------- 备份导出 / 还原 ---------------- */
  THL.exportBackup = async function (includePhotos) {
    var photoIds = [];
    if (includePhotos !== false) {
      var ids = new Set();
      THL.state.records.forEach(function (r) { if (r.photoId) ids.add(r.photoId); });
      photoIds = Array.from(ids);
    }
    var photos = includePhotos === false ? {} : await THL.exportPhotos(photoIds);
    var payload = {
      app: '泰合礼',
      appEn: 'THL GIFT LEDGER',
      version: THL.VERSION,
      exportedAt: THL.nowISO(),
      includesPhotos: includePhotos !== false,
      photoCount: Object.keys(photos).length,
      state: THL.state,
      photos: photos
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var fname = THL.safeFileName('泰合礼_数据备份_' + THL.todayISO(), 'json');
    THL.downloadBlob(blob, fname);
    return { name: fname, photoCount: Object.keys(photos).length };
  };

  THL.parseBackupFile = async function (file) {
    var text = await file.text();
    var data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('备份文件不是有效的 JSON 格式'); }
    if (!data || !data.state || !Array.isArray(data.state.books) || !Array.isArray(data.state.records)) {
      throw new Error('不是泰合礼的备份文件，或文件已损坏');
    }
    return {
      exportedAt: data.exportedAt || '',
      version: data.version || '',
      photoCount: data.photos ? Object.keys(data.photos).length : 0,
      state: THL.normalizeState(data.state),
      photos: data.photos || {}
    };
  };

  THL.restoreBackup = async function (parsed) {
    await THL.makeSnapshot('恢复备份前自动备份');
    THL.state = THL.normalizeState(parsed.state);
    THL.state.activeBookId = THL.state.books[0] ? THL.state.books[0].id : null;
    THL.save();
    if (parsed.photos && Object.keys(parsed.photos).length) {
      await THL.importPhotos(parsed.photos);
    }
    return THL.state;
  };
})();
