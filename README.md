# TrackerLists 🌌

TrackerLists is a premium, unified chronological guide builder, personal library shelf, and media tracking platform. It allows users to index, organize, and track consumption progress across **books, manga, comics, series, anime, and video games** in one cohesive interface, augmented by community-powered modifications (Mods) and social timelines.

---

## 🚀 Technology Stack

### Backend
* **Core Framework**: FastAPI (Python 3.11+)
* **Database & ORM**: PostgreSQL / SQLite (via SQLAlchemy & Alembic migrations)
* **Authentication**: OAuth2 Password Bearer with JWT access tokens + secure HttpOnly cookies for token refresh
* **Rate Limiting**: `slowapi` (IP-based limiters)
* **Background Tasks**: FastAPI native background processes for SMTP mail transport (forgot/reset password links)

### Frontend
* **Core Library**: React 19 + TypeScript + Vite 8
* **Styling**: Modern Vanilla CSS with a global HSL variables-based design system supporting premium light/dark/system themes
* **API Client**: Axios with automatic interceptors for token refresh rotation
* **State Management**: React Context (`AuthContext`, `LanguageContext`, `ThemeContext`)
* **Localization (i18n)**: English (default) and Spanish, toggled on demand and persisted on client storage

---

## 📖 Frontend Architecture & Sections

The frontend is structured around **five core pages** that provide a seamless UX:

### 1. Home (Feed & Progress Tracker)
* **Active Progression**: Displays the user's active guides (what they are reading, watching, or playing).
* **Up Next Panel**: Powered by the backend's `/up-next` algorithm. It tells users exactly what comic, book, game, or episode to consume next across all followed lists without showing skipped filler content.
* **Guide Update Alerts**: Displays real-time updates and notifications for guides followed by the user.

### 2. Social (Timeline & Feed)
* **Follow Timeline**: Displays chronological progress updates, ratings (1-5 stars), and written reviews of users you follow.
* **Community Interactions**: Allows users to comment on, upvote, and report community logs, reviews, or guide updates.

### 3. Crear (Guide Builder)
* **Custom Chronologies**: Drag-and-drop or index-based guide builder to sort books, comics, movies, series, or games chronologically.
* **TMDB Importer**: Integrates a TV episode auto-populator to import entire seasons in a single click.
* **Default Importance & Overrides**: Supports setting default importance ranks (1-5) for whole sections (e.g. "Filler Arcs" vs "Canon") while allowing individual item overrides.

### 4. Explorar (Explore & Search Hub)
* **Global Search Proxy**: A single unified search box querying Books (Open Library), Manga (MangaDex), Comics (Comic Vine), Movies/Series/Anime (TMDB), and Games (RAWG).
* **Recommended Guides**: List of popular, highly upvoted community chronologies with filters for categories and creator usernames.

### 5. Perfil (User Profile & Library Shelf)
* **User Statistics**: Following and followers count, joined date, and activity history.
* **Library Shelf tabs**: Filter shelf items by status (Reading, Watching, Playing, Completed, Dropped) with strict category-specific validation constraints.
* **Highlighted Favorites**: Showcase your absolute favorite movies, books, series, or games in a dedicated showcase block on your profile.

---

## ⚡ Backend Feature & API Reference

### 1. Authentication & Users
* **`POST /api/v1/auth/register`**: Registers a new account.
* **`POST /api/v1/auth/login`**: Authenticates credentials via Form URL-Encoded format. Returns JWT access token and sets secure HttpOnly cookie for refresh token.
* **`POST /api/v1/auth/refresh`**: Generates a new access token using the HttpOnly refresh cookie.
* **`POST /api/v1/auth/logout`**: Clears the HttpOnly refresh token cookie and invalidates the session.
* **`POST /api/v1/auth/google`**: Google ID Token verification. Auto-creates accounts on first login. Supports local development mock bypass (`"mock-google-email-username"`).
* **`POST /api/v1/auth/forgot-password`**: Asynchronously dispatches a password reset link to the email.
* **`POST /api/v1/auth/reset-password`**: Validates token parameters and updates the user's password.
* **`GET /api/v1/users/me`**: Returns the active profile structure (created lists, saved lists, followers).
* **`PUT /api/v1/users/me/username`** & **`PUT /api/v1/users/me/password`**: Update profile credentials.
* **`GET /api/v1/users/search?q={query}`**: Find other members by username.

### 2. Unified Media Search Proxy
* **`GET /api/v1/search/?q={query}&type={type}`**: Standardizes search responses from external APIs into a unified layout (`SearchResultItem`).
  * **Supported Types**: `comic` (Comic Vine), `manga` (MangaDex), `book` (Open Library), `game` (RAWG), `movie` (TMDB), `series` (TMDB).

### 3. Chronological Guides (Lists)
* **`POST /api/v1/lists/`**: Create new guides with custom `importance_labels` maps and default `section_importances`.
* **`GET /api/v1/lists/{list_id}`**: Retrieves guide structure including items, completions, and progress percentage.
* **`POST /api/v1/lists/{list_id}/items`**: Insert items with priority override ranks (`importance_rank`).
* **`POST /api/v1/lists/{list_id}/items/tv-import`**: Bulk import TV/Anime episodes directly from TMDB API.
* **`POST /api/v1/lists/items/{item_id}/toggle`** & **`toggle-skip`**: Marks items as completed or skipped.
* **`POST /api/v1/lists/{list_id}/sections/bulk-action`**: Bulk marks whole sections as skipped/completed.

### 4. Personal Library Tracking (Shelf)
* **`POST /api/v1/library/`**: Add media to shelf (`plan_to_read`, `reading`, `dropped`, etc.).
* **`GET /api/v1/library/`**: Fetch user shelf with category status validations.
* **`PUT /api/v1/library/{library_item_id}`**: Change status of a shelf item.
* **`DELETE /api/v1/library/{library_item_id}`**: Remove item from library.

### 5. Smart Up Next Tracker
* **`GET /api/v1/users/me/up-next`**: Computes next target item in followed guides and active TV episode trackers.

### 6. Social Timeline & Community Interaction
* **`POST /api/v1/social/users/{user_id}/follow`** / **`DELETE`**: Follow/unfollow members.
* **`GET /api/v1/social/users/feed/activity`**: Activity feed containing progress updates of followed users.
* **`GET /api/v1/social/lists/feed/social`**: Social feed for newly created public guides.
* **`POST /api/v1/social/lists/{list_id}/comments`**: Comment on guides.
* **`POST /api/v1/social/lists/{list_id}/vote`** & **`report`**: Upvote or report guides.
* **`POST /api/v1/reviews/{item_type}/{external_id}`**: Post reviews (1-5 stars + comment) on individual media items.

### 7. Community Modifications (Mods)
* **`POST /api/v1/additions/lists/{list_id}/additions`**: Propose a community modification/addition block.
* **`POST /api/v1/additions/additions/{addition_id}/items`**: Anchor custom items after list items.
* **`GET /api/v1/additions/lists/{list_id}/additions/community`**: View shared extensions.
* **`POST /api/v1/additions/additions/{addition_id}/adopt`**: Adopt community additions to merge them into your guide layout view.

### 8. Administrative Moderation & Limits
* **`GET /api/v1/admin/reports`**: Lists flagged reviews, comments, and lists.
* **`DELETE /api/v1/admin/users/{user_id}`**: Instantly bans toxic users.
* **`DELETE`** endpoints to prune reported toxic comments, reviews, or guides.
* **Rate limit**: Search proxy requests are throttled at a limit of **20 queries per minute per client IP** to avoid API key blockages.

---

## 🛠️ Installation & Setup

### Running the Backend
1. Initialize virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set your environment variables in `.env` (copy `.env.example`).
4. Run the Uvicorn server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Running the Frontend
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
4. Build production code:
   ```bash
   npm run build
   ```
