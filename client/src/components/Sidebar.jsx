import { useState } from 'react';
import { version } from '../../package.json';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SidebarItem from './SidebarItem.jsx';

function Sidebar({ categories, activeCategoryId, onSelect, onAdd, onDelete, onRename, onReorder, isOpen, onClose }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('generic');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex(c => c.id === active.id);
      const newIndex = categories.findIndex(c => c.id === over.id);
      const reordered = arrayMove(categories, oldIndex, newIndex);
      onReorder(reordered);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newName.trim()) {
      onAdd(newName.trim(), newType);
      setNewName('');
      setNewType('generic');
      setAdding(false);
    }
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h2>Lists</h2>
          <button className="sidebar-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="sidebar-add">
          {adding ? (
            <form className="sidebar-add-form" onSubmit={handleSubmit}>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="List name"
                autoFocus
              />
              <select value={newType} onChange={e => setNewType(e.target.value)}>
                <option value="generic">Generic</option>
                <option value="books">Books</option>
                <option value="movies">Movies</option>
                <option value="tvshows">TV Shows</option>
              </select>
              <div className="sidebar-add-actions">
                <button type="submit">Add</button>
                <button type="button" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <button className="sidebar-add-btn" onClick={() => setAdding(true)}>+ New List</button>
          )}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories} strategy={verticalListSortingStrategy}>
            <nav className="sidebar-nav">
              {categories.map(cat => (
                <SidebarItem
                  key={cat.id}
                  category={cat}
                  isActive={cat.id === activeCategoryId}
                  onSelect={() => { onSelect(cat.id); onClose(); }}
                  onDelete={() => onDelete(cat.id)}
                  onRename={onRename}
                />
              ))}
            </nav>
          </SortableContext>
        </DndContext>

        <div className="sidebar-version">v{version}</div>
      </aside>
    </>
  );
}

export default Sidebar;
