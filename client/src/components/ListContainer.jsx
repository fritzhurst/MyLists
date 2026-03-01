import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import DraggableItem from './DraggableItem.jsx';
import AddItemForm from './AddItemForm.jsx';

function ListContainer({ items, onAddItem, onDeleteItem, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex);
      onReorder(reordered);
    }
  };

  return (
    <div className="list-container">
      <AddItemForm onAddItem={onAddItem} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <DraggableItem
              key={item.id}
              item={item}
              onDelete={onDeleteItem}
            />
          ))}
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <p className="empty-message">No items yet. Add one above!</p>
      )}
    </div>
  );
}

export default ListContainer;
