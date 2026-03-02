import { useState, useMemo } from 'react';
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
import SearchAddForm from './SearchAddForm.jsx';

function ListContainer({ items, categoryType, onAddItem, onDeleteItem, onReorder }) {
  const [sortBy, setSortBy] = useState('manual');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const displayItems = useMemo(() => {
    if (sortBy === 'manual') return items;
    const sorted = [...items].sort((a, b) => {
      const dateA = a.created_at || '';
      const dateB = b.created_at || '';
      return sortBy === 'date_asc'
        ? dateA.localeCompare(dateB)
        : dateB.localeCompare(dateA);
    });
    return sorted;
  }, [items, sortBy]);

  const isDragDisabled = sortBy !== 'manual';

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
      {categoryType === 'generic' ? (
        <AddItemForm onAddItem={onAddItem} />
      ) : (
        <SearchAddForm categoryType={categoryType} onAddItem={onAddItem} />
      )}

      {items.length > 0 && (
        <div className="sort-controls">
          <label>Sort:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="manual">Manual (drag to reorder)</option>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
          </select>
        </div>
      )}

      <DndContext
        sensors={isDragDisabled ? [] : sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={displayItems} strategy={verticalListSortingStrategy}>
          {displayItems.map((item, index) => (
            <DraggableItem
              key={item.id}
              item={item}
              index={index}
              categoryType={categoryType}
              onDelete={onDeleteItem}
              dragDisabled={isDragDisabled}
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
