# MyLists `v1.5.2`

A Dockerized list management web app with category tabs and drag-and-drop reordering. Includes specialized list types for **Books**, **Movies**, and **TV Shows** with type-ahead search, cover art, and metadata popover cards.

## Features

- **User Authentication** — JWT-based login with admin and regular user roles
- **Multi-User** — Each user has their own private lists and categories
- **Category Tabs** — Create multiple lists organized in a sidebar; double-click to rename
- **Drag-and-Drop** — Reorder items and categories by dragging; mobile-friendly with hold-to-drag gesture
- **Inline Editing** — Double-click list names or item text to edit in place
- **Specialized List Types:**
  - **Books** — Type-ahead search via Open Library. Displays cover art, author, year, and description on hover.
  - **Movies** — Type-ahead search via TMDB. Displays poster, director, runtime, rating, and overview on hover.
  - **TV Shows** — Type-ahead search via TMDB. Displays poster, creator, network, seasons, episodes, status, and rating on hover.
- **Generic Lists** — Plain text lists for anything else (groceries, to-dos, etc.)
- **Item Notes & Attachments** — Click an item to add text notes and file attachments
- **Sorting** — Manual drag, date added, or release date; renumber to lock sort order
- **Mobile Responsive** — Sidebar overlay, tap drag handle for metadata popover, dates shown below items
- **Settings** — Users can change their password and set a personal TMDB API key
- **Admin Panel** — Admin users can create/delete users
- **Email Notifications** — Optional Gmail SMTP for sending welcome emails to new users
- **Persistent Storage** — SQLite database on a Docker volume survives container restarts and rebuilds

## Tech Stack

| Layer     | Technology                                  |
|-----------|---------------------------------------------|
| Backend   | Node.js, Express, better-sqlite3, JWT       |
| Frontend  | React 18, Vite, @dnd-kit/sortable           |
| Auth      | bcryptjs, jsonwebtoken                       |
| Email     | Nodemailer (Gmail SMTP)                      |
| Container | Docker (multi-stage build)                   |
| APIs      | Open Library (books), TMDB (movies/TV)       |

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A free [TMDB API key](https://www.themoviedb.org/settings/api) (for Movies/TV search — Books work without it)

### Option A: Pull from GitHub Container Registry (easiest)

No cloning or building required — just pull and run:

```bash
# Pull the latest image
docker pull ghcr.io/fritzhurst/mylists:latest

# Create a volume for persistent data
docker volume create mylists-data

# Run the container
docker run -d \
  --name mylists \
  -p 6001:3000 \
  -v mylists-data:/app/data \
  -e NODE_ENV=production \
  -e DB_PATH=/app/data/mylists.db \
  -e TMDB_API_KEY=your_tmdb_api_key_here \
  -e JWT_SECRET=your-secret-here \
  ghcr.io/fritzhurst/mylists:latest
```

To include email support, add the SMTP flags:
```bash
docker run -d \
  --name mylists \
  -p 6001:3000 \
  -v mylists-data:/app/data \
  -e NODE_ENV=production \
  -e DB_PATH=/app/data/mylists.db \
  -e TMDB_API_KEY=your_tmdb_api_key_here \
  -e JWT_SECRET=your-secret-here \
  -e SMTP_USER=your-gmail@gmail.com \
  -e SMTP_PASS=your-gmail-app-password \
  -e SMTP_FROM=your-gmail@gmail.com \
  -e APP_URL=http://localhost:6001 \
  ghcr.io/fritzhurst/mylists:latest
```

Then open **http://localhost:6001** and log in with `admin` / `admin`.

### Option B: Build from Source

1. Clone the repo:
   ```bash
   git clone https://github.com/fritzhurst/MyLists.git
   cd MyLists
   ```

2. Create a `.env` file in the project root:
   ```
   TMDB_API_KEY=your_tmdb_api_key_here

   # Optional: Gmail SMTP for sending welcome emails
   SMTP_USER=your-gmail@gmail.com
   SMTP_PASS=your-gmail-app-password
   SMTP_FROM=your-gmail@gmail.com
   APP_URL=http://localhost:6001

   # Optional: JWT secret (defaults to a built-in value)
   JWT_SECRET=your-secret-here
   ```

3. Build and run with **Docker Compose** (recommended):
   ```bash
   docker compose up --build
   ```

   Or with **Docker Run**:
   ```bash
   # Build the image
   docker build -t mylists .

   # Create a volume for persistent data
   docker volume create mylists-data

   # Run the container
   docker run -d \
     --name mylists \
     -p 6001:3000 \
     -v mylists-data:/app/data \
     -e NODE_ENV=production \
     -e DB_PATH=/app/data/mylists.db \
     -e TMDB_API_KEY=your_tmdb_api_key_here \
     -e JWT_SECRET=your-secret-here \
     mylists
   ```

   To include email support, add the SMTP flags:
   ```bash
   docker run -d \
     --name mylists \
     -p 6001:3000 \
     -v mylists-data:/app/data \
     -e NODE_ENV=production \
     -e DB_PATH=/app/data/mylists.db \
     -e TMDB_API_KEY=your_tmdb_api_key_here \
     -e JWT_SECRET=your-secret-here \
     -e SMTP_USER=your-gmail@gmail.com \
     -e SMTP_PASS=your-gmail-app-password \
     -e SMTP_FROM=your-gmail@gmail.com \
     -e APP_URL=http://localhost:6001 \
     mylists
   ```

   To stop and manage a `docker run` container:
   ```bash
   docker stop mylists        # Stop the container
   docker start mylists       # Restart it
   docker rm mylists          # Remove the container (data is kept in the volume)
   docker volume rm mylists-data  # Delete all data
   ```

4. Open **http://localhost:6001**

5. Log in with the default admin account:
   - **Username:** `admin`
   - **Password:** `admin`

### Email Setup (Optional)

To enable welcome emails for new users:

1. Go to your Google Account > Security > 2-Step Verification
2. Under "App passwords", generate a new app password for "Mail"
3. Add the app password to your `.env` file as `SMTP_PASS`
4. Set `SMTP_USER` and `SMTP_FROM` to your Gmail address

### Stopping

```bash
docker compose down
```

Your data is preserved in the `mylists-data` Docker volume. To delete all data:

```bash
docker compose down -v
```

## Usage

1. Log in with admin credentials or a user account
2. Click the **+** button to create a new category
3. Choose a type: **Generic**, **Books**, **Movies**, or **TV Shows**
4. For specialized types, start typing a title — suggestions appear automatically
5. Click a suggestion to add it to your list with full metadata
6. Hover over an item to see its details (cover art, summary, ratings, etc.)
7. Drag items by the handle (&#x2630;) to reorder
8. Click **x** on a tab to delete a category and all its items

### Admin Functions

- Click **Users** to manage user accounts
- Add new users by email — they'll receive a welcome email (if SMTP is configured) with a temporary password
- New users must change their password on first login

### User Settings

- Click **Settings** to change your password or set a personal TMDB API key

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/auth/login` | Login `{ email, password }` |
| GET    | `/api/auth/me` | Get current user |
| POST   | `/api/auth/register` | Admin: create user `{ email }` |
| GET    | `/api/auth/users` | Admin: list users |
| DELETE | `/api/auth/users/:id` | Admin: delete user |
| POST   | `/api/auth/change-password` | Change password |
| GET/PUT | `/api/auth/tmdb-key` | Get/set TMDB key |
| GET    | `/api/auth/email-status` | Admin: email config status |
| POST   | `/api/auth/test-email` | Admin: send test email |
| GET    | `/api/categories` | List user's categories |
| POST   | `/api/categories` | Create category `{ name, type }` |
| PUT    | `/api/categories/:id` | Rename category `{ name }` |
| DELETE | `/api/categories/:id` | Delete category + items |
| PUT    | `/api/categories/reorder` | Reorder categories `{ orderedIds: [...] }` |
| GET    | `/api/categories/:id/items` | List items for a category |
| POST   | `/api/categories/:id/items` | Add item `{ text, metadata }` |
| PUT    | `/api/items/:id` | Update item text `{ text }` |
| DELETE | `/api/items/:id` | Delete an item |
| PUT    | `/api/categories/:id/items/reorder` | Reorder items `{ orderedIds: [...] }` |
| GET    | `/api/search/books?q=` | Search Open Library |
| GET    | `/api/search/movies?q=` | Search TMDB movies |
| GET    | `/api/search/tv?q=` | Search TMDB TV shows |

## Project Structure

```
MyLists/
├── Dockerfile              # Multi-stage build
├── docker-compose.yml      # Service + volume config
├── server/
│   ├── index.js            # Express entry point
│   ├── db.js               # SQLite connection + schema + migrations
│   ├── middleware/
│   │   └── auth.js         # JWT auth middleware
│   ├── routes/
│   │   ├── auth.js         # Auth + user management endpoints
│   │   ├── categories.js   # Category CRUD + rename (user-scoped)
│   │   ├── items.js        # Item CRUD + edit + reorder (user-scoped)
│   │   ├── notes.js        # Notes & attachments CRUD + file upload
│   │   └── search.js       # Search proxy (Open Library + TMDB)
│   └── services/
│       └── email.js        # Nodemailer Gmail SMTP service
└── client/
    ├── vite.config.js
    └── src/
        ├── App.jsx               # Root state manager + auth flow
        ├── api.js                # API fetch wrappers + auth headers
        └── components/
            ├── LoginPage.jsx         # Login form
            ├── ChangePasswordPage.jsx # Forced password change
            ├── AdminPanel.jsx        # User management (admin)
            ├── SettingsPage.jsx      # Password + TMDB key settings
            ├── Sidebar.jsx           # Category list + drag reorder
            ├── SidebarItem.jsx       # Single category + inline rename
            ├── ListContainer.jsx     # Drag-and-drop list + sorting
            ├── DraggableItem.jsx     # Sortable item + inline edit
            ├── AddItemForm.jsx       # Generic item input
            ├── SearchAddForm.jsx     # Type-ahead autocomplete
            ├── ItemPopover.jsx       # Hover/tap metadata card
            └── ItemDetailPanel.jsx   # Notes + attachments panel
```

## Changelog

### v1.5.2
- Fix mobile drag-and-drop: replace PointerSensor with MouseSensor so TouchSensor properly handles touch input
- Hold drag handle (☰) on mobile now correctly activates drag instead of showing popover
- Suppress popover toggle after a drag operation completes

### v1.5.1
- Pencil icon (✎) next to item name for inline editing
- Type-ahead search when editing items (same as adding new items)
- Free-text editing supported even without selecting a type-ahead result
- Editing updates both item text and metadata when picking from search results

### v1.5.0
- Rename lists by double-clicking the name in the sidebar
- Edit item text by double-clicking the item name
- Mobile drag-and-drop with hold-to-drag gesture (TouchSensor with 300ms delay)
- Tap drag handle on mobile to toggle metadata popover
- Show release date and date added below item name on mobile
- Display version number at bottom of sidebar

### v1.4.0
- Sidebar layout replacing top tab bar
- Item notes and file attachments (click item to open detail panel)
- Release date sorting with locked priorities and renumber button
- Item indicators showing note/attachment counts
- Column headers for list items
- Favicon

### v1.3.0
- Specialized list types: Books, Movies, TV Shows with type-ahead search
- Cover art thumbnails and hover popover cards with metadata
- Open Library API (books) and TMDB API (movies/TV)
- Per-user TMDB API key setting

### v1.2.0
- JWT authentication with admin and regular user roles
- Admin panel for user management
- Gmail SMTP email support for welcome emails
- GitHub Actions CI/CD for automatic Docker image publishing

### v1.1.0
- Multi-user support with private lists per user
- Drag-and-drop reordering for items and categories
- Generic list type for plain text items

### v1.0.0
- Initial release: Dockerized list management app
- Category-based organization
- SQLite persistent storage on Docker volume

## License

MIT
