'use strict';

function findCategory(categories, id) {
  if (id == null || id === '') return null;
  return (categories || []).find((c) => c.id === id) || null;
}

function assertOneLevelNest(categories, parentId) {
  if (parentId == null || parentId === '') return;
  const parent = findCategory(categories, parentId);
  if (!parent) {
    throw new Error('父分类不存在');
  }
  if (parent.parentId != null && parent.parentId !== '') {
    throw new Error('分类只允许一层子分类：子分类不能再嵌套');
  }
}

function canBeParent(category) {
  return Boolean(category) && (category.parentId == null || category.parentId === '');
}

function validateCategoryTree(categories) {
  const list = categories || [];
  const ids = new Set(list.map((c) => c.id));
  for (const cat of list) {
    if (cat.parentId) {
      if (!ids.has(cat.parentId)) {
        throw new Error(`分类「${cat.name}」的父分类不存在`);
      }
      const parent = findCategory(list, cat.parentId);
      if (parent.parentId) {
        throw new Error(`分类「${cat.name}」违反一层嵌套约束`);
      }
    }
  }
  return true;
}

function createCategory(categories, { id, name, parentId = null, order }) {
  assertOneLevelNest(categories, parentId);
  const nextOrder = order != null ? order : (categories || []).length;
  return {
    id,
    name: String(name || '').trim() || '未命名分类',
    order: nextOrder,
    parentId: parentId || null,
  };
}

function categoryHasChildren(categories, id) {
  return (categories || []).some((c) => c.parentId === id);
}

module.exports = {
  findCategory,
  assertOneLevelNest,
  canBeParent,
  validateCategoryTree,
  createCategory,
  categoryHasChildren,
};
