# MyLists

A Dockerized list management web app with category tabs and drag-and-drop reordering. Includes specialized list types for **Books**, **Movies**, and **TV Shows** with type-ahead search, cover art, and metadata popover cards.

## Features

- **Category Tabs** — Create multiple lists organized as tabs across the top
- **Drag-and-Drop** — Reorder items by dragging them up or down
- **Specialized List Types:**
  - **Books** — Type-ahead search via Open Library. Displays cover art, author, year, and description on hover.
  - **Movies** — Type-ahead search via TMDB. Displays poster, director, runtime, rating, and overview on hover.
  - **TV Shows** — Type-ahead search via TMDB. Displays poster, creator, network, seasons, episodes, status, and rating on hover.
- **Generic Lists** — Plain text lists for anything else (groceries, to-dos, etc.)
- **Persistent Storage** — SQLite database on a Docker volume survives container restarts and rebuilds

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Node.js, Express, better-sqlite3    |
| Frontend  | React 18, Vite, @dnd-kit/sortable   |
| Container | Docker (multi-stage build)           |
| APIs      | Open Library (books), TMDB (movies/TV) |

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A free [TMDB API key](https://www.themoviedb.org/settings/api) (for Movies/TV search — Books work without it)

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/fritzhurst/MyLists.git
   cd MyLists
   ```

2. Create a `.env` file in the project root:
   ```
   TMDB_API_KEY=your_tmdb_api_key_here
   ```

3. Build and run:
   ```bash
   docker compose up --build
   ```

4. Open **http://localhost:6000**

### Stopping

```bash
docker compose down
```

Your data is preserved in the `mylists-data` Docker volume. To delete all data:

```bash
docker compose down -v
```

## Usage

1. Click the **+** button to create a new category
2. Choose a type: **Generic**, **Books**, **Movies**, or **TV Shows**
3. For specialized types, start typing a title — suggestions appear automatically
4. Click a suggestion to add it to your list with full metadata
5. Hover over an item to see its details (cover art, summary, ratings, etc.)
6. Drag items by the handle (&#x2630;) to reorder
7. Click **x** on a tab to delete a category and all its items

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/categories` | List all categories |
| POST   | `/api/categories` | Create category `{ name, type }` |
| DELETE | `/api/categories/:id` | Delete category + items |
| GET    | `/api/categories/:id/items` | List items for a category |
| POST   | `/api/categories/:id/items` | Add item `{ text, metadata }` |
| DELETE | `/api/items/:id` | Delete an item |
| PUT    | `/api/categories/:id/items/reorder` | Reorder `{ orderedIds: [...] }` |
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
│   ├── db.js               # SQLite connection + schema
│   └── routes/
│       ├── categories.js   # Category CRUD
│       ├── items.js        # Item CRUD + reorder
│       └── search.js       # Search proxy (Open Library + TMDB)
└── client/
    ├── vite.config.js
    └── src/
        ├── App.jsx         # Root state manager
        ├── api.js          # API fetch wrappers
        └── components/
            ├── TabBar.jsx        # Category tabs + type picker
            ├── Tab.jsx           # Single tab
            ├── ListContainer.jsx # Drag-and-drop list
            ├── DraggableItem.jsx # Sortable item + thumbnail
            ├── AddItemForm.jsx   # Generic item input
            ├── SearchAddForm.jsx # Type-ahead autocomplete
            └── ItemPopover.jsx   # Hover metadata card
```

## License

MIT
