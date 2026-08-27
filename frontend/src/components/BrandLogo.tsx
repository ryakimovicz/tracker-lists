import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

interface LetterConfig {
  char: string;
  colorVar: string;
  glow: string;
}

const LETTERS: LetterConfig[] = [
  { char: 'P', colorVar: 'var(--color-movie)', glow: 'rgba(74, 222, 128, 0.65)' },
  { char: 'a', colorVar: 'var(--color-manga)', glow: 'rgba(96, 165, 250, 0.65)' },
  { char: 't', colorVar: 'var(--color-game)', glow: 'rgba(192, 132, 252, 0.65)' },
  { char: 'h', colorVar: 'var(--color-comic)', glow: 'rgba(248, 113, 113, 0.65)' },
  { char: 'd', colorVar: 'var(--accent-primary)', glow: 'rgba(245, 158, 11, 0.7)' },
];

export const BrandLogo: React.FC = () => {
  // 'd' is index 4, normally active by default
  const [activeLetter, setActiveLetter] = useState<number>(4);
  const isHoveredRef = useRef(false);
  const lastHoveredIndexRef = useRef<number>(4);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
  };

  // Run the back-and-forth wave animation
  const runWave = () => {
    if (isHoveredRef.current) return;
    clearAllTimeouts();

    // Sequence: 4(d) -> 3(h) -> 2(t) -> 1(a) -> 0(P) -> 1(a) -> 2(t) -> 3(h) -> 4(d)
    const waveSequence = [4, 3, 2, 1, 0, 1, 2, 3, 4];
    const stepDelay = 110; // ms per step

    waveSequence.forEach((letterIndex, step) => {
      const t = setTimeout(() => {
        if (!isHoveredRef.current) {
          setActiveLetter(letterIndex);
        }
      }, step * stepDelay);
      timeoutsRef.current.push(t);
    });
  };

  // Schedule periodic wave every 7 seconds
  const startPeriodicWave = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!isHoveredRef.current) {
        runWave();
      }
    }, 7000);
  };

  useEffect(() => {
    startPeriodicWave();
    return () => {
      clearAllTimeouts();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleMouseEnterLetter = (index: number) => {
    isHoveredRef.current = true;
    lastHoveredIndexRef.current = index;
    clearAllTimeouts();
    setActiveLetter(index);
  };

  const handleMouseLeaveLogo = () => {
    isHoveredRef.current = false;
    clearAllTimeouts();

    const fromIndex = lastHoveredIndexRef.current;
    if (fromIndex >= 4) {
      setActiveLetter(4);
      startPeriodicWave();
      return;
    }

    // Smooth cascade from last hovered index forward to 'd' (index 4)
    // Example: if mouse left at 't' (2) -> activates 'h' (3) -> settles on 'd' (4)
    const forwardSteps: number[] = [];
    for (let i = fromIndex + 1; i <= 4; i++) {
      forwardSteps.push(i);
    }

    const stepDelay = 115;
    forwardSteps.forEach((letterIndex, step) => {
      const t = setTimeout(() => {
        if (!isHoveredRef.current) {
          setActiveLetter(letterIndex);
          if (letterIndex === 4) {
            startPeriodicWave();
          }
        }
      }, (step + 1) * stepDelay);
      timeoutsRef.current.push(t);
    });
  };

  return (
    <Link
      to="/"
      className="brand-logo-text"
      title="Pathd"
      onMouseLeave={handleMouseLeaveLogo}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        textDecoration: 'none',
        userSelect: 'none',
        fontSize: '2.15rem',
        fontWeight: 800,
        letterSpacing: '-0.5px',
        lineHeight: 1,
      }}
    >
      {LETTERS.map((letter, idx) => {
        const isActive = activeLetter === idx;
        return (
          <span
            key={letter.char}
            onMouseEnter={() => handleMouseEnterLetter(idx)}
            style={{
              display: 'inline-block',
              cursor: 'pointer',
              color: isActive ? letter.colorVar : 'var(--text-primary)',
              textShadow: isActive ? `0 0 16px ${letter.glow}` : 'none',
              transform: isActive ? 'translateY(-2.5px)' : 'translateY(0)',
              transition: 'color 0.18s cubic-bezier(0.4, 0, 0.2, 1), transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), text-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {letter.char}
          </span>
        );
      })}
    </Link>
  );
};
