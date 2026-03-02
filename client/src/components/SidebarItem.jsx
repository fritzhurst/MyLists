import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const typeIcons = { generic: '', books: '\u{1F4DA}', movies: '\u{1F3AC}', tvshows: '\u{1F4FA}' };

function SidebarItem({ category, isActive, onSelect, onDelete }) {
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

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${category.name}" and all its items?`)) {
      onDelete();
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
      <span className="sidebar-item-name">
        {typeIcons[category.type] || ''} {category.name}
      </span>
      <button className="sidebar-item-delete" onClick={handleDelete}>&times;</button>
    </div>
  );
}

export default SidebarItem;
