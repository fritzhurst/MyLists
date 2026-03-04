import { useState, useEffect, useRef, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ItemPopover from './ItemPopover.jsx';
import ItemDetailPanel from './ItemDetailPanel.jsx';
import * as api from '../api.js';

const searchFnMap = {
  books: api.searchBooks,
  movies: api.searchMovies,
  tvshows: api.searchTV,
};

const detailFnMap = {
  books: (result) => api.getBookDetails(result.externalId.replace('/works/', '')),
  movies: (result) => api.getMovieDetails(result.externalId),
  tvshows: (result) => api.getTVDetails(result.externalId),
};

function DraggableItem({ item, priority, categoryType, onDelete, onUpdateItem, dragDisabled, showReleaseDate }) {
  const [hovered, setHovered] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const editRef = useRef(null);
  const debounceRef = useRef(null);
  const dragOccurredRef = useRef(false);

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
  const isSpecialized = categoryType !== 'generic';

  const displayPriority = priority != null ? priority : (item.sort_order + 1);

  const formattedDate = item.created_at
    ? new Date(item.created_at + 'Z').toLocaleDateString()
    : null;

  const releaseDate = item.metadata?.releaseDate || item.metadata?.year?.toString() || null;
  const formattedRelease = releaseDate
    ? (releaseDate.length === 4 ? releaseDate : new Date(releaseDate).toLocaleDateString())
    : null;

  const hasNotes = (item.note_count || 0) > 0;
  const hasAttachments = (item.attachment_count || 0) > 0;

  // Track drag occurrence and close popover when dragging starts
  useEffect(() => {
    if (isDragging) {
      dragOccurredRef.current = true;
      setPopoverOpen(false);
    }
  }, [isDragging]);

  // Focus edit input when entering edit mode
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing]);

  // Type-ahead search when editing specialized types
  useEffect(() => {
    if (!editing || !isSpecialized) return;
    if (!editText.trim() || editText.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const searchFn = searchFnMap[categoryType];
        const data = await searchFn(editText.trim());
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editText, editing, isSpecialized, categoryType]);

  // Handle tap on drag handle — toggle popover for mobile (suppress after drag)
  const handleHandleClick = useCallback((e) => {
    if (dragOccurredRef.current) {
      dragOccurredRef.current = false;
      return;
    }
    if (hasMetadata) {
      setPopoverOpen(prev => !prev);
    }
  }, [hasMetadata]);

  const startEditing = useCallback((e) => {
    e.stopPropagation();
    setEditText(item.text);
    setSearchResults([]);
    setEditing(true);
  }, [item.text]);

  // Save plain text (manual entry or generic type)
  const handleEditSave = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.text && onUpdateItem) {
      onUpdateItem(item.id, trimmed);
    }
    setEditing(false);
    setSearchResults([]);
  }, [editText, item.id, item.text, onUpdateItem]);

  // Pick from type-ahead results
  const handlePick = useCallback(async (result) => {
    setPicking(true);
    try {
      const detailFn = detailFnMap[categoryType];
      let metadata = { ...result };
      if (detailFn) {
        const details = await detailFn(result);
        metadata = { ...metadata, ...details };
      }
      onUpdateItem(item.id, result.title, metadata);
    } catch {
      onUpdateItem(item.id, result.title, { ...result });
    }
    setEditing(false);
    setSearchResults([]);
    setPicking(false);
  }, [categoryType, item.id, onUpdateItem]);

  const handleEditKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setEditText(item.text);
      setSearchResults([]);
    }
  }, [handleEditSave, item.text]);

  const showPopover = (hovered || popoverOpen) && hasMetadata && !isDragging && !editing;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`list-item ${hasMetadata ? 'list-item-media' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPopoverOpen(false); }}
      >
        <span className="item-priority">{displayPriority}</span>
        {!dragDisabled && (
          <span
            className="drag-handle"
            onClick={handleHandleClick}
            {...attributes}
            {...listeners}
          >
            &#x2630;
          </span>
        )}
        {hasMetadata && thumbUrl && (
          <img src={thumbUrl} alt="" className="item-thumbnail" />
        )}
        <div className="item-text-wrapper">
          {editing ? (
            <div className="item-edit-form">
              <input
                ref={editRef}
                className="item-text-edit"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => {
                  // Delay to allow click on search results
                  setTimeout(() => {
                    if (!picking) {
                      handleEditSave();
                    }
                  }, 200);
                }}
                onKeyDown={handleEditKeyDown}
                disabled={picking}
              />
              {searchLoading && <span className="edit-search-spinner">Searching...</span>}
              {searchResults.length > 0 && !picking && (
                <ul className="edit-search-results">
                  {searchResults.map((r) => (
                    <li key={r.externalId} className="search-result" onMouseDown={(e) => e.preventDefault()} onClick={() => handlePick(r)}>
                      {r.thumbnailUrl && (
                        <img src={r.thumbnailUrl} alt="" className="search-thumb" />
                      )}
                      <div className="search-result-info">
                        <strong>{r.title}</strong>
                        {r.year && <span className="search-result-year"> ({r.year})</span>}
                        {r.author && <span className="search-result-detail"> &mdash; {r.author}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <span
              className="item-text item-text-clickable"
              onClick={() => setShowDetail(true)}
            >
              {item.text}
            </span>
          )}
          <div className="item-dates-mobile">
            {showReleaseDate && formattedRelease && (
              <span className="item-date-mobile">Released: {formattedRelease}</span>
            )}
            {formattedDate && (
              <span className="item-date-mobile">Added: {formattedDate}</span>
            )}
          </div>
        </div>
        {!editing && (
          <button className="item-edit-btn" onClick={startEditing} title="Edit item">
            &#x270E;
          </button>
        )}
        {showReleaseDate && (
          <span className="item-release-date" title="Release date">{formattedRelease || '—'}</span>
        )}
        <span className="item-date" title="Date added">{formattedDate || '—'}</span>
        {(hasNotes || hasAttachments) && (
          <span className="item-indicators" onClick={() => setShowDetail(true)}>
            {hasNotes && <span className="indicator-note" title={`${item.note_count} note(s)`}>&#x1F5D2;</span>}
            {hasAttachments && <span className="indicator-attach" title={`${item.attachment_count} attachment(s)`}>&#x1F4CE;</span>}
          </span>
        )}
        <button
          className="item-delete"
          onClick={() => onDelete(item.id)}
          title="Delete item"
        >
          &times;
        </button>
        {showPopover && (
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
