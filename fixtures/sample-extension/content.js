(function () {
  if (document.getElementById('html-shelf-sample-extension')) return;
  const bar = document.createElement('div');
  bar.id = 'html-shelf-sample-extension';
  bar.textContent = '页架示例扩展已加载';
  bar.setAttribute('style', [
    'position:fixed',
    'z-index:2147483647',
    'right:12px',
    'bottom:12px',
    'background:#6b4f3a',
    'color:#fffaf3',
    'padding:6px 10px',
    'border-radius:8px',
    'font:13px/1.3 sans-serif',
    'box-shadow:0 4px 14px rgba(0,0,0,.2)',
  ].join(';'));
  document.documentElement.appendChild(bar);
})();
