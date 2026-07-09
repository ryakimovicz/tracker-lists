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
  heroTitle: { en: 'Everything you love, in one place.', es: 'Todo lo que amas, en un solo lugar.' },
  heroSubtitle: { en: 'Movies, comics, books, series, and video games. Create the ultimate guides, track your progress, and discover your next obsession together with the community.', es: 'Películas, cómics, libros, series y videojuegos. Crea las guías definitivas, haz un seguimiento de tu progreso y descubre tu próxima obsesión junto a la comunidad.' },
  btnStartCollection: { en: 'Start My Collection', es: 'Empezar mi colección' },
  btnExploreGuides: { en: 'Explore Guides', es: 'Explorar Guías' },
  
  // Features
  featSearchTitle: { en: '🌌 Endless Universes', es: '🌌 Universos Sin Fronteras' },
  featSearchDesc: { en: 'Want to build the chronological order of Star Wars mixing movies, comics, and video games? Here you can. Our global search connects with the largest databases in the world so you don\'t miss anything.', es: '¿Quieres armar el orden cronológico de Star Wars mezclando las películas, los cómics y los videojuegos? Aquí puedes. Nuestro buscador global se conecta con las bases de datos más grandes del mundo para que no te falte nada.' },
  
  featModsTitle: { en: '🛠️ Make It Yours (Community Mods)', es: '🛠️ Hazlo Tuyo (Mods de la Comunidad)' },
  featModsDesc: { en: 'Missing an indie comic or a special episode? Add custom items to any public guide. The community will be able to vote and integrate your contributions into their own lists.', es: '¿Falta un cómic independiente o un episodio especial? Añade ítems personalizados a cualquier guía pública. La comunidad podrá votar e incorporar tus aportes a sus propias listas.' },
  
  featShelfTitle: { en: '✅ Your Progress, Your Rules', es: '✅ Tu Progreso, Tu Reglas' },
  featShelfDesc: { en: 'Forget about getting lost between seasons and volumes. Save community guides, check off what you have consumed, and our Up Next algorithm will tell you exactly what to follow.', es: 'Olvídate de perderte entre temporadas y volúmenes. Guarda las listas de la comunidad, marca lo que ya consumiste y nuestro algoritmo Up Next te dirá exactamente por dónde seguir.' },

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
