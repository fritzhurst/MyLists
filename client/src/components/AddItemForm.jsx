import { useState } from 'react';

function AddItemForm({ onAddItem }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onAddItem(text.trim());
      setText('');
    }
  };

  return (
    <form className="add-item-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add an item..."
      />
      <button type="submit">Add</button>
    </form>
  );
}

export default AddItemForm;
