import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ItemPopover from './ItemPopover.jsx';

function DraggableItem({ item, categoryType, onDelete }) {
  const [hovered, setHovered] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasMetadata = item.metadata && categoryType !== 'generic';
  const thumbUrl = item.metadata?.thumbnailUrl || item.metadata?.posterUrl;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`list-item ${hasMetadata ? 'list-item-media' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="drag-handle" {...attributes} {...listeners}>
        &#x2630;
      </span>
      {hasMetadata && thumbUrl && (
        <img src={thumbUrl} alt="" className="item-thumbnail" />
      )}
      <span className="item-text">{item.text}</span>
      <button
        className="item-delete"
        onClick={() => onDelete(item.id)}
        title="Delete item"
      >
        &times;
      </button>
      {hovered && hasMetadata && !isDragging && (
        <ItemPopover item={item} categoryType={categoryType} />
      )}
    </div>
  );
}

export default DraggableItem;
