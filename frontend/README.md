# Pathd - Frontend SPA 🌌

Frontend oficial de **Pathd (v0.9.8 Beta)**, desarrollado como una Single Page Application (SPA) moderna, fluida y de alto rendimiento construida con **React 19, TypeScript y Vite**.

---

## 🛠️ Stack Tecnológico

- **Framework & Build**: React 19, TypeScript 5, Vite
- **Iconografía**: [lucide-react](https://lucide.dev/)
- **Cliente HTTP**: Axios con interceptores automáticos de autenticación JWT y bilingüismo (`Accept-Language`).
- **Diseño & Estilos**:
  - Vanilla CSS con sistema de diseño modular basado en variables CSS personalizadas (**Solar Amber `#f59e0b`** y **Deep Cinema Charcoal `#090d16`**).
  - Efectos *Glassmorphism* y desenfoques por capas (`backdrop-filter`).
  - Colores temáticos y scrollbars contextuales por categoría (*Movies, Series, Anime, Books, Comics, Manga, Games*).
  - Tipografía moderna (*Inter / Outfit*).
- **Multimedia & Comunidad**:
  - **KLIPY API Integrada**: Selector de contenido enriquecido (**GIFs, Stickers, Memes y Clips de Audio**) en reseñas y comentarios con persistencia de favoritos (`klipyFavorites.ts`), buscador reactivo, slider de volumen y auto-silenciado en scroll o pérdida de foco.
- **Rendimiento & Precarga**:
  - **Idle Warmup**: Calentamiento automático de datos en segundo plano durante períodos de inactividad de CPU.
  - **Hover & Touch Prefetching**: Anticipación inteligente al clic en elementos del Sidebar y tarjetas de obras.
  - **Multi-tier Cache**: Caché en memoria + `sessionStorage` para apertura de vistas y modales en 0 ms.
  - **Debounced Search**: Búsqueda reactiva optimizada con botón de borrado instantáneo y filtros de categoría permanentes.
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
│   ├── MusicDetailsModal.tsx       # Modal de detalle de álbumes, artistas y pistas (Last.fm + MusicBrainz)
│   ├── MusicServiceGuideModal.tsx  # Guía de conexión para Last.fm (Spotify, Apple Music, YT Music, Deezer)
│   ├── KlipyPicker.tsx             # Selector multimedia de KLIPY (GIFs, Memes, Stickers, Clips de Audio)
│   ├── MediaCard.tsx               # Tarjeta visual con badges de progreso, tipo y acciones rápidas
│   ├── MediaPoster.tsx             # Portada optimizada con fallbacks inteligentes y badges temáticos
│   ├── HorizontalScroll.tsx        # Carrusel reutilizable con gradientes y continuous scroll
│   ├── PathdLoader.tsx             # Loader animado nativo con gradiente y transiciones fluidas
│   ├── Sidebar.tsx                 # Navegación principal con prefetch inteligente al hover
│   ├── ReplaceFavoriteModal.tsx    # Modal para reemplazar obras destacadas al alcanzar el límite
│   ├── ReplaceSavedGuideModal.tsx  # Modal para reemplazar guías guardadas al alcanzar el límite
│   ├── ConsumptionHistoryModal.tsx # Historial cronológico de re-consumo y fechas
│   ├── AdBanner.tsx                # Bloques de publicidad responsiva con bypass para usuarios Pro
│   └── ...
├── context/      # Contextos globales de estado:
│   ├── AuthContext.tsx             # Sesión, usuario activo, roles, VIP y token refresh
│   ├── LanguageContext.tsx         # Internacionalización dinámica (Español / English)
│   └── ThemeContext.tsx            # Variables visuales y personalización de interfaz
├── hooks/        # Custom hooks de React:
│   ├── useContinuousScroll.ts      # Desplazamiento continuo por clic sostenido en carruseles
│   └── useScrollLock.ts            # Bloqueo dinámico de scroll del body en modales abiertos
├── pages/        # Vistas y pantallas de la aplicación:
│   ├── Home.tsx                    # Dashboard (Continuar, Próximos/Calendario, Seguimiento)
│   ├── Search.tsx                  # Búsqueda global, filtros por categoría y adición rápida
│   ├── Explore.tsx                 # Tendencias multimedia y Guías comunitarias destacadas
│   ├── Library.tsx                 # Estantería personal con filtros, estados y badge 100%
│   ├── Social.tsx                  # Feed de actividad de seguidos y comunidad
│   ├── CreateGuide.tsx             # Constructor interactivo de guías cronológicas (Drag & Drop)
│   ├── GuideDetail.tsx             # Vista y progreso de guías con soporte para Mods
│   ├── Profile.tsx                 # Perfil (Estantería, Favoritos Drag & Drop, Guías, Last.fm)
│   ├── Customize.tsx               # Personalización estética de perfil y orden de categorías
│   └── Settings.tsx                # Configuración de cuenta, seguridad y suscripciones
└── utils/        # Utilidades y motores de caché:
    ├── klipyFavorites.ts           # Almacenamiento local de favoritos de KLIPY
    ├── prefetch.ts                 # Motor de prefetching anticipado y warmup
    ├── seriesCache.ts              # Caché de metadatos de episodios y volúmenes
    ├── profileThemes.ts            # Paletas de color temáticas y estilos dinámicos de perfil
    └── categoryOrder.ts            # Orden y visibilidad personalizada de categorías
```

