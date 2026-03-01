import { useState } from 'react';
import Tab from './Tab.jsx';

function TabBar({ categories, activeCategoryId, onSelect, onAdd, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newName.trim()) {
      onAdd(newName.trim());
      setNewName('');
      setAdding(false);
    }
  };

  return (
    <div className="tab-bar">
      <div className="tabs">
        {categories.map((cat) => (
          <Tab
            key={cat.id}
            category={cat}
            isActive={cat.id === activeCategoryId}
            onSelect={() => onSelect(cat.id)}
            onDelete={() => onDelete(cat.id)}
          />
        ))}

        {adding ? (
          <form className="add-category-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              autoFocus
              onBlur={() => {
                if (!newName.trim()) setAdding(false);
              }}
            />
            <button type="submit">Add</button>
          </form>
        ) : (
          <button className="add-tab-btn" onClick={() => setAdding(true)}>
            +
          </button>
        )}
      </div>
    </div>
  );
}

export default TabBar;
