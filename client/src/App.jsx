import { useState, useEffect, useCallback } from 'react';
import LoginPage from './components/LoginPage.jsx';
import ChangePasswordPage from './components/ChangePasswordPage.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import Sidebar from './components/Sidebar.jsx';
import ListContainer from './components/ListContainer.jsx';
import PlexPlaylistModal from './components/PlexPlaylistModal.jsx';
import * as api from './api.js';

function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPlexModal, setShowPlexModal] = useState(false);

  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [items, setItems] = useState([]);

  const handleLogin = (userData, needsPasswordChange) => {
    setUser(userData);
    if (needsPasswordChange) {
      setMustChangePassword(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeCategoryId');
    setUser(null);
    setCategories([]);
    setItems([]);
    setActiveCategoryId(null);
    setMustChangePassword(false);
  };

  const handlePasswordChanged = () => {
    setMustChangePassword(false);
    setTempPassword('');
  };

  // Load categories when user is logged in, restore last active list
  useEffect(() => {
    if (user && !mustChangePassword) {
      api.getCategories().then((cats) => {
        setCategories(cats);
        if (cats.length > 0) {
          const savedId = parseInt(localStorage.getItem('activeCategoryId'), 10);
          const exists = cats.some(c => c.id === savedId);
          setActiveCategoryId(exists ? savedId : cats[0].id);
        }
      });
    }
  }, [user, mustChangePassword]);

  // Load items when active category changes, persist selection
  useEffect(() => {
    if (activeCategoryId != null) {
      localStorage.setItem('activeCategoryId', activeCategoryId);
      api.getItems(activeCategoryId).then(setItems);
    } else {
      setItems([]);
    }
  }, [activeCategoryId]);

  const activeCategory = categories.find(c => c.id === activeCategoryId);
  const activeCategoryType = activeCategory?.type || 'generic';

  const handleAddCategory = useCallback(async (name, type) => {
    const cat = await api.createCategory(name, type);
    setCategories((prev) => [...prev, cat]);
    setActiveCategoryId(cat.id);
  }, []);

  const handleDeleteCategory = useCallback(async (id) => {
    await api.deleteCategory(id);
    setCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      if (id === activeCategoryId) {
        setActiveCategoryId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  }, [activeCategoryId]);

  const handleRenameCategory = useCallback(async (id, name) => {
    const updated = await api.renameCategory(id, name);
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, name: updated.name } : c));
  }, []);

  const handleReorderCategories = useCallback(async (reorderedCategories) => {
    setCategories(reorderedCategories);
    const orderedIds = reorderedCategories.map(c => c.id);
    await api.reorderCategories(orderedIds);
  }, []);

  const handleAddItem = useCallback(async (text, metadata) => {
    if (activeCategoryId == null) return;
    const item = await api.createItem(activeCategoryId, text, metadata || null);
    setItems((prev) => [...prev, item]);
  }, [activeCategoryId]);

  const handleUpdateItem = useCallback(async (id, text, metadata) => {
    const updated = await api.updateItem(id, text, metadata);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...updated } : i));
  }, []);

  const handleDeleteItem = useCallback(async (id) => {
    await api.deleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleReorder = useCallback(async (reorderedItems) => {
    const updated = reorderedItems.map((item, idx) => ({ ...item, sort_order: idx }));
    setItems(updated);
    const orderedIds = updated.map((i) => i.id);
    await api.reorderItems(activeCategoryId, orderedIds);
  }, [activeCategoryId]);

  // Not logged in — show login
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Must change password
  if (mustChangePassword) {
    return (
      <ChangePasswordPage
        currentTempPassword={tempPassword || 'changeme'}
        onDone={handlePasswordChanged}
      />
    );
  }

  // Admin panel overlay
  if (showAdmin) {
    return <AdminPanel onClose={() => setShowAdmin(false)} />;
  }

  // Settings overlay
  if (showSettings) {
    return <SettingsPage user={user} onClose={() => setShowSettings(false)} />;
  }

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-left">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>&#9776;</button>
          <h1>MyLists</h1>
        </div>
        <div className="header-actions">
          <span className="user-info">{user.email}</span>
          {user.role === 'admin' && (
            <button className="header-btn" onClick={() => setShowAdmin(true)}>Users</button>
          )}
          <button className="header-btn" onClick={() => setShowSettings(true)}>Settings</button>
          <button className="header-btn header-btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>
      <div className="app-body">
        <Sidebar
          categories={categories}
          activeCategoryId={activeCategoryId}
          onSelect={setActiveCategoryId}
          onAdd={handleAddCategory}
          onDelete={handleDeleteCategory}
          onRename={handleRenameCategory}
          onReorder={handleReorderCategories}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onPlexPlaylist={() => { setSidebarOpen(false); setShowPlexModal(true); }}
        />
        {showPlexModal && (
          <PlexPlaylistModal categories={categories} onClose={() => setShowPlexModal(false)} />
        )}
        <main className="main-content">
          {activeCategoryId != null && (
            <>
              <h2 className="list-title">{activeCategory?.name}</h2>
              <ListContainer
                items={items}
                categoryType={activeCategoryType}
                onAddItem={handleAddItem}
                onDeleteItem={handleDeleteItem}
                onUpdateItem={handleUpdateItem}
                onReorder={handleReorder}
              />
            </>
          )}
          {activeCategoryId == null && categories.length === 0 && (
            <p className="empty-message">Create a list to get started!</p>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
