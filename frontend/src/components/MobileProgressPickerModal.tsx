import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Clock, BookOpen, X, Check, Plus, Minus, RotateCcw } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export interface MobileProgressPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'time' | 'pages';
  value: number; // For time: total minutes; for pages: pages read
  maxValue?: number; // For time: max duration in minutes; for pages: total pages
  title?: string;
  onChange: (newValue: number) => void;
  onTotalPagesChange?: (newTotal: number) => void;
}

const ITEM_HEIGHT = 42; // px per wheel row
const VISIBLE_ITEMS = 3; // odd number for centered selection

export const MobileProgressPickerModal: React.FC<MobileProgressPickerModalProps> = ({
  isOpen,
  onClose,
  mode,
  value,
  maxValue = 0,
  title,
  onChange,
  onTotalPagesChange
}) => {
  const { language } = useTranslation();
  const isEs = language === 'es';

  // Local state for interactive editing before committing
  const [currentValue, setCurrentValue] = useState<number>(value);

  // Time components
  const hours = Math.floor(currentValue / 60);
  const minutes = currentValue % 60;

  // References for wheel scrolling
  const hoursScrollRef = useRef<HTMLDivElement>(null);
  const minutesScrollRef = useRef<HTMLDivElement>(null);
  const pagesScrollRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Authoritative current value ref to guarantee 100% precision on rapid clicks
  const currentValueRef = useRef<number>(value);

  // Input typing state
  const [directInputVal, setDirectInputVal] = useState<string>(String(mode === 'time' ? hours : currentValue));
  const [directMinInputVal, setDirectMinInputVal] = useState<string>(String(minutes).padStart(2, '0'));

  // Sync internal state when modal opens or value prop changes
  useEffect(() => {
    if (isOpen) {
      currentValueRef.current = value;
      setCurrentValue(value);
      if (mode === 'time') {
        const h = Math.floor(value / 60);
        const m = value % 60;
        setDirectInputVal(String(h));
        setDirectMinInputVal(String(m).padStart(2, '0'));
      } else {
        setDirectInputVal(String(value));
      }
    }
  }, [isOpen, value, mode]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Generate range array for wheels
  const maxHours = mode === 'time' ? (maxValue > 0 ? Math.max(Math.ceil(maxValue / 60), 24) : 999) : 0;
  const hoursList = useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i <= Math.min(maxHours, 999); i++) list.push(i);
    return list;
  }, [maxHours]);

  const minutesList = useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i < 60; i++) list.push(i);
    return list;
  }, []);

  // For pages: create an appropriate page list (0 to maxPages or at least 2000)
  const maxPages = mode === 'pages' ? Math.max(maxValue > 0 ? maxValue : 0, currentValue + 500, 2000) : 0;
  const pagesList = useMemo(() => {
    const list: number[] = [];
    const limit = Math.min(maxPages, 10000);
    for (let i = 0; i <= limit; i++) list.push(i);
    return list;
  }, [maxPages]);

  // Scroll wheel to current positions when opened
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      isProgrammaticScroll.current = true;
      if (mode === 'time') {
        if (hoursScrollRef.current) {
          hoursScrollRef.current.scrollTop = hours * ITEM_HEIGHT;
        }
        if (minutesScrollRef.current) {
          minutesScrollRef.current.scrollTop = minutes * ITEM_HEIGHT;
        }
      } else {
        if (pagesScrollRef.current) {
          pagesScrollRef.current.scrollTop = currentValue * ITEM_HEIGHT;
        }
      }
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 150);
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, mode]);

  if (!isOpen) return null;

  // Update value helper with optional capping
  // Update value helper with optional capping
  const updateVal = (newVal: number, fromKeyboard = false) => {
    let finalVal = Math.max(0, newVal);
    if (maxValue > 0 && finalVal > maxValue) {
      finalVal = maxValue;
    }
    currentValueRef.current = finalVal;
    setCurrentValue(finalVal);

    if (!fromKeyboard) {
      if (mode === 'time') {
        const h = Math.floor(finalVal / 60);
        const m = finalVal % 60;
        setDirectInputVal(String(h));
        setDirectMinInputVal(String(m).padStart(2, '0'));
      } else {
        setDirectInputVal(String(finalVal));
      }
    }
  };

  // Wheel scroll handlers with debounce
  const handleHoursScroll = () => {
    if (isProgrammaticScroll.current || !hoursScrollRef.current) return;
    const top = hoursScrollRef.current.scrollTop;
    const index = Math.round(top / ITEM_HEIGHT);
    const validH = Math.min(Math.max(0, index), hoursList.length - 1);
    const currentM = currentValueRef.current % 60;
    const newTotal = validH * 60 + currentM;
    updateVal(newTotal);
  };

  const handleMinutesScroll = () => {
    if (isProgrammaticScroll.current || !minutesScrollRef.current) return;
    const top = minutesScrollRef.current.scrollTop;
    const index = Math.round(top / ITEM_HEIGHT);
    const validM = Math.min(Math.max(0, index), 59);
    const currentH = Math.floor(currentValueRef.current / 60);
    const newTotal = currentH * 60 + validM;
    updateVal(newTotal);
  };

  const handlePagesScroll = () => {
    if (isProgrammaticScroll.current || !pagesScrollRef.current) return;
    const top = pagesScrollRef.current.scrollTop;
    const index = Math.round(top / ITEM_HEIGHT);
    const validP = Math.min(Math.max(0, index), pagesList.length - 1);
    updateVal(validP);
  };

  // Programmatically scroll a wheel to a target index
  const scrollWheelTo = (ref: React.RefObject<HTMLDivElement | null>, index: number) => {
    if (!ref.current) return;
    isProgrammaticScroll.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    ref.current.scrollTop = index * ITEM_HEIGHT;
    scrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 150);
  };

  // Keyboard input handlers - instant scrollTop positioning for seamless typing
  const handleDirectHourInput = (text: string) => {
    setDirectInputVal(text);
    if (text === '') {
      updateVal(currentValueRef.current % 60, true);
      return;
    }
    const h = parseInt(text, 10);
    if (!isNaN(h)) {
      const newTotal = Math.max(0, h) * 60 + (currentValueRef.current % 60);
      updateVal(newTotal, true);
      if (hoursScrollRef.current) {
        isProgrammaticScroll.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        hoursScrollRef.current.scrollTop = Math.min(Math.max(0, h), hoursList.length - 1) * ITEM_HEIGHT;
        scrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 100);
      }
    }
  };

  const handleDirectMinInput = (text: string) => {
    setDirectMinInputVal(text);
    if (text === '') {
      updateVal(Math.floor(currentValueRef.current / 60) * 60, true);
      return;
    }
    const m = parseInt(text, 10);
    if (!isNaN(m)) {
      const validM = Math.min(Math.max(0, m), 59);
      const newTotal = Math.floor(currentValueRef.current / 60) * 60 + validM;
      updateVal(newTotal, true);
      if (minutesScrollRef.current) {
        isProgrammaticScroll.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        minutesScrollRef.current.scrollTop = validM * ITEM_HEIGHT;
        scrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 100);
      }
    }
  };

  const handleDirectPagesInput = (text: string) => {
    setDirectInputVal(text);
    if (text === '') {
      updateVal(0, true);
      return;
    }
    const p = parseInt(text, 10);
    if (!isNaN(p)) {
      updateVal(p, true);
      if (pagesScrollRef.current) {
        isProgrammaticScroll.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        pagesScrollRef.current.scrollTop = Math.min(Math.max(0, p), pagesList.length - 1) * ITEM_HEIGHT;
        scrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 100);
      }
    }
  };

  // Quick adjust presets with synchronous ref to guarantee precision under rapid clicks
  const adjustTimeBy = (deltaMins: number) => {
    const current = currentValueRef.current;
    let next = Math.max(0, current + deltaMins);
    if (maxValue > 0 && next > maxValue) next = maxValue;
    currentValueRef.current = next;
    updateVal(next);

    const nextH = Math.floor(next / 60);
    const nextM = next % 60;
    isProgrammaticScroll.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (hoursScrollRef.current) hoursScrollRef.current.scrollTop = Math.min(nextH, hoursList.length - 1) * ITEM_HEIGHT;
    if (minutesScrollRef.current) minutesScrollRef.current.scrollTop = nextM * ITEM_HEIGHT;
    scrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 150);
  };

  const adjustPagesBy = (deltaPages: number) => {
    const current = currentValueRef.current;
    let next = Math.max(0, current + deltaPages);
    if (maxValue > 0 && next > maxValue) next = maxValue;
    currentValueRef.current = next;
    updateVal(next);

    isProgrammaticScroll.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (pagesScrollRef.current) pagesScrollRef.current.scrollTop = Math.min(next, pagesList.length - 1) * ITEM_HEIGHT;
    scrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 150);
  };

  const setToValue = (targetVal: number) => {
    let next = Math.max(0, targetVal);
    if (maxValue > 0 && next > maxValue) next = maxValue;
    currentValueRef.current = next;
    updateVal(next);

    isProgrammaticScroll.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (mode === 'time') {
      const nextH = Math.floor(next / 60);
      const nextM = next % 60;
      if (hoursScrollRef.current) hoursScrollRef.current.scrollTop = Math.min(nextH, hoursList.length - 1) * ITEM_HEIGHT;
      if (minutesScrollRef.current) minutesScrollRef.current.scrollTop = nextM * ITEM_HEIGHT;
    } else {
      if (pagesScrollRef.current) pagesScrollRef.current.scrollTop = Math.min(next, pagesList.length - 1) * ITEM_HEIGHT;
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 150);
  };

  const handleConfirm = () => {
    onChange(currentValueRef.current);
    onClose();
  };

  const progressPercent = maxValue > 0 ? Math.min(100, Math.round((currentValue / maxValue) * 100)) : 0;

  const modalContent = (
    <div
      className="progress-picker-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem 1.25rem',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        className="progress-picker-modal-card"
        style={{
          width: 'calc(100% - 2.5rem)',
          maxWidth: 380,
          margin: '0 auto',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 24,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100dvh - 140px)',
          boxSizing: 'border-box',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.9rem 1.25rem 0.85rem',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            {mode === 'time' ? <Clock size={19} color="var(--accent-primary)" /> : <BookOpen size={19} color="var(--accent-primary)" />}
            <span>
              {title || (mode === 'time' ? (isEs ? 'Progreso de tiempo' : 'Time progress') : (isEs ? 'Páginas leídas' : 'Pages read'))}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isEs ? 'Cerrar' : 'Close'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Top Direct Editable Number Displays (Keyboard accessible) */}
        <div style={{
          padding: '0.9rem 1.25rem 0.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {isEs ? 'Toca para escribir o desliza la rueda' : 'Tap to type or scroll the wheel'}
          </div>

          {mode === 'time' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {/* Hours input */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-tertiary)',
                border: '1.5px solid var(--border-color)',
                borderRadius: 12,
                padding: '0.4rem 0.8rem',
                gap: '0.2rem'
              }}>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={directInputVal}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleDirectHourInput(e.target.value)}
                  style={{
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    width: '60px',
                    textAlign: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    outline: 'none',
                    padding: 0
                  }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>h</span>
              </div>

              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-muted)' }}>:</span>

              {/* Minutes input */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-tertiary)',
                border: '1.5px solid var(--border-color)',
                borderRadius: 12,
                padding: '0.4rem 0.8rem',
                gap: '0.2rem'
              }}>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={directMinInputVal}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleDirectMinInput(e.target.value)}
                  style={{
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    width: '50px',
                    textAlign: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    outline: 'none',
                    padding: 0
                  }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>m</span>
              </div>

              {maxValue > 0 && (
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                  / {Math.floor(maxValue / 60)}h {String(maxValue % 60).padStart(2, '0')}m
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-tertiary)',
                border: '1.5px solid var(--border-color)',
                borderRadius: 12,
                padding: '0.4rem 1rem',
                gap: '0.3rem'
              }}>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={directInputVal}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleDirectPagesInput(e.target.value)}
                  style={{
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    width: '90px',
                    textAlign: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    outline: 'none',
                    padding: 0
                  }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {isEs ? 'págs' : 'pages'}
                </span>
              </div>

              {maxValue > 0 && (
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  / {maxValue} {isEs ? 'págs' : 'pages'}
                </div>
              )}
            </div>
          )}

          {/* Progress percentage pill if total is known */}
          {maxValue > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '80%',
              maxWidth: 320,
              marginTop: '0.2rem'
            }}>
              <div style={{
                flex: 1,
                height: 6,
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 4,
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'var(--accent-primary)',
                  borderRadius: 4,
                  transition: 'width 0.2s ease'
                }} />
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>
                {progressPercent}%
              </span>
            </div>
          )}
        </div>

        {/* Tactile Wheel Picker Area */}
        <div style={{
          position: 'relative',
          height: ITEM_HEIGHT * VISIBLE_ITEMS,
          margin: '0.5rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: 16,
          border: '1px solid var(--border-color)'
        }}>
          {/* Active selection center highlight bar */}
          <div style={{
            position: 'absolute',
            left: 8,
            right: 8,
            height: ITEM_HEIGHT,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(255, 255, 255, 0.06)',
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 10,
            pointerEvents: 'none',
            zIndex: 1
          }} />

          {/* Top/bottom vignette fading gradient mask */}
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'linear-gradient(to bottom, var(--bg-secondary) 0%, transparent 35%, transparent 65%, var(--bg-secondary) 100%)',
            opacity: 0.85,
            zIndex: 2
          }} />

          {mode === 'time' ? (
            <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', zIndex: 0 }}>
              {/* Hours Column */}
              <div
                ref={hoursScrollRef}
                onScroll={handleHoursScroll}
                style={{
                  flex: 1,
                  height: '100%',
                  overflowY: 'scroll',
                  scrollSnapType: 'y mandatory',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {/* Spacer top */}
                <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }} />
                {hoursList.map((h) => {
                  const isSelected = h === hours;
                  return (
                    <div
                      key={`h-${h}`}
                      onClick={() => {
                        updateVal(h * 60 + minutes);
                        scrollWheelTo(hoursScrollRef, h);
                      }}
                      style={{
                        height: ITEM_HEIGHT,
                        scrollSnapAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isSelected ? '1.4rem' : '1.05rem',
                        fontWeight: isSelected ? 800 : 500,
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                        transform: isSelected ? 'scale(1.08)' : 'scale(0.92)',
                        transition: 'color 0.15s, transform 0.15s',
                        cursor: 'pointer'
                      }}
                    >
                      {h} <span style={{ fontSize: '0.78rem', marginLeft: 3, opacity: 0.7 }}>h</span>
                    </div>
                  );
                })}
                {/* Spacer bottom */}
                <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }} />
              </div>

              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-muted)', padding: '0 0.2rem' }}>:</div>

              {/* Minutes Column */}
              <div
                ref={minutesScrollRef}
                onScroll={handleMinutesScroll}
                style={{
                  flex: 1,
                  height: '100%',
                  overflowY: 'scroll',
                  scrollSnapType: 'y mandatory',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {/* Spacer top */}
                <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }} />
                {minutesList.map((m) => {
                  const isSelected = m === minutes;
                  return (
                    <div
                      key={`m-${m}`}
                      onClick={() => {
                        updateVal(hours * 60 + m);
                        scrollWheelTo(minutesScrollRef, m);
                      }}
                      style={{
                        height: ITEM_HEIGHT,
                        scrollSnapAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isSelected ? '1.4rem' : '1.05rem',
                        fontWeight: isSelected ? 800 : 500,
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                        transform: isSelected ? 'scale(1.08)' : 'scale(0.92)',
                        transition: 'color 0.15s, transform 0.15s',
                        cursor: 'pointer'
                      }}
                    >
                      {String(m).padStart(2, '0')} <span style={{ fontSize: '0.78rem', marginLeft: 3, opacity: 0.7 }}>m</span>
                    </div>
                  );
                })}
                {/* Spacer bottom */}
                <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }} />
              </div>
            </div>
          ) : (
            /* Pages Single Wheel Column */
            <div
              ref={pagesScrollRef}
              onScroll={handlePagesScroll}
              style={{
                width: '100%',
                height: '100%',
                overflowY: 'scroll',
                scrollSnapType: 'y mandatory',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                zIndex: 0
              }}
            >
              {/* Spacer top */}
              <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }} />
              {pagesList.map((p) => {
                const isSelected = p === currentValue;
                return (
                  <div
                    key={`p-${p}`}
                    onClick={() => {
                      updateVal(p);
                      scrollWheelTo(pagesScrollRef, p);
                    }}
                    style={{
                      height: ITEM_HEIGHT,
                      scrollSnapAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isSelected ? '1.45rem' : '1.05rem',
                      fontWeight: isSelected ? 800 : 500,
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                      transform: isSelected ? 'scale(1.08)' : 'scale(0.92)',
                      transition: 'color 0.15s, transform 0.15s',
                      cursor: 'pointer'
                    }}
                  >
                    {p} <span style={{ fontSize: '0.78rem', marginLeft: 4, opacity: 0.7 }}>{isEs ? 'págs' : 'pages'}</span>
                  </div>
                );
              })}
              {/* Spacer bottom */}
              <div style={{ height: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) }} />
            </div>
          )}
        </div>

        {/* Quick step buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 1.25rem 0.75rem',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {mode === 'time' ? (
            <>
              <button
                type="button"
                onClick={() => adjustTimeBy(-15)}
                style={quickBtnStyle}
              >
                -15m
              </button>
              <button
                type="button"
                onClick={() => adjustTimeBy(15)}
                style={quickBtnStyle}
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => adjustTimeBy(60)}
                style={quickBtnStyle}
              >
                +1h
              </button>
              {maxValue > 0 && (
                <button
                  type="button"
                  onClick={() => setToValue(maxValue)}
                  style={{ ...quickBtnStyle, color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
                >
                  {isEs ? 'Terminar' : 'Complete'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setToValue(0)}
                title={isEs ? 'Reiniciar' : 'Reset'}
                style={quickBtnStyle}
              >
                <RotateCcw size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => adjustPagesBy(-10)}
                style={quickBtnStyle}
              >
                -10
              </button>
              <button
                type="button"
                onClick={() => adjustPagesBy(-1)}
                style={quickBtnStyle}
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => adjustPagesBy(1)}
                style={quickBtnStyle}
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => adjustPagesBy(10)}
                style={quickBtnStyle}
              >
                +10
              </button>
              <button
                type="button"
                onClick={() => adjustPagesBy(50)}
                style={quickBtnStyle}
              >
                +50
              </button>
              {maxValue > 0 && (
                <button
                  type="button"
                  onClick={() => setToValue(maxValue)}
                  style={{ ...quickBtnStyle, color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
                >
                  {isEs ? 'Leído' : 'Read'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer Confirm & Cancel Actions */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '0.85rem 1.25rem 1.15rem',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: '0.95rem'
            }}
          >
            {isEs ? 'Cancelar' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary"
            style={{
              flex: 2,
              padding: '0.75rem',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <Check size={18} />
            {isEs ? 'Confirmar' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};

const quickBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid var(--border-color)',
  borderRadius: 10,
  padding: '0.55rem 0.15rem',
  color: 'var(--text-secondary)',
  fontSize: '0.82rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  minWidth: 0,
  gap: '0.2rem',
  transition: 'all 0.15s ease',
  boxSizing: 'border-box'
};

export default MobileProgressPickerModal;
