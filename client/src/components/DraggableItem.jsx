import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function DraggableItem({ item, onDelete }) {
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

  return (
    <div ref={setNodeRef} style={style} className="list-item">
      <span className="drag-handle" {...attributes} {...listeners}>
        &#x2630;
      </span>
      <span className="item-text">{item.text}</span>
      <button
        className="item-delete"
        onClick={() => onDelete(item.id)}
        title="Delete item"
      >
        &times;
      </button>
    </div>
  );
}

export default DraggableItem;
