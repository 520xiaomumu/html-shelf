'use strict';

const fs = require('fs');
const path = require('path');

const HTML_EXT = new Set(['.html', '.htm']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', 'dist', 'out', 'user-data']);

function isHtmlFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return HTML_EXT.has(ext);
}

function scanHtmlFiles(rootDir, options = {}) {
  const maxDepth = options.maxDepth == null ? 8 : options.maxDepth;
  const absRoot = path.resolve(rootDir);
  const stat = fs.statSync(absRoot);
  if (!stat.isDirectory()) {
    throw new Error('scanHtmlFiles 需要一个文件夹路径');
  }
  const found = [];
  walk(absRoot, 0, maxDepth, found);
  found.sort((a, b) => a.localeCompare(b, 'zh'));
  return found;
}

function walk(dir, depth, maxDepth, found) {
  if (depth > maxDepth) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    const full = path.join(dir, entry.name);
    let st;
    try {
      st = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, depth + 1, maxDepth, found);
    } else if (st.isFile() && isHtmlFile(full)) {
      found.push(full);
    }
  }
}

function titleFromHtmlFile(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  try {
    const buf = fs.readFileSync(filePath, 'utf8');
    const m = buf.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m && m[1].trim()) return decodeEntities(m[1].trim());
  } catch {
    // use filename
  }
  return base;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function suggestCategoryName(filePath, title) {
  const hay = `${path.basename(filePath)} ${title || ''}`.toLowerCase();
  if (/tool|工具|timer|计时|换算|便签/.test(hay)) return '工具';
  if (/game|游戏|three|连珠/.test(hay)) return '游戏';
  if (/lab|实验|media|媒体|webrtc|video|视频/.test(hay)) return '实验';
  return null;
}

module.exports = {
  HTML_EXT,
  SKIP_DIRS,
  isHtmlFile,
  scanHtmlFiles,
  titleFromHtmlFile,
  suggestCategoryName,
};
