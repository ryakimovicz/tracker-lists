# Pathd 🌌

**Pathd** es una plataforma premium y unificada para el seguimiento de bibliotecas personales y monitorización del consumo multimedia. Permite a los usuarios indexar, organizar y hacer seguimiento de su progreso en **libros, mangas, cómics, películas, series, animes, música y videojuegos** en una única interfaz cohesiva, complementada con modificaciones de la comunidad, guías cronológicas interactivas, planes de suscripción y un feed social en tiempo real.

---

## 🚀 Stack Tecnológico

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Base de Datos y ORM**: SQLite / PostgreSQL via SQLAlchemy
- **Autenticación**: OAuth2 Password Bearer con JWT + cookie HttpOnly segura para renovación de token de refresco
- **Pagos y Suscripciones**: Stripe API (Checkout Sessions, Customer Portal y Webhooks de ciclo de vida de suscripción)
- **Rate Limiting**: `slowapi` con límites por IP
- **Tareas en Segundo Plano**: FastAPI `BackgroundTasks` (envío de emails SMTP y sincronizaciones)

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Estilos**: Vanilla CSS con sistema de diseño premium "Galería Cultural" basado en variables CSS (Tonos Pizarra y Acentos Vibrantes), *Glassmorphism* (tarjetas translúcidas con desenfoque) y tipografía Inter.
- **Cliente HTTP**: Axios con interceptores para renovación automática de tokens y manejo centralizado de sesiones.
- **Estado Global**: Contextos de React (`AuthContext`, `LanguageContext`, `ThemeContext`).
- **Localización**: Español e Inglés, con selector dinámico persistente.

---

## 🌐 APIs Externas e Integraciones

| Servicio | Uso |
|---|---|
| [OMDb](https://www.omdbapi.com/) + [Fanart.tv](https://fanart.tv/) | Películas (con duración y sinopsis completas) y pósters en HD |
| [TVMaze](https://www.tvmaze.com/api) | Series, animes y detalle de episodios/temporadas |
| [Google Books](https://developers.google.com/books/docs/v1/using) + [Open Library](https://openlibrary.org/developers/api) | Libros (con tracking de páginas) |
| [Comic Vine](https://comicvine.gamespot.com/api/) | Cómics occidentales (con tracking de volúmenes y grapas) |
| [AniList](https://graphql.anilist.co) | Mangas, novelas ligeras y one-shots (GraphQL) |
| [IGDB](https://api-docs.igdb.com/) | Videojuegos (autenticado via Twitch OAuth2) |
| [Last.fm](https://www.last.fm/api) | Música, álbumes destacados y scrobbling en tiempo real |
| [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page) | Calendario de estrenos de películas y sinopsis enriquecidas (CC BY-SA) |
| [Stripe](https://stripe.com/) | Procesamiento de pagos seguros y gestión de suscripciones Premium |
| [deep-translator](https://github.com/nidhaloff/deep-translator) (Google) | Traducción dinámica y gratuita de sinopsis con caché en base de datos |
| [UptimeRobot](https://uptimerobot.com/) | Monitorización continua y mantenimiento activo 24/7 mediante `GET /health` |


---

## 💎 Niveles de Membresía y Beneficios

Pathd cuenta con un sistema de roles y privilegios que personaliza la experiencia del usuario:

### 🌟 Pathd Gratuito (Free)
- Seguimiento ilimitado de biblioteca personal en todas las categorías.
- Hasta 7 obras destacadas en la estantería del perfil.
- Creación de hasta 2 guías públicas activas.
- Acceso a la comunidad, feed social, valoraciones y reseñas.

### 👑 Pathd Premium / VIP / Admin
- **Personalización Completa del Perfil**: Subida de banner personalizado y selección de color de acento propio que se refleja en todo el perfil y guías públicas.
- **Hasta 70 Obras Destacadas**: Expansión del escaparate de favoritos en el perfil.
- **Guías Privadas y No Listadas**: Creación de guías cronológicas secretas o accesibles solo mediante enlace directo.
- **Creación Ilimitada de Guías**: Sin límite en la cantidad de guías activas.
- **Estatus VIP**: Rol especial otorgado por administradores que desbloquea todas las funciones Premium gratis y de por vida, con insignia VIP exclusiva.
- **Administradores**: Acceso al panel de administración y privilegios Premium permanentes.

---

## 📖 Secciones del Frontend

La interfaz está estructurada en **secciones principales** accesibles desde la barra lateral (Sidebar):

### 🏠 Home (Inicio)
Centro de control personal del usuario dividido en 4 pestañas:
- **Continuar**: Series y animes en progreso (muestran el siguiente episodio por ver con botón `✓`), libros/cómics (muestran páginas leídas), y juegos y películas (muestran tiempo activo en horas y minutos). También incluye el progreso activo en guías cronológicas.
- **No comenzado**: Obras pendientes (Plan to watch/read/play).
- **Terminado**: Obras completadas. Muestra directamente el total de páginas, duración en minutos o horas jugadas en lugar del estado.
- **Abandonado**: Obras dejadas a medias, detallando el progreso hasta el momento del abandono.
- **Actualizaciones**: Cambios recientes en las guías seguidas.

### 📱 Social (Feed)
Timeline comunitaria unificada:
- **Muro Cronológico**: Feed que agrupa en tiempo real la actividad de la comunidad (nuevas guías, ítems marcados, progreso, votos, finalizaciones) ordenado cronológicamente.
- **Interacciones**: Votos, comentarios y reportes en guías y opiniones.

### ✏️ Crear (Editor de Guías)
Constructor interactivo de guías y listas cronológicas con flujo documental estilo procesador de texto:
- **Estructura Jerárquica Flexible**: Organización multinivel en **Secciones maestras**, **Bloques** con escala de importancia (1 a 5: Extra, Opcional, Recomendado, Importante, Obligatorio) y **Subbloques** anidados.
- **Sistema Unificado de Arrastrar y Soltar (Drag & Drop)**:
  - Tirador unificado (`≡`) para reordenamiento fluido por eventos de puntero (*Pointer Events*).
  - Desplazamiento continuo con la rueda del ratón mientras se arrastran elementos por documentos extensos.
  - Colapso dinámico de bloques asociados al mover secciones.
  - Ranuras de inserción animadas (*drop slots*) y vista previa flotante (*ghost preview*).
- **Portapapeles y Selección Múltiple**: Copiar, cortar, eliminar y zonas inteligentes de pegado (`PasteZone`).
- **Autoguardado Automático (Auto-Save)**: Guarda los borradores en la base de datos de manera continua (`draft_flow`).

### 🔍 Explorar (Buscador)
- **Dashboard de Recomendaciones**: Tendencias globales, guías destacadas y recomendaciones personalizadas "Para Ti".
- **Buscador Global**: Conecta con TVMaze, OMDb, IGDB, Google Books, AniList y Comic Vine con filtros por categoría.
- **Modal de Detalle del Ítem**: Ficha completa con seguimiento de progreso, acordeón de temporadas/capítulos para series y traducción de sinopsis con caché.
- **Búsqueda de Usuarios y Guías**: Localización ágil de perfiles y listas comunitarias.

### 👤 Perfil (Estantería Personal)
- **Estadísticas**: Seguidores, seguidos, fecha de registro e historial de actividad.
- **Estantería (Shelf)**: Catálogo personal organizado por categoría y estado de consumo, insignias visuales de estado y formateo inteligente de series y capítulos.
- **Favoritos / Destacados**: Obras destacadas visibles en el perfil (hasta 70 para Premium/VIP).
- **Música en Tiempo Real**: Integración con Last.fm para mostrar el scrobble actual y los mejores álbumes semanales.

### 🛡️ Panel de Administración (`/admin`)
Panel completo de gestión y moderación disponible exclusivamente para administradores:
- **Reasignación Atómica de ID de Usuario**: Modificación segura del ID numérico del usuario actualizando automáticamente todas las tablas relacionales y secuencias de PostgreSQL/SQLite.
- **Gestión de Roles y Membresías**:
  - Asignación y revocación de Estatus VIP.
  - Regalo de meses de suscripción Premium con input numérico manual o selectores rápidos (1, 3, 6, 12 meses).
  - Cancelación directa de suscripciones Premium activas.
- **Sanciones y Moderación de Usuarios**:
  - Suspensión temporal (con fecha y motivo) o permanente de cuentas.
  - Envío y limpieza de advertencias administrativas directas en el panel del usuario.
  - Eliminación definitiva de cuentas de usuario.
- **Moderación de Contenido**: Ver, atender y resolver reportes activos sobre guías, reseñas y comentarios.

---

## ⚡ Referencia de la API

### Health Check (`/health`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Endpoint ligero de estado utilizado por UptimeRobot para mantener activo el servicio |

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
| GET | `/me` | Perfil del usuario autenticado y auto-reparación de listas |
| PUT | `/me/username` | Cambiar nombre de usuario |
| PUT | `/me/password` | Cambiar contraseña |
| PUT | `/me/profile-customization` | Actualizar color de acento y banner (Premium/VIP/Admin) |
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

### Suscripciones y Stripe (`/api/v1/stripe`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/create-checkout-session` | Iniciar sesión de pago en Stripe Checkout para suscripción Premium |
| POST | `/create-portal-session` | Abrir el Portal de Cliente de Stripe para gestionar pagos y facturación |
| POST | `/cancel-subscription` | Cancelar la renovación automática de la suscripción |
| POST | `/webhook` | Webhook para procesar altas, renovaciones y cancelaciones automáticas |

### Búsqueda de Medios (`/api/v1/search`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/?q={query}&type={type}` | Búsqueda por tipo de medio |
| GET | `/all?q={query}` | Búsqueda unificada en todas las fuentes |
| GET | `/series/{id}` | Detalle de serie/anime (TVMaze) con temporadas |
| GET | `/series/{id}/episodes` | Episodios de una serie (TVMaze) |

### Guías Cronológicas (`/api/v1/lists`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Listar guías propias |
| POST | `/` | Crear nueva guía |
| GET | `/{list_id}` | Detalle de guía con progreso (soporta visibilidad privada y auto-reparación) |
| PUT | `/{list_id}` | Editar guía |
| DELETE | `/{list_id}` | Eliminar guía |
| POST | `/{list_id}/save` | Guardar/seguir guía de otro usuario |
| DELETE | `/{list_id}/save` | Dejar de seguir guía |
| POST | `/{list_id}/items` | Añadir ítem a la guía |
| PUT | `/{list_id}/items/{item_id}` | Editar ítem de la guía |
| DELETE | `/{list_id}/items/{item_id}` | Eliminar ítem de la guía |
| POST | `/{list_id}/items/tv-import` | Importar temporada completa desde TVMaze |
| POST | `/{list_id}/items/bulk-toggle` | Marcar múltiples ítems de una vez |
| POST | `/{list_id}/toggle-series-episode` | Marcar/desmarcar episodio individual |
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
| GET | `/stats` | Estadísticas generales de la plataforma |
| GET | `/users` | Buscar y listar usuarios registrados |
| POST | `/users/{user_id}/change-id` | Reasignación atómica de ID de usuario |
| POST | `/users/{user_id}/toggle-vip` | Otorgar o revocar Estatus VIP |
| POST | `/users/{user_id}/grant-pro` | Regalar meses de suscripción Premium |
| POST | `/users/{user_id}/cancel-pro` | Cancelar suscripción Premium de un usuario |
| POST | `/users/{user_id}/suspend` | Suspender cuenta temporal o permanentemente |
| POST | `/users/{user_id}/unsuspend` | Levantar suspensión a una cuenta |
| POST | `/users/{user_id}/warn` | Enviar advertencia administrativa |
| POST | `/users/{user_id}/clear-warning` | Limpiar advertencia administrativa |
| DELETE | `/users/{user_id}` | Banear y eliminar cuenta de usuario |
| GET | `/reports` | Ver todos los reportes activos |
| DELETE | `/lists/{list_id}` | Eliminar guía por moderación |
| DELETE | `/comments/{comment_id}` | Eliminar comentario por moderación |
| DELETE | `/reviews/{review_id}` | Eliminar reseña por moderación |

### Traducción (`/api/v1/translate`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/` | Traduce sinopsis al idioma local (con caché en base de datos) |

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
FRONTEND_URL="http://localhost:5173"

# Base de Datos
DATABASE_URL="sqlite:///./tracker_lists.db"
# Para producción (PostgreSQL):
# DATABASE_URL="postgresql://usuario:password@host/dbname"

# Seguridad y Autenticación
SECRET_KEY="genera-una-clave-segura-con-openssl-rand-hex-32"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=11520

# Stripe (Suscripciones y Pagos)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID_MONTHLY="price_..."

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
BACKEND_CORS_ORIGINS='["http://localhost:5173", "https://pathd.net"]'

# Email (para recuperación de contraseña)
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASSWORD=""
EMAILS_FROM_EMAIL="noreply@pathd.net"
```

---

## 🗂️ Estructura del Proyecto

```
tracker-lists/
├── app/
│   ├── api/v1/           # Endpoints REST
│   │   ├── auth.py       # Autenticación y recuperación de contraseña
│   │   ├── users.py      # Perfil, personalización, actividad, feed
│   │   ├── lists.py      # Guías cronológicas y tracking de episodios
│   │   ├── library.py    # Estantería personal
│   │   ├── search.py     # Búsqueda multi-fuente
│   │   ├── social.py     # Follows, feed, comentarios, votos
│   │   ├── reviews.py    # Reseñas y calificaciones
│   │   ├── additions.py  # Modificaciones comunitarias
│   │   ├── admin.py      # Moderación, roles VIP/Pro y gestión de IDs
│   │   ├── stripe.py     # Checkout, Portal de cliente y Webhooks
│   │   └── translate.py  # Traducción de sinopsis con caché
│   ├── core/             # Configuración, base de datos, seguridad, rate limiting
│   ├── models/           # Modelos SQLAlchemy (User, ReadingList, ListItem, etc.)
│   ├── schemas/          # Schemas Pydantic para validación de requests/responses
│   └── services/         # Clientes externos (TVMaze, OMDb, IGDB, Stripe, etc.)
├── frontend/
│   ├── src/
│   │   ├── api/          # Cliente Axios con interceptores de autenticación
│   │   ├── components/   # Componentes reutilizables (Sidebar, ItemDetailsModal, ProModal)
│   │   ├── context/      # Contextos globales (AuthContext, ThemeContext, LanguageContext)
│   │   ├── hooks/        # Custom hooks
│   │   ├── pages/        # Páginas (Home, Social, CreateGuide, Search, Profile, AdminPanel)
│   │   └── utils/        # Utilidades y caché de APIs
│   └── index.html
├── .env.example
├── requirements.txt
└── README.md
```
