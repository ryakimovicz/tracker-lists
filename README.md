<div align="center">
  <a href="https://pathd.net">
    <img src="frontend/public/logo-horizontal-transparent.png" alt="Pathd Logo" width="300" />
  </a>
  <p><strong>La plataforma definitiva para el seguimiento de tu universo multimedia, guías cronológicas y biblioteca personal</strong></p>

  <p>
    <a href="https://pathd.net"><img src="https://img.shields.io/badge/Version-v0.9.8_Beta-f59e0b?style=for-the-badge&logo=rocket" alt="Pathd Version" /></a>
    <a href="https://pathd.net"><img src="https://img.shields.io/badge/Production-Online-10b981?style=for-the-badge&logo=cloudflare" alt="Production Status" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/Frontend-React_19_+_TypeScript-61dafb?style=for-the-badge&logo=react" alt="React" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" /></a>
    <a href="https://neon.tech/"><img src="https://img.shields.io/badge/Database-PostgreSQL_Serverless-4169e1?style=for-the-badge&logo=postgresql" alt="PostgreSQL" /></a>
  </p>
</div>

**Pathd** (`pathd.net`) es una plataforma web unificada de alto rendimiento diseñada para indexar, organizar y hacer seguimiento detallado de tu consumo cultural y entretenimiento en un único lugar: **Películas, Series, Anime, Libros, Cómics, Mangas, Música y Videojuegos**.

Cuenta con un potente constructor de **Guías Cronológicas interactivas**, modificaciones de la comunidad (*Mods*), un **Feed Social y Reseñas con soporte multimedia KLIPY**, **Sincronización Musical con Last.fm**, calendario inteligente de próximos lanzamientos y un sistema de diseño inmersivo con estética *Glassmorphism*.

---

## ✨ Características Principales

### 🎯 Todo tu Entretenimiento en un Solo Lugar
- **Seguimiento Unificado**: Olvídate de usar una app distinta para cada formato. Todo tu historial, pendientes, re-consumo y calificaciones conviven en tu estantería personal.
- **Estantería Inteligente con Subcategorías por Estado**: Organización automática por medios y estados contextuales (*Viendo / Al día, Pausadas, Terminadas / Leídas, 🏆 100%, Por ver/leer/jugar y Abandonadas*) con contadores tipográficos sutiles y suma matemática unificada.
- **Selectores de Progreso Inteligentes por Formato**:
  - *Series y Anime*: Detección automática del siguiente episodio por ver, avance con un solo clic, estado "Al día" en emisión, exclusión de extras/especiales en el cómputo y árbol interactivo de temporadas.
  - *Libros, Cómics y Mangas*: Contador interactivo de páginas leídas, porcentaje en tiempo real, sincronización de grapas/números sueltos dentro de tomos y confirmación de números anteriores.
  - *Juegos y Películas*: Registro dinámico de tiempo dedicado (*horas y minutos*), soporte para películas pausadas, juegos infinitos/continuos y distinciones entre completado estándar y **100% completado**.
- **Calendario de Próximos Estrenos**:
  - Pestaña *Próximos* con visualización en *Calendario* mensual persistente y sección *Por Confirmar (TBA)* para obras anunciadas sin fecha exacta.
  - Persistencia permanente de fechas de estreno (`release_date`) en la base de datos para carga instantánea en 0 ms.

### 🧭 Exploración, Tendencias y Destacados
- **Tendencias Globales y por Categoría**: Descubre lo más popular en películas, series, anime, libros, cómics y juegos en una interfaz fluida.
- **Pestaña de Guías Comunitarias**: Explora colecciones y cronologías recomendadas por la comunidad con métricas de votos, vistas y creadores.
- **Vitrina de Obras Destacadas en Perfil**:
  - Selección de hasta 7 (Free) o 70 (Pro) favoritos con filtros por tipo de obra y vistas en *Grid* o *Lista*.
  - Reordenamiento visual mediante **Arrastrar y Soltar (*Drag & Drop*)** y persistencia cronológica (`favorited_at` / `favorite_order`).
  - Navegación lateral con soporte para desplazamiento continuo (*Hold-to-Scroll*) y visualización fluida de 1 o 2 filas.

### ✏️ Creador de Guías Cronológicas & Modificaciones (Mods)
- **Constructor Multinivel**: Diseña el orden de visualización o lectura para sagas complejas mediante secciones, bloques de prioridad (1 a 5 estrellas: *Opcional, Recomendado, Obligatorio*) y notas contextuales.
- **Arrastrar y Soltar (*Drag & Drop*)**: Reordena temporadas, películas y tomos con fluidez.
- **Sistema de Adiciones Comunitarias (Mods)**: Crea expansiones o listas complementarias sobre guías públicas de otros usuarios y adóptalas con un clic.

### 👥 Comunidad, Reseñas, Actividad & KLIPY Multimedia
- **Feed Social y Actividad Estandarizada**:
  - Feed social estructurado con 4 pestañas especializadas (*Siguiendo, Descubrir, Reseñas y Mi Actividad*).
  - Botón flotante e inteligente de **Actualizar** que aparece solo cuando hay actividad fresca detectada, evitando saltos de scroll molestos.
  - Historial de actividad personal y público con agrupación inteligente por ventana de 24 horas (*24h batching*) para evitar saturación en avances de episodios, páginas y sesiones de juego.
  - Likes e interacciones totalmente idempotentes y protegidos contra carreras de red concurrentes.
  - Sincronización y limpieza reversible automática al desmarcar o eliminar obras.
- **Reseñas & Puntuaciones de Precisión**:
  - Calificación fluida con soporte para **medias estrellas** (0.5 a 5.0 ⭐) y hover continuo.
  - Críticas de la comunidad separadas de los hilos de debate general, con votos y soporte para KLIPY.
- **Integración KLIPY**: Selector multimedia enriquecido integrado en comentarios y reseñas con **GIFs, Stickers, Memes y Clips de Audio**, con buscador persistente, pestañas de favoritos y control global de volumen con auto-silenciado en scroll.
- **Suite Musical Completa (Last.fm)**:
  - Vincula tu cuenta de Last.fm con soporte para Spotify, Apple Music, YouTube Music y Deezer.
  - Canción en reproducción en vivo con ecualizador animado adaptativo al tema de color de tu perfil.
  - Tops semanales, mensuales e históricos de artistas, álbumes y canciones.
  - Enriquecimiento de portadas HD multifuente (*Last.fm, Deezer, MusicBrainz, Discogs*) y modal interactivo de detalles de álbumes y pistas con tracklist completo.

### ⚡ Rendimiento Ultrarrápido & Sincronización Multidispositivo (0 ms)
- **Sincronización Inteligente Multidispositivo**:
  - Detección reactiva de visibilidad (`visibilitychange` / `focus`) para sincronizar estantería, notificaciones no leídas y listas de seguimiento entre PC y móvil sin recargas forzadas ni saturación del servidor.
  - Marcado instantáneo de episodios y números de cómics en Inicio con avance optimista y backend idempotente (`action=complete`), garantizando **cero registros duplicados** en el historial.
- **Motor de Prefetching Inteligente**: Calentamiento silencioso en segundo plano (*Idle Warmup*) y precarga anticipada al interactuar con enlaces (*Hover & Touch Prefetching*).
- **Búsqueda Multicapa con Caché y Debounce**: Barra de búsqueda con limpieza instantánea, filtros por categoría persistentes y caché en memoria y `sessionStorage`.
- **Sincronización Instantánea de Estantería (Frame-0)**: Caché local persistente con indexación hash $O(1)$ para marcar de inmediato las obras agregadas en Explorar y modales sin esperar peticiones de red.
- **Navegación Continua en Carruseles**: Desplazamiento fluido con soporte de clic único (paso fijo) o pulsación sostenida (*Smooth Continuous Scrolling*) y máscaras de gradiente.

---

## 💎 Niveles de Membresía

| Beneficio | 🌟 Pathd Free | 👑 Pathd Premium / VIP |
|---|:---:|:---:|
| **Biblioteca & Seguimiento Personal** | Ilimitado | Ilimitado |
| **Experiencia sin Publicidad (Ad-Free)** | — | ✅ 100% Libre de Anuncios |
| **Historial Detallado de Re-consumo** | Hasta 2 por obra | ✅ Ilimitado con Fechas |
| **Obras Destacadas en el Perfil** | Hasta 7 obras | ✅ Hasta 70 obras |
| **Creación de Guías Cronológicas** | Hasta 2 públicas | ✅ Ilimitadas (Públicas, Privadas y No Listadas) |
| **Personalización** | Básico | ✅ Color de acento, avatar, fondo, banner y orden de categorías personalizado |
| **Insignia Distintiva en la Comunidad** | — | ⭐ Insignia Dorada Premium / VIP |

---

## 🌐 Proveedores de Datos y Atribuciones

Pathd se alimenta e integra con los mejores servicios y APIs abiertas del mundo:

- 🎬 **Películas**: [OMDb API](https://www.omdbapi.com/) & [Fanart.tv](https://fanart.tv/)
- 📺 **Series & Anime**: [TVMaze](https://www.tvmaze.com/) & [AniList GraphQL](https://anilist.co/)
- 📚 **Libros**: [Google Books](https://developers.google.com/books) & [Open Library](https://openlibrary.org/)
- 🦸 **Cómics**: [Comic Vine](https://comicvine.gamespot.com/)
- 🌸 **Mangas & Novelas Ligeras**: [AniList GraphQL](https://anilist.co/)
- 🎮 **Videojuegos**: [IGDB / Twitch](https://www.igdb.com/)
- 🎵 **Música & Scrobbling**: [Last.fm](https://www.last.fm/)
- 🎭 **GIFs, Memes & Clips**: [KLIPY API](https://klipy.co/)
- 💳 **Pagos Seguros**: [Dodo Payments](https://dodopayments.com/)
- 💌 **Correos Transaccionales**: [Resend](https://resend.com/)

---

## 📚 Documentación Técnica & Código

Si eres desarrollador o deseas auditar la arquitectura:

- 📖 **[Especificación Técnica y Catálogo de API REST](docs/TECHNICAL.md)**: Documentación completa de endpoints, arquitectura, modelos de base de datos y guías de desarrollo local.
- 🎨 **[Documentación del Frontend (React + Vite)](frontend/README.md)**: Estructura del cliente, tokens de diseño, integración KLIPY y optimizaciones de rendimiento.

---

<div align="center">
  <sub>Desarrollado con ❤️ para amantes del cine, las series, el anime, los cómics, la literatura, los videojuegos y la música.</sub><br>
  <sub>© 2026 Pathd (pathd.net). Todos los derechos reservados.</sub>
</div>
