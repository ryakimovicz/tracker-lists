import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Star, Check, RotateCcw } from 'lucide-react';
import { PROFILE_THEME_COLORS, findProfileThemeColor } from '../utils/profileThemes';
import { canCustomizeColor } from '../utils/planPermissions';
import { useTheme } from '../context/ThemeContext';

interface GuideAccentColorPickerProps {
  accentColor: string | null;
  onChange: (colorId: string | null) => void;
  currentUser: any;
  language: string;
  compact?: boolean;
  onRequirePro?: () => void;
}

export const GuideAccentColorPicker: React.FC<GuideAccentColorPickerProps> = ({
  accentColor,
  onChange,
  currentUser,
  language,
  compact = false,
  onRequirePro
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const isPro = canCustomizeColor(currentUser);
  const selectedTheme = findProfileThemeColor(accentColor);
  const selectedHex = selectedTheme
    ? (isLight ? selectedTheme.light.accent : selectedTheme.dark.accent)
    : null;

  const updatePopoverPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 272;
    const margin = 12;
    const maxLeft = Math.max(margin, window.innerWidth - popoverWidth - margin);
    const left = Math.min(Math.max(margin, rect.left), maxLeft);
    const top = rect.bottom + 8;
    setPopoverPos({ top, left });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePopoverPosition();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleReposition = () => updatePopoverPosition();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen]);

  const handlePickColor = (colorId: string | null) => {
    if (!isPro) {
      setIsOpen(false);
      onRequirePro?.();
      return;
    }
    onChange(colorId);
    setIsOpen(false);
  };

  const renderPopover = () => {
    if (!isOpen) return null;
    return createPortal(
      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: `${popoverPos.top}px`,
          left: `${popoverPos.left}px`,
          zIndex: 9999,
          width: '272px',
          padding: '0.85rem',
          borderRadius: '12px',
          background: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.98)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 14px 36px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Palette size={14} />
            {language === 'es' ? 'Color de la guía' : 'Guide accent color'}
          </span>
          <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.12rem 0.4rem', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            <Star size={9} fill="#f59e0b" /> PREMIUM
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.45rem' }}>
          {PROFILE_THEME_COLORS.map((c) => {
            const swatch = isLight ? c.light.accent : c.dark.accent;
            const isSelected = accentColor === c.id;
            return (
              <button
                key={c.id}
                type="button"
                title={language === 'es' ? c.name.es : c.name.en}
                onClick={() => handlePickColor(c.id)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: swatch,
                  border: isSelected ? '2.5px solid var(--text-primary)' : '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  boxShadow: isSelected ? `0 0 10px ${swatch}` : 'none',
                  transition: 'transform 0.15s ease'
                }}
              >
                {isSelected && <Check size={14} color={isLight ? '#fff' : '#0f172a'} strokeWidth={3} />}
              </button>
            );
          })}
        </div>

        {accentColor && (
          <button
            type="button"
            onClick={() => handlePickColor(null)}
            className="btn-secondary"
            style={{
              fontSize: '0.78rem',
              padding: '0.35rem 0.65rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              width: '100%'
            }}
          >
            <RotateCcw size={13} />
            {language === 'es' ? 'Usar color por defecto' : 'Use default color'}
          </button>
        )}
      </div>,
      document.body
    );
  };

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="btn-secondary"
          title={language === 'es' ? 'Color de acento de la guía' : 'Guide accent color'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            height: '38px',
            padding: '0.4rem 0.85rem',
            fontSize: '0.82rem'
          }}
        >
          {selectedHex ? (
            <span
              style={{
                width: '13px',
                height: '13px',
                borderRadius: '50%',
                background: selectedHex,
                border: '1px solid rgba(255,255,255,0.35)',
                flexShrink: 0
              }}
            />
          ) : (
            <Palette size={15} />
          )}
          <span>{language === 'es' ? 'Color' : 'Color'}</span>
          <span style={{ fontSize: '0.62rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
            <Star size={9} fill="#f59e0b" />
          </span>
        </button>
        {renderPopover()}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
      <label style={{ fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Palette size={15} /> {language === 'es' ? 'Color de acento' : 'Accent color'}
        <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.15rem 0.35rem', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
          <Star size={10} fill="#f59e0b" />
        </span>
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="btn-secondary"
          style={{
            fontSize: '0.82rem',
            padding: '0.35rem 0.85rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem'
          }}
        >
          {selectedHex && (
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: selectedHex,
                border: '1px solid rgba(255,255,255,0.35)',
                flexShrink: 0
              }}
            />
          )}
          {selectedTheme
            ? (language === 'es' ? selectedTheme.name.es : selectedTheme.name.en)
            : (language === 'es' ? 'Elegir color' : 'Choose color')}
        </button>
        {accentColor && (
          <button
            type="button"
            onClick={() => handlePickColor(null)}
            className="btn-secondary"
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem', color: '#ef4444' }}
          >
            {language === 'es' ? 'Quitar' : 'Remove'}
          </button>
        )}
      </div>

      {renderPopover()}
    </div>
  );
};
