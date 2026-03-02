import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ItemPopover from './ItemPopover.jsx';
import ItemDetailPanel from './ItemDetailPanel.jsx';

function DraggableItem({ item, index, categoryType, onDelete, dragDisabled }) {
  const [hovered, setHovered] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: dragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasMetadata = item.metadata && categoryType !== 'generic';
  const thumbUrl = item.metadata?.thumbnailUrl || item.metadata?.posterUrl;

  const formattedDate = item.created_at
    ? new Date(item.created_at + 'Z').toLocaleDateString()
    : null;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`list-item ${hasMetadata ? 'list-item-media' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="item-priority">{index + 1}</span>
        {!dragDisabled && (
          <span className="drag-handle" {...attributes} {...listeners}>
            &#x2630;
          </span>
        )}
        {hasMetadata && thumbUrl && (
          <img src={thumbUrl} alt="" className="item-thumbnail" />
        )}
        <span
          className="item-text item-text-clickable"
          onClick={() => setShowDetail(true)}
        >
          {item.text}
        </span>
        {formattedDate && <span className="item-date">{formattedDate}</span>}
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
      {showDetail && (
        <ItemDetailPanel
          item={item}
          categoryType={categoryType}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}

export default DraggableItem;
