/* 舞台等比缩放：把 750×1334 铺满当前视口（独立打开 / iframe 内通用） */
(function () {
  function fit() {
    var s = document.querySelector('.stage');
    if (!s) return;
    var k = Math.min(window.innerWidth / 750, window.innerHeight / 1334);
    s.style.transform = 'translate(-50%,-50%) scale(' + k + ')';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  fit();
})();
