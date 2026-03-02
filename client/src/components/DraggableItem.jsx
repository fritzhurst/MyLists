import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ItemPopover from './ItemPopover.jsx';
import ItemDetailPanel from './ItemDetailPanel.jsx';

function DraggableItem({ item, priority, categoryType, onDelete, dragDisabled, showReleaseDate }) {
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

  // Priority: use locked manual priority if provided, otherwise use sort_order + 1
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

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`list-item ${hasMetadata ? 'list-item-media' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="item-priority">{displayPriority}</span>
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
