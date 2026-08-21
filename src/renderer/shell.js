'use strict';

const ALL = '__all__';
const NONE = '__none__';
const PALETTE = ['#8b5e3c', '#6b4f3a', '#a67c52', '#7a5c45', '#9c6b4e', '#5c4033', '#b08968'];

let state = { categories: [], items: [], extensions: [], permissions: {}, sort: 'lastOpened' };
let activeCategory = ALL;
let query = '';
let view = 'library';
let modalResolver = null;
const tabs = [];
let activeTabId = null;
let zoom = 1;

const $ = (id) => document.getElementById(id);

function colorFor(title) {
  let h = 0;
  const s = String(title || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function initialOf(title) {
  const s = String(title || '页').trim();
  return s.slice(0, 1) || '页';
}

function showView(name) {
  view = name;
  $('view-library').hidden = name !== 'library';
  $('view-browser').hidden = name !== 'browser';
  $('view-settings').hidden = name !== 'settings';
  $('topbar-library').hidden = name !== 'library';
  $('topbar-browser').hidden = name !== 'browser';
  $('topbar-settings').hidden = name !== 'settings';
}

function sortedItems(items) {
  const copy = items.slice();
  if (state.sort === 'name') {
    copy.sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh'));
  } else {
    copy.sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0) || String(a.title).localeCompare(String(b.title), 'zh'));
  }
  return copy;
}

function visibleItems() {
  const q = query.trim().toLowerCase();
  return sortedItems(state.items.filter((item) => {
    if (item.kind === 'folder') return false;
    if (activeCategory === NONE && item.categoryId) return false;
    if (activeCategory !== ALL && activeCategory !== NONE && item.categoryId !== activeCategory) {
      const children = state.categories.filter((c) => c.parentId === activeCategory).map((c) => c.id);
      if (!children.includes(item.categoryId)) return false;
    }
    if (!q) return true;
    const hay = `${item.title} ${(item.tags || []).join(' ')} ${item.path}`.toLowerCase();
    return hay.includes(q);
  }));
}

function countForCategory(id) {
  if (id === ALL) return state.items.filter((i) => i.kind !== 'folder').length;
  if (id === NONE) return state.items.filter((i) => i.kind !== 'folder' && !i.categoryId).length;
  const childIds = state.categories.filter((c) => c.parentId === id).map((c) => c.id);
  return state.items.filter((i) => i.kind !== 'folder' && (i.categoryId === id || childIds.includes(i.categoryId))).length;
}

function renderCategories() {
  const nav = $('category-list');
  nav.replaceChildren();
  const roots = state.categories.filter((c) => !c.parentId).sort((a, b) => a.order - b.order);
  const makeBtn = (id, label, cls) => {
    const row = document.createElement('div');
    row.className = 'cat-row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cat-btn${cls || ''}${activeCategory === id ? ' active' : ''}`;
    const name = document.createElement('span');
    name.textContent = label;
    const count = document.createElement('span');
    count.className = 'cat-count';
    count.textContent = String(countForCategory(id));
    btn.append(name, count);
    btn.addEventListener('click', () => {
      activeCategory = id;
      render();
    });
    row.append(btn);
    if (id !== ALL && id !== NONE) {
      const actions = document.createElement('div');
      actions.className = 'cat-actions';
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.textContent = '改';
      rename.addEventListener('click', () => renameCategory(id));
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '删';
      del.addEventListener('click', () => {
        if (window.confirm('删除该分类？条目不会从磁盘删除，只会变为未分类。')) {
          window.shelf.removeCategory(id);
        }
      });
      actions.append(rename, del);
      row.append(actions);
    }
    nav.append(row);
  };
  makeBtn(ALL, '全部');
  makeBtn(NONE, '未分类');
  for (const root of roots) {
    makeBtn(root.id, root.name);
    const children = state.categories.filter((c) => c.parentId === root.id).sort((a, b) => a.order - b.order);
    for (const child of children) makeBtn(child.id, root.name + ' / ' + child.name, ' child');
  }
}

function renderCards() {
  const grid = $('card-grid');
  const items = visibleItems();
  grid.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = state.items.length
      ? '没有匹配的条目。试试别的搜索或分类。'
      : '库是空的。添加 examples/ 文件夹即可开始演示。';
    grid.append(empty);
    return;
  }
  for (const item of items) {
    grid.append(renderCard(item));
  }
}

function renderCard(item) {
  const card = document.createElement('article');
  card.className = 'card';
  const cover = document.createElement('div');
  cover.className = 'cover';
  cover.style.background = colorFor(item.title);
  if (item.coverPath) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = `shelfmedia://cover/${encodeURIComponent(item.id)}`;
    cover.replaceChildren(img);
  } else {
    cover.textContent = initialOf(item.title);
  }
  cover.addEventListener('click', () => openItem(item.id));

  const body = document.createElement('div');
  body.className = 'card-body';
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = item.title;
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const mode = document.createElement('span');
  mode.className = 'tag';
  mode.textContent = item.openMode === 'tab' ? '浏览器标签' : '应用窗';
  meta.append(mode);
  for (const tag of item.tags || []) {
    const t = document.createElement('span');
    t.className = 'tag';
    t.textContent = tag;
    meta.append(t);
  }
  body.append(title, meta);
  body.addEventListener('click', () => openItem(item.id));

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn';
  edit.textContent = '编辑';
  edit.addEventListener('click', (e) => {
    e.stopPropagation();
    editItem(item);
  });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn danger';
  remove.textContent = '移出库';
  remove.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.confirm(`从库中移除「${item.title}」？不会删除磁盘上的文件。`)) {
      window.shelf.removeItem(item.id);
    }
  });
  actions.append(edit, remove);
  card.append(cover, body, actions);
  return card;
}

function render() {
  $('sort').value = state.sort || 'lastOpened';
  renderCategories();
  renderCards();
}

async function openItem(id) {
  await window.shelf.openItem(id);
}

function closeMenus() {
  $('add-menu').hidden = true;
}

function openModal(title, build, onOk) {
  $('modal-title').textContent = title;
  const body = $('modal-body');
  body.replaceChildren();
  build(body);
  $('modal').hidden = false;
  modalResolver = onOk;
}

function closeModal() {
  $('modal').hidden = true;
  modalResolver = null;
}

function field(parent, labelText, el) {
  const lab = document.createElement('label');
  lab.textContent = labelText;
  parent.append(lab, el);
  return el;
}

function inputEl(value) {
  const el = document.createElement('input');
  el.type = 'text';
  el.value = value || '';
  return el;
}

function categoryOptions(select, current) {
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = '未分类';
  select.append(opt0);
  const roots = state.categories.filter((c) => !c.parentId).sort((a, b) => a.order - b.order);
  for (const root of roots) {
    const o = document.createElement('option');
    o.value = root.id;
    o.textContent = root.name;
    select.append(o);
    for (const child of state.categories.filter((c) => c.parentId === root.id)) {
      const c = document.createElement('option');
      c.value = child.id;
      c.textContent = `${root.name} / ${child.name}`;
      select.append(c);
    }
  }
  select.value = current || '';
}

function editItem(item) {
  openModal('编辑条目', (body) => {
    const title = field(body, '显示名称', inputEl(item.title));
    title.id = 'f-title';
    const tags = field(body, '标签（逗号分隔）', inputEl((item.tags || []).join(', ')));
    tags.id = 'f-tags';
    const cat = document.createElement('select');
    categoryOptions(cat, item.categoryId);
    cat.id = 'f-cat';
    field(body, '分类', cat);
    const mode = document.createElement('select');
    mode.id = 'f-mode';
    const optApp = document.createElement('option');
    optApp.value = 'app';
    optApp.textContent = '应用窗（默认，地址栏可收起）';
    const optTab = document.createElement('option');
    optTab.value = 'tab';
    optTab.textContent = '普通浏览器标签';
    mode.append(optApp, optTab);
    mode.value = item.openMode || 'app';
    field(body, '打开方式', mode);
    const coverBtn = document.createElement('button');
    coverBtn.type = 'button';
    coverBtn.className = 'btn';
    coverBtn.id = 'f-cover';
    coverBtn.textContent = item.coverPath ? '更换封面…' : '选择封面…';
    coverBtn.dataset.cover = item.coverPath || '';
    coverBtn.addEventListener('click', async () => {
      const picked = await window.shelf.pickCover();
      if (picked) coverBtn.dataset.cover = picked;
    });
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'btn';
    clear.textContent = '清除封面';
    clear.addEventListener('click', () => {
      coverBtn.dataset.cover = '';
    });
    const wrap = document.createElement('p');
    wrap.append(coverBtn, document.createTextNode(' '), clear);
    body.append(wrap);
  }, async () => {
    await window.shelf.updateItem(item.id, {
      title: $('f-title').value,
      tags: $('f-tags').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      categoryId: $('f-cat').value || null,
      openMode: $('f-mode').value,
      coverPath: $('f-cover').dataset.cover || null,
    });
  });
}

function renameCategory(id) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return;
  openModal('重命名分类', (body) => {
    const name = field(body, '名称', inputEl(cat.name));
    name.id = 'f-cat-name';
  }, async () => {
    await window.shelf.updateCategory(id, { name: $('f-cat-name').value });
  });
}

function newCategory() {
  openModal('新分类', (body) => {
    const name = field(body, '名称', inputEl(''));
    name.id = 'f-new-cat';
    const parent = document.createElement('select');
    parent.id = 'f-parent';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '根分类';
    parent.append(none);
    for (const root of state.categories.filter((c) => !c.parentId)) {
      const o = document.createElement('option');
      o.value = root.id;
      o.textContent = `挂到「${root.name}」下（一层子分类）`;
      parent.append(o);
    }
    field(body, '位置', parent);
  }, async () => {
    const name = $('f-new-cat').value.trim();
    if (!name) return false;
    await window.shelf.addCategory(name, $('f-parent').value || null);
    return true;
  });
}

function promptText(title, label, initial) {
  return new Promise((resolve) => {
    openModal(title, (body) => {
      const el = field(body, label, inputEl(initial || ''));
      el.id = 'f-prompt';
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('modal-ok').click();
      });
      setTimeout(() => el.focus(), 0);
    }, async () => {
      resolve($('f-prompt').value.trim());
      return true;
    });
    const prev = $('modal-cancel').onclick;
    $('modal-cancel').addEventListener('click', function cancelOnce() {
      resolve(null);
      $('modal-cancel').removeEventListener('click', cancelOnce);
      if (prev) prev();
    }, { once: true });
  });
}

function normalizeUrl(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return s;
  return `https://${s}`;
}

function currentWebview() {
  const tab = tabs.find((t) => t.id === activeTabId);
  return tab ? tab.webview : null;
}

function updateNavButtons() {
  const wv = currentWebview();
  $('nav-back').disabled = !(wv && wv.canGoBack && wv.canGoBack());
  $('nav-forward').disabled = !(wv && wv.canGoForward && wv.canGoForward());
  $('zoom-label').textContent = `${Math.round(zoom * 100)}%`;
  if (wv && wv.getURL) {
    try {
      const url = wv.getURL();
      if (url && url !== 'about:blank') $('url-input').value = url;
    } catch {
      // guest not ready
    }
  }
}

function renderTabs() {
  const strip = $('tab-strip');
  strip.replaceChildren();
  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tab${tab.id === activeTabId ? ' active' : ''}`;
    const label = document.createElement('span');
    label.textContent = tab.title || '新标签';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'x';
    x.textContent = '×';
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    btn.append(label, x);
    btn.addEventListener('click', () => activateTab(tab.id));
    strip.append(btn);
  }
}

function activateTab(id) {
  activeTabId = id;
  for (const tab of tabs) {
    tab.webview.classList.toggle('active', tab.id === id);
  }
  const tab = tabs.find((t) => t.id === id);
  if (tab) {
    $('url-input').value = tab.url || '';
    zoom = tab.zoom || 1;
    try {
      tab.webview.setZoomFactor(zoom);
    } catch {
      // ignore
    }
  }
  renderTabs();
  updateNavButtons();
}

function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const [tab] = tabs.splice(idx, 1);
  tab.webview.remove();
  if (!tabs.length) {
    activeTabId = null;
    showView('library');
    return;
  }
  activateTab(tabs[Math.max(0, idx - 1)].id);
}

function openTab({ url, partition, title, itemId }) {
  const id = `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const wv = document.createElement('webview');
  wv.setAttribute('partition', partition || 'persist:browser');
  wv.setAttribute('allowpopups', 'on');
  wv.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no, sandbox=yes');
  const href = url || 'about:blank';
  wv.src = href;
  $('webview-host').append(wv);
  const tab = { id, title: title || href, url: href, partition, itemId, webview: wv, zoom: 1 };
  tabs.push(tab);
  wv.addEventListener('page-title-updated', (e) => {
    tab.title = e.title || tab.title;
    renderTabs();
  });
  wv.addEventListener('did-navigate', (e) => {
    tab.url = e.url;
    if (activeTabId === id) $('url-input').value = e.url;
    updateNavButtons();
  });
  wv.addEventListener('did-navigate-in-page', (e) => {
    tab.url = e.url;
    if (activeTabId === id) $('url-input').value = e.url;
  });
  wv.addEventListener('did-fail-load', (e) => {
    if (!e.isMainFrame || e.errorCode === -3) return;
    const box = $('browser-error');
    box.hidden = false;
    box.textContent = `页面加载失败：${e.errorDescription || e.errorCode}。这不是白屏，可以换个地址或点主页回库。`;
  });
  wv.addEventListener('did-finish-load', () => {
    $('browser-error').hidden = true;
    updateNavButtons();
  });
  showView('browser');
  activateTab(id);
}

async function askUrlAndOpen() {
  const raw = await promptText('打开网址', '网址', 'https://');
  if (!raw) return;
  const url = normalizeUrl(raw);
  if (!url) return;
  openTab({ url, partition: 'persist:browser', title: url });
}

async function askUrlAndAdd() {
  const raw = await promptText('添加网址到库', '网址', 'https://');
  if (!raw) return;
  await window.shelf.addUrl(normalizeUrl(raw));
}

async function renderSettings() {
  const info = await window.shelf.getSettings();
  $('path-userdata').textContent = info.userData;
  $('path-library').textContent = info.libraryFile;
  const exts = await window.shelf.listExtensions();
  const body = $('ext-body');
  body.replaceChildren();
  if (!exts.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
                td.textContent = '尚未加载扩展。可用仓库里的 fixtures/sample-extension 做验收。';
    tr.append(td);
    body.append(tr);
  }
  for (const ext of exts) {
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = ext.name;
    const src = document.createElement('td');
    src.textContent = ext.sourcePath;
    const st = document.createElement('td');
    st.textContent = ext.enabled
      ? (ext.runtimeLoaded ? '已启用（已加载）' : '已启用（待加载）')
      : '已停用';
    const act = document.createElement('td');
    const tog = document.createElement('button');
    tog.type = 'button';
    tog.className = 'btn';
    tog.textContent = ext.enabled ? '停用' : '启用';
    tog.addEventListener('click', async () => {
      try {
        await window.shelf.toggleExtension(ext.id, !ext.enabled);
        await renderSettings();
      } catch (err) {
        showExtStatus(err.message || String(err), true);
      }
    });
    const un = document.createElement('button');
    un.type = 'button';
    un.className = 'btn danger';
    un.textContent = '卸载';
    un.addEventListener('click', async () => {
      if (!window.confirm(`卸载扩展「${ext.name}」？`)) return;
      await window.shelf.uninstallExtension(ext.id);
      await renderSettings();
    });
    act.append(tog, un);
    tr.append(name, src, st, act);
    body.append(tr);
  }

  const permBody = $('perm-body');
  permBody.replaceChildren();
  const entries = Object.entries(state.permissions || {});
  if (!entries.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = '还没有记住的媒体权限。打开实验页申请摄像头/麦克风后会出现在这里。';
    tr.append(td);
    permBody.append(tr);
  }
  for (const [origin, perms] of entries) {
    const tr = document.createElement('tr');
    const a = document.createElement('td');
    a.textContent = origin;
    const b = document.createElement('td');
    b.textContent = perms.media === true ? '允许' : perms.media === false ? '拒绝' : '未设置';
    const c = document.createElement('td');
    const allow = document.createElement('button');
    allow.type = 'button';
    allow.className = 'btn';
    allow.textContent = '允许';
    allow.addEventListener('click', async () => {
      await window.shelf.setPermission(origin, 'media', true);
      await renderSettings();
    });
    const deny = document.createElement('button');
    deny.type = 'button';
    deny.className = 'btn';
    deny.textContent = '拒绝';
    deny.addEventListener('click', async () => {
      await window.shelf.setPermission(origin, 'media', false);
      await renderSettings();
    });
    c.append(allow, deny);
    tr.append(a, b, c);
    permBody.append(tr);
  }
}

function showExtStatus(text, isError) {
  const el = $('ext-status');
  el.hidden = false;
  el.textContent = text;
  el.style.background = isError ? '#f8d7d0' : '#f0e6d6';
}

function goHome() {
  showView('library');
  window.shelf.home();
}

function bindUi() {
  $('btn-brand').addEventListener('click', goHome);
  $('btn-settings-home').addEventListener('click', goHome);
  $('btn-settings-back').addEventListener('click', goHome);
  $('btn-settings').addEventListener('click', async () => {
    showView('settings');
    await renderSettings();
  });
  $('btn-settings-2').addEventListener('click', async () => {
    showView('settings');
    await renderSettings();
  });

  $('search').addEventListener('input', () => {
    query = $('search').value;
    renderCards();
  });
  $('sort').addEventListener('change', () => window.shelf.setSort($('sort').value));

  $('btn-add').addEventListener('click', (e) => {
    e.stopPropagation();
    $('add-menu').hidden = !$('add-menu').hidden;
  });
  document.addEventListener('click', () => closeMenus());
  $('add-menu').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    closeMenus();
    const kind = btn.dataset.add;
    try {
      if (kind === 'file') await window.shelf.pickFiles();
      if (kind === 'folder') await window.shelf.pickFolder();
      if (kind === 'url') await askUrlAndAdd();
      if (kind === 'opentab') await askUrlAndOpen();
    } catch (err) {
      window.alert(err.message || String(err));
    }
  });

  $('btn-new-category').addEventListener('click', newCategory);

  $('nav-home').addEventListener('click', goHome);
  $('nav-back').addEventListener('click', () => {
    const wv = currentWebview();
    if (wv && wv.canGoBack()) wv.goBack();
  });
  $('nav-forward').addEventListener('click', () => {
    const wv = currentWebview();
    if (wv && wv.canGoForward()) wv.goForward();
  });
  $('nav-reload').addEventListener('click', () => {
    const wv = currentWebview();
    if (wv) wv.reload();
  });
  $('url-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = normalizeUrl($('url-input').value);
    if (!url) return;
    const wv = currentWebview();
    if (wv) {
      wv.loadURL(url);
    } else {
      openTab({ url, partition: 'persist:browser', title: url });
    }
  });
  $('nav-newtab').addEventListener('click', () => {
    $('url-input').value = '';
    openTab({ url: 'about:blank', partition: 'persist:browser', title: '新标签' });
    $('url-input').focus();
  });
  $('nav-zoom-in').addEventListener('click', () => setZoom(zoom + 0.1));
  $('nav-zoom-out').addEventListener('click', () => setZoom(zoom - 0.1));
  $('nav-fullscreen').addEventListener('click', () => window.shelf.toggleFullscreen());

  $('modal-cancel').addEventListener('click', closeModal);
  $('modal-ok').addEventListener('click', async () => {
    if (!modalResolver) {
      closeModal();
      return;
    }
    try {
      const ok = await modalResolver();
      if (ok !== false) closeModal();
    } catch (err) {
      window.alert(err.message || String(err));
    }
  });

  document.querySelectorAll('.settings-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach((b) => b.classList.toggle('active', b === btn));
      ['extensions', 'permissions', 'library'].forEach((name) => {
        $(`panel-${name}`).hidden = btn.dataset.panel !== name;
      });
    });
  });

  $('btn-load-unpacked').addEventListener('click', async () => {
    const dir = await window.shelf.pickUnpacked();
    if (!dir) return;
    try {
      const row = await window.shelf.loadUnpacked(dir);
      showExtStatus(`已加载：${row.name}。请到普通网页标签查看扩展是否已启用。`, false);
      await renderSettings();
    } catch (err) {
      showExtStatus(err.message || String(err), true);
    }
  });
  $('btn-import-crx').addEventListener('click', async () => {
    const file = await window.shelf.pickCrx();
    if (!file) return;
    try {
      const row = await window.shelf.importCrx(file);
      showExtStatus(`已导入 .crx：${row.name}。商店一键安装仍属 v2。`, false);
      await renderSettings();
    } catch (err) {
      showExtStatus(`无法导入该 .crx（此 Electron 可能仅支持解压后按 unpacked 加载）：${err.message || err}`, true);
    }
  });
  $('btn-open-userdata').addEventListener('click', () => window.shelf.openLibraryDir());

  window.addEventListener('keydown', (e) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === 't') {
      e.preventDefault();
      openTab({ url: 'about:blank', partition: 'persist:browser', title: '新标签' });
      $('url-input').focus();
    }
    if (meta && e.key.toLowerCase() === 'l' && view === 'browser') {
      e.preventDefault();
      $('url-input').focus();
      $('url-input').select();
    }
    if (meta && e.key.toLowerCase() === 'r' && view === 'browser') {
      e.preventDefault();
      const wv = currentWebview();
      if (wv) wv.reload();
    }
    if (e.key === 'F11') {
      e.preventDefault();
      window.shelf.toggleFullscreen();
    }
    if (e.altKey && e.key === 'ArrowLeft' && view === 'browser') {
      const wv = currentWebview();
      if (wv && wv.canGoBack()) wv.goBack();
    }
    if (e.altKey && e.key === 'ArrowRight' && view === 'browser') {
      const wv = currentWebview();
      if (wv && wv.canGoForward()) wv.goForward();
    }
    if (e.key === 'Escape' && !$('modal').hidden) closeModal();
  });

  bindDrop();
}

function setZoom(next) {
  zoom = Math.min(3, Math.max(0.3, Math.round(next * 10) / 10));
  const tab = tabs.find((t) => t.id === activeTabId);
  const wv = currentWebview();
  if (tab) tab.zoom = zoom;
  if (wv) {
    try {
      wv.setZoomFactor(zoom);
    } catch {
      // ignore
    }
  }
  updateNavButtons();
}

function bindDrop() {
  let dragDepth = 0;
  const mask = $('drop-mask');
  const on = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  document.addEventListener('dragenter', (e) => {
    on(e);
    dragDepth += 1;
    mask.hidden = false;
  });
  document.addEventListener('dragover', on);
  document.addEventListener('dragleave', (e) => {
    on(e);
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) mask.hidden = true;
  });
  document.addEventListener('drop', async (e) => {
    on(e);
    dragDepth = 0;
    mask.hidden = true;
    const files = [...e.dataTransfer.files];
    const paths = files.map((f) => window.shelf.pathForFile(f)).filter(Boolean);
    if (!paths.length) return;
    try {
      await window.shelf.addDropped(paths);
      showView('library');
    } catch (err) {
      window.alert(err.message || String(err));
    }
  });
}

async function boot() {
  bindUi();
  state = await window.shelf.getState();
  render();
  window.shelf.onState((next) => {
    state = next;
    render();
    if (view === 'settings') renderSettings();
  });
  window.shelf.onOpenTab((payload) => openTab(payload));
  window.shelf.onView((name) => {
    if (name === 'library') showView('library');
  });
  window.shelf.onCommand(async (cmd) => {
    if (cmd === 'add-files') await window.shelf.pickFiles();
    if (cmd === 'add-folder') await window.shelf.pickFolder();
  });
}

boot();
