import { useState, useEffect, useCallback } from 'react';
import TabBar from './components/TabBar.jsx';
import ListContainer from './components/ListContainer.jsx';
import * as api from './api.js';

function App() {
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [items, setItems] = useState([]);

  // Load categories on mount
  useEffect(() => {
    api.getCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) {
        setActiveCategoryId(cats[0].id);
      }
    });
  }, []);

  // Load items when active category changes
  useEffect(() => {
    if (activeCategoryId != null) {
      api.getItems(activeCategoryId).then(setItems);
    } else {
      setItems([]);
    }
  }, [activeCategoryId]);

  const handleAddCategory = useCallback(async (name) => {
    const cat = await api.createCategory(name);
    setCategories((prev) => [...prev, cat]);
    setActiveCategoryId(cat.id);
  }, []);

  const handleDeleteCategory = useCallback(async (id) => {
    await api.deleteCategory(id);
    setCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      // If we deleted the active tab, switch to the first remaining
      if (id === activeCategoryId) {
        setActiveCategoryId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  }, [activeCategoryId]);

  const handleAddItem = useCallback(async (text) => {
    if (activeCategoryId == null) return;
    const item = await api.createItem(activeCategoryId, text);
    setItems((prev) => [...prev, item]);
  }, [activeCategoryId]);

  const handleDeleteItem = useCallback(async (id) => {
    await api.deleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleReorder = useCallback(async (reorderedItems) => {
    setItems(reorderedItems);
    const orderedIds = reorderedItems.map((i) => i.id);
    await api.reorderItems(activeCategoryId, orderedIds);
  }, [activeCategoryId]);

  return (
    <div className="app">
      <h1>MyLists</h1>
      <TabBar
        categories={categories}
        activeCategoryId={activeCategoryId}
        onSelect={setActiveCategoryId}
        onAdd={handleAddCategory}
        onDelete={handleDeleteCategory}
      />
      {activeCategoryId != null && (
        <ListContainer
          items={items}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          onReorder={handleReorder}
        />
      )}
      {categories.length === 0 && (
        <p className="empty-message">Create a category to get started!</p>
      )}
    </div>
  );
}

export default App;
