/* 泰合礼 THL 礼金簿 — 启动入口 */
(function () {
  'use strict';
  function boot() {
    if (!window.THL || !window.THL.start) {
      console.error('THL boot missing');
      return;
    }
    window.THL.start();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
