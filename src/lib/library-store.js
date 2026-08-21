'use strict';

const fs = require('fs');
const path = require('path');
const { newId } = require('./ids');
const { createCategory, assertOneLevelNest, validateCategoryTree } = require('./categories');
const { scanHtmlFiles, titleFromHtmlFile, suggestCategoryName, isHtmlFile } = require('./scan');

const STORE_VERSION = 1;

function seedCategories(idFactory) {
  return [
    { id: idFactory(), name: '工具', order: 0, parentId: null },
    { id: idFactory(), name: '游戏', order: 1, parentId: null },
    { id: idFactory(), name: '实验', order: 2, parentId: null },
  ];
}

function defaultState(idFactory = newId) {
  return {
    version: STORE_VERSION,
    categories: seedCategories(idFactory),
    items: [],
    extensions: [],
    permissions: {},
    sort: 'lastOpened',
  };
}

function normalizeState(parsed) {
  if (!parsed || typeof parsed !== 'object') return defaultState();
  return {
    version: STORE_VERSION,
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    items: Array.isArray(parsed.items) ? parsed.items : [],
    extensions: Array.isArray(parsed.extensions) ? parsed.extensions : [],
    permissions: parsed.permissions && typeof parsed.permissions === 'object' ? parsed.permissions : {},
    sort: parsed.sort === 'name' ? 'name' : 'lastOpened',
  };
}

class LibraryStore {
  constructor(filePath, { now = () => Date.now(), idFactory = newId } = {}) {
    this.filePath = filePath;
    this.now = now;
    this.idFactory = idFactory;
    this.state = defaultState(idFactory);
  }

  load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      this.state = normalizeState(JSON.parse(raw));
      validateCategoryTree(this.state.categories);
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.state = defaultState(this.idFactory);
        this.save();
      } else {
        this.state = defaultState(this.idFactory);
      }
    }
    return this.state;
  }

  save() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
    return this.state;
  }

  getState() {
    return this.state;
  }

  findItem(id) {
    return this.state.items.find((i) => i.id === id) || null;
  }

  findCategory(id) {
    return this.state.categories.find((c) => c.id === id) || null;
  }

  categoryIdByName(name) {
    if (!name) return null;
    const found = this.state.categories.find((c) => c.name === name);
    return found ? found.id : null;
  }

  setSort(sort) {
    this.state.sort = sort === 'name' ? 'name' : 'lastOpened';
    return this.save();
  }

  addCategory(name, parentId = null) {
    assertOneLevelNest(this.state.categories, parentId);
    const cat = createCategory(this.state.categories, {
      id: this.idFactory(),
      name,
      parentId: parentId || null,
      order: this.state.categories.length,
    });
    this.state.categories.push(cat);
    this.save();
    return cat;
  }

  updateCategory(id, patch) {
    const cat = this.findCategory(id);
    if (!cat) throw new Error('分类不存在');
    if (Object.prototype.hasOwnProperty.call(patch, 'parentId')) {
      const nextParent = patch.parentId || null;
      if (nextParent === id) throw new Error('分类不能作为自己的父分类');
      assertOneLevelNest(this.state.categories, nextParent);
      const children = this.state.categories.filter((c) => c.parentId === id);
      if (nextParent && children.length) {
        throw new Error('已有子分类的根分类不能再嵌到其他分类下');
      }
      cat.parentId = nextParent;
    }
    if (typeof patch.name === 'string' && patch.name.trim()) {
      cat.name = patch.name.trim();
    }
    if (typeof patch.order === 'number') cat.order = patch.order;
    this.save();
    return cat;
  }

  removeCategory(id) {
    this.state.categories = this.state.categories.filter((c) => c.id !== id);
    for (const child of this.state.categories) {
      if (child.parentId === id) child.parentId = null;
    }
    for (const item of this.state.items) {
      if (item.categoryId === id) item.categoryId = null;
    }
    this.save();
    return this.state;
  }

  _suggestCategoryId(filePath, title) {
    const name = suggestCategoryName(filePath, title);
    return this.categoryIdByName(name);
  }

  _makeFileItem(filePath, extras = {}) {
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new Error('文件不存在');
    }
    if (!isHtmlFile(abs)) {
      throw new Error('只支持将 .html / .htm 加入为应用');
    }
    const existing = this.state.items.find(
      (i) => i.kind === 'file' && path.resolve(i.path) === abs,
    );
    if (existing) return { item: existing, created: false };
    const title = extras.title || titleFromHtmlFile(abs);
    const item = {
      id: this.idFactory(),
      title,
      path: abs,
      kind: 'file',
      categoryId: extras.categoryId || this._suggestCategoryId(abs, title),
      tags: Array.isArray(extras.tags) ? extras.tags : [],
      coverPath: extras.coverPath || null,
      lastOpened: null,
      openMode: extras.openMode === 'tab' ? 'tab' : 'app',
      createdAt: this.now(),
    };
    this.state.items.push(item);
    return { item, created: true };
  }

  addFile(filePath, extras = {}) {
    const result = this._makeFileItem(filePath, extras);
    if (result.created) this.save();
    return result.item;
  }

  addFiles(filePaths, extras = {}) {
    const items = [];
    for (const p of filePaths || []) {
      items.push(this._makeFileItem(p, extras).item);
    }
    this.save();
    return items;
  }

  addFolder(dirPath) {
    const abs = path.resolve(dirPath);
    const files = scanHtmlFiles(abs);
    const items = [];
    for (const f of files) {
      items.push(this._makeFileItem(f).item);
    }
    const existingSource = this.state.items.find(
      (i) => i.kind === 'folder' && path.resolve(i.path) === abs,
    );
    if (!existingSource) {
      this.state.items.push({
        id: this.idFactory(),
        title: path.basename(abs),
        path: abs,
        kind: 'folder',
        categoryId: null,
        tags: [],
        coverPath: null,
        lastOpened: null,
        openMode: 'app',
        createdAt: this.now(),
      });
    }
    this.save();
    return { sourcePath: abs, files: items };
  }

  addUrl(url, extras = {}) {
    let href = String(url || '').trim();
    if (!href) throw new Error('网址不能为空');
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) href = `https://${href}`;
    const item = {
      id: this.idFactory(),
      title: extras.title || href,
      path: href,
      kind: 'url',
      categoryId: extras.categoryId || null,
      tags: Array.isArray(extras.tags) ? extras.tags : [],
      coverPath: extras.coverPath || null,
      lastOpened: null,
      openMode: extras.openMode === 'app' ? 'app' : 'tab',
      createdAt: this.now(),
    };
    this.state.items.push(item);
    this.save();
    return item;
  }

  updateItem(id, patch) {
    const item = this.findItem(id);
    if (!item) throw new Error('条目不存在');
    if (typeof patch.title === 'string' && patch.title.trim()) item.title = patch.title.trim();
    if (Object.prototype.hasOwnProperty.call(patch, 'categoryId')) {
      const cid = patch.categoryId || null;
      if (cid && !this.findCategory(cid)) throw new Error('分类不存在');
      item.categoryId = cid;
    }
    if (Array.isArray(patch.tags)) {
      item.tags = patch.tags.map((t) => String(t).trim()).filter(Boolean);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'coverPath')) {
      item.coverPath = patch.coverPath || null;
    }
    if (patch.openMode === 'app' || patch.openMode === 'tab') {
      item.openMode = patch.openMode;
    }
    this.save();
    return item;
  }

  removeItem(id) {
    const before = this.state.items.length;
    this.state.items = this.state.items.filter((i) => i.id !== id);
    if (this.state.items.length === before) throw new Error('条目不存在');
    this.save();
    return this.state;
  }

  touchLastOpened(id) {
    const item = this.findItem(id);
    if (!item) return null;
    item.lastOpened = this.now();
    this.save();
    return item;
  }

  upsertExtension(ext) {
    const idx = this.state.extensions.findIndex((e) => e.id === ext.id || e.sourcePath === ext.sourcePath);
    const row = {
      id: ext.id,
      name: ext.name,
      sourcePath: ext.sourcePath,
      enabled: ext.enabled !== false,
      unpackedPath: ext.unpackedPath || ext.sourcePath,
      kind: ext.kind || 'unpacked',
    };
    if (idx >= 0) this.state.extensions[idx] = { ...this.state.extensions[idx], ...row };
    else this.state.extensions.push(row);
    this.save();
    return row;
  }

  setExtensionEnabled(id, enabled) {
    const ext = this.state.extensions.find((e) => e.id === id);
    if (!ext) throw new Error('扩展不存在');
    ext.enabled = Boolean(enabled);
    this.save();
    return ext;
  }

  removeExtension(id) {
    this.state.extensions = this.state.extensions.filter((e) => e.id !== id);
    this.save();
    return this.state;
  }

  setPermission(key, permission, allow) {
    if (!this.state.permissions[key]) this.state.permissions[key] = {};
    this.state.permissions[key][permission] = Boolean(allow);
    this.save();
    return this.state.permissions;
  }
}

module.exports = {
  STORE_VERSION,
  defaultState,
  normalizeState,
  LibraryStore,
};
