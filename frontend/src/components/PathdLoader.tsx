import React from 'react';

interface PathdLoaderProps {
  fullScreen?: boolean;
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

const DOTS = [
  { char: 'P', color: 'var(--color-movie, #4ade80)', glow: 'rgba(74, 222, 128, 0.65)', delay: '0s' },
  { char: 'a', color: 'var(--color-manga, #60a5fa)', glow: 'rgba(96, 165, 250, 0.65)', delay: '0.15s' },
  { char: 't', color: 'var(--color-game, #c084fc)', glow: 'rgba(192, 132, 252, 0.65)', delay: '0.3s' },
  { char: 'h', color: 'var(--color-comic, #f87171)', glow: 'rgba(248, 113, 113, 0.65)', delay: '0.45s' },
  { char: 'd', color: 'var(--color-anime, #ff8833)', glow: 'rgba(255, 136, 51, 0.65)', delay: '0.6s' },
];

export const PathdLoader: React.FC<PathdLoaderProps> = ({
  fullScreen = false,
  size = 'medium',
  message,
}) => {
  const fontSize = size === 'small' ? '1.5rem' : size === 'large' ? '2.75rem' : '2.15rem';
  const dotSize = size === 'small' ? '8px' : size === 'large' ? '14px' : '11px';
  const gap = size === 'small' ? '0.35rem' : size === 'large' ? '0.75rem' : '0.5rem';

  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes pathdWave {
          0%, 100% {
            transform: translateY(0) scale(0.92);
            opacity: 0.6;
            filter: brightness(0.9);
          }
          50% {
            transform: translateY(-7px) scale(1.18);
            opacity: 1;
            filter: brightness(1.25);
          }
        }
        @keyframes pathdGlow {
          0%, 100% {
            box-shadow: 0 0 6px rgba(0,0,0,0.2);
          }
          50% {
            box-shadow: 0 0 18px currentColor;
          }
        }
      `}</style>

      {/* Animated Pathd Letters / Colored Dots */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: gap,
          fontSize: fontSize,
          fontWeight: 800,
          letterSpacing: '-0.5px',
        }}
      >
        {DOTS.map((item, idx) => (
          <span
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: item.color,
              textShadow: `0 0 16px ${item.glow}`,
              animation: `pathdWave 1.4s ease-in-out infinite`,
              animationDelay: item.delay,
              willChange: 'transform, opacity, filter',
            }}
          >
            {item.char}
          </span>
        ))}
      </div>

      {/* Pulsing Colored Mini-Dots Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {DOTS.map((item, idx) => (
          <div
            key={idx}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              backgroundColor: item.color,
              animation: `pathdWave 1.4s ease-in-out infinite, pathdGlow 1.4s ease-in-out infinite`,
              animationDelay: item.delay,
              willChange: 'transform, opacity',
            }}
          />
        ))}
      </div>

      {message && (
        <p
          style={{
            margin: 0,
            fontSize: '0.9rem',
            fontWeight: 500,
            color: 'var(--text-secondary, #94a3b8)',
            letterSpacing: '0.2px',
          }}
        >
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary, #090d16)',
          zIndex: 9999,
          backdropFilter: 'blur(10px)',
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1rem',
        width: '100%',
      }}
    >
      {content}
    </div>
  );
};
