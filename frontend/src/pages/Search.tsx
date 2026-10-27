import { HorizontalScroll } from '../components/HorizontalScroll';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useEffectiveSearchParams } from '../hooks/useEffectiveSearchParams';
import { apiClient } from '../api/client';
import { ItemDetailsModal } from '../components/ItemDetailsModal';
import { MediaPoster } from '../components/MediaPoster';
import { AdBanner } from '../components/AdBanner';
import { ReplaceFavoriteModal } from '../components/ReplaceFavoriteModal';
import { ProModal } from '../components/ProModal';
import { PathdLoader } from '../components/PathdLoader';
import { getOrderedCategories, sortFilterTabs, getCategoryIcon } from '../utils/categoryOrder';
import { prefetchMediaDetails } from '../utils/prefetch';
import { removeCachedSeries, clearCachedSeriesMatching } from '../utils/seriesCache';
import { getCachedShelfItems, setCachedShelfItems, updateCachedShelfItem, createShelfMap, findInShelfMap } from '../utils/shelfCache';
import { SwipeViewPager } from '../components/SwipeViewPager';

import { Search as SearchIcon, AlertCircle, CheckCircle, Plus, X, Heart, Star, Users, BookOpen, Package, Puzzle, Sparkles, Gamepad2, Trash2, Flame, TrendingUp, Trophy, Bookmark, Film, Tv, Book, MessageSquare, MessageCircle, Rocket, Clock, Tag, RefreshCw, Zap } from 'lucide-react';

interface SearchResultItem {
  external_id: string;
  title: string;
  image_url: string;
  description: string;
  item_type: 'game' | 'movie' | 'series' | 'anime' | 'book' | 'user' | 'guide' | 'comic' | 'manga';
  release_date?: string;
  imdb_id?: string;
  status?: string;
  badge?: string;
  page_count?: number;
  cv_id?: string;
  metron_id?: string;
}

export const renderMediaBadge = (
  badge?: string | null, 
  language: string = 'es', 
  className: string = 'explore-cover-badge',
  inline: boolean = false
) => {
  if (!badge) return null;
  const isEs = language === 'es';
  const bLower = badge.toLowerCase().trim();

  let label = bLower.charAt(0).toUpperCase() + bLower.slice(1);
  let icon = null;
  let borderColor = 'rgba(255, 255, 255, 0.25)';

  if (bLower === 'pack') {
    label = 'Pack';
    icon = <Package size={11} color="#38bdf8" />;
    borderColor = 'rgba(56, 189, 248, 0.5)';
  } else if (bLower === 'collection' || bLower === 'colección' || bLower === 'coleccion') {
    label = isEs ? 'Colección' : 'Collection';
    icon = <Package size={11} color="#10b981" />;
    borderColor = 'rgba(16, 185, 129, 0.5)';
  } else if (bLower === 'dlc') {
    label = 'DLC';
    icon = <Puzzle size={11} color="#8b5cf6" />;
    borderColor = 'rgba(139, 92, 246, 0.5)';
  } else if (bLower === 'expansion' || bLower === 'expansión' || bLower === 'expansion') {
    label = isEs ? 'Expansión' : 'Expansion';
    icon = <Zap size={11} color="#3b82f6" />;
    borderColor = 'rgba(59, 130, 246, 0.5)';
  } else if (bLower === 'edition' || bLower === 'edición' || bLower === 'edicion') {
    label = isEs ? 'Edición' : 'Edition';
    icon = <Tag size={11} color="#f59e0b" />;
    borderColor = 'rgba(245, 158, 11, 0.5)';
  } else if (bLower === 'remake') {
    label = 'Remake';
    icon = <Gamepad2 size={11} color="#ec4899" />;
    borderColor = 'rgba(236, 72, 153, 0.5)';
  } else if (bLower === 'remaster') {
    label = 'Remaster';
    icon = <RefreshCw size={11} color="#06b6d4" />;
    borderColor = 'rgba(6, 182, 212, 0.5)';
  } else if (bLower === 'mod') {
    label = 'Mod';
    icon = <Puzzle size={11} color="#a855f7" />;
    borderColor = 'rgba(168, 85, 247, 0.5)';
  } else if (bLower === 'upcoming' || bLower === 'próximamente' || bLower === 'proximamente') {
    label = isEs ? 'Próximamente' : 'Upcoming';
    icon = <Clock size={11} color="#f97316" />;
    borderColor = 'rgba(249, 115, 22, 0.5)';
  } else if (bLower === 'issue' || bLower === 'número' || bLower === 'numero') {
    label = isEs ? 'Número' : 'Issue';
    icon = null;
    borderColor = 'rgba(255, 255, 255, 0.25)';
  } else if (bLower === 'series' || bLower === 'serie') {
    label = isEs ? 'Serie' : 'Series';
    icon = <Tv size={11} color="#3b82f6" />;
    borderColor = 'rgba(59, 130, 246, 0.5)';
  } else {
    const numMatch = bLower.match(/^(\d+)\s*(números?|numeros?|issues?)$/);
    if (numMatch) {
      const count = numMatch[1];
      label = isEs ? `${count} ${count === '1' ? 'Número' : 'Números'}` : `${count} ${count === '1' ? 'Issue' : 'Issues'}`;
      icon = null;
      borderColor = 'rgba(255, 255, 255, 0.25)';
    }
  }

  if (inline) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.68rem',
          fontWeight: 700,
          background: 'rgba(255, 255, 255, 0.08)',
          color: 'var(--text-primary)',
          border: `1px solid ${borderColor}`,
          padding: '0.1rem 0.4rem',
          borderRadius: '4px',
          lineHeight: 1.2,
          letterSpacing: '0.01em',
          width: 'fit-content'
        }}
      >
        {icon}
        <span>{label}</span>
      </span>
    );
  }

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        top: '0.5rem',
        left: '0.5rem',
        padding: '0.2rem 0.45rem',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: 700,
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#ffffff',
        border: `1px solid ${borderColor}`,
        backdropFilter: 'blur(6px)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        zIndex: 2,
        letterSpacing: '0.02em'
      }}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
};

export const formatComicBadgeText = (badge?: string | null, isEs: boolean = true) => {
  if (!badge) return '';
  const numMatch = badge.match(/^(\d+)\s*(números?|numeros?|issues?)$/i);
  if (numMatch) {
    const count = numMatch[1];
    return isEs ? `${count} ${count === '1' ? 'Número' : 'Números'}` : `${count} ${count === '1' ? 'Issue' : 'Issues'}`;
  }
  const bLower = badge.toLowerCase().trim();
  if (bLower === 'issue' || bLower === 'número' || bLower === 'numero') {
    return isEs ? 'Número' : 'Issue';
  }
  return badge;
};

const stripHtml = (html: string) => {
  if (!html) return '';
  const clean = html.replace(/<[^>]*>/g, '');
  const txt = document.createElement('textarea');
  txt.innerHTML = clean;
  return txt.value;
};

interface ExploreSectionProps {
  subTab?: string;
  loading: boolean;
  categories: Array<{ type: string; title: string; items: any[] }>;
  language: string;
  currentUser: any;
  onOpenItem: (item: any) => void;
  getTagClass: (type: string) => string;
  isFiltered?: boolean;
}

const ExploreSection = React.memo<ExploreSectionProps>(({
  subTab = 'explore',
  loading,
  categories,
  language,
  currentUser,
  onOpenItem,
  getTagClass,
  isFiltered = false
}) => {
  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>{language === 'es' ? 'Cargando...' : 'Loading...'}</div>;
  }

  if (categories.length === 0) {
    return <div style={{ color: "var(--text-secondary)", padding: "1rem 0" }}>{language === 'es' ? 'No hay elementos disponibles.' : 'No items available.'}</div>;
  }

  const renderCard = (item: any, idx: number) => {
    const epSubtitle = (item.item_type === 'series' || item.item_type === 'anime') && item.latest_episode != null
      ? `${language === 'es' ? 'T' : 'S'}${String(item.latest_season || 1).padStart(2, '0')} | E${String(item.latest_episode).padStart(2, '0')}`
      : null;
    const statusLabel = item.status && ['completed', 'watching', 'dropped', 'read', 'reading'].includes(item.status)
      ? ((item.status === 'completed' || item.status === 'read') 
          ? (item.item_type === 'series' || item.item_type === 'anime' ? (language === 'es' ? 'Terminado' : 'Completed') : ['book', 'comic', 'manga'].includes(item.item_type) ? (language === 'es' ? 'Leído' : 'Read') : (language === 'es' ? 'Visto' : 'Watched'))
          : (item.status === 'watching' || item.status === 'reading') 
          ? (item.item_type === 'movie' ? (language === 'es' ? 'En pausa' : 'Paused') : ['book', 'comic', 'manga'].includes(item.item_type) ? (language === 'es' ? 'Leyendo' : 'Reading') : (language === 'es' ? 'Viendo' : 'Watching')) 
          : (language === 'es' ? 'Abandonado' : 'Dropped'))
      : null;

    return (
      <div 
        key={idx} 
        className="activity-card activity-card-portrait" 
        style={{ 
          minWidth: '180px', 
          maxWidth: '180px', 
          background: 'var(--bg-secondary)', 
          border: `1px solid var(--border-color)`,
          borderRadius: '12px', 
          overflow: 'hidden', 
          cursor: 'pointer', 
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }} 
        onClick={() => onOpenItem(item)} 
        onMouseEnter={() => prefetchMediaDetails(item)}
      >
        {/* Title */}
        {(() => {
          const displayTitle = item.item_type === 'comic' 
            ? item.title.replace(/\s*#\d+\s*$/, '').replace(/\s*\(\d{4}\)$/, '') 
            : item.title;
          return (
            <div 
              className="card-item-title" 
              style={{ 
                padding: '0.5rem 0.75rem', 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                borderBottom: '1px solid var(--border-color)', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis' 
              }} 
              title={displayTitle}
            >
              {displayTitle}
            </div>
          );
        })()}

        {/* Poster Thumbnail */}
        <div className="card-media-cover" style={{ width: '100%', height: '240px', background: 'var(--bg-tertiary)', position: 'relative' }}>
          <MediaPoster
            src={item.image_url}
            title={item.title}
            itemType={item.item_type}
            isUpcomingMovie={item.item_type === 'movie'}
            height="100%"
            width="100%"
            borderRadius={0}
          />

          {/* Game/Media Badge (Colección, DLC, etc.) - exclude comic issue numbers */}
          {item.item_type !== 'comic' && renderMediaBadge(item.badge, language, 'explore-cover-badge home-desktop-only')}

          {/* Status Badge */}
          {statusLabel && (
            <div 
              className="explore-cover-badge home-desktop-only"
              style={{ 
                position: 'absolute', top: '0.5rem', right: '0.5rem', 
                padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600,
                background: (item.status === 'completed' || item.status === 'read') ? 'var(--color-movie)' : (item.status === 'watching' || item.status === 'reading') ? '#3b82f6' : '#ef4444',
                color: (item.status === 'completed' || item.status === 'read') ? 'var(--color-text-movie)' : '#ffffff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}
            >
              {statusLabel}
            </div>
          )}
        </div>

        {/* Body Content / Subtitle */}
        <div className="card-body-content" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minHeight: '2.5rem', justifyContent: 'center' }}>
          {item.item_type === 'comic' && item.badge && item.badge !== 'series' && subTab !== 'trending' ? (
            <>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatComicBadgeText(item.badge, language === 'es')}
              </div>
              {item.release_date && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {item.release_date}
                </div>
              )}
            </>
          ) : (
            <>
              {epSubtitle && (
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {epSubtitle}
                </div>
              )}
              {item.release_date ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {item.release_date}
                </div>
              ) : !epSubtitle ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {item.title}
                </div>
              ) : null}
            </>
          )}

          {/* Mobile badges: Move media & status badges from cover to card body */}
          {((item.item_type !== 'comic' && item.badge) || statusLabel) && (
            <div className="explore-card-badges-inline home-mobile-only" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
              {item.item_type !== 'comic' && renderMediaBadge(item.badge, language, 'explore-card-badge-inline', true)}
              {statusLabel && (
                <span
                  className="explore-card-status-badge-inline"
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background: (item.status === 'completed' || item.status === 'read') ? 'var(--color-movie)' : (item.status === 'watching' || item.status === 'reading') ? '#3b82f6' : '#ef4444',
                    color: (item.status === 'completed' || item.status === 'read') ? 'var(--color-text-movie)' : '#ffffff',
                    lineHeight: 1.2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    width: 'fit-content'
                  }}
                >
                  {statusLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {categories.map(({ type, title, items }) => (
        <React.Fragment key={`${subTab}_${type}`}>
          {isFiltered ? (
            <>
              {/* Single Unified Category Title & Badge (Without painted border, matches Home) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingLeft: '0.5rem', paddingRight: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {getCategoryIcon(type, { size: 20, color: `var(--color-${type})` })}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {title}
                </h3>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: `var(--color-${type})`,
                  border: `1px solid var(--color-${type})`
                }}>
                  {items.length}
                </span>
              </div>

              {/* Mobile vertical stack (edge to edge full width) */}
              <div className="mobile-vertical-stack home-mobile-only">
                {items.map((item: any, idx: number) => renderCard(item, idx))}
              </div>

              {/* Desktop multi-column grid (wrap into multiple rows without horizontal scrolling) */}
              <div className="home-desktop-only" style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '1rem' }}>
                <div className="desktop-category-grid">
                  {items.map((item: any, idx: number) => renderCard(item, idx))}
                </div>
              </div>
            </>
          ) : (
            <HorizontalScroll 
              key={`${subTab}_${type}`} 
              title={
                <>
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {getCategoryIcon(type, { size: 18 })}
                  </span>
                  <span>{title}</span>
                </>
              } 
              outlineColor={`var(--color-${type})`}
              itemCount={items.length}
            >
              {items.map((item: any, idx: number) => renderCard(item, idx))}
            </HorizontalScroll>
          )}
        </React.Fragment>
      ))}
    </div>
  );
});

interface ExploreGuidesSectionProps {
  loading: boolean;
  guidesData: any;
  language: string;
  t: (key: string) => string;
  navigate: (path: string) => void;
}

const ExploreGuidesSection = React.memo<ExploreGuidesSectionProps>(({
  loading,
  guidesData,
  language,
  t,
  navigate
}) => {
  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>{language === 'es' ? 'Cargando guías...' : 'Loading guides...'}</div>;
  }

  const rows = [
    { 
      key: 'populares', 
      title: t('guidesPopular'), 
      icon: <Flame size={18} color="#f97316" />, 
      outlineColor: '#f97316',
      items: guidesData?.populares || [] 
    },
    { 
      key: 'mejor_valoradas', 
      title: t('guidesTopRated'), 
      icon: <Trophy size={18} color="#eab308" />, 
      outlineColor: '#eab308',
      items: guidesData?.mejor_valoradas || [] 
    },
    { 
      key: 'mas_guardadas', 
      title: t('guidesMostSaved'), 
      icon: <Plus size={18} color="#ec4899" strokeWidth={2.5} />, 
      outlineColor: '#ec4899',
      items: guidesData?.mas_guardadas || [] 
    },
    { 
      key: 'nuevas', 
      title: t('guidesNew'), 
      icon: <Clock size={18} color="var(--accent-primary)" />, 
      outlineColor: 'var(--accent-primary)',
      items: guidesData?.nuevas || [] 
    },
  ].filter(r => r.items.length > 0);

  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem 1rem' }}>
        <BookOpen size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
        <p style={{ margin: 0 }}>{language === 'es' ? 'Aún no hay guías públicas disponibles.' : 'No public guides available yet.'}</p>
      </div>
    );
  }

  const renderMediaIcon = (mt: string) => {
    switch (mt) {
      case 'movie':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title={language === 'es' ? 'Películas' : 'Movies'}><Film size={13} color="var(--color-movie)" /></span>;
      case 'series':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title={language === 'es' ? 'Series' : 'TV Shows'}><Tv size={13} color="var(--color-series)" /></span>;
      case 'anime':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title="Anime"><Sparkles size={13} color="var(--color-anime)" /></span>;
      case 'manga':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title="Manga"><MessageCircle size={13} color="var(--color-manga)" /></span>;
      case 'game':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title={language === 'es' ? 'Juegos' : 'Games'}><Gamepad2 size={13} color="var(--color-game)" /></span>;
      case 'book':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title={language === 'es' ? 'Libros' : 'Books'}><Book size={13} color="var(--color-book)" /></span>;
      case 'comic':
        return <span key={mt} style={{ display: 'inline-flex', alignItems: 'center' }} title={language === 'es' ? 'Cómics' : 'Comics'}><MessageSquare size={13} color="var(--color-comic)" /></span>;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {rows.map(row => (
        <HorizontalScroll 
          key={row.key} 
          title={
            <>
              {row.icon}
              <span>{row.title}</span>
            </>
          } 
          outlineColor={row.outlineColor}
          itemCount={row.items.length}
        >
          {row.items.map((guide: any) => (
            <div
              key={guide.id}
              className="activity-card activity-card-portrait guide-explore-card"
              style={{
                minWidth: '240px',
                width: '240px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onClick={() => navigate(`/guide/${guide.id}`)}
            >
              {/* Desktop Title / Card Title */}
              <div 
                className="card-item-title"
                style={{ 
                  padding: '0.5rem 0.75rem', 
                  fontSize: '0.85rem', 
                  fontWeight: 600, 
                  borderBottom: '1px solid var(--border-color)', 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis' 
                }}
                title={guide.title}
              >
                {guide.title}
              </div>

              {/* Cover Collage */}
              <div className="card-media-cover" style={{
                position: 'relative',
                width: '100%',
                height: '140px',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(0,0,0,0.4))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {guide.covers && guide.covers.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: guide.covers.length >= 2 ? '1fr 1fr' : '1fr',
                    gridTemplateRows: guide.covers.length >= 3 ? '1fr 1fr' : '1fr',
                    width: '100%',
                    height: '100%',
                    gap: '2px',
                    background: '#000'
                  }}>
                    {guide.covers.slice(0, 4).map((img: string, cIdx: number) => (
                      <img
                        key={cIdx}
                        src={img}
                        alt=""
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <BookOpen size={28} color="var(--color-guide)" />
                  </div>
                )}

                {/* Items count overlay */}
                <div 
                  className="guide-items-badge"
                  style={{
                    position: 'absolute',
                    bottom: '6px',
                    right: '6px',
                    background: 'rgba(0,0,0,0.75)',
                    backdropFilter: 'blur(4px)',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#fff'
                  }}
                >
                  {guide.items_count} {t('guidesWorksCount')}
                </div>
              </div>

              {/* Body Content */}
              <div className="card-body-content" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minHeight: '2.5rem', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: '#fff',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {guide.creator_photo_url ? (
                      <img src={guide.creator_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      guide.creator_username?.charAt(0).toUpperCase() || 'P'
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {guide.creator_username}
                  </span>
                </div>

                {/* Badges / Metrics */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>{guide.items_count} {t('guidesWorksCount')}</span>
                  {guide.average_rating != null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#eab308', fontWeight: 600 }}>
                      <Star size={11} fill="#eab308" color="#eab308" />
                      {guide.average_rating}
                    </span>
                  )}
                  {guide.saves_count > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#ec4899', fontWeight: 600 }}>
                      <Plus size={11} strokeWidth={2.5} />
                      {guide.saves_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </HorizontalScroll>
      ))}
    </div>
  );
});

export const Search: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const getTagClass = (type: string) => {
    switch (type) {
      case 'movie': return 'tag-badge tag-movie';
      case 'series': return 'tag-badge tag-series';
      case 'anime': return 'tag-badge tag-anime';
      case 'book': return 'tag-badge tag-book';
      case 'comic': return 'tag-badge tag-comic';
      case 'manga': return 'tag-badge tag-manga';
      case 'game': return 'tag-badge tag-game';
      case 'guide': return 'tag-badge tag-guide';
      case 'user': return 'tag-badge tag-user';
      default: return 'tag-badge';
    }
  };

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(24);
  const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'series' | 'anime' | 'book' | 'comic' | 'game' | 'user' | 'guide' | 'manga'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Rate limit tracking per category from backend headers
  interface CategoryRateLimit {
    category: string;
    resetAt: number; // Unix timestamp in seconds
    reason: string;
  }
  const [categoryRateLimits, setCategoryRateLimits] = useState<Record<string, CategoryRateLimit>>({});

  const formatResetInfo = (resetAtSecs: number, lang: string) => {
    const isEs = lang === 'es';
    const now = Date.now();
    const resetMs = resetAtSecs * 1000;
    const diffSecs = Math.max(0, Math.round((resetMs - now) / 1000));
    const diffMins = Math.round(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;

    const resetDate = new Date(resetMs);
    const isToday = resetDate.toDateString() === new Date().toDateString();

    const timeStr = resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = resetDate.toLocaleDateString([], { day: 'numeric', month: 'short' });

    let fullTimeDisplay = '';
    if (isToday) {
      fullTimeDisplay = isEs ? `Hoy a las ${timeStr} hs` : `Today at ${timeStr}`;
    } else {
      fullTimeDisplay = isEs ? `El ${dateStr} a las ${timeStr} hs` : `${dateStr} at ${timeStr}`;
    }

    let relativeDisplay = '';
    if (diffHours > 0) {
      relativeDisplay = isEs 
        ? `en ~${diffHours} h${remMins > 0 ? ` ${remMins} min` : ''}` 
        : `in ~${diffHours}h${remMins > 0 ? ` ${remMins}m` : ''}`;
    } else if (diffMins > 0) {
      relativeDisplay = isEs ? `en ~${diffMins} min` : `in ~${diffMins} min`;
    } else {
      relativeDisplay = isEs ? 'en unos instantes' : 'in a few moments';
    }

    return {
      fullTimeDisplay,
      relativeDisplay
    };
  };

  // Reset visibleCount on tab change or new search query
  useEffect(() => {
    setVisibleCount(24);
  }, [activeTab, submittedQuery]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleFocusSearch = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    window.addEventListener('focus-search-input', handleFocusSearch);
    return () => {
      window.removeEventListener('focus-search-input', handleFocusSearch);
    };
  }, []);

  const { effectiveSearchParams, searchParams, setSearchParams } = useEffectiveSearchParams('/search');

  const validExploreTabs = ['new', 'trending', 'guides'] as const;
  type ExploreTab = typeof validExploreTabs[number];

  const exploreTabParamRaw = effectiveSearchParams?.get('tab');
  // Backwards compatibility for legacy Spanish params: 'nuevo' -> 'new', 'tendencias' -> 'trending', 'guias' -> 'guides'
  const normalizedTabParam = 
    exploreTabParamRaw === 'nuevo' ? 'new' :
    exploreTabParamRaw === 'tendencias' ? 'trending' :
    exploreTabParamRaw === 'guias' ? 'guides' :
    exploreTabParamRaw;

  const exploreSubTab: ExploreTab = (normalizedTabParam && validExploreTabs.includes(normalizedTabParam as any))
    ? (normalizedTabParam as ExploreTab)
    : 'new';

  const [activeExploreSubTab, setActiveExploreSubTab] = useState<ExploreTab>(exploreSubTab);

  useEffect(() => {
    if (!effectiveSearchParams) return;
    setActiveExploreSubTab(exploreSubTab);
  }, [exploreSubTab, effectiveSearchParams]);

  const handleExploreSubTabChange = (tab: ExploreTab) => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    setActiveExploreSubTab(tab);

    const step = tab === 'trending' ? 1 : tab === 'guides' ? 2 : 0;
    if (exploreSubtabsContainerRef.current) {
      exploreSubtabsContainerRef.current.style.setProperty('--tab-progress', String(step));
      const indColor = step === 1 ? '#f97316' : step === 2 ? 'var(--color-guide, #2DD4BF)' : 'var(--accent-primary)';
      exploreSubtabsContainerRef.current.style.setProperty('--explore-indicator-color', indColor);
    }
    subtabItemRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.setProperty('--tab-act', i === step ? '1' : '0');
    });

    const newParams = new URLSearchParams(effectiveSearchParams || searchParams);
    if (tab === 'new') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    setSearchParams(newParams);
  };

  const currentExploreStep = activeExploreSubTab === 'trending' ? 1 : activeExploreSubTab === 'guides' ? 2 : 0;

  const goToExploreStep = (step: number) => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    const targetTab = step === 1 ? 'trending' : step === 2 ? 'guides' : 'new';
    setActiveExploreSubTab(targetTab);

    if (exploreSubtabsContainerRef.current) {
      exploreSubtabsContainerRef.current.style.setProperty('--tab-progress', String(step));
      const indColor = step === 1 ? '#f97316' : step === 2 ? 'var(--color-guide, #2DD4BF)' : 'var(--accent-primary)';
      exploreSubtabsContainerRef.current.style.setProperty('--explore-indicator-color', indColor);
    }
    subtabItemRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.setProperty('--tab-act', i === step ? '1' : '0');
    });

    handleExploreSubTabChange(targetTab);
  };

  const exploreSubtabsContainerRef = useRef<HTMLDivElement>(null);
  const subtabItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleScrollProgress = React.useCallback((progress: number) => {
    const clamped = Math.min(2, Math.max(0, progress));
    if (exploreSubtabsContainerRef.current) {
      exploreSubtabsContainerRef.current.style.setProperty('--tab-progress', clamped.toFixed(4));

      let indColor = 'var(--accent-primary)';
      if (clamped <= 1) {
        indColor = `color-mix(in srgb, #f97316 ${Math.round(clamped * 100)}%, var(--accent-primary))`;
      } else {
        indColor = `color-mix(in srgb, var(--color-guide, #2DD4BF) ${Math.round((clamped - 1) * 100)}%, #f97316)`;
      }
      exploreSubtabsContainerRef.current.style.setProperty('--explore-indicator-color', indColor);
    }
    subtabItemRefs.current.forEach((el, i) => {
      if (!el) return;
      const dist = Math.abs(clamped - i);
      const act = Math.max(0, Math.min(1, 1 - dist));
      el.style.setProperty('--tab-act', act.toFixed(4));
    });
  }, []);

  useEffect(() => {
    handleScrollProgress(currentExploreStep);
  }, [currentExploreStep, handleScrollProgress]);

  const [exploreData, setExploreData] = useState<any>(null);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [guidesData, setGuidesData] = useState<any>(null);
  const [loadingGuides, setLoadingGuides] = useState(false);

  const buildCategorizedList = (items: any[]) => {
    if (!items || items.length === 0) return [];
    const grouped: Record<string, any[]> = {};
    items.forEach((item: any) => {
      if (!grouped[item.item_type]) grouped[item.item_type] = [];
      grouped[item.item_type].push(item);
    });

    const categoryOrder = getOrderedCategories(user?.category_order);
    return categoryOrder.map(type => ({
      type,
      title: type === 'movie' ? (language === 'es' ? 'Películas' : 'Movies') :
             type === 'series' ? (language === 'es' ? 'Series' : 'TV Shows') :
             type === 'anime' ? 'Anime' :
             type === 'book' ? (language === 'es' ? 'Libros' : 'Books') :
             type === 'comic' ? (language === 'es' ? 'Cómics' : 'Comics') : 
             type === 'manga' ? 'Mangas' : 
             type === 'game' ? (language === 'es' ? 'Juegos' : 'Games') : type,
      items: grouped[type] || []
    })).filter(g => g.items.length > 0);
  };

  const exploreNewCategories = React.useMemo(() => {
    const items = exploreData?.nuevo || [];
    const cats = buildCategorizedList(items);
    const now = new Date();
    const twoWeeksForward = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const maxFutureDateStr = twoWeeksForward.toISOString().slice(0, 10);

    cats.forEach(c => {
      // For movies in Novedades, strictly filter out films scheduled more than 2 weeks after current day
      if (c.type === 'movie') {
        c.items = c.items.filter(it => !it.release_date || it.release_date <= maxFutureDateStr);
      }

      c.items.sort((a, b) => {
        if (!a.release_date) return 1;
        if (!b.release_date) return -1;
        return new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
      });

      // At least 40 items floor, but if there are more items sharing the date of the 40th item, include all of them
      const floorCount = 40;
      if (c.items.length > floorCount) {
        const thresholdDate = c.items[floorCount - 1]?.release_date;
        if (thresholdDate) {
          let cutoff = floorCount;
          while (cutoff < c.items.length && c.items[cutoff]?.release_date === thresholdDate) {
            cutoff++;
          }
          c.items = c.items.slice(0, cutoff);
        } else {
          c.items = c.items.slice(0, floorCount);
        }
      }
    });
    return cats;
  }, [exploreData, language, user?.category_order]);

  const exploreTrendingCategories = React.useMemo(() => {
    const items = exploreData?.tendencias || [];
    const cats = buildCategorizedList(items);
    cats.forEach(c => {
      c.items = c.items.slice(0, 20);
    });
    return cats;
  }, [exploreData, language, user?.category_order]);

  const filteredExploreCategories = React.useMemo(() => {
    const targetCats = activeExploreSubTab === 'trending' ? exploreTrendingCategories : exploreNewCategories;
    if (activeTab === 'all') return targetCats;
    return targetCats.filter(cat => cat.type === activeTab);
  }, [activeExploreSubTab, exploreTrendingCategories, exploreNewCategories, activeTab]);

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'movie': return language === 'es' ? 'Películas' : 'Movies';
      case 'series': return language === 'es' ? 'Series' : 'TV Shows';
      case 'anime': return 'Anime';
      case 'book': return language === 'es' ? 'Libros' : 'Books';
      case 'comic': return language === 'es' ? 'Cómics' : 'Comics';
      case 'manga': return 'Mangas';
      case 'game': return language === 'es' ? 'Juegos' : 'Games';
      case 'user': return language === 'es' ? 'Usuarios' : 'Users';
      case 'guide': return language === 'es' ? 'Guías' : 'Guides';
      default: return language === 'es' ? 'Todo' : 'All';
    }
  };

  const getSingleCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'movie': return language === 'es' ? 'Película' : 'Movie';
      case 'series': return language === 'es' ? 'Serie' : 'TV Show';
      case 'anime': return 'Anime';
      case 'book': return language === 'es' ? 'Libro' : 'Book';
      case 'comic': return language === 'es' ? 'Cómic' : 'Comic';
      case 'manga': return 'Manga';
      case 'game': return language === 'es' ? 'Juego' : 'Game';
      case 'user': return language === 'es' ? 'Usuario' : 'User';
      case 'guide': return language === 'es' ? 'Guía' : 'Guide';
      default: return cat;
    }
  };

  // Shelf tracking states (Synchronous Frame-0 cache for 0ms instant '+' matching)
  const [shelfItems, setShelfItems] = useState<any[]>(getCachedShelfItems);
  const shelfMap = React.useMemo(() => createShelfMap(shelfItems), [shelfItems]);
  const [itemToRemoveFromShelf, setItemToRemoveFromShelf] = useState<any | null>(null);

  // Details Modal states
  const location = useLocation();
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const handleOpenItem = (item: any) => {
    if (!item) return;
    const targetType = item.item_type || 'movie';
    const targetId = item.external_id || item.id;
    if (targetType && targetId) {
      const currentBg = (location.state as any)?.backgroundLocation;
      navigate(`/item/${targetType}/${targetId}`, {
        state: { backgroundLocation: currentBg || location, item }
      });
    } else {
      setSelectedItem(item);
    }
  };

  // Replace Favorite Modal State & Pro Modal
  const [replaceModalState, setReplaceModalState] = useState<{
    isOpen: boolean;
    newItem: any | null;
    currentFavorites: any[];
  }>({
    isOpen: false,
    newItem: null,
    currentFavorites: []
  });
  const [showProModal, setShowProModal] = useState(false);

  // TV Tracking states inside details modal
          
  // User & Guide search tracking
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [savedGuides, setSavedGuides] = useState<any[]>([]);

  const loadShelfItems = async () => {
    try {
      const res = await apiClient.get('/library/shelf');
      if (Array.isArray(res.data)) {
        setShelfItems(res.data);
        setCachedShelfItems(res.data);
      }
    } catch (e) {
      console.error("Failed to load shelf items", e);
    }
  };

  const loadSocialMetadata = async () => {
    try {
      const profileRes = await apiClient.get('/users/me');
      setCurrentUser(profileRes.data);
      const followingRes = await apiClient.get(`/social/users/${profileRes.data.id}/following`);
      setFollowingUsers(followingRes.data);
      setSavedGuides(profileRes.data.saved_lists || []);
    } catch(e) {
      console.error("Failed to load user social data", e);
    }
  };

  const lastShelfFetchRef = useRef<number>(Date.now());

  useEffect(() => {
    loadShelfItems();
    loadSocialMetadata();
    lastShelfFetchRef.current = Date.now();

    const handleLibUpdated = (e?: any) => {
      const detailItem = (e as CustomEvent)?.detail?.item;
      if (detailItem && detailItem.id) {
        setShelfItems(prev => {
          const idx = prev.findIndex(x => (x.id === detailItem.id) || (x.external_id === detailItem.external_id && x.item_type === detailItem.item_type));
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...detailItem };
            setCachedShelfItems(copy);
            return copy;
          }
          const copy = [...prev, detailItem];
          setCachedShelfItems(copy);
          return copy;
        });
        return;
      }
      const cached = getCachedShelfItems();
      if (cached && cached.length > 0) {
        setShelfItems(cached);
      }
      loadShelfItems();
      lastShelfFetchRef.current = Date.now();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - lastShelfFetchRef.current > 25000) {
          loadShelfItems();
          lastShelfFetchRef.current = Date.now();
        }
      }
    };

    window.addEventListener('library-updated', handleLibUpdated);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('library-updated', handleLibUpdated);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, []);

  useEffect(() => {
    if (submittedQuery === '') {
      const fetchExplore = async () => {
        // 1. Instant cache check from sessionStorage
        const cachedRaw = sessionStorage.getItem('pathd_explore_cache');
        if (cachedRaw) {
          try {
            const cachedParsed = JSON.parse(cachedRaw);
            if (cachedParsed?.nuevo?.length > 0 || cachedParsed?.tendencias?.length > 0) {
              setExploreData(cachedParsed);
            }
          } catch (e) {}
        } else {
          setLoadingExplore(true);
        }

        // 2. Fetch fresh data from backend
        try {
          const res = await apiClient.get('/search/explore/tabs');
          setExploreData(res.data);
          sessionStorage.setItem('pathd_explore_cache', JSON.stringify(res.data));
        } catch (err) {
          console.error("Failed to load recommendations", err);
        } finally {
          setLoadingExplore(false);
        }
      };
      fetchExplore();
    }
  }, [submittedQuery]);

  useEffect(() => {
    if (submittedQuery === '' && activeExploreSubTab === 'guides' && !guidesData) {
      const fetchGuides = async () => {
        const cachedRaw = sessionStorage.getItem('pathd_guides_explore_cache');
        if (cachedRaw) {
          try {
            const parsed = JSON.parse(cachedRaw);
            if (parsed) setGuidesData(parsed);
          } catch (e) {}
        } else {
          setLoadingGuides(true);
        }
        try {
          const res = await apiClient.get('/lists/explore');
          setGuidesData(res.data);
          sessionStorage.setItem('pathd_guides_explore_cache', JSON.stringify(res.data));
        } catch (e) {
          console.error("Failed to load explore guides", e);
        } finally {
          setLoadingGuides(false);
        }
      };
      fetchGuides();
    }
  }, [submittedQuery, activeExploreSubTab, guidesData]);

  const searchRequestIdRef = React.useRef<number>(0);

  const executeSearch = async (targetQuery: string, currentTab: string) => {
    const cleanQuery = targetQuery.trim();
    if (!cleanQuery) {
      setSubmittedQuery('');
      setResults([]);
      setIsSearching(false);
      return;
    }

    const currentReqId = ++searchRequestIdRef.current;
    setSubmittedQuery(cleanQuery);
    setIsSearching(true);
    setErrorMsg('');

    // Ensure results view is scrolled to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      if (currentTab !== 'all' && ['manga', 'game', 'movie', 'anime', 'series', 'book', 'comic'].includes(currentTab)) {
        // 1. Fetch only the active category first (Super fast: ~150ms response)
        const primaryRes = await apiClient.get('/search/', {
          params: { q: cleanQuery, type: currentTab }
        });
        if (searchRequestIdRef.current !== currentReqId) return;

        // Check rate limit headers for primary request
        const limCat = primaryRes.headers?.['x-category-rate-limited'];
        const rst = Number(primaryRes.headers?.['x-category-rate-limit-reset'] || 0);
        const rsn = primaryRes.headers?.['x-category-rate-limit-reason'] || 'temporary_limit';
        if (limCat && rst > 0) {
          setCategoryRateLimits(prev => ({
            ...prev,
            [limCat]: { category: limCat, resetAt: rst, reason: rsn }
          }));
        } else {
          setCategoryRateLimits(prev => {
            if (!prev[currentTab]) return prev;
            const copy = { ...prev };
            delete copy[currentTab];
            return copy;
          });
        }

        const initialData = Array.isArray(primaryRes.data) ? primaryRes.data : [];
        setResults(prev => {
          // If we already had results for this exact query (e.g. from 'all' search), merge new items without discarding existing ones
          if (cleanQuery === submittedQuery && prev.length > 0) {
            const seenIds = new Set(initialData.map(item => item.external_id));
            const retainedPrev = prev.filter(item => !seenIds.has(item.external_id));
            return [...initialData, ...retainedPrev];
          }
          return initialData;
        });
        setIsSearching(false);
        if (initialData.length > 0) {
          initialData.slice(0, 8).forEach((r: any) => prefetchMediaDetails(r));
        }

        // 2. In background, fetch the rest of categories silently
        const otherTypes = ['movie', 'series', 'anime', 'book', 'comic', 'manga', 'game'].filter(t => t !== currentTab);
        Promise.allSettled(
          otherTypes.map(t => apiClient.get('/search/', { params: { q: cleanQuery, type: t } }))
        ).then(resultsArr => {
          if (searchRequestIdRef.current !== currentReqId) return;
          const bgLimits: Record<string, CategoryRateLimit> = {};
          resultsArr.forEach(resObj => {
            if (resObj.status === 'fulfilled') {
              const hdrs = (resObj.value as any)?.headers || {};
              const bgCat = hdrs['x-category-rate-limited'];
              const bgRst = Number(hdrs['x-category-rate-limit-reset'] || 0);
              const bgRsn = hdrs['x-category-rate-limit-reason'] || 'temporary_limit';
              if (bgCat && bgRst > 0) {
                bgLimits[bgCat] = { category: bgCat, resetAt: bgRst, reason: bgRsn };
              }
            }
          });
          if (Object.keys(bgLimits).length > 0) {
            setCategoryRateLimits(prev => ({ ...prev, ...bgLimits }));
          }

          setResults(prev => {
            const existingIds = new Set(prev.map(p => p.external_id));
            const newItems: SearchResultItem[] = [];
            resultsArr.forEach(resObj => {
              if (resObj.status === 'fulfilled' && Array.isArray(resObj.value.data)) {
                resObj.value.data.forEach((item: SearchResultItem) => {
                  if (!existingIds.has(item.external_id)) {
                    existingIds.add(item.external_id);
                    newItems.push(item);
                  }
                });
              }
            });
            return [...prev, ...newItems];
          });
        }).catch(() => {});

      } else {
        // 'all', 'user', or 'guide'
        const response = await apiClient.get('/search/all', {
          params: { q: cleanQuery }
        });
        if (searchRequestIdRef.current !== currentReqId) return;

        const catsHdr = response.headers?.['x-categories-rate-limited'];
        if (catsHdr) {
          const allLimits: Record<string, CategoryRateLimit> = {};
          catsHdr.split(',').forEach((entry: string) => {
            const [c, rsn, rst] = entry.split(':');
            if (c && rst) {
              allLimits[c] = { category: c, reason: rsn || 'temporary_limit', resetAt: Number(rst) };
            }
          });
          if (Object.keys(allLimits).length > 0) {
            setCategoryRateLimits(prev => ({ ...prev, ...allLimits }));
          }
        }

        const filteredAll = Array.isArray(response.data) ? response.data : [];
        setResults(filteredAll);
        setIsSearching(false);
        if (filteredAll.length > 0) {
          filteredAll.slice(0, 8).forEach((r: any) => prefetchMediaDetails(r));
        }
      }
    } catch (err: any) {
      if (searchRequestIdRef.current !== currentReqId) return;
      if (err.response?.status === 429) {
        setErrorMsg(t('errRateLimit'));
      } else {
        setErrorMsg(t('errSearchFailed'));
      }
      setIsSearching(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
    executeSearch(query, activeTab);
  };

  const handleTabClick = (tabValue: any) => {
    setActiveTab(tabValue);
    showFiltersRef.current = true;
    setShowFiltersOnScroll(true);
    const cleanQuery = query.trim();
    if (cleanQuery && submittedQuery) {
      executeSearch(cleanQuery, tabValue);
    }
  };

  const getStatusesForType = (type: string) => {
    const normType = type === 'anime' ? 'series' : type;
    if (normType === 'game') {
      return [
        { value: 'plan_to_play', label: language === 'es' ? 'Por Jugar' : 'Plan to Play' },
        { value: 'playing', label: language === 'es' ? 'Jugando' : 'Playing' },
        { value: 'completed', label: language === 'es' ? 'Terminado' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    if (normType === 'movie') {
      return [
        { value: 'plan_to_watch', label: language === 'es' ? 'Por Ver' : 'Plan to Watch' },
        { value: 'completed', label: language === 'es' ? 'Visto' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    if (normType === 'series') {
      return [
        { value: 'plan_to_watch', label: language === 'es' ? 'Por Ver' : 'Plan to Watch' },
        { value: 'watching', label: language === 'es' ? 'Viendo' : 'Watching' },
        { value: 'completed', label: language === 'es' ? 'Terminada' : 'Completed' },
        { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
      ];
    }
    return [
      { value: 'plan_to_read', label: language === 'es' ? 'Por Leer' : 'Plan to Read' },
      { value: 'reading', label: language === 'es' ? 'Leyendo' : 'Reading' },
      { value: 'read', label: language === 'es' ? 'Leído' : 'Read' },
      { value: 'dropped', label: language === 'es' ? 'Abandonado' : 'Dropped' }
    ];
  };

  const getDefaultStatus = (type: string) => {
    if (type === 'game') return 'plan_to_play';
    if (['book', 'comic', 'manga'].includes(type)) return 'plan_to_read';
    return 'plan_to_watch';
  };

  const handleQuickAddToShelf = async (item: SearchResultItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setErrorMsg('');
    const status = getDefaultStatus(item.item_type);

    // Optimistic UI update: immediately paint the button as added
    const tempId = -Date.now();
    const optimisticItem = {
      id: tempId,
      external_id: item.external_id,
      item_type: item.item_type,
      title: item.title,
      image_url: item.image_url,
      imdb_id: item.imdb_id,
      custom_badge: item.badge || null,
      release_date: item.release_date || null,
      status: status
    };

    setShelfItems(prev => {
      const filtered = prev.filter(x => !(x.external_id === item.external_id && x.item_type === item.item_type));
      const updated = [...filtered, optimisticItem];
      setCachedShelfItems(updated);
      return updated;
    });

    try {
      await apiClient.post('/library/', {
        item_type: item.item_type,
        external_id: item.external_id,
        title: item.title,
        image_url: item.image_url,
        imdb_id: item.imdb_id,
        custom_badge: item.badge || null,
        release_date: item.release_date || null,
        status: status
      });
      await loadShelfItems();
      window.dispatchEvent(new CustomEvent('library-updated', { detail: { item: optimisticItem } }));
    } catch (err: any) {
      // Revert optimistic state on failure
      setShelfItems(prev => {
        const updated = prev.filter(x => !(x.external_id === item.external_id && x.item_type === item.item_type));
        setCachedShelfItems(updated);
        return updated;
      });
      setErrorMsg(err.response?.data?.detail || 'Failed to add item to your library shelf.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleConfirmRemoveFromShelf = async (deleteHistory = false) => {
    if (!itemToRemoveFromShelf || !itemToRemoveFromShelf.id) return;
    try {
      const url = deleteHistory ? `/library/${itemToRemoveFromShelf.id}?delete_history=true` : `/library/${itemToRemoveFromShelf.id}`;
      await apiClient.delete(url);

      if (deleteHistory) {
        const cleanId = String(itemToRemoveFromShelf.external_id || itemToRemoveFromShelf.id || '').replace('cv_vol_', '').replace('cv_issue_', '').replace('cv_', '').replace('tvm-ep-', '').replace('tvm_', '');
        clearCachedSeriesMatching(`issue_state_`);
        if (cleanId) {
          removeCachedSeries(`comic_vol_${cleanId}`);
          removeCachedSeries(`series_${cleanId}`);
          removeCachedSeries(`${cleanId}_all_episodes`);
          removeCachedSeries(`${cleanId}_all_episodes_v2`);
          removeCachedSeries(`${cleanId}_metadata`);
        }
        if (itemToRemoveFromShelf.tracking_list_id) {
          removeCachedSeries(`list_${itemToRemoveFromShelf.tracking_list_id}`);
        }
      }

      setSuccessMsg(deleteHistory
        ? (language === 'es' ? 'Elemento y su historial eliminados por completo.' : 'Item and all history deleted completely.')
        : (language === 'es' ? 'Elemento eliminado de tu estantería (historial conservado).' : 'Item removed from your shelf (history preserved).')
      );
      setResults(prev => prev.map(r => 
        r.item_type === itemToRemoveFromShelf.item_type && r.external_id === itemToRemoveFromShelf.external_id 
        ? { ...r, id: undefined, status: undefined, tracking_list_id: undefined, completed_at: undefined, is_favorite: false } 
        : r
      ));
      setItemToRemoveFromShelf(null);
      await loadShelfItems();
      window.dispatchEvent(new CustomEvent('progress-updated', { detail: { deletedExternalId: itemToRemoveFromShelf.external_id, deleteHistory } }));
      window.dispatchEvent(new Event('library-updated'));
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to remove item.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleOpenItemDetails = (item: SearchResultItem) => {
    if ((item as any).id && (item as any).list_title && !item.external_id) {
      navigate(`/guide/${(item as any).id}`);
      return;
    }
    handleOpenItem(item);
  };

  const handleToggleFollowUser = async (userId: number) => {
    try {
      const res = await apiClient.post(`/social/users/${userId}/follow`);
      await loadSocialMetadata();
      setSuccessMsg(res.data.following
        ? (language === 'es' ? 'Comenzaste a seguir a este usuario.' : 'Started following this user.')
        : (language === 'es' ? 'Dejaste de seguir a este usuario.' : 'Unfollowed this user.')
      );
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch(err) {
      console.error("Failed to follow user", err);
    }
  };

  const handleToggleSaveGuide = async (guideId: number, isSaved: boolean) => {
    try {
      if (isSaved) {
        await apiClient.delete(`/lists/${guideId}/save`);
        setSuccessMsg(language === 'es' ? 'Guía quitada de tu biblioteca.' : 'Guide removed from library.');
      } else {
        await apiClient.post(`/lists/${guideId}/save`);
        setSuccessMsg(language === 'es' ? 'Guía guardada en tu biblioteca.' : 'Guide saved to library.');
      }
      await loadSocialMetadata();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch(err) {
      console.error("Failed to toggle guide save", err);
    }
  };

  const formatReleaseDate = (raw: string | undefined) => {
    if (!raw) return '';
    const clean = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [year, month, day] = clean.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (isNaN(date.getTime())) return clean;
      const months = language === 'es'
        ? ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
        : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return language === 'es'
        ? `${parseInt(day)} de ${months[date.getMonth()]} de ${year}`
        : `${months[date.getMonth()]} ${parseInt(day)}, ${year}`;
    }
    return clean;
  };

  const filteredResults = activeTab === 'all'
    ? results
    : results.filter(item => {
        if (activeTab === 'series') return item.item_type === 'series';
        if (activeTab === 'anime') return item.item_type === 'anime';
        if (activeTab === 'movie') return item.item_type === 'movie';
        if (activeTab === 'book') return item.item_type === 'book';
        if (activeTab === 'comic') return item.item_type === 'comic';
        if (activeTab === 'manga') return item.item_type === 'manga';
        if (activeTab === 'game') return item.item_type === 'game';
        if (activeTab === 'user') return item.item_type === 'user';
        if (activeTab === 'guide') return item.item_type === 'guide';
        return item.item_type === activeTab;
      });

  const handleToggleFavorite = async (itemId: number, currentFav: boolean) => {
    const targetItem = shelfItems.find(li => li.id === itemId) || (((selectedItem as any)?.id === itemId) ? (selectedItem as any) : null);
    if (!targetItem && !itemId) return;

    if (!currentFav && targetItem) {
      const isDlcOrExpansion = targetItem.item_type === 'game' && ['dlc', 'expansion'].includes(targetItem.badge || targetItem.custom_badge || '');
      const isUnconsumed = !isDlcOrExpansion && ['plan_to_watch', 'plan_to_read', 'plan_to_play'].includes(targetItem.status);
      if (isUnconsumed) {
        setErrorMsg(language === 'es' 
          ? 'Solo puedes destacar elementos que hayas empezado a consumir o completado.' 
          : 'You can only feature items that you have started or completed.');
        setTimeout(() => setErrorMsg(''), 5000);
        return;
      }

      const isPro = Boolean(currentUser?.is_pro || currentUser?.is_admin || currentUser?.is_vip);
      const sameCategoryFavs = shelfItems.filter(f => f.item_type === targetItem.item_type && f.is_favorite);
      const maxAllowed = isPro ? 10 : 1;

      if (sameCategoryFavs.length >= maxAllowed) {
        setReplaceModalState({
          isOpen: true,
          newItem: targetItem,
          currentFavorites: sameCategoryFavs
        });
        return;
      }
    }

    try {
      await apiClient.put(`/library/${itemId}`, { is_favorite: !currentFav, status: targetItem?.status });
      const updatedItem = { ...(targetItem || {}), id: itemId, is_favorite: !currentFav };
      setShelfItems(prev => {
        const updated = prev.map(item => item.id === itemId ? { ...item, is_favorite: !currentFav } : item);
        setCachedShelfItems(updated);
        return updated;
      });
      updateCachedShelfItem(updatedItem);
      window.dispatchEvent(new CustomEvent('favorites-updated', {
        detail: {
          itemId,
          externalId: targetItem?.external_id,
          itemType: targetItem?.item_type,
          isFavorite: !currentFav,
          item: updatedItem
        }
      }));
      window.dispatchEvent(new CustomEvent('library-updated', { detail: { item: updatedItem } }));

      setSuccessMsg(!currentFav 
        ? (language === 'es' ? 'Elemento añadido a destacados.' : 'Item added to favorites.')
        : (language === 'es' ? 'Elemento quitado de destacados.' : 'Item removed from favorites.')
      );
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error updating favorite status');
      setTimeout(() => setErrorMsg(''), 4000);
      throw err;
    }
  };

  const handleConfirmReplace = async (itemToReplaceId: number, newItemId: number) => {
    try {
      await apiClient.put(`/library/${itemToReplaceId}`, { is_favorite: false });
      await apiClient.put(`/library/${newItemId}`, { is_favorite: true });

      setShelfItems(prev => {
        const next = prev.map(item => {
          if (item.id === itemToReplaceId) return { ...item, is_favorite: false };
          if (item.id === newItemId) return { ...item, is_favorite: true };
          return item;
        });
        setCachedShelfItems(next);
        return next;
      });

      const unFavStub = shelfItems.find(x => x.id === itemToReplaceId);
      const favStub = shelfItems.find(x => x.id === newItemId);
      if (unFavStub) updateCachedShelfItem({ ...unFavStub, is_favorite: false });
      if (favStub) updateCachedShelfItem({ ...favStub, is_favorite: true });

      window.dispatchEvent(new CustomEvent('favorites-updated', {
        detail: {
          itemId: newItemId,
          externalId: favStub?.external_id,
          itemType: favStub?.item_type,
          isFavorite: true,
          item: favStub ? { ...favStub, is_favorite: true } : undefined
        }
      }));
      window.dispatchEvent(new CustomEvent('library-updated', { detail: { item: favStub ? { ...favStub, is_favorite: true } : undefined } }));

      setSuccessMsg(language === 'es' ? 'Obra destacada actualizada correctamente.' : 'Featured item updated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error updating featured item');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleClearSearch = (e?: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setQuery('');
    setSubmittedQuery('');
    setResults([]);
    setIsSearching(false);
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
  };

  const normType = selectedItem ? (selectedItem.item_type === 'anime' ? 'series' : selectedItem.item_type) : '';
  const currentShelfItem = selectedItem ? findInShelfMap(shelfMap, selectedItem.item_type, selectedItem.external_id) : null;
  const isFavorite = Boolean(currentShelfItem?.is_favorite);

  // Scroll direction state for explore category filters (matches Home behavior)
  const [showFiltersOnScroll, setShowFiltersOnScroll] = useState<boolean>(true);
  const showFiltersRef = useRef<boolean>(true);
  const lastScrollYRef = useRef<number>(0);
  const scrollAccumulatorRef = useRef<number>(0);
  const lastToggleTimeRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    lastScrollYRef.current = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    let ticking = false;

    const handleScroll = () => {
      if (window.innerWidth > 768) {
        if (!showFiltersRef.current) {
          showFiltersRef.current = true;
          setShowFiltersOnScroll(true);
        }
        return;
      }

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
          const delta = currentScrollY - lastScrollYRef.current;
          lastScrollYRef.current = currentScrollY;

          // When near the very top of the page (<= 30px), keep filters visible without any flickering
          if (currentScrollY <= 30) {
            if (!showFiltersRef.current) {
              showFiltersRef.current = true;
              setShowFiltersOnScroll(true);
              lastToggleTimeRef.current = Date.now();
            }
            scrollAccumulatorRef.current = 0;
            ticking = false;
            return;
          }

          // Ignore tiny noise (< 3px)
          if (Math.abs(delta) < 3) {
            ticking = false;
            return;
          }

          // Cool-down check: don't toggle back and forth while transition animation is active (300ms)
          const now = Date.now();
          if (now - lastToggleTimeRef.current < 300) {
            ticking = false;
            return;
          }

          // Reset accumulator when changing scroll direction
          if ((delta > 0 && scrollAccumulatorRef.current < 0) || (delta < 0 && scrollAccumulatorRef.current > 0)) {
            scrollAccumulatorRef.current = 0;
          }

          scrollAccumulatorRef.current += delta;

          // HIDE: Only hide if currently visible, scrolled past header (> 70px), and accumulated > 50px downward scroll
          if (showFiltersRef.current) {
            if (currentScrollY > 70 && scrollAccumulatorRef.current > 50) {
              showFiltersRef.current = false;
              setShowFiltersOnScroll(false);
              scrollAccumulatorRef.current = 0;
              lastToggleTimeRef.current = now;
            }
          }
          // SHOW: Only show if currently hidden and accumulated > 50px upward scroll
          else {
            if (scrollAccumulatorRef.current < -50) {
              showFiltersRef.current = true;
              setShowFiltersOnScroll(true);
              scrollAccumulatorRef.current = 0;
              lastToggleTimeRef.current = now;
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const modalItem = React.useMemo(() => {
    if (!selectedItem) return null;
    if (selectedItem.item_type === 'guide' || selectedItem.item_type === 'user') {
      return selectedItem;
    }
    if (currentShelfItem) {
      return { ...selectedItem, ...currentShelfItem };
    }
    // If not in shelfItems, strip any stale shelf/tracking properties from previous sessions
    const clean: any = { ...selectedItem };
    delete clean.id;
    delete clean.tracking_list_id;
    delete clean.status;
    delete clean.completed_at;
    delete clean.is_favorite;
    return clean;
  }, [selectedItem, currentShelfItem]);

  return (
    <div className="explore-page-container" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Unified Sticky Header for Explore: Search bar, category filters, and subtabs */}
      <div className="explore-sticky-header-wrapper">
        {/* Search Bar Header */}
        <div className="explore-sticky-search-bar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={searchInputRef}
                type="text"
                required
                className="input-field"
                placeholder={activeTab === 'all' 
                  ? t('searchPlaceholder')
                  : (language === 'es' ? `Buscar en ${getCategoryLabel(activeTab)}...` : `Search in ${getCategoryLabel(activeTab)}...`)}
                value={query}
                onChange={(e) => {
                  const val = e.target.value;
                  setQuery(val);
                  if (val.trim() === '') {
                    setSubmittedQuery('');
                    setResults([]);
                  }
                }}
                style={{ paddingLeft: '2.5rem', paddingRight: query ? '2.5rem' : '1rem' }}
              />
              <SearchIcon size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              {query && (
                <button
                  type="button"
                  onPointerDown={handleClearSearch}
                  onClick={handleClearSearch}
                  title={language === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
                  aria-label={language === 'es' ? 'Limpiar búsqueda' : 'Clear search'}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: 0,
                    bottom: 0,
                    margin: 'auto 0',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 0,
                    touchAction: 'manipulation'
                  }}
                >
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s, color 0.2s'
                    }}
                  >
                    <X size={14} />
                  </span>
                </button>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSearching} 
              className="btn-primary home-desktop-only" 
              style={{ padding: '0 2.5rem' }}
            >
              {t('searchButton')}
            </button>
          </form>
        </div>

        {/* Category Filters (Always visible on desktop, smooth collapsible on mobile) */}
        <section className={`search-panel-section explore-filters-section ${showFiltersOnScroll ? 'show' : 'hide'}`}>
          <div className="search-category-filters-inner">
            <div className="search-category-filters">
              {sortFilterTabs([
                { value: 'all', label: language === 'es' ? 'Todo' : 'All' },
                { value: 'movie', label: language === 'es' ? 'Películas' : 'Movies' },
                { value: 'series', label: language === 'es' ? 'Series' : 'TV Shows' },
                { value: 'anime', label: 'Anime' },
                { value: 'book', label: language === 'es' ? 'Libros' : 'Books' },
                { value: 'comic', label: language === 'es' ? 'Cómics' : 'Comics' },
                { value: 'manga', label: 'Mangas' },
                { value: 'game', label: language === 'es' ? 'Juegos' : 'Games' },
                { value: 'user', label: language === 'es' ? 'Usuarios' : 'Users' },
                { value: 'guide', label: language === 'es' ? 'Guías' : 'Guides' }
              ], user?.category_order).map(tab => {
                const isSelected = activeTab === tab.value;
                const tabColor = tab.value === 'all' 
                  ? 'var(--accent-primary)' 
                  : tab.value === 'user' 
                  ? 'var(--color-user, #ec4899)' 
                  : `var(--color-${tab.value})`;
                const tabTextColor = tab.value === 'all' 
                  ? '#ffffff' 
                  : `var(--color-text-${tab.value})`;

                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => handleTabClick(tab.value as any)}
                    className={`profile-category-tab search-filter-btn ${isSelected ? 'selected' : ''}`}
                    title={tab.label}
                    style={{
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      '--tab-color': tabColor,
                      '--tab-text': tabTextColor
                    } as React.CSSProperties}
                  >
                    <span className="search-filter-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {getCategoryIcon(tab.value, { size: 14, color: isSelected ? tabTextColor : tabColor })}
                    </span>
                    <span className="search-filter-label">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Explore Subtabs (Novedades, Tendencias, Guías) - Sticks permanently below search/filters */}
        {submittedQuery === '' && (
          <div 
            ref={exploreSubtabsContainerRef}
            className="explore-subtabs-container"
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "1.75rem", 
              borderBottom: "1px solid var(--border-color)",
              paddingBottom: "0.75rem",
              paddingTop: "0.25rem",
              position: "relative",
              '--tab-progress': String(currentExploreStep),
              '--explore-indicator-color': (
                currentExploreStep === 1 ? '#f97316' :
                currentExploreStep === 2 ? 'var(--color-guide, #2DD4BF)' :
                'var(--accent-primary)'
              )
            } as React.CSSProperties}
          >
              <button 
                type="button"
                ref={el => { subtabItemRefs.current[0] = el; }}
                className={`explore-subtab-item explore-tab-new ${activeExploreSubTab === 'new' ? 'active' : ''}`}
                onClick={() => goToExploreStep(0)}
                title={t('exploreNew')}
                style={{
                  fontSize: "1.05rem", fontWeight: activeExploreSubTab === 'new' ? 600 : 500,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.25rem 0",
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  '--tab-color': 'var(--accent-primary)',
                  '--tab-act': activeExploreSubTab === 'new' ? '1' : '0'
                } as React.CSSProperties}
              >
                <span className="explore-subtab-icon">
                  <Rocket size={17} />
                </span>
                <span className="explore-subtab-label">{t('exploreNew')}</span>
                {activeExploreSubTab === 'new' && (
                  <div className="explore-subtab-indicator home-desktop-only" style={{ position: "absolute", bottom: "-0.75rem", left: 0, right: 0, height: "2px", background: "var(--accent-primary)" }} />
                )}
              </button>

              <button 
                type="button"
                ref={el => { subtabItemRefs.current[1] = el; }}
                className={`explore-subtab-item explore-tab-trending ${activeExploreSubTab === 'trending' ? 'active' : ''}`}
                onClick={() => goToExploreStep(1)}
                title={t('exploreTrending')}
                style={{
                  fontSize: "1.05rem", fontWeight: activeExploreSubTab === 'trending' ? 600 : 500,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.25rem 0",
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  '--tab-color': '#f97316',
                  '--tab-act': activeExploreSubTab === 'trending' ? '1' : '0'
                } as React.CSSProperties}
              >
                <span className="explore-subtab-icon">
                  <Flame size={17} />
                </span>
                <span className="explore-subtab-label">{t('exploreTrending')}</span>
                {activeExploreSubTab === 'trending' && (
                  <div className="explore-subtab-indicator home-desktop-only" style={{ position: "absolute", bottom: "-0.75rem", left: 0, right: 0, height: "2px", background: "#f97316" }} />
                )}
              </button>

              <button 
                type="button"
                ref={el => { subtabItemRefs.current[2] = el; }}
                className={`explore-subtab-item explore-tab-guides ${activeExploreSubTab === 'guides' ? 'active' : ''}`}
                onClick={() => goToExploreStep(2)}
                title={t('exploreGuides')}
                style={{
                  fontSize: "1.05rem", fontWeight: activeExploreSubTab === 'guides' ? 600 : 500,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.25rem 0",
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  '--tab-color': 'var(--color-guide, #2DD4BF)',
                  '--tab-act': activeExploreSubTab === 'guides' ? '1' : '0'
                } as React.CSSProperties}
              >
                <span className="explore-subtab-icon">
                  <BookOpen size={17} />
                </span>
                <span className="explore-subtab-label">{t('exploreGuides')}</span>
                {activeExploreSubTab === 'guides' && (
                  <div className="explore-subtab-indicator home-desktop-only" style={{ position: "absolute", bottom: "-0.75rem", left: 0, right: 0, height: "2px", background: "var(--color-guide)" }} />
                )}
              </button>

              {/* Sliding Continuous Indicator for Explore Mobile Subtabs */}
              <div className="explore-subtabs-sliding-indicator home-mobile-only" />
            </div>
          )}
      </div>

      {submittedQuery === '' ? (
        <SwipeViewPager
          currentIndex={currentExploreStep}
          totalSlides={3}
          onSlideChange={goToExploreStep}
          onScrollProgress={handleScrollProgress}
          ignoreSelector={activeTab === 'all' ? '.horizontal-scroll-container, .horizontal-scroll-content, .scroll-fade-zone, .scroll-nav-arrow, .home-scroll-carousel' : undefined}
        >
          {/* Slide 0: Novedades */}
          <div style={{ width: "100%", flex: 1, marginTop: '1rem' }}>
            <ExploreSection
              subTab="new"
              loading={loadingExplore}
              categories={exploreNewCategories.filter(cat => activeTab === 'all' || cat.type === activeTab)}
              language={language}
              currentUser={currentUser}
              onOpenItem={handleOpenItemDetails}
              getTagClass={getTagClass}
              isFiltered={activeTab !== 'all'}
            />
          </div>

          {/* Slide 1: Tendencias */}
          <div style={{ width: "100%", flex: 1, marginTop: '1rem' }}>
            <ExploreSection
              subTab="trending"
              loading={loadingExplore}
              categories={exploreTrendingCategories.filter(cat => activeTab === 'all' || cat.type === activeTab)}
              language={language}
              currentUser={currentUser}
              onOpenItem={handleOpenItemDetails}
              getTagClass={getTagClass}
              isFiltered={activeTab !== 'all'}
            />
          </div>

          {/* Slide 2: Guías */}
          <div style={{ width: "100%", flex: 1, marginTop: '1rem' }}>
            <ExploreGuidesSection
              loading={loadingGuides}
              guidesData={guidesData}
              language={language}
              t={t}
              navigate={navigate}
            />
          </div>
        </SwipeViewPager>
      ) : (
        <>

      {errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem', textAlign: 'left' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem', textAlign: 'left' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Loading Animation with Colored Pulsing Dots */}
      {isSearching && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem 1rem' }}>
          <PathdLoader size="medium" message={language === 'es' ? 'Buscando...' : 'Searching...'} />
        </div>
      )}

      {/* Search Results Display */}
      {!isSearching && filteredResults.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {activeTab !== 'all' && categoryRateLimits[activeTab] && (categoryRateLimits[activeTab].resetAt * 1000 > Date.now()) && (
            <div style={{
              padding: '0.85rem 1.25rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 20, 28, 0.6) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: '0 4px 16px rgba(245, 158, 11, 0.05)'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0, color: '#f59e0b' }} />
              <span>
                {language === 'es'
                  ? `Mostrando resultados en caché. El límite de búsquedas en vivo para ${getCategoryLabel(activeTab)} se restablecerá a las ${formatResetInfo(categoryRateLimits[activeTab].resetAt, language).fullTimeDisplay}.`
                  : `Showing cached results. Live search limit for ${getCategoryLabel(activeTab)} will reset at ${formatResetInfo(categoryRateLimits[activeTab].resetAt, language).fullTimeDisplay}.`}
              </span>
            </div>
          )}
          <div className="search-results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {filteredResults.slice(0, visibleCount).map((item) => {
              return (
                <React.Fragment key={`${item.external_id}-${item.item_type}`}>
                  {(() => {
              if (item.item_type === 'user') {
                const isFollowing = followingUsers.some(u => String(u.id) === item.external_id);
                const isMe = currentUser && String(currentUser.id) === item.external_id;
                return (
                  <div key={`${item.external_id}-${item.item_type}`} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate(`/user/${encodeURIComponent(item.title || item.external_id)}`)}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '2px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <Users size={40} color="var(--accent-primary)" />
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 600 }}>{item.title}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {language === 'es' ? 'Usuario' : 'User'}
                      </span>
                    </div>
                    {!isMe && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFollowUser(parseInt(item.external_id));
                        }}
                        className={isFollowing ? "btn-secondary" : "btn-primary"}
                        style={{ width: '100%', fontSize: '0.85rem', padding: '0.4rem' }}
                      >
                        {isFollowing 
                          ? (language === 'es' ? 'Siguiendo (Dejar)' : 'Following (Unfollow)') 
                          : (language === 'es' ? 'Seguir' : 'Follow')
                        }
                      </button>
                    )}
                  </div>
                );
              }

              if (item.item_type === 'guide') {
                const isSaved = savedGuides.some(g => String(g.id) === item.external_id);
                return (
                  <div key={`${item.external_id}-${item.item_type}`} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <BookOpen size={18} color="var(--accent-primary)" />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {language === 'es' ? 'Guía Pública' : 'Public Guide'}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {item.title}
                      </h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {item.description}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        onClick={() => navigate(`/guide/${item.external_id}`)}
                        className="btn-primary"
                        style={{ flex: 1, fontSize: '0.82rem', padding: '0.4rem' }}
                      >
                        {language === 'es' ? 'Ver' : 'View'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSaveGuide(parseInt(item.external_id), isSaved);
                        }}
                        className="btn-secondary"
                        style={{ flex: 1, fontSize: '0.82rem', padding: '0.4rem', color: isSaved ? 'var(--accent-primary)' : 'var(--text-primary)', borderColor: isSaved ? 'var(--accent-primary)' : 'var(--border-color)', background: isSaved ? 'rgba(124, 58, 237, 0.1)' : 'transparent' }}
                      >
                        {isSaved 
                          ? (language === 'es' ? 'Siguiendo' : 'Following') 
                          : (language === 'es' ? 'Seguir' : 'Follow')
                        }
                      </button>
                    </div>
                  </div>
                );
              }

              const shelfItem = findInShelfMap(shelfMap, item.item_type, item.external_id) || (item.cv_id ? findInShelfMap(shelfMap, item.item_type, item.cv_id) : undefined);
              const onShelf = Boolean(shelfItem);
              const itemTypeColor = `var(--color-${item.item_type || 'movie'})`;
              const itemTypeTextColor = `var(--color-text-${item.item_type || 'movie'})`;

              const isComicIssue = item.item_type === 'comic' && (String(item.external_id || '').startsWith('cv_issue_') || String(item.external_id || '').startsWith('metron_issue_') || item.badge === 'issue' || item.badge === 'número' || item.badge === 'numero');
              const isComicVolume = item.item_type === 'comic' && !isComicIssue;
              const displayTitle = isComicVolume ? item.title.replace(/\s*\(\d{4}\)$/, '') : item.title;
              const effectiveBadge = (isComicVolume && (item.badge === 'Volumen' || item.badge === 'volume') && item.page_count)
                ? `${item.page_count} ${language === 'es' ? (item.page_count === 1 ? 'Número' : 'Números') : (item.page_count === 1 ? 'Issue' : 'Issues')}`
                : item.badge;

              return (
                <div key={`${item.external_id}-${item.item_type}`} className="glass-card search-item-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer', position: 'relative' }} onClick={() => handleOpenItemDetails(item)} onMouseEnter={() => prefetchMediaDetails(item)}>

                  <div className="card-media-cover search-media-cover" style={{ position: 'relative', width: '100%', height: '260px', borderRadius: '8px', overflow: 'hidden' }}>
                    <MediaPoster
                      src={item.image_url}
                      title={displayTitle}
                      itemType={item.item_type}
                      height="100%"
                      width="100%"
                      borderRadius="8px"
                    />
                    {effectiveBadge !== 'series' && renderMediaBadge(effectiveBadge, language)}
                  </div>

                  {(() => {
                    return (
                      <>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', textAlign: 'left', paddingRight: (user && !isComicIssue) ? '36px' : 0 }}>
                          <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayTitle}>
                            {displayTitle}
                          </h4>
                          {item.release_date && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                              {formatReleaseDate(item.release_date)}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            {activeTab === 'all' && (
                              <span
                                className={`${getTagClass(item.item_type)} search-category-tag`}
                                style={{ 
                                  alignSelf: 'flex-start', 
                                  padding: '0.15rem 0.5rem', 
                                  borderRadius: '5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  textTransform: 'none',
                                  letterSpacing: 'normal'
                                }}
                              >
                                {getCategoryIcon(item.item_type, { size: 13, color: 'currentColor' })}
                                <span>{getSingleCategoryLabel(item.item_type)}</span>
                              </span>
                            )}
                            {item.badge && item.badge !== 'series' && renderMediaBadge(item.badge, language, 'search-media-badge-inline', true)}
                          </div>
                        </div>

                        {user && !isComicIssue && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (shelfItem) {
                                const hasProgress = shelfItem.status !== 'plan_to_watch' && 
                                                    shelfItem.status !== 'plan_to_play' && 
                                                    shelfItem.status !== 'plan_to_read' && 
                                                    shelfItem.status !== 'untracked' && 
                                                    Boolean(shelfItem.status || shelfItem.completed_at || shelfItem.last_seen_episode || shelfItem.rating || shelfItem.consumption_count > 0 || shelfItem.total_time_spent > 0);
                                if (!hasProgress) {
                                  const previousShelf = shelfItems;
                                  setShelfItems(prev => {
                                    const updated = prev.filter(x => !(x.external_id === item.external_id && x.item_type === item.item_type));
                                    setCachedShelfItems(updated);
                                    return updated;
                                  });
                                  try {
                                    if (shelfItem.id && shelfItem.id > 0) {
                                      await apiClient.delete(`/library/${shelfItem.id}?delete_history=true`);
                                      const cleanId = String(shelfItem.external_id || shelfItem.id || '').replace('cv_vol_', '').replace('cv_issue_', '').replace('cv_', '').replace('tvm-ep-', '').replace('tvm_', '');
                                      clearCachedSeriesMatching(`issue_state_`);
                                      if (cleanId) {
                                        removeCachedSeries(`comic_vol_${cleanId}`);
                                        removeCachedSeries(`series_${cleanId}`);
                                        removeCachedSeries(`${cleanId}_all_episodes`);
                                        removeCachedSeries(`${cleanId}_all_episodes_v2`);
                                        removeCachedSeries(`${cleanId}_metadata`);
                                      }
                                      if (shelfItem.tracking_list_id) {
                                        removeCachedSeries(`list_${shelfItem.tracking_list_id}`);
                                      }
                                      window.dispatchEvent(new CustomEvent('progress-updated', { detail: { deletedExternalId: shelfItem.external_id, deleteHistory: true } }));
                                      window.dispatchEvent(new Event('library-updated'));
                                    }
                                    setSuccessMsg(language === 'es' ? 'Elemento eliminado de tu estantería.' : 'Item removed from your shelf.');
                                    await loadShelfItems();
                                    setTimeout(() => setSuccessMsg(''), 3000);
                                  } catch (err: any) {
                                    setShelfItems(previousShelf);
                                    setCachedShelfItems(previousShelf);
                                    setErrorMsg(err.response?.data?.detail || 'Failed to remove item.');
                                    setTimeout(() => setErrorMsg(''), 4000);
                                  }
                                } else {
                                  setItemToRemoveFromShelf(shelfItem);
                                }
                              } else {
                                handleQuickAddToShelf(item, e);
                              }
                            }}
                            className={`btn-card-add-shelf ${onShelf ? 'on-shelf' : ''}`}
                            title={onShelf 
                              ? (language === 'es' ? 'Quitar de estantería' : 'Remove from shelf')
                              : (language === 'es' ? 'Agregar a estantería' : 'Add to shelf')
                            }
                            style={{
                              position: 'absolute',
                              bottom: '0.75rem',
                              right: '0.75rem',
                              width: '32px',
                              height: '32px',
                              '--category-color': itemTypeColor,
                              '--category-text-color': itemTypeTextColor,
                            } as React.CSSProperties}
                          >
                            <Plus size={18} />
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              );
              })()}
              </React.Fragment>
              );
            })}
          </div>

          {/* Load More Centered Button */}
          {visibleCount < filteredResults.length && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setVisibleCount(prev => prev + 24)}
                className="btn-secondary"
                style={{
                  padding: '0.65rem 2rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  borderRadius: '24px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
              >
                {t('loadMoreResults')}
              </button>
            </div>
          )}
        </div>
      )}

      {!isSearching && results.length > 0 && filteredResults.length === 0 && (
        (() => {
          const isCategoryLimited = activeTab !== 'all' && categoryRateLimits[activeTab] && (categoryRateLimits[activeTab].resetAt * 1000 > Date.now());
          if (isCategoryLimited) {
            const limitInfo = categoryRateLimits[activeTab];
            const timeInfo = formatResetInfo(limitInfo.resetAt, language);
            return (
              <div 
                className="glass-card" 
                style={{ 
                  padding: '3rem 2rem', 
                  textAlign: 'center', 
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 20, 28, 0.75) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  boxShadow: '0 12px 32px rgba(245, 158, 11, 0.1)',
                  borderRadius: '16px',
                  maxWidth: '660px',
                  margin: '2rem auto'
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '1.25rem' }}>
                  <Clock size={28} color="#f59e0b" />
                </div>

                <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  {language === 'es' 
                    ? `Límite de búsquedas alcanzado en ${getCategoryLabel(activeTab)}`
                    : `Search limit reached in ${getCategoryLabel(activeTab)}`}
                </h3>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '520px', margin: '0 auto 1.5rem' }}>
                  {limitInfo.reason === 'daily_limit'
                    ? (language === 'es'
                        ? `Se ha alcanzado la cuota diaria de consultas de este catálogo para proteger la disponibilidad del servicio. Las nuevas búsquedas en esta categoría se restablecerán a las:`
                        : `The daily query quota for this catalog has been reached to protect service availability. New searches in this category will reset at:`)
                    : (language === 'es'
                        ? `Se ha pausado temporalmente la búsqueda en esta categoría para evitar sobrecargas del proveedor. Las búsquedas se restablecerán a las:`
                        : `Searches in this category are temporarily paused to prevent provider overload. Searches will reset at:`)}
                </p>

                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.6rem', 
                  padding: '0.65rem 1.4rem', 
                  borderRadius: '30px', 
                  background: 'rgba(245, 158, 11, 0.12)', 
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  color: '#fbbf24',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  marginBottom: '1.25rem'
                }}>
                  <Clock size={16} />
                  <span>{timeInfo.fullTimeDisplay} ({timeInfo.relativeDisplay})</span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.5rem' }}>
                  {language === 'es'
                    ? '💡 Los elementos que ya tengas en tu estantería o en caché siguen disponibles con normalidad.'
                    : '💡 Items already saved in your shelf or cached continue to function normally.'}
                </div>
              </div>
            );
          }
          return (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {language === 'es' ? 'No se encontraron elementos en esta categoría.' : 'No items found in this category.'}
            </div>
          );
        })()
      )}

      {results.length === 0 && !isSearching && submittedQuery && (
        (() => {
          const isCategoryLimited = activeTab !== 'all' && categoryRateLimits[activeTab] && (categoryRateLimits[activeTab].resetAt * 1000 > Date.now());
          if (isCategoryLimited) {
            const limitInfo = categoryRateLimits[activeTab];
            const timeInfo = formatResetInfo(limitInfo.resetAt, language);
            return (
              <div 
                className="glass-card" 
                style={{ 
                  padding: '3rem 2rem', 
                  textAlign: 'center', 
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(20, 20, 28, 0.75) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  boxShadow: '0 12px 32px rgba(245, 158, 11, 0.1)',
                  borderRadius: '16px',
                  maxWidth: '660px',
                  margin: '2rem auto'
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '1.25rem' }}>
                  <Clock size={28} color="#f59e0b" />
                </div>

                <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  {language === 'es' 
                    ? `Límite de búsquedas alcanzado en ${getCategoryLabel(activeTab)}`
                    : `Search limit reached in ${getCategoryLabel(activeTab)}`}
                </h3>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '520px', margin: '0 auto 1.5rem' }}>
                  {limitInfo.reason === 'daily_limit'
                    ? (language === 'es'
                        ? `Se ha alcanzado la cuota diaria de consultas de este catálogo para proteger la disponibilidad del servicio. Las nuevas búsquedas en esta categoría se restablecerán a las:`
                        : `The daily query quota for this catalog has been reached to protect service availability. New searches in this category will reset at:`)
                    : (language === 'es'
                        ? `Se ha pausado temporalmente la búsqueda en esta categoría para evitar sobrecargas del proveedor. Las búsquedas se restablecerán a las:`
                        : `Searches in this category are temporarily paused to prevent provider overload. Searches will reset at:`)}
                </p>

                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.6rem', 
                  padding: '0.65rem 1.4rem', 
                  borderRadius: '30px', 
                  background: 'rgba(245, 158, 11, 0.12)', 
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  color: '#fbbf24',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  marginBottom: '1.25rem'
                }}>
                  <Clock size={16} />
                  <span>{timeInfo.fullTimeDisplay} ({timeInfo.relativeDisplay})</span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.5rem' }}>
                  {language === 'es'
                    ? '💡 Los elementos que ya tengas en tu estantería o en caché siguen disponibles con normalidad.'
                    : '💡 Items already saved in your shelf or cached continue to function normally.'}
                </div>
              </div>
            );
          }

          const limitedCatsInAll = activeTab === 'all'
            ? Object.keys(categoryRateLimits).filter(cat => categoryRateLimits[cat].resetAt * 1000 > Date.now())
            : [];

          return (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p style={{ margin: 0 }}>{t('searchNoResults')}</p>
              {limitedCatsInAll.length > 0 && (
                <div style={{
                  marginTop: '1.5rem',
                  padding: '1rem 1.5rem',
                  borderRadius: '12px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  color: '#fbbf24',
                  fontSize: '0.9rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  maxWidth: '640px',
                  textAlign: 'left'
                }}>
                  <AlertCircle size={20} style={{ flexShrink: 0, color: '#f59e0b' }} />
                  <div>
                    {language === 'es'
                      ? `Nota: Las búsquedas en ${limitedCatsInAll.map(c => getCategoryLabel(c)).join(', ')} han alcanzado su límite de consultas y se restablecerán próximamente.`
                      : `Notice: Searches in ${limitedCatsInAll.map(c => getCategoryLabel(c)).join(', ')} have reached their query limit and will reset soon.`}
                  </div>
                </div>
              )}
            </div>
          );
        })()
      )}
      </>
      )}

      {/* Remove From Shelf Confirmation Modal */}
      {itemToRemoveFromShelf && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2200,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setItemToRemoveFromShelf(null)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '380px',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {language === 'es' ? '¿Quitar de la estantería?' : 'Remove from shelf?'}
              </h3>
              <button
                type="button"
                onClick={() => setItemToRemoveFromShelf(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {language === 'es'
                ? 'Elige cómo deseas remover esta obra de tu biblioteca:'
                : 'Choose how you would like to remove this item from your library:'
              }
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => handleConfirmRemoveFromShelf(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Trash2 size={16} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span>{language === 'es' ? 'Quitar conservando historial' : 'Remove keeping history'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                    {language === 'es'
                      ? 'Se quita de tu biblioteca pero se mantienen tus visualizaciones y estadísticas'
                      : 'Removes from shelf but preserves your completions and statistics'
                    }
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmRemoveFromShelf(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Trash2 size={16} style={{ flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span>{language === 'es' ? 'Quitar eliminando todo' : 'Remove deleting everything'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                    {language === 'es'
                      ? 'Borra todo el progreso, historial de visualizaciones y calificaciones'
                      : 'Wipes all progress, completion history, and reviews'
                    }
                  </span>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setItemToRemoveFromShelf(null)}
              style={{
                padding: '0.55rem',
                borderRadius: '6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Non-intrusive Explore / Search Bottom AdBanner */}
      <AdBanner />

      {selectedItem && (
        <ItemDetailsModal 
          item={modalItem || selectedItem}
          isOwnProfile={true}
          profileId={currentUser?.id}
          onClose={() => setSelectedItem(null)}
          onOpenItem={(item) => handleOpenItem(item)}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          onUpdate={(updatedItem) => {
            if (updatedItem && updatedItem.id) {
              setResults(prev => prev.map(r => 
                r.item_type === selectedItem?.item_type && r.external_id === selectedItem?.external_id 
                ? { ...r, ...updatedItem } 
                : r
              ));
              setShelfItems(prev => {
                const idx = prev.findIndex(x => (x.id === updatedItem.id) || (x.external_id === updatedItem.external_id && x.item_type === updatedItem.item_type));
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = { ...copy[idx], ...updatedItem };
                  setCachedShelfItems(copy);
                  return copy;
                }
                const copy = [...prev, updatedItem];
                setCachedShelfItems(copy);
                return copy;
              });
            } else if (updatedItem && !updatedItem.id) {
              setResults(prev => prev.map(r => 
                r.item_type === selectedItem?.item_type && r.external_id === selectedItem?.external_id 
                ? { ...r, id: undefined, status: undefined, tracking_list_id: undefined, completed_at: undefined, is_favorite: false } 
                : r
              ));
              setShelfItems(prev => {
                const filtered = prev.filter(x => !(x.external_id === updatedItem.external_id && x.item_type === updatedItem.item_type));
                setCachedShelfItems(filtered);
                return filtered;
              });
            } else {
              loadShelfItems();
            }
          }}
        />
      )}

      {/* Pro / Premium Modal */}
      {showProModal && (
        <ProModal onClose={() => setShowProModal(false)} />
      )}

      {/* Replace Favorite Modal (Confirmation & 10/10 Selector) */}
      <ReplaceFavoriteModal
        isOpen={replaceModalState.isOpen}
        onClose={() => setReplaceModalState({ isOpen: false, newItem: null, currentFavorites: [] })}
        newItem={replaceModalState.newItem}
        currentFavorites={replaceModalState.currentFavorites}
        isPro={Boolean(currentUser?.is_pro || currentUser?.is_admin || currentUser?.is_vip)}
        onConfirmReplace={handleConfirmReplace}
        onOpenProModal={() => setShowProModal(true)}
      />

    </div>
  );
};
export default Search;

