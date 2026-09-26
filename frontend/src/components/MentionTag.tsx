import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { findProfileThemeColor } from '../utils/profileThemes';
import { useTheme } from '../context/ThemeContext';

interface UserColorInfo {
  profile_color?: string | null;
  is_pro?: boolean;
}

// Global cache for resolved usernames -> color info
const usernameColorCache = new Map<string, UserColorInfo>();
const pendingQueries = new Set<string>();
const listeners = new Set<() => void>();

let batchTimeout: any = null;

function notifyListeners() {
  listeners.forEach(cb => cb());
}

function scheduleBatchFetch(username: string) {
  const clean = username.trim().toLowerCase();
  if (usernameColorCache.has(clean) || pendingQueries.has(clean)) return;

  pendingQueries.add(clean);

  if (batchTimeout) clearTimeout(batchTimeout);

  batchTimeout = setTimeout(async () => {
    const toFetch = Array.from(pendingQueries);
    pendingQueries.clear();

    if (toFetch.length === 0) return;

    try {
      const res = await apiClient.post('/users/colors', { usernames: toFetch });
      if (res.data && typeof res.data === 'object') {
        for (const u of toFetch) {
          const match = res.data[u];
          usernameColorCache.set(u, {
            profile_color: match?.profile_color || null,
            is_pro: Boolean(match?.is_pro)
          });
        }
      }
    } catch (e) {
      // If error, cache as null so we don't repeat endlessly
      for (const u of toFetch) {
        if (!usernameColorCache.has(u)) {
          usernameColorCache.set(u, { profile_color: null, is_pro: false });
        }
      }
    } finally {
      notifyListeners();
    }
  }, 50);
}

/**
 * Hook to get user color style for a username mention
 */
export function useMentionColor(username: string) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const clean = username.trim().toLowerCase();

  const [colorInfo, setColorInfo] = useState<UserColorInfo | undefined>(() => usernameColorCache.get(clean));

  useEffect(() => {
    if (!usernameColorCache.has(clean)) {
      scheduleBatchFetch(clean);
    }

    const onChange = () => {
      setColorInfo(usernameColorCache.get(clean));
    };

    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, [clean]);

  if (!colorInfo || !colorInfo.is_pro || !colorInfo.profile_color) {
    return {
      textColor: 'var(--accent-primary)',
      background: 'rgba(99, 102, 241, 0.12)'
    };
  }

  const themeColor = findProfileThemeColor(colorInfo.profile_color);
  if (!themeColor) {
    return {
      textColor: colorInfo.profile_color,
      background: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)'
    };
  }

  const mode = isLight ? themeColor.light : themeColor.dark;
  return {
    textColor: mode.accent,
    background: mode.border
  };
}

/**
 * Component that renders an individual @username tag with its custom profile color
 */
export const MentionTag: React.FC<{ username: string }> = ({ username }) => {
  const cleanName = username.startsWith('@') ? username.slice(1) : username;
  const { textColor, background } = useMentionColor(cleanName);

  return (
    <span
      style={{
        color: textColor,
        fontWeight: 600,
        background: background,
        padding: '0.1rem 0.35rem',
        borderRadius: '4px',
        marginRight: '0.2rem',
        display: 'inline-block',
        transition: 'color 0.2s ease, background 0.2s ease'
      }}
    >
      @{cleanName}
    </span>
  );
};

/**
 * Component that renders an author's username in their profile color if PRO, else neutral text-primary
 */
export const AuthorUsername: React.FC<{
  username: string;
  isDeleted?: boolean;
  deletedLabel?: string;
  style?: React.CSSProperties;
  className?: string;
}> = ({ username, isDeleted = false, deletedLabel = 'Usuario', style, className }) => {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const cleanName = username.trim().toLowerCase();

  const [colorInfo, setColorInfo] = useState<UserColorInfo | undefined>(() => usernameColorCache.get(cleanName));

  useEffect(() => {
    if (isDeleted || !cleanName) return;
    if (!usernameColorCache.has(cleanName)) {
      scheduleBatchFetch(cleanName);
    }

    const onChange = () => {
      setColorInfo(usernameColorCache.get(cleanName));
    };

    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, [cleanName, isDeleted]);

  if (isDeleted) {
    return (
      <span
        className={className}
        style={{
          fontWeight: 700,
          color: 'var(--text-muted)',
          ...style
        }}
      >
        {deletedLabel}
      </span>
    );
  }

  let color = 'var(--text-primary)';
  if (colorInfo && colorInfo.is_pro && colorInfo.profile_color) {
    const themeColor = findProfileThemeColor(colorInfo.profile_color);
    if (themeColor) {
      color = isLight ? themeColor.light.accent : themeColor.dark.accent;
    } else {
      color = colorInfo.profile_color;
    }
  }

  return (
    <span
      className={className}
      style={{
        fontWeight: 700,
        color,
        transition: 'color 0.2s ease',
        ...style
      }}
    >
      {username}
    </span>
  );
};

/**
 * Helper to render text with highlighted and styled @username mentions
 */
export function renderFormattedContentWithMentions(content?: string | null): React.ReactNode {
  if (!content) return null;
  const parts = content.split(/(@[a-zA-Z0-9_\-.]+)/g);
  return (
    <span>
      {parts.map((part, idx) => {
        if (part.startsWith('@') && part.length > 1) {
          return <MentionTag key={idx} username={part} />;
        }
        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
}


