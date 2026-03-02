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

function getReleaseDate(item) {
  return item.metadata?.releaseDate || item.metadata?.year?.toString() || '';
}

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
      if (sortBy === 'date_asc' || sortBy === 'date_desc') {
        const dateA = a.created_at || '';
        const dateB = b.created_at || '';
        return sortBy === 'date_asc'
          ? dateA.localeCompare(dateB)
          : dateB.localeCompare(dateA);
      }
      if (sortBy === 'release_asc' || sortBy === 'release_desc') {
        const relA = getReleaseDate(a);
        const relB = getReleaseDate(b);
        return sortBy === 'release_asc'
          ? relA.localeCompare(relB)
          : relB.localeCompare(relA);
      }
      return 0;
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

  const handleRenumber = () => {
    onReorder([...displayItems]);
    setSortBy('manual');
  };

  // Map item id to its manual sort position (1-based), locked during non-manual sorts
  const manualOrderMap = useMemo(() => {
    const map = {};
    items.forEach((item, idx) => { map[item.id] = idx + 1; });
    return map;
  }, [items]);

  const showReleaseDate = categoryType !== 'generic';

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
            <option value="date_desc">Date Added (newest first)</option>
            <option value="date_asc">Date Added (oldest first)</option>
            {showReleaseDate && (
              <>
                <option value="release_desc">Release Date (newest first)</option>
                <option value="release_asc">Release Date (oldest first)</option>
              </>
            )}
          </select>
          {isDragDisabled && (
            <button className="renumber-btn" onClick={handleRenumber} title="Apply current sort as new manual order">
              Renumber
            </button>
          )}
        </div>
      )}

      {displayItems.length > 0 && (
        <div className="list-header">
          <span className="list-header-priority">#</span>
          {!isDragDisabled && <span className="list-header-drag"></span>}
          <span className="list-header-text">Item</span>
          {showReleaseDate && <span className="list-header-release">Released</span>}
          <span className="list-header-added">Added</span>
          <span className="list-header-actions"></span>
        </div>
      )}

      <DndContext
        sensors={isDragDisabled ? [] : sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={displayItems} strategy={verticalListSortingStrategy}>
          {displayItems.map((item) => (
            <DraggableItem
              key={item.id}
              item={item}
              priority={isDragDisabled ? manualOrderMap[item.id] : null}
              categoryType={categoryType}
              onDelete={onDeleteItem}
              dragDisabled={isDragDisabled}
              showReleaseDate={showReleaseDate}
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
