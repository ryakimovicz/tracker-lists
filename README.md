# TrackerLists 🌌

TrackerLists es una plataforma premium y unificada para la creación de guías de orden cronológico, seguimiento de bibliotecas personales (Estantería) y monitorización de consumo multimedia. Permite a los usuarios indexar, organizar y realizar un seguimiento de su progreso en **libros, mangas, cómics, series, animes y videojuegos** en una única interfaz cohesiva, complementada con modificaciones de la comunidad (Mods) e interacciones sociales en tiempo real.

---

## 🚀 Stack Tecnológico

### Backend
* **Framework Principal**: FastAPI (Python 3.11+)
* **Base de Datos y ORM**: PostgreSQL / SQLite (vía SQLAlchemy y migraciones con Alembic)
* **Autenticación**: OAuth2 Password Bearer con tokens de acceso JWT + cookie HttpOnly segura para rotación de tokens de refresco (`refresh_token`)
* **Límite de Peticiones (Rate Limiting)**: `slowapi` (limitadores basados en IP del cliente)
* **Tareas en Segundo Plano**: FastAPI BackgroundTasks nativas para envío de correos por SMTP (enlaces de recuperación de contraseñas)

### Frontend
* **Biblioteca Principal**: React 19 + TypeScript + Vite 8
* **Estilos**: Vanilla CSS moderno con un sistema de diseño basado en variables HSL globales, soportando temas Claro, Oscuro y Automático (según sistema operativo)
* **Cliente de API**: Axios con interceptores para rotación automatizada de tokens
* **Gestión de Estado**: Contextos de React (`AuthContext`, `LanguageContext`, `ThemeContext`)
* **Localización (i18n)**: Inglés (por defecto) y Español, con selector dinámico y persistencia en cliente

---

## 📖 Arquitectura del Frontend y Secciones

La interfaz de usuario está estructurada en torno a **cinco secciones principales**:

### 1. Home (Inicio y Seguimiento de Progreso)
* **Progreso Activo**: Muestra las guías que el usuario está siguiendo activamente (lo que está leyendo, viendo o jugando).
* **Panel Up Next**: Alimentado por el algoritmo del backend `/up-next`. Le dice al usuario exactamente qué cómic, libro, juego o episodio consumir a continuación, omitiendo las partes marcadas como "relleno" o saltadas.
* **Alertas de Actualización**: Notificaciones cuando hay cambios o adiciones en las guías que sigue el usuario.

### 2. Social (Timeline y Novedades)
* **Timeline de Actividad**: Muestra de forma cronológica los avances, calificaciones (1-5 estrellas) y opiniones de los usuarios seguidos.
* **Interacciones de Comunidad**: Opciones para dar me gusta, comentar y reportar guías, comentarios u opiniones.

### 3. Crear (Creador de Guías)
* **Cronologías Personalizadas**: Editor visual para arrastrar y ordenar contenido cronológicamente (mezclando distintos tipos de medios).
* **Importador de TMDB**: Integración para importar temporadas completas de series y animes con un solo clic.
* **Prioridad de Secciones e Ítems**: Permite definir una escala de importancia (1-5) para secciones enteras (ej. "Saga del Relleno" vs "Canon") con opción de sobreescribir la prioridad de elementos individuales.

### 4. Explorar (Buscador y Recomendaciones)
* **Buscador Global Unificado**: Un único buscador que conecta con las bases de datos de Comic Vine (cómics), MangaDex (manga), Open Library (libros), RAWG (juegos) y TMDB (películas, series y animes).
* **Guías Recomendadas**: Listado de cronologías más votadas y populares de la comunidad, con filtros por creador y categoría.

### 5. Perfil (Datos y Estantería Personal)
* **Estadísticas de Usuario**: Número de seguidores y seguidos, fecha de registro e historial completo de acciones.
* **Estantería (Library Shelf)**: Gestión del catálogo personal por estados de consumo (Por ver/leer/jugar, Viendo/leyendo/jugando, Terminado, Abandonado) con validación estricta de estados por tipo de categoría.
* **Destacados / Favoritos**: Sección en el perfil para fijar tus obras favoritas de cada formato multimedia.

---

## ⚡ Referencia del Backend y API

### 1. Autenticación y Usuarios
* **`POST /api/v1/auth/register`**: Registra una nueva cuenta de usuario.
* **`POST /api/v1/auth/login`**: Inicia sesión mediante Form URL-Encoded. Devuelve token JWT y establece cookie HttpOnly de refresco.
* **`POST /api/v1/auth/refresh`**: Genera un nuevo token de acceso usando la cookie de refresco.
* **`POST /api/v1/auth/logout`**: Cierra la sesión activa y elimina la cookie de refresco.
* **`POST /api/v1/auth/google`**: Validación de token de Google. Registro automático si es el primer inicio. Soporta bypass de desarrollo local (`"mock-google-email-username"`).
* **`POST /api/v1/auth/forgot-password`**: Envía un enlace de recuperación de contraseña al correo mediante una tarea en segundo plano.
* **`POST /api/v1/auth/reset-password`**: Valida el token y actualiza la contraseña del usuario.
* **`GET /api/v1/users/me`**: Retorna el perfil del usuario activo (guías creadas, guardadas y seguidos).
* **`PUT /api/v1/users/me/username`** y **`PUT /api/v1/users/me/password`**: Permiten modificar credenciales.
* **`GET /api/v1/users/search?q={query}`**: Busca otros usuarios por su nombre de usuario.

### 2. Buscador de Medios Unificado
* **`GET /api/v1/search/?q={query}&type={type}`**: Estandariza la respuesta de APIs externas en un formato único (`SearchResultItem`).
  * **Tipos**: `comic` (Comic Vine), `manga` (MangaDex), `book` (Open Library), `game` (RAWG), `movie` (TMDB), `series` (TMDB).

### 3. Guías Cronológicas (Listas)
* **`POST /api/v1/lists/`**: Crea una nueva guía con etiquetas de importancia personalizadas y pesos de sección por defecto.
* **`GET /api/v1/lists/{list_id}`**: Retorna los detalles de la lista, elementos, marcas de completado y porcentaje de progreso.
* **`POST /api/v1/lists/{list_id}/items`**: Añade ítems con prioridad individual (`importance_rank`).
* **`POST /api/v1/lists/{list_id}/items/tv-import`**: Importa capítulos de TV/Anime en lote desde la API de TMDB.
* **`POST /api/v1/lists/items/{item_id}/toggle`** y **`toggle-skip`**: Marca un elemento como completado o saltado.
* **`POST /api/v1/lists/{list_id}/sections/bulk-action`**: Aplica acciones en lote (completar/saltar) a secciones enteras.

### 4. Estantería Personal (Shelf)
* **`POST /api/v1/library/`**: Añade obras al catálogo del usuario (`reading`, `playing`, `plan_to_watch`, etc.).
* **`GET /api/v1/library/`**: Devuelve los elementos de la estantería del usuario con validación estricta.
* **`PUT /api/v1/library/{library_item_id}`**: Cambia el estado de consumo del elemento.
* **`DELETE /api/v1/library/{library_item_id}`**: Remueve el elemento de la estantería.

### 5. Algoritmo Up Next
* **`GET /api/v1/users/me/up-next`**: Calcula la siguiente obra o capítulo a consumir en base a las guías seguidas y series en seguimiento.

### 6. Interacción Social e Hilos
* **`POST /api/v1/social/users/{user_id}/follow`** / **`DELETE`**: Seguir y dejar de seguir usuarios.
* **`GET /api/v1/social/users/feed/activity`**: Feed de actividad social de las personas que sigues.
* **`GET /api/v1/social/lists/feed/social`**: Novedades de nuevas guías públicas creadas en la red.
* **`POST /api/v1/social/lists/{list_id}/comments`**: Comentar en guías.
* **`POST /api/v1/social/lists/{list_id}/vote`** y **`report`**: Votar a favor o reportar guías.
* **`POST /api/v1/reviews/{item_type}/{external_id}`**: Escribir reseñas y asignar calificación (1-5 estrellas) a obras individuales.

### 7. Modificaciones (Mods)
* **`POST /api/v1/additions/lists/{list_id}/additions`**: Crea un bloque de adiciones/modificaciones a una guía.
* **`POST /api/v1/additions/additions/{addition_id}/items`**: Añade ítems personalizados anclados a elementos base de la guía.
* **`GET /api/v1/additions/lists/{list_id}/additions/community`**: Consulta adiciones públicas sugeridas por otros usuarios.
* **`POST /api/v1/additions/additions/{addition_id}/adopt`**: Adopta adiciones de terceros para integrarlas visualmente en tu propia vista de la guía.

### 8. Moderación de Administradores y Límites
* **`GET /api/v1/admin/reports`**: Retorna reportes activos sobre opiniones, comentarios y listas.
* **`DELETE /api/v1/admin/users/{user_id}`**: Banea y elimina cuentas de usuarios tóxicos.
* **Límite de peticiones**: Las búsquedas globales están restringidas mediante slowapi a un máximo de **20 búsquedas por minuto por IP** para proteger las cuotas de las APIs externas.

---

## 🛠️ Instalación y Configuración

### Ejecución del Backend
1. Crea tu entorno virtual de Python:
   ```bash
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   ```
2. Instala dependencias:
   ```bash
   pip install -r requirements.txt
   ```
3. Crea tu archivo `.env` tomando como base `.env.example` y rellena tus claves.
4. Levanta el servidor local con Uvicorn:
   ```bash
   uvicorn app.main:app --reload
   ```

### Ejecución del Frontend
1. Ve al directorio frontend:
   ```bash
   cd frontend
   ```
2. Instala los paquetes de Node:
   ```bash
   npm install
   ```
3. Ejecuta el servidor de desarrollo local de Vite:
   ```bash
   npm run dev
   ```
4. Genera el empaquetado para producción:
   ```bash
   npm run build
   ```
