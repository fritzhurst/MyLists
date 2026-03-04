import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const typeIcons = { generic: '', books: '\u{1F4DA}', movies: '\u{1F3AC}', tvshows: '\u{1F4FA}' };

function SidebarItem({ category, isActive, onSelect, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const inputRef = useRef(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${category.name}" and all its items?`)) {
      onDelete();
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setEditName(category.name);
    setEditing(true);
  };

  const handleSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== category.name) {
      onRename(category.id, trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setEditName(category.name);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
      onClick={onSelect}
    >
      <span className="sidebar-drag" {...attributes} {...listeners}>&#x2630;</span>
      {editing ? (
        <input
          ref={inputRef}
          className="sidebar-item-edit"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="sidebar-item-name" onDoubleClick={handleDoubleClick}>
          {typeIcons[category.type] || ''} {category.name}
        </span>
      )}
      <button className="sidebar-item-delete" onClick={handleDelete}>&times;</button>
    </div>
  );
}

export default SidebarItem;
