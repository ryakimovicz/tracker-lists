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

  // Landing Page
  heroTitle: { en: 'Chronological Guides for Manga, Series & Games', es: 'Cronologías de Lectura, Visualización y Juegos' },
  heroSubtitle: { en: 'Create custom chronological order lists, track episodes, adopt community additions, and keep your personal shelf synced.', es: 'Crea tus propias guías de orden cronológico, realiza seguimientos de episodios, adopta adiciones de la comunidad y mantén tu biblioteca personal sincronizada.' },
  btnGoShelf: { en: 'Go to My Shelf', es: 'Ir a mi Estantería' },
  btnGetStarted: { en: 'Get Started', es: 'Empezar Gratis' },
  
  // Features
  featSearchTitle: { en: 'Unified Media Search', es: 'Multimedios Unificado' },
  featSearchDesc: { en: 'Find and manage books, manga, comics, series, movies, and video games connecting 4 APIs in a single console.', es: 'Busca y gestiona libros, mangas, cómics, series de televisión, películas y videojuegos conectando 4 APIs en un único portal.' },
  
  featModsTitle: { en: 'Community Mods (Additions)', es: 'Mods de Comunidad (Additions)' },
  featModsDesc: { en: 'Missing a special issue, light novel, or filler episode? Inject additions, share them, and adopt community ones.', es: '¿Falta un especial, novela ligera o episodio de relleno? Inyecta adiciones, compártelas y adopta las de la comunidad.' },
  
  featShelfTitle: { en: 'Flexible Library Shelf', es: 'Estantería Flexible' },
  featShelfDesc: { en: 'Manage consumption statuses (Reading, Playing, Skipped, Completed) with rigorous category validations and global sync.', es: 'Administra tus estados de consumo (Leyendo, Jugando, Omitido, Completado) con validaciones categóricas y sincronización de progreso global.' },

  // Priority Levels
  priorityOptional: { en: 'Optional', es: 'Opcional' },
  priorityRecommended: { en: 'Recommended', es: 'Recomendado' },
  priorityHighlyRec: { en: 'Highly Recommended', es: 'Altamente Recomendado' },
  priorityMandatory: { en: 'Mandatory', es: 'Obligatorio' },
  priorityEssential: { en: 'Essential', es: 'Esencial' },

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
      // Fallback to browser language if it is Spanish, otherwise English
      const browserLang = navigator.language.startsWith('es') ? 'es' : 'en';
      setLanguageState(browserLang);
    }
  }, []);

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
