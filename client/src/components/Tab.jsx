function Tab({ category, isActive, onSelect, onDelete }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${category.name}" and all its items?`)) {
      onDelete();
    }
  };

  return (
    <button
      className={`tab ${isActive ? 'tab-active' : ''}`}
      onClick={onSelect}
    >
      <span className="tab-name">{category.name}</span>
      <span className="tab-delete" onClick={handleDelete} title="Delete category">
        &times;
      </span>
    </button>
  );
}

export default Tab;
