# Pathd 🌌

**Pathd** es una plataforma premium y unificada para el seguimiento de bibliotecas personales y monitorización del consumo multimedia. Permite a los usuarios indexar, organizar y hacer seguimiento de su progreso en **libros, mangas, cómics, películas, series, animes, música y videojuegos** en una única interfaz cohesiva, complementada con modificaciones de la comunidad y un feed social en tiempo real.

---

## 🚀 Stack Tecnológico

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Base de Datos y ORM**: SQLite / PostgreSQL via SQLAlchemy
- **Autenticación**: OAuth2 Password Bearer con JWT + cookie HttpOnly segura para renovación de token de refresco
- **Rate Limiting**: `slowapi` con límites por IP
- **Tareas en Segundo Plano**: FastAPI `BackgroundTasks` (envío de emails SMTP)

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Estilos**: Vanilla CSS con sistema de diseño premium "Galería Cultural" basado en variables CSS (Tonos Pizarra y Acentos Pastel), *Glassmorphism* (tarjetas translúcidas con desenfoque) y tipografía Inter.
- **Cliente HTTP**: Axios con interceptores para renovación automática de tokens
- **Estado Global**: Contextos de React (`AuthContext`, `LanguageContext`, `ThemeContext`)
- **Localización**: Español e Inglés, con selector dinámico persistente

---

## 🌐 APIs Externas

| Servicio | Uso |
|---|---|
| [TVMaze](https://www.tvmaze.com/api) | Series, animes y detalle de episodios/temporadas |
| [OMDb](https://www.omdbapi.com/) + [Fanart.tv](https://fanart.tv/) | Películas y pósters en HD |
| [Last.fm](https://www.last.fm/api) | Música, álbumes destacados y scrobbling en tiempo real |
| [IGDB](https://api-docs.igdb.com/) | Videojuegos (autenticado via Twitch OAuth2) |
| [Google Books](https://developers.google.com/books/docs/v1/using) | Libros |
| [Comic Vine](https://comicvine.gamespot.com/api/) | Cómics y mangas |

---

## 📖 Secciones del Frontend

La interfaz está estructurada en **seis secciones principales** accesibles desde la barra lateral (Sidebar):

### 🏠 Home (Inicio)
Centro de control personal del usuario:
- **Continuar viendo**: Series y animes en progreso que muestran permanentemente el siguiente episodio por ver (`S01E01`, `S01E02`...), con un botón circular `✓` para marcarlo como visto directamente desde la tarjeta.
- **Continuar guías**: Progreso activo en las guías cronológicas que el usuario sigue.
- **Actualizaciones**: Cambios recientes en las guías seguidas.

### 📱 Social (Feed)
Timeline comunitaria unificada:
- **Muro Cronológico**: Un único feed que agrupa en tiempo real toda la actividad de la comunidad (nuevas guías, ítems marcados, progreso, votos, finalizaciones) ordenado de más reciente a más antiguo, de forma similar a redes sociales modernas.
- **Interacciones**: Votos, comentarios y reportes en guías y opiniones.

### ✏️ Crear (Editor de Guías)
Constructor de guías cronológicas:
- **Editor Visual**: Ordenamiento manual de obras de distintos tipos de medios (películas, libros, cómics, juegos, etc.).
- **Gestión Avanzada**: Cortar, copiar, pegar (*"Pegar Arriba"*, *"Pegar Abajo"*) mediante menú contextual de acción o pulsación larga (`useLongPress`).
- **Importador de Temporadas**: Importa temporadas completas de series con un clic.
- **Prioridad de Secciones**: Escala 1–5 para clasificar secciones como "Canon", "Recomendado", "Relleno", etc.

### 🔍 Explorar (Buscador)
Búsqueda y descubrimiento:
- **Dashboard de Recomendaciones**: Panel inicial con tendencias globales, guías destacadas y recomendaciones personalizadas "Para Ti".
- **Buscador Global**: Conecta con TVMaze, OMDb, IGDB, Google Books y Comic Vine con filtros por categoría (Películas, Series, Animes, Libros, Cómics, Mangas, Juegos).
- **Modal de Detalle del Ítem**: Ficha completa del elemento con:
  - Botón `+` en la barra superior para añadir/seguir la obra en la estantería (creando automáticamente una lista privada de seguimiento para series/animes).
  - Menú `⋮` (3 puntos verticales) con opciones para *"Marcar como abandonado"* o *"Quitar de estantería"*.
  - Botón `X` de cierre posicionado en la esquina superior para no entorpecer los botones de acción.
  - Botón de tick `✓` en el cuerpo del modal (alineado a la derecha, bajo la calificación) para marcar como visto/leído/jugado sin desplegables de estado.
  - Para series y animes: acordeón de temporadas y capítulos con marcado mediante botones circulares `✓` individuales o masivos por temporada.
- **Búsqueda de Usuarios y Guías**: Encuentra usuarios de Pathd y guías públicas de la comunidad.

### 👤 Perfil (Estantería Personal)
Perfil público y gestión de biblioteca:
- **Estadísticas**: Seguidores, seguidos, fecha de registro e historial de actividad.
- **Estantería (Shelf)**: Catálogo personal organizado por categoría y estado de consumo, sin desplegables de estado en las tarjetas:
  - Marcado de fecha (sin hora) en que el usuario completó/marcó el elemento.
  - Distintivo visual claro para elementos marcados como `🚫 Abandonado`.
  - **Tarjetas de Series**: Muestran limpiamente el último capítulo visto (ej: `Último visto: S01E03`).
  - **Episodios y Temporadas Sueltas**: Si el usuario marca un capítulo o temporada en una guía sin seguir la serie completa, se crea una tarjeta individual en la estantería indicando la serie a la que pertenece y la fecha. Si posteriormente se sigue la serie completa, las tarjetas sueltas se agrupan automáticamente en la tarjeta principal de la serie.
- **Favoritos**: Obras destacadas visibles en el perfil.

### 🛡️ Panel de Administración
Gestión de contenido moderado:
- Ver y resolver reportes activos (guías, comentarios, reseñas).
- Banear usuarios y eliminar contenido inapropiado.

---

## ⚡ Referencia de la API

### Autenticación (`/api/v1/auth`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/register` | Registro de nueva cuenta |
| POST | `/login` | Inicio de sesión (devuelve JWT + cookie de refresco) |
| POST | `/refresh` | Renovar token de acceso |
| POST | `/logout` | Cerrar sesión y eliminar cookie |
| POST | `/forgot-password` | Envía link de recuperación por email |
| POST | `/reset-password` | Valida token y actualiza contraseña |

### Usuarios (`/api/v1/users`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/me` | Perfil del usuario autenticado |
| PUT | `/me/username` | Cambiar nombre de usuario |
| PUT | `/me/password` | Cambiar contraseña |
| DELETE | `/me` | Eliminar cuenta |
| GET | `/me/activity` | Historial de actividad del usuario |
| GET | `/me/up-next` | Próximos ítems pendientes en guías seguidas y listas personales |
| GET | `/me/feed/guides-updates` | Actualizaciones recientes de guías seguidas |
| POST | `/me/lastfm/connect` | Conectar cuenta de Last.fm |
| DELETE | `/me/lastfm/disconnect` | Desconectar cuenta de Last.fm |
| GET | `/me/music/now-playing` | Obtener canción que se está escuchando ahora |
| GET | `/me/music/top-albums` | Obtener los álbumes más escuchados de la semana |
| GET | `/profile/{user_id}` | Perfil público de otro usuario |
| GET | `/{user_id}/activity` | Historial de actividad de otro usuario |
| GET | `/search?q={query}` | Buscar usuarios por username |

### Búsqueda de Medios (`/api/v1/search`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/?q={query}&type={type}` | Búsqueda por tipo de medio |
| GET | `/all?q={query}` | Búsqueda unificada en todas las fuentes |
| GET | `/series/{id}` | Detalle de serie/anime (TVMaze) con temporadas |
| GET | `/series/{id}/episodes` | Episodios de una serie (TVMaze) |

**Tipos disponibles**: `movie`, `series`, `anime`, `book`, `comic`, `manga`, `game`

### Guías Cronológicas (`/api/v1/lists`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Listar guías propias |
| POST | `/` | Crear nueva guía |
| GET | `/{list_id}` | Detalle de guía con progreso |
| PUT | `/{list_id}` | Editar guía |
| DELETE | `/{list_id}` | Eliminar guía |
| POST | `/{list_id}/save` | Guardar/seguir guía de otro usuario |
| DELETE | `/{list_id}/save` | Dejar de seguir guía |
| POST | `/{list_id}/items` | Añadir ítem a la guía |
| PUT | `/{list_id}/items/{item_id}` | Editar ítem de la guía |
| DELETE | `/{list_id}/items/{item_id}` | Eliminar ítem de la guía |
| POST | `/{list_id}/items/tv-import` | Importar temporada completa desde TVMaze |
| POST | `/{list_id}/items/bulk-toggle` | Marcar múltiples ítems de una vez |
| POST | `/{list_id}/toggle-tmdb-episode` | Marcar/desmarcar episodio individual |
| POST | `/{list_id}/bulk-toggle-season` | Marcar toda una temporada de una vez |
| POST | `/{list_id}/sections/bulk-action` | Acción masiva sobre una sección |
| POST | `/items/{item_id}/toggle` | Marcar ítem como completado/pendiente |
| POST | `/items/{item_id}/toggle-skip` | Marcar ítem como saltado |
| GET | `/items/lookup` | Buscar guías que contienen un ítem externo |
| GET | `/db/search` | Buscar guías en la base de datos local |

### Estantería Personal (`/api/v1/library`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/` | Añadir obra a la estantería (sincronizando progreso previo) |
| GET | `/` | Obtener estantería del usuario |
| PUT | `/{library_item_id}` | Actualizar estado u opciones de una obra |
| DELETE | `/{library_item_id}` | Eliminar obra de la estantería |

### Social (`/api/v1/social`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/users/{user_id}/follow` | Seguir / dejar de seguir usuario (toggle) |
| GET | `/users/{user_id}/followers` | Seguidores de un usuario |
| GET | `/users/{user_id}/following` | Usuarios seguidos |
| GET | `/users/feed/activity` | Feed de actividad de seguidos |
| GET | `/lists/feed/social` | Nuevas guías públicas |
| POST | `/lists/{list_id}/vote` | Votar una guía |
| POST | `/lists/{list_id}/report` | Reportar guía |
| GET | `/lists/{list_id}/comments` | Obtener comentarios de una guía |
| POST | `/lists/{list_id}/comments` | Comentar en una guía |
| DELETE | `/lists/{list_id}/comments/{comment_id}` | Eliminar comentario |
| POST | `/lists/{list_id}/comments/{comment_id}/vote` | Votar un comentario |
| POST | `/lists/{list_id}/comments/{comment_id}/report` | Reportar comentario |

### Reseñas (`/api/v1/reviews`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/{item_type}/{external_id}` | Escribir reseña y calificación (1–5 estrellas) |
| GET | `/{item_type}/{external_id}` | Obtener reseñas de una obra |

### Modificaciones / Mods (`/api/v1/additions`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/lists/{list_id}/additions` | Crear bloque de adiciones a una guía |
| POST | `/additions/{addition_id}/items` | Añadir ítems a un bloque |
| GET | `/lists/{list_id}/additions/community` | Consultar adiciones públicas de la comunidad |
| POST | `/additions/{addition_id}/adopt` | Adoptar las adiciones de otro usuario |
| DELETE | `/additions/{addition_id}/adopt` | Desadoptar adiciones |
| POST | `/additions/{addition_id}/vote` | Votar un bloque de adiciones |
| POST | `/additions/{addition_id}/comments` | Comentar en un bloque de adiciones |
| GET | `/additions/{addition_id}/comments` | Ver comentarios de un bloque |
| POST | `/items/additions/{addition_item_id}/toggle` | Marcar ítem de adición como completado |
| POST | `/items/additions/{addition_item_id}/toggle-skip` | Marcar ítem de adición como saltado |

### Administración (`/api/v1/admin`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/reports` | Ver todos los reportes activos |
| DELETE | `/users/{user_id}` | Banear y eliminar cuenta de usuario |
| DELETE | `/lists/{list_id}` | Eliminar guía por moderación |
| DELETE | `/comments/{comment_id}` | Eliminar comentario por moderación |
| DELETE | `/reviews/{review_id}` | Eliminar reseña por moderación |

---

## 🛠️ Instalación y Configuración

### Backend

```bash
# 1. Crear entorno virtual
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate   # Linux / macOS

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Levantar el servidor
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # Servidor de desarrollo
npm run build     # Build de producción
```

---

## 🔑 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto basado en `.env.example`:

```env
# App
PROJECT_NAME="Pathd"
API_V1_STR="/api/v1"

# Base de Datos
DATABASE_URL="sqlite:///./tracker_lists.db"

# Seguridad
SECRET_KEY="genera-una-clave-segura-con-openssl-rand-hex-32"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=11520

# APIs Externas
TVMAZE_API_KEY=""
OMDB_API_KEY=""
FANART_API_KEY=""
LASTFM_API_KEY=""
LASTFM_SHARED_SECRET=""
COMIC_VINE_API_KEY=""
GOOGLE_BOOKS_API_KEY=""

# IGDB (via Twitch Developer)
TWITCH_CLIENT_ID=""
TWITCH_CLIENT_SECRET=""

# CORS
BACKEND_CORS_ORIGINS='["http://localhost:5173"]'

# Email (para recuperación de contraseña)
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASSWORD=""
EMAILS_FROM_EMAIL="noreply@pathd.app"
```

---

## 🗂️ Estructura del Proyecto

```
tracker-lists/
├── app/
│   ├── api/v1/           # Endpoints REST
│   │   ├── auth.py       # Autenticación y recuperación de contraseña
│   │   ├── users.py      # Perfil, actividad, feed
│   │   ├── lists.py      # Guías cronológicas y tracking de episodios
│   │   ├── library.py    # Estantería personal
│   │   ├── search.py     # Búsqueda multi-fuente
│   │   ├── social.py     # Follows, feed, comentarios, votos
│   │   ├── reviews.py    # Reseñas y calificaciones
│   │   ├── additions.py  # Modificaciones comunitarias
│   │   └── admin.py      # Moderación y administración
│   ├── core/             # Configuración, base de datos, seguridad, rate limiting
│   ├── models/           # Modelos SQLAlchemy (User, ReadingList, UserLibraryItem, etc.)
│   ├── schemas/          # Schemas Pydantic para validación de requests/responses
│   └── services/         # Clientes de APIs externas (TVMaze, OMDb, Last.fm, IGDB, Google Books, Comic Vine)
├── frontend/
│   ├── src/
│   │   ├── api/          # Cliente Axios con interceptores de autenticación
│   │   ├── components/   # Componentes reutilizables (Sidebar, SearchPanel, MediaCard, ItemDetailsModal)
│   │   ├── context/      # Contextos globales (AuthContext, ThemeContext, LanguageContext)
│   │   ├── hooks/        # Custom hooks (useLongPress)
│   │   ├── pages/        # Páginas (Home, Social, CreateGuide, Search, Profile, ViewGuide, AdminPanel, etc.)
│   │   └── utils/        # Utilidades y caché de TMDB/APIs
│   └── index.html
├── .env.example
├── requirements.txt
└── README.md
```
