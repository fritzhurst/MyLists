const BASE = '/api';

export async function getCategories() {
  const res = await fetch(`${BASE}/categories`);
  return res.json();
}

export async function createCategory(name) {
  const res = await fetch(`${BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteCategory(id) {
  await fetch(`${BASE}/categories/${id}`, { method: 'DELETE' });
}

export async function getItems(categoryId) {
  const res = await fetch(`${BASE}/categories/${categoryId}/items`);
  return res.json();
}

export async function createItem(categoryId, text) {
  const res = await fetch(`${BASE}/categories/${categoryId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function deleteItem(id) {
  await fetch(`${BASE}/items/${id}`, { method: 'DELETE' });
}

export async function reorderItems(categoryId, orderedIds) {
  await fetch(`${BASE}/categories/${categoryId}/items/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds }),
  });
}
