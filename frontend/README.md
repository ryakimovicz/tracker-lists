# Pathd - Frontend SPA 🌌

Frontend oficial de **Pathd (v0.9.10)**, desarrollado como una Single Page Application (SPA) moderna, fluida y de alto rendimiento construida con **React 19, TypeScript y Vite**.

---

## 🛠️ Stack Tecnológico

- **Framework & Build**: React 19, TypeScript 5, Vite
- **Iconografía**: [lucide-react](https://lucide.dev/)
- **Cliente HTTP**: Axios con interceptores automáticos de autenticación JWT y bilingüismo (`Accept-Language`).
- **Diseño & Estilos**:
  - Vanilla CSS con sistema de diseño modular basado en variables CSS personalizadas (**Solar Amber `#f59e0b`** y **Deep Cinema Charcoal `#090d16`**).
  - Efectos *Glassmorphism* y desenfoques por capas (`backdrop-filter`).
  - Colores temáticos y scrollbars contextuales por categoría (*Movies, TV Shows, Anime, Books, Manga, Comics, Games, Music*).
  - Tipografía moderna (*Inter / Outfit*).
- **Multimedia & Comunidad**:
  - **KLIPY API Integrada**: Selector de contenido enriquecido (**GIFs, Stickers, Memes y Clips de Audio**) en reseñas y comentarios con persistencia de favoritos (`klipyFavorites.ts`), buscador reactivo, slider de volumen y auto-silenciado en scroll o pérdida de foco.
  - **Puntuaciones de 0.5 a 5 Estrellas**: Componente interactivo de rating con detección de medias estrellas y hover suave continuo.
  - **Feed Social No Invasivo**: Botón flotante y centrado de actualización que aparece únicamente cuando se detecta actividad nueva al regresar a la pestaña.
- **Rendimiento, Resiliencia & Sincronización Multidispositivo**:
  - **Code-Splitting y Lazy Loading**: Rutas divididas dinámicamente con `React.lazy()` y `Suspense` respaldado por `PathdLoader` nativo para una carga inicial instantánea.
  - **Error Boundaries Globales**: Aislamiento de excepciones con `ErrorBoundary.tsx` para evitar caídas totales de la aplicación y permitir recuperación con 1 clic.
  - **Página 404 Adaptativa**: Ruta de captura global (`*`) con `NotFound.tsx` temática y enlaces rápidos de regreso.
  - **Detección Offline en Vivo**: `OfflineDetector.tsx` y hook reactivo para alertar sobre desconexiones y auto-reconectar de forma fluida.
  - **Deep-Linking y Modales en URL**: Navegación directa y compartible sincronizada con la barra de direcciones (`/music/album/...`, `/music/artist/...`, `?item=...`, `?discography=...`) con soporte nativo de retroceso y avance en el historial.
  - **Auto-Sync Reactivo**: Detección de visibilidad de pestaña (`visibilitychange` / `focus`) con intervalos de resguardo (throttling de 15s a 25s) para refrescar el estante, notificaciones no leídas y listas de seguimiento sin peticiones innecesarias.
  - **Marcado Instantáneo e Idempotente**: Botón de check de episodios en Inicio inmediatamente cliqueable apoyado en caché local, consultas paralelas (`Promise.all`) y mutación optimista en 0 ms.
  - **Idle Warmup**: Calentamiento automático de datos en segundo plano durante períodos de inactividad de CPU.
  - **Hover & Touch Prefetching**: Anticipación inteligente al clic en elementos del Sidebar y tarjetas de obras.
  - **Multi-tier Cache**: Caché en memoria + `sessionStorage` para apertura de vistas y modales en 0 ms.
  - **Instant Shelf Cache**: Persistencia local inmediata de la estantería del usuario con indexación $O(1)$ para marcar obras agregadas sin retraso en Explorar y modales.
  - **Debounced Search**: Búsqueda reactiva optimizada con botón de borrado instantáneo y filtros de categoría permanentes.
  - **Seguridad en Cliente & Manejo de Sesión**: Renovación transparente de tokens JWT mediante interceptores de Axios con rotación de cookies `HttpOnly`/`Secure`, tolerancia a respuestas de límite de tasa (`429 Too Many Requests`) y renderizado estrictamente sanitizado en React 19 sin scripts embebidos.
- **Monetización**: Google AdSense con bloques responsivos integrados y soporte nativo para cuentas Premium sin anuncios.

---

## 🚀 Comandos Disponibles

En el directorio `frontend/`:

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo con HMR
npm run dev

# Compilar bundle de producción optimizado
npm run build

# Previsualizar el build de producción localmente
npm run preview

# Ejecutar linter
npm run lint
```

---

## 🗂️ Estructura del Proyecto
 
```
frontend/src/
├── api/          # Cliente Axios centralizado e interceptores de red (auth, refresh, language)
├── components/   # Componentes modulares y reutilizables:
│   ├── ItemDetailsModal.tsx        # Modal de detalle de obra, cast, relaciones, episodios, tomos y reseñas
│   ├── MusicDetailsModal.tsx       # Modal de detalle de álbumes, artistas y pistas (Last.fm, Deezer)
│   ├── MusicServiceGuideModal.tsx  # Guía de conexión para Last.fm (Spotify, Apple Music, YT Music, Deezer)
│   ├── ItemRouteModal.tsx          # Enrutador modal deep-linked para obras sincronizado con la URL
│   ├── MusicRouteModal.tsx         # Enrutador modal deep-linked para música sincronizado con la URL
│   ├── PostRouteModal.tsx          # Enrutador modal deep-linked para publicaciones
│   ├── PremiumRouteModal.tsx       # Enrutador modal deep-linked para membresías
│   ├── ProModal.tsx                # Modal de suscripción, beneficios y checkout de Pathd Premium
│   ├── ErrorBoundary.tsx           # Error Boundary global con interfaz de recuperación y reintento
│   ├── OfflineDetector.tsx         # Detector reactivo de conectividad de red con banner de reconexión
│   ├── MobileBottomNav.tsx         # Barra de navegación inferior adaptativa para dispositivos móviles
│   ├── MobileHeader.tsx            # Cabecera compacta responsive con perfil y notificaciones
│   ├── KlipyPicker.tsx             # Selector multimedia de KLIPY (GIFs, Memes, Stickers, Clips de Audio)
│   ├── MediaCard.tsx               # Tarjeta visual con badges de progreso, tipo y acciones rápidas
│   ├── MediaPoster.tsx             # Portada optimizada con fallbacks inteligentes y badges temáticos
│   ├── HorizontalScroll.tsx        # Carrusel reutilizable con gradientes y continuous scroll
│   ├── PathdLoader.tsx             # Loader animado nativo con gradiente y transiciones fluidas
│   ├── Sidebar.tsx                 # Navegación principal con prefetch inteligente al hover
│   ├── ReplaceFavoriteModal.tsx    # Modal para reemplazar obras destacadas al alcanzar el límite
│   ├── ReplaceSavedGuideModal.tsx  # Modal para reemplazar guías guardadas al alcanzar el límite
│   ├── SearchPanel.tsx             # Panel de búsqueda rápida y navegación de resultados
│   ├── SwipeViewPager.tsx          # Paginador táctil fluido con gestos para navegación móvil
│   ├── AdBanner.tsx                # Bloques de publicidad responsiva con bypass para usuarios Pro
│   └── ...
├── context/      # Contextos globales de estado:
│   ├── AuthContext.tsx             # Sesión, usuario activo, roles, VIP y token refresh
│   ├── LanguageContext.tsx         # Internacionalización dinámica (Español / English)
│   └── ThemeContext.tsx            # Variables visuales y personalización de interfaz
├── hooks/        # Custom hooks de React:
│   ├── useContinuousScroll.ts      # Desplazamiento continuo por clic sostenido en carruseles
│   └── useScrollLock.ts            # Bloqueo dinámico de scroll del body en modales abiertos
├── pages/        # Vistas y pantallas de la aplicación (lazy-loaded con React.lazy):
│   ├── Landing.tsx                 # Presentación pública de Pathd, planes, características y FAQ
│   ├── Home.tsx                    # Dashboard (Continuar, Próximos/Calendario, Seguimiento)
│   ├── Search.tsx                  # Búsqueda global, filtros por categoría y adición rápida
│   ├── Social.tsx                  # Feed de actividad de seguidos y comunidad
│   ├── CreateGuide.tsx             # Constructor interactivo de guías cronológicas (Drag & Drop)
│   ├── ViewGuide.tsx               # Vista y progreso de guías con soporte para Mods
│   ├── Profile.tsx                 # Perfil (Estantería con subcategorías por estado, Favoritos Drag & Drop, Guías, Last.fm)
│   ├── Customize.tsx               # Personalización estética de la interfaz y orden de categorías
│   ├── Settings.tsx                # Configuración de cuenta, seguridad y suscripciones
│   ├── AdminPanel.tsx              # Panel de administración, métricas y moderación
│   ├── TermsOfService.tsx          # Términos del servicio, atribuciones y políticas de APIs
│   ├── PrivacyPolicy.tsx           # Política de privacidad, almacenamiento local y telemetría
│   └── NotFound.tsx                # Página 404 global para rutas inexistentes
├── utils/        # Utilidades y motores de caché:
│   ├── shelfCache.ts               # Caché local y diccionario hash O(1) de obras en estantería para sincronización inmediata
│   ├── klipyFavorites.ts           # Almacenamiento local de favoritos de KLIPY
│   ├── prefetch.ts                 # Motor de prefetching anticipado y warmup
│   ├── seriesCache.ts              # Caché de metadatos de episodios y volúmenes
│   ├── profileThemes.ts            # Paletas de color temáticas y estilos dinámicos de perfil
│   └── categoryOrder.ts            # Orden y visibilidad personalizada de categorías
```

