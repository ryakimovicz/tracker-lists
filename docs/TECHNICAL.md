# Pathd - Especificación Técnica & Referencia de API ⚡

Documento de referencia para desarrolladores, arquitectura del sistema y catálogo completo de endpoints REST de **Pathd**.

---

## 🏗️ Arquitectura y Stack Tecnológico

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Base de Datos y ORM**: PostgreSQL (Neon Serverless en producción) / SQLite (desarrollo local) via SQLAlchemy
- **Autenticación**: OAuth2 Password Bearer con JWT + cookie HttpOnly segura para rotación de token de refresco
- **Email Transaccional**: Resend API con dominio personalizado `@pathd.net` y soporte bilingüe (ES/EN)
- **Pagos y Suscripciones**: Dodo Payments API (Checkout Sessions, Customer Portal y Webhooks de ciclo de vida)
- **Rate Limiting**: `slowapi` con límites por IP
- **Caché y Rendimiento**:
  - In-memory TTL Cache (Novedades de Explorar y Búsqueda global)
  - Filtrado dinámico en tiempo real contra `BlockedFranchise` y `BlockedMediaItem`
- **Tareas en Segundo Plano**: FastAPI `BackgroundTasks` (despacho asíncrono de correos y sincronizaciones)

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Cliente HTTP**: Axios con interceptores para renovación automática de tokens y propagación de idioma (`Accept-Language`)
- **Estilos**: Vanilla CSS con sistema de diseño basado en variables CSS (**Solar Amber `#f59e0b`** y **Deep Cinema Charcoal `#090d16`**), *Glassmorphism* y tipografía Inter
- **Optimización de Rendimiento**:
  - **Idle Warmup**: Calentamiento automático durante períodos de inactividad de CPU
  - **Hover & Touch Prefetching**: Anticipación a la navegación en enlaces del Sidebar
  - **Multi-tier Cache**: Caché en memoria + `sessionStorage` para aperturas en 0 ms

### Infraestructura de Despliegue
- **Frontend SPA**: [Cloudflare Pages](https://pages.cloudflare.com/) (Auto-deploy en push a `main`)
- **Backend API**: [Render](https://render.com/) (Web Service FastAPI / Uvicorn con auto-deploy)
- **Base de Datos**: [Neon.tech](https://neon.tech/) (PostgreSQL Serverless gestionado)
- **DNS & SSL**: [Cloudflare](https://cloudflare.com/) (`pathd.net`)
- **Correos**: [Resend](https://resend.com/) (`noreply@pathd.net`)
- **Monitorización**: [UptimeRobot](https://uptimerobot.com/) realizando pings continuos 24/7 a `GET /health`

---

## ⚡ Referencia Completa de la API

### Health Check (`/health`)
| Método | Ruta | Descripción |
|---|---|---|
| `GET`, `HEAD`, `POST`, `OPTIONS` | `/health` | Endpoint de monitorización utilizado por UptimeRobot para verificar estado 24/7 con código `200 OK` |
| `GET`, `HEAD`, `POST`, `OPTIONS` | `/api/v1/health` | Alias del endpoint de salud bajo el prefijo general de la API |

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
| PUT | `/me/avatar` | Actualizar imagen de perfil / avatar |
| PUT | `/me/banner` | Actualizar imagen de portada / banner (Premium) |
| PUT | `/me/background` | Actualizar fondo de pantalla de perfil (Premium) |
| PUT | `/me/color` | Actualizar color temático de perfil (Premium) |
| PUT | `/me/category-order` | Guardar orden personalizado de categorías (Premium) |
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
| GET | `/?q={query}&type={type}` | Búsqueda por categoría multimedia específica con caché de 15 min |
| GET | `/all?q={query}` | Búsqueda global con ranking unificado por tiers y caché en memoria |
| GET | `/game/{game_id}/relations` | Obtener colecciones, ediciones, DLCs y juego base de un videojuego |
| GET | `/series/{id}` | Detalle de serie/anime (TVMaze) con temporadas |
| GET | `/series/{id}/episodes` | Lista de episodios estructurados por temporada |
| GET | `/explore/tabs` | Novedades y tendencias con caché de 4 horas y filtrado dinámico de blacklist |

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
| DELETE | `/{library_item_id}` | Eliminar obra de la estantería (con opción de conservar o purgar historial) |
| POST | `/{library_item_id}/mark-consumed` | Volver a marcar como visto/leído/jugado (Free max 2 / Premium ilimitado) |
| GET | `/{library_item_id}/consumption-history` | Obtener historial cronológico de fechas de consumo |
| DELETE | `/{library_item_id}/consumption-history/latest` | Desmarcar última visualización o volver al estado anterior |

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
| POST | `/media/report` | Reportar una obra del catálogo por contenido indebido |

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
| GET | `/reports` | Consultar reportes activos de obras, guías, comentarios y reseñas |
| POST | `/media/ban` | Banear y purgar una obra específica de todo el sistema |
| DELETE | `/media/unban/{blocked_id}` | Desbloquear una obra de la blacklist |
| GET | `/franchises/search` | Buscar sagas, revistas o editoriales externas por nombre |
| GET | `/franchises/resolve-from-media` | Resolver saga o volumen matriz desde una obra reportada |
| POST | `/franchises/ban` | Banear y purgar saga o editorial por ID estructural |
| DELETE | `/franchises/unban/{blocked_id}` | Desbloquear saga o editorial de la blacklist |
| DELETE | `/reports/media/{report_id}` | Desestimar reporte de obra |
| DELETE | `/lists/{list_id}` | Eliminar guía por moderación |
| DELETE | `/comments/{comment_id}` | Eliminar comentario por moderación |
| DELETE | `/reviews/{review_id}` | Eliminar reseña por moderación |

### Traducción (`/api/v1/translate`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/` | Traduce sinopsis al idioma local (con caché en base de datos) |

---

## 🛠️ Instalación y Configuración para Desarrollo

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
