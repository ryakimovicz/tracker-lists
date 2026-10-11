import React from 'react';

interface CreateGuideIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  idSuffix?: string;
}

export const CreateGuideIcon: React.FC<CreateGuideIconProps> = ({
  size = 20,
  strokeWidth = 2,
  className,
  style,
  idSuffix = 'default',
}) => {
  const maskId = `book-plus-cutout-${idSuffix}`;
  const plusStroke = Math.max(strokeWidth * 1.1, 2.2);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ overflow: 'visible', ...style }}
      aria-hidden="true"
    >
      <mask id={maskId}>
        <rect x="-5" y="-5" width="34" height="34" fill="#ffffff" />
        {/* Cut out a clearing around the plus symbol */}
        <circle cx="20.5" cy="4" r="5.5" fill="#000000" />
      </mask>
      {/* Left book page */}
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      {/* Right book page with cutout mask */}
      <path
        d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
        mask={`url(#${maskId})`}
      />
      {/* Plus symbol in the top right corner */}
      <path d="M20.5 1.5v5" strokeWidth={plusStroke} />
      <path d="M18 4h5" strokeWidth={plusStroke} />
    </svg>
  );
};
