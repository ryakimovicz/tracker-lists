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
  // activeLetter is the letter currently highlighted by wave or hover (-1 when in idle state)
  const [activeLetter, setActiveLetter] = useState<number>(-1);
  const isHoveredRef = useRef(false);
  const lastHoveredIndexRef = useRef<number>(4);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
  };

  // Run the back-and-forth wave animation with a subtle pause on 'P'
  const runWave = () => {
    if (isHoveredRef.current) return;
    clearAllTimeouts();

    // Sequence with extra hold time on 'P' (index 0)
    const waveTimeline: { index: number; delay: number }[] = [
      { index: 4, delay: 0 },    // 'd' (orange)
      { index: 3, delay: 110 },  // 'h' (red)
      { index: 2, delay: 220 },  // 't' (purple)
      { index: 1, delay: 330 },  // 'a' (blue)
      { index: 0, delay: 440 },  // 'P' (green) - arrives and holds
      { index: 1, delay: 740 },  // 'a' (blue) - returns forward after ~300ms hold on 'P'
      { index: 2, delay: 850 },  // 't' (purple)
      { index: 3, delay: 960 },  // 'h' (red)
      { index: 4, delay: 1070 }, // 'd' (orange)
    ];

    waveTimeline.forEach(({ index, delay }) => {
      const t = setTimeout(() => {
        if (!isHoveredRef.current) {
          setActiveLetter(index);
        }
      }, delay);
      timeoutsRef.current.push(t);
    });

    // Settle back to idle resting state (d painted orange at normal baseline position)
    const settleTimeout = setTimeout(() => {
      if (!isHoveredRef.current) {
        setActiveLetter(-1);
      }
    }, 1240);
    timeoutsRef.current.push(settleTimeout);
  };


  // Schedule periodic wave every 16 seconds
  const startPeriodicWave = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!isHoveredRef.current) {
        runWave();
      }
    }, 16000);
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
      setActiveLetter(-1);
      startPeriodicWave();
      return;
    }

    // Smooth cascade from last hovered index forward to 'd' (index 4)
    const forwardSteps: number[] = [];
    for (let i = fromIndex + 1; i <= 4; i++) {
      forwardSteps.push(i);
    }

    const stepDelay = 115;
    forwardSteps.forEach((letterIndex, step) => {
      const t = setTimeout(() => {
        if (!isHoveredRef.current) {
          setActiveLetter(letterIndex);
        }
      }, (step + 1) * stepDelay);
      timeoutsRef.current.push(t);
    });

    // Return to resting position once cascade completes
    const settleTimeout = setTimeout(() => {
      if (!isHoveredRef.current) {
        setActiveLetter(-1);
        startPeriodicWave();
      }
    }, (forwardSteps.length + 1) * stepDelay + 100);
    timeoutsRef.current.push(settleTimeout);
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
        // Is actively being animated or hovered right now
        const isDynamicActive = activeLetter === idx;
        // In idle state (activeLetter === -1), 'd' is always painted orange
        const isIdleD = activeLetter === -1 && idx === 4;

        const isColored = isDynamicActive || isIdleD;
        const isLifted = isDynamicActive; // Only lifted while animating or hovered

        return (
          <span
            key={letter.char}
            onMouseEnter={() => handleMouseEnterLetter(idx)}
            style={{
              display: 'inline-block',
              cursor: 'pointer',
              color: isColored ? letter.colorVar : 'var(--text-primary)',
              textShadow: isDynamicActive ? `0 0 16px ${letter.glow}` : 'none',
              transform: isLifted ? 'translateY(-2.5px)' : 'translateY(0)',
              transition: 'color 0.18s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), text-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {letter.char}
          </span>
        );
      })}
    </Link>
  );
};
