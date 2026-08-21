'use strict';

const params = new URLSearchParams(location.search);
const startUrl = params.get('url') || 'about:blank';
const partition = params.get('partition') || 'persist:browser';
const title = params.get('title') || '应用';

document.getElementById('app-title').textContent = title;
document.title = title;

const host = document.getElementById('host');
const wv = document.createElement('webview');
wv.setAttribute('partition', partition);
wv.setAttribute('allowpopups', 'on');
wv.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no, sandbox=yes');
wv.src = startUrl;
host.append(wv);

const addr = document.getElementById('addr');
const urlInput = document.getElementById('url-input');
urlInput.value = startUrl;

function normalizeUrl(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return s;
  return `https://${s}`;
}

document.getElementById('btn-toggle').addEventListener('click', () => {
  addr.hidden = false;
  document.getElementById('btn-toggle').hidden = true;
  urlInput.focus();
});
document.getElementById('btn-collapse').addEventListener('click', () => {
  addr.hidden = true;
  document.getElementById('btn-toggle').hidden = false;
});
document.getElementById('btn-home').addEventListener('click', () => window.appChrome.home());
document.getElementById('btn-fullscreen').addEventListener('click', () => window.appChrome.toggleFullscreen());
document.getElementById('nav-back').addEventListener('click', () => {
  if (wv.canGoBack()) wv.goBack();
});
document.getElementById('nav-forward').addEventListener('click', () => {
  if (wv.canGoForward()) wv.goForward();
});
document.getElementById('nav-reload').addEventListener('click', () => wv.reload());
document.getElementById('url-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const url = normalizeUrl(urlInput.value);
  if (url) wv.loadURL(url);
});

wv.addEventListener('page-title-updated', (e) => {
  document.getElementById('app-title').textContent = e.title || title;
  document.title = e.title || title;
});
wv.addEventListener('did-navigate', (e) => {
  urlInput.value = e.url;
});
wv.addEventListener('did-fail-load', (e) => {
  if (!e.isMainFrame || e.errorCode === -3) return;
  const box = document.getElementById('fail');
  box.hidden = false;
  box.textContent = `加载失败：${e.errorDescription || e.errorCode}。无摄像头/麦克风时应由页面给出失败提示，而不是白屏。`;
});
wv.addEventListener('did-finish-load', () => {
  document.getElementById('fail').hidden = true;
});
