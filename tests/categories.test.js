'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  assertOneLevelNest,
  createCategory,
  validateCategoryTree,
} = require('../src/lib/categories');

describe('one-level category nest constraint', () => {
  it('allows a root category and one child level', () => {
    const root = createCategory([], { id: 'root', name: '工具', parentId: null });
    const child = createCategory([root], { id: 'child', name: '计时', parentId: 'root' });
    assert.equal(root.parentId, null);
    assert.equal(child.parentId, 'root');
    assert.equal(validateCategoryTree([root, child]), true);
  });

  it('rejects nesting a child under another child', () => {
    const root = createCategory([], { id: 'root', name: '工具' });
    const child = createCategory([root], { id: 'child', name: '计时', parentId: 'root' });
    assert.throws(
      () => createCategory([root, child], { id: 'grand', name: '秒表', parentId: 'child' }),
      /一层子分类/,
    );
    assert.throws(() => assertOneLevelNest([root, child], 'child'), /一层子分类/);
  });

  it('rejects a missing parent', () => {
    assert.throws(() => assertOneLevelNest([], 'nope'), /父分类不存在/);
  });

  it('validateCategoryTree flags a two-level chain', () => {
    const bad = [
      { id: 'a', name: 'A', parentId: null, order: 0 },
      { id: 'b', name: 'B', parentId: 'a', order: 1 },
      { id: 'c', name: 'C', parentId: 'b', order: 2 },
    ];
    assert.throws(() => validateCategoryTree(bad), /一层嵌套/);
  });
});
