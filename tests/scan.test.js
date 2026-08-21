'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scanHtmlFiles, isHtmlFile } = require('../src/lib/scan');

describe('folder scan of html/htm', () => {
  let root;

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-shelf-scan-'));
    fs.writeFileSync(path.join(root, 'alpha.html'), '<title>Alpha</title>');
    fs.writeFileSync(path.join(root, 'beta.HTM'), '<title>Beta</title>');
    fs.writeFileSync(path.join(root, 'notes.txt'), 'not html');
    fs.writeFileSync(path.join(root, 'script.js'), 'console.log(1)');
    fs.mkdirSync(path.join(root, 'nested'));
    fs.writeFileSync(path.join(root, 'nested', 'gamma.html'), '<title>Gamma</title>');
    fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(root, 'node_modules', 'pkg', 'skip.html'), '<title>Skip</title>');
  });

  after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('collects .html and .htm, ignoring other files', () => {
    const found = scanHtmlFiles(root);
    const names = found.map((f) => path.basename(f).toLowerCase()).sort();
    assert.deepEqual(names, ['alpha.html', 'beta.htm', 'gamma.html']);
    assert.ok(found.every((f) => isHtmlFile(f)));
    assert.ok(!found.some((f) => f.endsWith('skip.html')));
    assert.ok(!found.some((f) => f.endsWith('notes.txt')));
  });

  it('scans repo examples/ into the three demo html files', () => {
    const examples = path.join(__dirname, '..', 'examples');
    const found = scanHtmlFiles(examples).map((f) => path.basename(f)).sort();
    assert.deepEqual(found, ['game-three.html', 'lab-media.html', 'tool-timer.html']);
  });

  it('rejects a file path as scan root', () => {
    assert.throws(() => scanHtmlFiles(path.join(root, 'alpha.html')), /文件夹/);
  });
});
