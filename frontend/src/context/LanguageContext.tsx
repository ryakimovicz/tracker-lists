import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'es';

interface Translations {
  [key: string]: {
    en: string;
    es: string;
  };
}

const translations: Translations = {
  // Navigation
  navSearch: { en: 'Search', es: 'Buscar' },
  navShelf: { en: 'My Shelf', es: 'Estantería' },
  navAdmin: { en: 'Admin Panel', es: 'Panel de Admin' },
  navLogout: { en: 'Log Out', es: 'Salir' },
  navLogin: { en: 'Log In', es: 'Iniciar Sesión' },
  navRegister: { en: 'Register', es: 'Registrarse' },
  navHome: { en: 'Home', es: 'Inicio' },
  navSocial: { en: 'Social', es: 'Social' },
  navCreate: { en: 'Create', es: 'Crear' },
  navExplore: { en: 'Explore', es: 'Explorar' },
  navProfile: { en: 'Profile', es: 'Perfil' },
  navSettings: { en: 'Settings', es: 'Ajustes' },
  navUpgradePro: { en: 'Get Premium', es: 'Hacerse Premium' },




  // Landing Page
  heroTitleLine1: { en: 'Guides for everything you love', es: 'Guías de todo lo que amas' },
  heroTitleLine2: { en: 'in a single place', es: 'en un único sitio' },
  heroSubtitle: { en: 'Movies, series, anime, books, comics, manga, and games. Create complete guides, track your progress, and discover your next obsession together with the community.', es: 'Películas, series, animes, libros, comics, mangas y juegos. Crea las guías completas, haz un seguimiento de tu progreso y descubre tu próxima obsesión junto a la comunidad.' },
  btnStartCollection: { en: 'Start My Collection', es: 'Empezar mi colección' },
  btnExploreGuides: { en: 'Explore Guides', es: 'Explorar Guías' },
  
  // Features
  featTrackerTitle: { en: 'All-in-One Tracker', es: 'Tracker Todo en Uno' },
  featTrackerDesc: { en: 'Track movies, TV shows, anime, books, comics, manga, and games. Log your activity, rate, and visualize your stats in a single unified profile.', es: 'Lleva el control de películas, series, anime, libros, cómics, mangas y juegos. Registra tu consumo, puntúa y visualiza estadísticas en un solo perfil unificado.' },

  
  featSearchTitle: { en: 'Guides & Endless Universes', es: 'Guías y Universos Sin Fronteras' },
  featSearchDesc: { en: 'Create and explore chronological or thematic lists combining any format. The ideal tool for organizing complex sagas and franchises.', es: 'Crea y explora listas cronológicas o temáticas combinando cualquier formato. La herramienta perfecta para organizar sagas y franquicias complejas.' },
  
  featModsTitle: { en: 'Community & Customization', es: 'Comunidad y Personalización' },
  featModsDesc: { en: 'Follow friends\' progress, share recommendations, and enrich any guide by adding custom items and special notes.', es: 'Sigue el progreso de amigos, comparte recomendaciones y enriquece cualquier guía añadiendo ítems personalizados y notas especiales.' },


  // Priority Levels
  priorityOptional: { en: 'Optional', es: 'Opcional' },
  priorityRecommended: { en: 'Recommended', es: 'Recomendado' },
  priorityHighlyRec: { en: 'Highly Recommended', es: 'Altamente Recomendado' },
  priorityMandatory: { en: 'Mandatory', es: 'Obligatorio' },
  priorityEssential: { en: 'Essential', es: 'Esencial' },

  // Authentication & Forms
  authEmail: { en: 'Email Address', es: 'Correo Electrónico' },
  authPassword: { en: 'Password', es: 'Contraseña' },
  authConfirmPassword: { en: 'Confirm Password', es: 'Confirmar Contraseña' },
  authUsername: { en: 'Username', es: 'Nombre de usuario' },
  authForgotPassword: { en: 'Forgot Password?', es: '¿Olvidaste tu contraseña?' },
  authResetPasswordTitle: { en: 'Reset Password', es: 'Restablecer Contraseña' },
  authSendResetLink: { en: 'Send Reset Link', es: 'Enviar Enlace de Recuperación' },
  authLoginButton: { en: 'Sign In', es: 'Iniciar Sesión' },
  authRegisterButton: { en: 'Create Account', es: 'Crear Cuenta' },
  authOr: { en: 'Or', es: 'O' },
  authGoogleLogin: { en: 'Sign In with Google', es: 'Iniciar Sesión con Google' },
  authNoAccount: { en: "Don't have an account?", es: '¿No tienes una cuenta?' },
  authHaveAccount: { en: 'Already have an account?', es: '¿Ya tienes una cuenta?' },
  authEmailPlaceholder: { en: 'enter your email', es: 'ingresa tu correo' },
  authPasswordPlaceholder: { en: 'enter your password', es: 'ingresa tu contraseña' },
  authUsernamePlaceholder: { en: 'choose a username', es: 'elige un nombre de usuario' },
  authRegistering: { en: 'Registering...', es: 'Registrando...' },
  authLoggingIn: { en: 'Logging in...', es: 'Iniciando sesión...' },
  authShowPassword: { en: 'Show password', es: 'Mostrar contraseña' },
  authHidePassword: { en: 'Hide password', es: 'Ocultar contraseña' },


  // Auth Errors & Alerts
  errUsernameTaken: { en: 'Username already registered', es: 'El nombre de usuario ya está registrado' },
  errEmailTaken: { en: 'Email already registered', es: 'El correo electrónico ya está registrado' },
  errGoogleAccountExists: { en: 'This email is already registered with Google. Please use "Continue with Google" to log in.', es: 'Este correo ya está registrado con Google. Por favor usa "Continuar con Google" para iniciar sesión.' },
  errAccountUsesGoogle: { en: 'This account was created with Google. Please click "Continue with Google" to log in, or use "Forgot password?" to set a password.', es: 'Esta cuenta fue creada con Google. Por favor pulsa "Continuar con Google" para entrar, o usa "¿Olvidaste tu contraseña?" para crear una.' },
  errRegistrationFailed: { en: 'Registration failed. Username or email might be already taken.', es: 'Error al registrarse. El nombre de usuario o correo podrían estar ya en uso.' },
  errLoginFailed: { en: 'Invalid username/email or password.', es: 'Usuario/correo o contraseña incorrectos.' },
  errPasswordLength: { en: 'Password must be at least 6 characters long.', es: 'La contraseña debe tener al menos 6 caracteres.' },
  errUsernameLength: { en: 'Username must be at least 3 characters long.', es: 'El nombre de usuario debe tener al menos 3 caracteres.' },
  errPasswordsNotMatch: { en: 'Passwords do not match.', es: 'Las contraseñas no coinciden.' },
  errResetTokenMissing: { en: 'Reset token is missing or invalid.', es: 'El token de recuperación falta o no es válido.' },
  errForgotPasswordFailed: { en: 'Failed to request password reset.', es: 'No se pudo solicitar el restablecimiento de contraseña.' },
  errResetPasswordFailed: { en: 'Failed to reset password. Token may have expired.', es: 'No se pudo restablecer la contraseña. El token podría haber expirado.' },

  // Media Categories
  mediaAll: { en: 'All', es: 'Todos' },
  mediaGame: { en: 'Game', es: 'Juego' },
  mediaMovie: { en: 'Movie', es: 'Película' },
  mediaSeries: { en: 'Show', es: 'Serie' },
  mediaBook: { en: 'Book', es: 'Libro' },
  mediaAnime: { en: 'Anime', es: 'Anime' },
  mediaEpisode: { en: 'Episode', es: 'Episodio' },
  mediaSeason: { en: 'Season', es: 'Temporada' },

  // Search Page
  searchTitle: { en: 'Explore Media Database', es: 'Explorar Base de Datos' },
  searchPlaceholder: { en: 'Search games, movies, series, books, anime, manga...', es: 'Buscar juegos, películas, series, libros, anime, manga...' },
  searchButton: { en: 'Search', es: 'Buscar' },
  searchNoResults: { en: 'No results found.', es: 'No se encontraron resultados.' },
  loadMoreResults: { en: 'Load more results', es: 'Mostrar más resultados' },
  searchAddShelf: { en: 'Add to Shelf', es: 'Añadir a Estantería' },
  searchSelectStatus: { en: 'Select Status', es: 'Seleccionar Estado' },
  searchItemAdded: { en: 'Item added to your shelf!', es: '¡Elemento añadido a tu estantería!' },
  exploreNew: { en: "What's New", es: 'Novedades' },
  errRateLimit: { en: 'Too many search requests. Please wait a minute.', es: 'Demasiadas búsquedas. Por favor espera un minuto.' },
  errSearchFailed: { en: 'Search failed. Please try again.', es: 'Error al realizar la búsqueda. Inténtalo de nuevo.' },

  // Themes
  themeSystem: { en: 'System', es: 'Sistema' },
  themeLight: { en: 'Light', es: 'Claro' },
  themeDark: { en: 'Dark', es: 'Oscuro' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const savedLang = localStorage.getItem('language') as Language;
    if (savedLang === 'en' || savedLang === 'es') {
      setLanguageState(savedLang);
    } else {
      const browserLang = navigator.language.startsWith('es') ? 'es' : 'en';
      setLanguageState(browserLang);
    }
  }, []);

  useEffect(() => {
    if (language === 'es') {
      document.title = 'Pathd • Seguimiento Multimedia Todo en Uno y Guías';
    } else {
      document.title = 'Pathd • All-in-One Media Tracker & Guides';
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };


  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) {
      return key; // Fallback to raw key string if translation is missing
    }
    return translation[language];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
