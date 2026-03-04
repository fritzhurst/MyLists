import { useState, useRef, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ItemPopover from './ItemPopover.jsx';
import ItemDetailPanel from './ItemDetailPanel.jsx';

function DraggableItem({ item, priority, categoryType, onDelete, onUpdateItem, dragDisabled, showReleaseDate }) {
  const [hovered, setHovered] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const editRef = useRef(null);
  const clickTimer = useRef(null);

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

  // Close popover when dragging starts
  useEffect(() => {
    if (isDragging) setPopoverOpen(false);
  }, [isDragging]);

  // Focus edit input when entering edit mode
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing]);

  // Handle tap on drag handle — toggle popover for mobile
  const handleHandleClick = useCallback((e) => {
    if (hasMetadata) {
      setPopoverOpen(prev => !prev);
    }
  }, [hasMetadata]);

  // Single click opens detail panel, double click enters edit mode
  const handleTextClick = useCallback(() => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      // Double click — enter edit mode
      setEditText(item.text);
      setEditing(true);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        // Single click — open detail panel
        setShowDetail(true);
      }, 250);
    }
  }, [item.text]);

  const handleEditSave = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.text && onUpdateItem) {
      onUpdateItem(item.id, trimmed);
    }
    setEditing(false);
  }, [editText, item.id, item.text, onUpdateItem]);

  const handleEditKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setEditText(item.text);
    }
  }, [handleEditSave, item.text]);

  const showPopover = (hovered || popoverOpen) && hasMetadata && !isDragging;

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
            <input
              ref={editRef}
              className="item-text-edit"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleEditKeyDown}
            />
          ) : (
            <span
              className="item-text item-text-clickable"
              onClick={handleTextClick}
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
