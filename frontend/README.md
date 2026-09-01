# Pathd - Frontend SPA 🌌

Frontend oficial de **Pathd**, desarrollado como una Single Page Application (SPA) moderna, responsiva y de alto rendimiento construida con **React 19, TypeScript y Vite**.

---

## 🛠️ Stack Tecnológico

- **Core**: React 19, TypeScript 5, Vite
- **Iconografía**: [lucide-react](https://lucide.dev/)
- **Cliente HTTP**: Axios con interceptores automáticos de autenticación JWT y bilingüismo (`Accept-Language`).
- **Diseño & Estilos**: Vanilla CSS con sistema de diseño basado en variables CSS personalizadas (**Solar Amber `#f59e0b`** y **Deep Cinema Charcoal `#090d16`**), efectos *Glassmorphism* y tipografía Inter.
- **Rendimiento & Precarga**:
  - **Idle Warmup**: Calentamiento automático de datos en segundo plano durante períodos de inactividad de CPU.
  - **Hover & Touch Prefetching**: Anticipación al clic en elementos de navegación del Sidebar.
  - **Multi-tier Cache**: Caché en memoria y `sessionStorage` para aperturas de pantalla en 0 ms.
- **Monetización**: Google AdSense con bloques responsivos integrados y soporte nativo para cuentas Premium sin anuncios.

---

## 🚀 Comandos Disponibles

En el directorio `frontend/`:

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (HMR)
npm run dev

# Compilar bundle de producción optimizado
npm run build

# Previsualizar el build de producción localmente
npm run preview

# Ejecutar linter
npm run lint
```

---

## 🗂️ Estructura del Frontend

```
frontend/src/
├── api/          # Cliente Axios centralizado e interceptores de red
├── components/   # Componentes modulares reutilizables (Sidebar, Modales, MediaCards, Ads, etc.)
├── context/      # Contextos globales de estado (AuthContext, LanguageContext, ThemeContext)
├── hooks/        # Custom hooks de React (useScrollLock, etc.)
├── pages/        # Vistas y pantallas principales (Home, Search, Social, CreateGuide, Profile, etc.)
└── utils/        # Utilidades de caché, formateo y motor de prefetching inteligente
```
