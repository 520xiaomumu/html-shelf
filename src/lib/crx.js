'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function sliceCrxToZip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) {
    throw new Error('不是有效的 .crx 文件');
  }
  if (buf.subarray(0, 2).toString('utf8') === 'PK') {
    return buf;
  }
  if (buf.subarray(0, 4).toString('utf8') !== 'Cr24') {
    throw new Error('不是有效的 .crx 文件');
  }
  if (buf.length < 12) {
    throw new Error('CRX 文件过短');
  }
  const version = buf.readUInt32LE(4);
  if (version === 2) {
    const pubKeyLen = buf.readUInt32LE(8);
    const sigLen = buf.readUInt32LE(12);
    const start = 16 + pubKeyLen + sigLen;
    if (start > buf.length) throw new Error('CRX2 头损坏');
    return buf.subarray(start);
  }
  if (version === 3) {
    const headerSize = buf.readUInt32LE(8);
    const start = 12 + headerSize;
    if (start > buf.length) throw new Error('CRX3 头损坏');
    return buf.subarray(start);
  }
  throw new Error('不支持的 CRX 版本: ' + version);
}

function extractZipBuffer(buf, destDir) {
  const root = path.resolve(destDir);
  fs.mkdirSync(root, { recursive: true });
  let offset = 0;
  let files = 0;
  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const flags = buf.readUInt16LE(offset + 6);
    const method = buf.readUInt16LE(offset + 8);
    let compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.toString('utf8', offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;
    if (flags & 0x08) {
      throw new Error('该 CRX 使用了不支持的 zip data descriptor');
    }
    const dataEnd = dataStart + compSize;
    if (dataEnd > buf.length) throw new Error('CRX zip 数据截断');
    const data = buf.subarray(dataStart, dataEnd);
    offset = dataEnd;
    if (!name || name.endsWith('/')) {
      const dir = safeJoin(root, name);
      if (dir) fs.mkdirSync(dir, { recursive: true });
      continue;
    }
    const out = safeJoin(root, name);
    if (!out) continue;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    let raw;
    if (method === 0) raw = Buffer.from(data);
    else if (method === 8) raw = zlib.inflateRawSync(data);
    else throw new Error('不支持的 zip 压缩方式: ' + method);
    fs.writeFileSync(out, raw);
    files += 1;
  }
  if (files === 0) {
    throw new Error('CRX 中没有可解压的文件');
  }
}

function safeJoin(root, rel) {
  if (!rel) return null;
  const normalized = rel.replace(/\\/g, '/');
  if (normalized.includes('\0') || path.isAbsolute(normalized)) return null;
  const out = path.resolve(root, normalized);
  const relToRoot = path.relative(root, out);
  if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) return null;
  return out;
}

function extractCrx(crxPath, destDir) {
  const buf = fs.readFileSync(crxPath);
  const zip = sliceCrxToZip(buf);
  extractZipBuffer(zip, destDir);
  const manifest = path.join(destDir, 'manifest.json');
  if (!fs.existsSync(manifest)) {
    throw new Error('解压后没有 manifest.json，无法作为扩展加载');
  }
  return destDir;
}

module.exports = {
  sliceCrxToZip,
  extractZipBuffer,
  extractCrx,
};
