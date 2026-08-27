# Pathd 🌌

**Pathd** es una plataforma premium y unificada para el seguimiento de bibliotecas personales y monitorización del consumo multimedia. Permite a los usuarios indexar, organizar y hacer seguimiento de su progreso en **películas, series, animes, libros, cómics, mangas, música y videojuegos** en una única interfaz cohesiva, complementada con modificaciones de la comunidad, guías cronológicas interactivas, planes de suscripción, feed social en tiempo real y confirmación de cuentas por correo electrónico.

---

## 🚀 Stack Tecnológico

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Base de Datos y ORM**: SQLite / PostgreSQL via SQLAlchemy
- **Autenticación**: OAuth2 Password Bearer con JWT + cookie HttpOnly segura para renovación de token de refresco
- **Email Transaccional**: Integración con **Resend API** con dominio personalizado `@pathd.net`, plantillas HTML responsivas y adaptación dinámica de idioma (Español / Inglés).
- **Pagos y Suscripciones**: Dodo Payments / Stripe API (Checkout Sessions, Customer Portal y Webhooks de ciclo de vida de suscripción)
- **Rate Limiting**: `slowapi` con límites por IP
- **Tareas en Segundo Plano**: FastAPI `BackgroundTasks` (despacho asíncrono de emails y sincronizaciones)

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Estilos**: Vanilla CSS con sistema de diseño premium basado en variables CSS (**Solar Amber `#f59e0b`** y **Deep Cinema Charcoal `#090d16`**), *Glassmorphism* (tarjetas translúcidas con desenfoque de fondo) y tipografía Inter.
- **Cliente HTTP**: Axios con interceptores para renovación automática de tokens y propagación reactiva del idioma (`Accept-Language`).
- **Estado Global**: Contextos de React (`AuthContext`, `LanguageContext`, `ThemeContext`).
- **Localización (i18n)**: Español e Inglés con selector dinámico persistente en navegador.

---

## 🌐 APIs Externas e Integraciones

| Servicio | Uso |
|---|---|
| [Resend](https://resend.com/) | Envío de correos transaccionales (confirmación de cuentas y recuperación de contraseñas) desde `noreply@pathd.net` |
| [OMDb](https://www.omdbapi.com/) + [Fanart.tv](https://fanart.tv/) | Películas (con duración, director y sinopsis completas) y pósters en alta definición |
| [TVMaze](https://www.tvmaze.com/api) | Series, animes y detalle estructurado de temporadas y episodios |
| [Google Books](https://developers.google.com/books/docs/v1/using) + [Open Library](https://openlibrary.org/developers/api) | Libros (con tracking de páginas leídas y portadas) |
| [Comic Vine](https://comicvine.gamespot.com/api/) | Cómics occidentales (con tracking de volúmenes y grapas) |
| [AniList](https://graphql.anilist.co) | Mangas, novelas ligeras y one-shots (GraphQL) |
| [IGDB](https://api-docs.igdb.com/) | Videojuegos, colecciones, ediciones, DLCs y expansiones (autenticado via Twitch OAuth2) |
| [Last.fm](https://www.last.fm/api) | Música, álbumes destacados y scrobbling en tiempo real |
| [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page) | Calendario de estrenos de cine y sinopsis abiertas (CC BY-SA) |
| [Dodo Payments](https://dodopayments.com/) / [Stripe](https://stripe.com/) | Procesamiento de pagos seguros y gestión de suscripciones Premium |
| [deep-translator](https://github.com/nidhaloff/deep-translator) (Google) | Traducción dinámica de sinopsis con almacenamiento en caché |
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
- **Personalización Completa del Perfil**: Subida de avatar, banner y fondo de pantalla personalizado, además de selección de color de acento propio.
- **Hasta 70 Obras Destacadas**: Expansión del escaparate de favoritos en el perfil.
- **Guías Privadas y No Listadas**: Creación de guías cronológicas secretas o accesibles solo mediante enlace directo.
- **Creación Ilimitada de Guías**: Sin límite en la cantidad de guías activas.
- **Estatus VIP**: Rol especial otorgado por administradores que desbloquea todas las funciones Premium gratis y de por vida, con insignia VIP dorada exclusiva.
- **Administradores**: Acceso al panel de administración y privilegios Premium permanentes.

---

## 📖 Secciones del Frontend y Características Principales

### 🏠 Home (Inicio y Seguimiento)
Centro de control personal del usuario dividido en 5 pestañas:
- **Continuar**: Series y animes en progreso (muestran el siguiente episodio por ver con botón `✓`), libros/cómics (con páginas leídas y barra de progreso reactiva), y juegos y películas (con tiempo consumido en horas y minutos).
- **No comenzado**: Obras pendientes (*Plan to watch/read/play*).
- **Terminado**: Obras completadas, mostrando métricas finales de tiempo, páginas o episodios.
- **Abandonado**: Obras dejadas a medias con registro del momento de abandono.
- **Actualizaciones**: Cambios y nuevos ítems agregados en las guías seguidas.

### 🎮 Explorador de Videojuegos y Jerarquías (IGDB)
- **Ranking Inteligente por Tiers**: Priorización en búsquedas de **Colecciones y Trilogías (Tier 0)** ➔ **Juegos Base (Tier 1)** ➔ **Ediciones Especiales y GOTY (Tier 2)** ➔ **Expansiones (Tier 3)** ➔ **DLCs y Packs cosméticos (Tier 4)**.
- **Exploración Bidireccional en Modal**: Permite navegar interactivamente entre una Colección, sus Juegos Base, sus Ediciones y sus DLCs con historial de navegación y botón de retroceso `← Volver`.
- **Botones de Desplazamiento Lateral (`ModalScrollRow`)**: Carruseles fluidos con botones circulares de navegación en modales sin barras de scroll nativas.
- **Etiquetas Visuales sobre Portadas**: Badges estilo cristal en las portadas de búsqueda (`📦 Colección`, `🧩 DLC`, `⚡ Expansión`, `🌟 Edición`, `🔨 Remake`, `✨ Remaster`).

### ⏱️ Selectores Interactivos de Tiempo y Páginas
- **Selector de Tiempo en Línea (`[ HH ] h : [ MM ] min`)**: Selector minimalista para películas y juegos con soporte para rueda del mouse (*scroll wheel*), validación de límites y conversión automática a minutos.
- **Selector de Lectura Reactivo**: Para libros, cómics y mangas, permitiendo editar el total de páginas y deslizar la barra de lectura con actualización inmediata de porcentajes.
- **Bloqueo de Scroll en Fondo (`useScrollLock`)**: Bloqueo automático del scroll de la página de fondo al abrir cualquier modal de la aplicación.

### 🔍 Explorar y Búsqueda Global
- **Novedades y Tendencias**: Lanzamientos recientes y destacados organizados por categorías multimedia.
- **Portadas Cinematográficas de Respaldo**: Detección de pósters genéricos con fondo fotográfico cinematográfico y tipografía del título destacada en la parte central superior.
- **Auto-Sincronización de Metadatos**: Enriquecimiento y actualización automática de portadas oficiales en la estantería del usuario cuando las APIs externas se recuperan.

### 💌 Flujos de Correo Electrónico (Resend + @pathd.net)
- **Verificación de Cuentas (`/verify-email`)**: Activación de cuenta por enlace seguro de 24 horas y auto-login al confirmar.
- **Recuperación de Contraseña (`/forgot-password` & `/reset-password`)**: Restablecimiento seguro en 1 hora con validación de contraseña interactiva y visibilidad `Eye / EyeOff`.
- **Plantillas HTML Adaptativas y Bilingües**: Diseño con la paleta oficial de Pathd que ajusta automáticamente los textos y asuntos a Español o Inglés según el idioma activo del usuario.

### 📱 Social (Feed Comunitario)
- **Timeline en Tiempo Real**: Feed cronológico que agrupa la actividad de la comunidad (nuevas guías creadas, avances, reseñas, votos y comentarios).
- **Interacciones**: Votos, comentarios y reportes sobre guías y reseñas.

### ✏️ Crear (Editor Avanzado de Guías)
Constructor interactivo de listas cronológicas con flujo documental estilo procesador de texto:
- **Estructura Multinivel**: Secciones maestras, Bloques con escala de importancia (1 a 5: Extra, Opcional, Recomendado, Importante, Obligatorio) y Subbloques anidados.
- **Drag & Drop Unificado**: Tirador (`≡`) con soporte para eventos de puntero, autoscroll al arrastrar, colapso de bloques y ranuras animadas de inserción.
- **Portapapeles y Pegado Inteligente**: Zonas de pegado contextual (`PasteZone`) y autoguardado continuo de borradores (`draft_flow`).

### 👤 Perfil y Estantería (Shelf)
- **Estadísticas Personales**: Métricas de consumo, seguidores, seguidos y registro de actividad reciente.
- **Estantería Unificada**: Catálogo personal filtrable por tipo de medio y estado de consumo.
- **Música en Vivo (Last.fm)**: Muestra en tiempo real la canción en reproducción y los álbumes más escuchados de la semana.

### 🛡️ Panel de Administración (`/admin`)
Panel completo de gestión y moderación disponible exclusivamente para administradores:
- **Reasignación Atómica de ID de Usuario**: Modificación segura del ID numérico del usuario actualizando automáticamente todas las tablas relacionales.
- **Gestión de Roles y Membresías**: Asignación/revocación de Estatus VIP, regalo de meses de suscripción Premium y cancelación de suscripciones.
- **Moderación de Usuarios y Contenido**: Suspensión temporal/permanente de cuentas, advertencias administrativas, eliminación de cuentas y resolución de reportes sobre guías, comentarios y reseñas.

---

## ⚡ Referencia de la API

### Health Check (`/health`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Endpoint de monitorización utilizado por UptimeRobot para mantener activo el servicio |

### Autenticación (`/api/v1/auth`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/register` | Registro de nueva cuenta y despacho de correo de verificación |
| GET | `/verify-email?token={token}` | Confirmación de correo electrónico y auto-login |
| POST | `/resend-verification` | Reenviar correo de confirmación de cuenta |
| POST | `/login` | Inicio de sesión (bloquea cuentas no verificadas con `403`) |
| POST | `/refresh` | Renovar token de acceso con cookie HttpOnly |
| POST | `/logout` | Cerrar sesión y revocar tokens |
| POST | `/forgot-password` | Envía enlace de restablecimiento de contraseña por email |
| POST | `/reset-password` | Valida token y actualiza la contraseña del usuario |
| POST | `/google` | Autenticación y registro con Google OAuth2 |

### Usuarios (`/api/v1/users`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/me` | Perfil del usuario autenticado y auto-reparación de listas |
| PUT | `/me/username` | Cambiar nombre de usuario |
| PUT | `/me/password` | Cambiar contraseña |
| PUT | `/me/profile-customization` | Actualizar color de acento, avatar, fondo y banner |
| DELETE | `/me` | Eliminar cuenta definitivamente |
| GET | `/me/activity` | Historial de actividad personal |
| GET | `/me/up-next` | Próximos ítems pendientes en guías seguidas y listas |
| GET | `/me/feed/guides-updates` | Actualizaciones recientes de guías seguidas |
| POST | `/me/lastfm/connect` | Conectar cuenta de Last.fm |
| DELETE | `/me/lastfm/disconnect` | Desconectar cuenta de Last.fm |
| GET | `/me/music/now-playing` | Canción en reproducción en vivo |
| GET | `/me/music/top-albums` | Álbumes más escuchados de la semana |
| GET | `/profile/{user_id}` | Perfil público de otro usuario |
| GET | `/{user_id}/activity` | Historial de actividad pública de otro usuario |
| GET | `/search?q={query}` | Buscar usuarios por nombre de usuario |

### Búsqueda de Medios (`/api/v1/search`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/?q={query}&type={type}` | Búsqueda por categoría multimedia |
| GET | `/all?q={query}` | Búsqueda global con ranking unificado por tiers |
| GET | `/game/{game_id}/relations` | Obtener colecciones, ediciones, DLCs y juego base de un videojuego |
| GET | `/series/{id}` | Detalle de serie/anime (TVMaze) con temporadas |
| GET | `/series/{id}/episodes` | Lista de episodios estructurados por temporada |
| GET | `/explore/tabs` | Datos de pestañas de exploración (Novedades, Tendencias, Para Ti) |

### Guías Cronológicas (`/api/v1/lists`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Listar guías propias |
| POST | `/` | Crear nueva guía cronológica |
| GET | `/{list_id}` | Detalle completo de guía con progreso |
| PUT | `/{list_id}` | Editar guía |
| DELETE | `/{list_id}` | Eliminar guía |
| POST | `/{list_id}/save` | Guardar / seguir guía de otro usuario |
| DELETE | `/{list_id}/save` | Dejar de seguir guía |
| POST | `/{list_id}/items` | Añadir ítem a la guía |
| PUT | `/{list_id}/items/{item_id}` | Editar ítem de la guía |
| DELETE | `/{list_id}/items/{item_id}` | Eliminar ítem de la guía |
| POST | `/{list_id}/items/tv-import` | Importar temporada completa de serie |
| POST | `/{list_id}/items/bulk-toggle` | Marcar múltiples ítems de forma masiva |
| POST | `/{list_id}/toggle-series-episode` | Marcar/desmarcar episodio individual |
| POST | `/{list_id}/bulk-toggle-season` | Marcar toda una temporada de una vez |
| POST | `/{list_id}/sections/bulk-action` | Acción masiva sobre una sección |
| POST | `/items/{item_id}/toggle` | Marcar ítem como completado/pendiente |
| POST | `/items/{item_id}/toggle-skip` | Marcar ítem como saltado |
| GET | `/items/lookup` | Buscar guías que contienen una obra externa |
| GET | `/db/search` | Buscar guías en la base de datos local |

### Estantería Personal (`/api/v1/library`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/` | Añadir obra a la estantería personal |
| GET | `/` | Obtener estantería del usuario autenticado |
| PUT | `/{library_item_id}` | Actualizar estado, tiempo o páginas leídas de una obra |
| DELETE | `/{library_item_id}` | Eliminar obra de la estantería |

### Social (`/api/v1/social`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/users/{user_id}/follow` | Seguir / dejar de seguir a un usuario (toggle) |
| GET | `/users/{user_id}/followers` | Lista de seguidores de un usuario |
| GET | `/users/{user_id}/following` | Lista de usuarios seguidos |
| GET | `/users/feed/activity` | Feed de actividad de seguidos |
| GET | `/lists/feed/social` | Nuevas guías públicas de la comunidad |
| POST | `/lists/{list_id}/vote` | Votar positivamente una guía |
| POST | `/lists/{list_id}/report` | Reportar una guía por contenido indebido |
| GET | `/lists/{list_id}/comments` | Obtener comentarios de una guía |
| POST | `/lists/{list_id}/comments` | Publicar comentario en una guía |
| DELETE | `/lists/{list_id}/comments/{comment_id}` | Eliminar comentario |
| POST | `/lists/{list_id}/comments/{comment_id}/vote` | Votar un comentario |
| POST | `/lists/{list_id}/comments/{comment_id}/report` | Reportar un comentario |

### Reseñas (`/api/v1/reviews`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/{item_type}/{external_id}` | Publicar reseña y calificación (1 a 5 estrellas) |
| GET | `/{item_type}/{external_id}` | Consultar reseñas de una obra |

### Modificaciones / Mods (`/api/v1/additions`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/lists/{list_id}/additions` | Crear bloque de adiciones a una guía |
| POST | `/additions/{addition_id}/items` | Añadir ítems a un bloque de adiciones |
| GET | `/lists/{list_id}/additions/community` | Consultar adiciones públicas de la comunidad |
| POST | `/additions/{addition_id}/adopt` | Adoptar adiciones de otro usuario |
| DELETE | `/additions/{addition_id}/adopt` | Desadoptar bloque de adiciones |
| POST | `/additions/{addition_id}/vote` | Votar un bloque de adiciones |
| POST | `/additions/{addition_id}/comments` | Comentar en un bloque de adiciones |
| GET | `/additions/{addition_id}/comments` | Ver comentarios de un bloque de adiciones |
| POST | `/items/additions/{addition_item_id}/toggle` | Marcar ítem de adición como completado |
| POST | `/items/additions/{addition_item_id}/toggle-skip` | Marcar ítem de adición como saltado |

### Suscripciones y Pagos (`/api/v1/stripe` / Dodo Payments)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/create-checkout-session` | Iniciar checkout de pago para suscripción Premium |
| POST | `/create-portal-session` | Abrir portal de cliente para gestión de facturación |
| POST | `/cancel-subscription` | Cancelar renovación automática de la suscripción |
| POST | `/webhook` | Webhook para altas, renovaciones y cancelaciones automáticas |

### Administración (`/api/v1/admin`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/stats` | Estadísticas globales de la plataforma |
| GET | `/users` | Buscar y listar usuarios registrados |
| POST | `/users/{user_id}/change-id` | Reasignación atómica de ID de usuario |
| POST | `/users/{user_id}/toggle-vip` | Otorgar o revocar Estatus VIP |
| POST | `/users/{user_id}/grant-pro` | Regalar meses de suscripción Premium |
| POST | `/users/{user_id}/cancel-pro` | Cancelar suscripción Premium de un usuario |
| POST | `/users/{user_id}/suspend` | Suspender cuenta temporal o permanentemente |
| POST | `/users/{user_id}/unsuspend` | Levantar suspensión a una cuenta |
| POST | `/users/{user_id}/warn` | Enviar advertencia administrativa directa |
| POST | `/users/{user_id}/clear-warning` | Limpiar advertencia administrativa |
| DELETE | `/users/{user_id}` | Banear y eliminar cuenta de usuario |
| GET | `/reports` | Consultar reportes activos de la comunidad |
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

# 4. Levantar el servidor de desarrollo
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

Crea un archivo `.env` en la raíz del proyecto:

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

# Email Transaccional (Resend)
RESEND_API_KEY="re_..."
EMAILS_FROM_EMAIL="Pathd <noreply@pathd.net>"
EMAILS_FROM_NAME="Pathd"

# Dodo Payments / Stripe (Suscripciones)
DODO_PAYMENTS_API_KEY=""
DODO_PAYMENTS_PRODUCT_ID=""
DODO_PAYMENTS_WEBHOOK_KEY=""
DODO_PAYMENTS_ENVIRONMENT="test_mode"

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

# Google OAuth2
GOOGLE_CLIENT_ID=""

# CORS
BACKEND_CORS_ORIGINS='["http://localhost:5173", "https://pathd.net"]'
```

---

## 🗂️ Estructura del Proyecto

```
tracker-lists/
├── app/
│   ├── api/v1/           # Endpoints REST (auth, lists, library, search, social, admin, etc.)
│   ├── core/             # Configuración, base de datos, seguridad, rate limiting
│   ├── models/           # Modelos SQLAlchemy (User, ReadingList, ListItem, UserLibraryItem, etc.)
│   ├── schemas/          # Schemas Pydantic para validación y serialización
│   └── services/         # Clientes e integraciones externas (EmailService, IGDB, OMDb, TVMaze, etc.)
├── frontend/
│   ├── src/
│   │   ├── api/          # Cliente Axios con interceptores de autenticación y lenguaje
│   │   ├── components/   # Componentes modulares (Sidebar, ItemDetailsModal, MediaPoster, etc.)
│   │   ├── context/      # Contextos globales (AuthContext, ThemeContext, LanguageContext)
│   │   ├── hooks/        # Custom hooks (useScrollLock, etc.)
│   │   ├── pages/        # Páginas principales (Home, Search, Social, CreateGuide, Profile, VerifyEmail, etc.)
│   │   └── utils/        # Utilidades y caché de APIs
│   └── index.html
├── .env.example
├── requirements.txt
└── README.md
```
