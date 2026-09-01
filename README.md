<div align="center">
  <a href="https://pathd.net">
    <img src="frontend/public/logo-horizontal-tagline-transparent.png" alt="Pathd Logo" width="340" />
  </a>
  <p><strong>The Ultimate Multi-Media Universe & Personal Library Tracker</strong></p>

  <p>
    <a href="https://pathd.net"><img src="https://img.shields.io/badge/Production-Online-10b981?style=for-the-badge&logo=cloudflare" alt="Production Status" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/Frontend-React_19_+_TypeScript-61dafb?style=for-the-badge&logo=react" alt="React" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" /></a>
    <a href="https://neon.tech/"><img src="https://img.shields.io/badge/Database-PostgreSQL_Serverless-4169e1?style=for-the-badge&logo=postgresql" alt="PostgreSQL" /></a>
  </p>
</div>

**Pathd** (`pathd.net`) es una plataforma web premium y unificada diseñada para indexar, organizar y hacer seguimiento de tu consumo cultural y entretenimiento en un único lugar: **Películas, Series, Anime, Libros, Cómics, Mangas, Música y Videojuegos**.

Complementada con un potente constructor de **Guías Cronológicas interactivas**, modificaciones de la comunidad (*Mods*), un **Feed Social en tiempo real**, **Sincronización Musical con Last.fm**, y un sistema de diseño inmersivo con estética *Glassmorphism*.

---

## ✨ Características Principales

### 🎯 Todo tu Entretenimiento en un Solo Lugar
- **Seguimiento Unificado**: Olvídate de usar una app distinta para películas, otra para libros y otra para videojuegos. Todo tu historial, pendientes y calificaciones conviven en tu estantería personal.
- **Selectores de Progreso Inteligentes**:
  - *Series y Anime*: Detección automática del siguiente episodio por ver, calendario de estrenos y botón de marcado rápido.
  - *Libros, Cómics y Mangas*: Contador interactivo de páginas leídas con porcentaje visual en tiempo real.
  - *Juegos y Películas*: Registro dinámico de tiempo dedicado (*horas y minutos*).

### ✏️ Creador de Guías Cronológicas & Modificaciones (Mods)
- **Constructor Multinivel**: Crea el orden perfecto para sagas complejas con secciones, bloques de importancia (1 a 5 estrellas: *Opcional, Recomendado, Obligatorio*) y notas personalizadas.
- **Arrastrar y Soltar (*Drag & Drop*)**: Reordena temporadas, películas y tomos con fluidez.
- **Sistema de Adiciones Comunitarias**: Los usuarios pueden crear expansiones o listas complementarias sobre guías públicas y adoptarlas con un solo clic.

### 👥 Comunidad & Social
- **Feed de Actividad en Tiempo Real**: Descubre qué están viendo, leyendo o jugando las personas que sigues.
- **Reseñas & Puntuaciones**: Comparte tus opiniones con calificaciones del 1 al 5 y debate en hilos de comentarios.
- **Música en Vivo (Last.fm)**: Conecta tu cuenta para mostrar en tu perfil la canción que estás escuchando en vivo y tus álbumes más reproducidos de la semana.

### ⚡ Rendimiento Ultrarrápido (0 ms)
- **Motor de Prefetching Inteligente**: Calentamiento silencioso en segundo plano (*Idle Warmup*) y precarga anticipada al pasar el cursor sobre los enlaces (*Hover Prefetching*).
- **Búsqueda Multicapa con Caché**: Respuestas inmediatas y búsqueda progresiva con priorización en la categoría activa.

---

## 💎 Niveles de Membresía

| Beneficio | 🌟 Pathd Free | 👑 Pathd Premium / VIP |
|---|:---:|:---:|
| **Biblioteca & Seguimiento Personal** | Ilimitado | Ilimitado |
| **Experiencia sin Publicidad (Ad-Free)** | — | ✅ 100% Libre de Anuncios |
| **Historial Detallado de Re-consumo** | Hasta 2 por obra | ✅ Ilimitado con Fechas |
| **Obras Destacadas en el Perfil** | Hasta 7 obras | ✅ Hasta 70 obras |
| **Creación de Guías Cronológicas** | Hasta 2 públicas | ✅ Ilimitadas (Públicas, Privadas y No Listadas) |
| **Personalización de Perfil** | Básico | ✅ Color de acento, avatar, fondo y banner personalizado |
| **Insignia Distintiva en la Comunidad** | — | ⭐ Insignia Dorada Premium / VIP |

---

## 🌐 Proveedores de Datos y Atribuciones

Pathd se alimenta e integra con los mejores servicios abiertos y especializados del mundo:

- 🎬 **Películas**: [OMDb API](https://www.omdbapi.com/) & [Fanart.tv](https://fanart.tv/)
- 📺 **Series & Anime**: [TVMaze](https://www.tvmaze.com/)
- 📚 **Libros**: [Google Books](https://developers.google.com/books) & [Open Library](https://openlibrary.org/)
- 🦸 **Cómics**: [Comic Vine](https://comicvine.gamespot.com/)
- 🌸 **Mangas & Novelas**: [AniList GraphQL](https://anilist.co/)
- 🎮 **Videojuegos**: [IGDB / Twitch](https://www.igdb.com/)
- 🎵 **Música & Scrobbling**: [Last.fm](https://www.last.fm/)
- 💳 **Pagos Seguros**: [Dodo Payments](https://dodopayments.com/)
- 💌 **Correos Transaccionales**: [Resend](https://resend.com/)

---

## 📚 Documentación Técnica & Código

Si eres desarrollador, buscas auditar la infraestructura o colaborar en el proyecto:

- 📖 **[Especificación Técnica y Catálogo de API REST](docs/TECHNICAL.md)**: Documentación completa de los más de 60 endpoints, esquema de base de datos y guías de desarrollo local.
- 🎨 **[Documentación del Frontend (React + Vite)](frontend/README.md)**: Estructura del cliente, tokens de diseño y optimizaciones de rendimiento.

---

<div align="center">
  <sub>Desarrollado con ❤️ para amantes del cine, las series, la literatura, los videojuegos y la música.</sub><br>
  <sub>© 2026 Pathd (pathd.net). Todos los derechos reservados.</sub>
</div>
