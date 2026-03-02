import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../api.js';

function ItemDetailPanel({ item, categoryType, onClose }) {
  const [notes, setNotes] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.getItemNotes(item.id).then(data => {
      setNotes(data.notes || []);
      setAttachments(data.attachments || []);
    });
  }, [item.id]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const note = await api.addNote(item.id, newNote.trim());
    setNotes(prev => [note, ...prev]);
    setNewNote('');
  };

  const handleDeleteNote = async (noteId) => {
    await api.deleteNote(item.id, noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const newAttachments = await api.uploadAttachments(item.id, files);
      setAttachments(prev => [...newAttachments, ...prev]);
    } catch {
      // Upload failed silently
    }
    setUploading(false);
  }, [item.id]);

  const handleFileInput = (e) => handleFiles(e.target.files);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handlePaste = useCallback((e) => {
    const clipItems = e.clipboardData?.items;
    if (!clipItems) return;
    const files = [];
    for (const ci of clipItems) {
      if (ci.kind === 'file') files.push(ci.getAsFile());
    }
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
    }
  }, [handleFiles]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleDeleteAttachment = async (attachmentId) => {
    await api.deleteAttachment(item.id, attachmentId);
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  };

  const isImage = (mimeType) => mimeType?.startsWith('image/');

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="item-detail-overlay" onClick={onClose}>
      <div className="item-detail-panel" onClick={e => e.stopPropagation()}>
        <div className="item-detail-header">
          <h2>{item.text}</h2>
          <button className="settings-close" onClick={onClose}>&times;</button>
        </div>

        {/* Notes section */}
        <div className="item-detail-section">
          <h3>Notes</h3>
          <form onSubmit={handleAddNote} className="note-add-form">
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add a note..."
              rows={3}
            />
            <button type="submit" disabled={!newNote.trim()}>Add Note</button>
          </form>
          {notes.map(note => (
            <div key={note.id} className="note-item">
              <p>{note.content}</p>
              <div className="note-meta">
                <span>{new Date(note.created_at + 'Z').toLocaleString()}</span>
                <button onClick={() => handleDeleteNote(note.id)}>&times;</button>
              </div>
            </div>
          ))}
        </div>

        {/* Attachments section */}
        <div className="item-detail-section">
          <h3>Attachments</h3>
          <div
            className={`attachment-dropzone ${dragOver ? 'attachment-dropzone-active' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading...' : 'Drop files here, paste from clipboard, or click to browse'}
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileInput} />
          </div>
          <div className="attachment-list">
            {attachments.map(att => (
              <div key={att.id} className="attachment-item">
                {isImage(att.mime_type) ? (
                  <img
                    src={`/api/uploads/${item.id}/${att.filename}`}
                    alt={att.original_name}
                    className="attachment-preview"
                  />
                ) : (
                  <a
                    href={`/api/uploads/${item.id}/${att.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="attachment-file"
                  >
                    {att.original_name}
                  </a>
                )}
                <div className="attachment-meta">
                  <span className="attachment-name">{att.original_name}</span>
                  <span className="attachment-size">{formatSize(att.size)}</span>
                  <button onClick={() => handleDeleteAttachment(att.id)}>&times;</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ItemDetailPanel;
