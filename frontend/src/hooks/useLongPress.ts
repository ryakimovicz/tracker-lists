import { useState, useEffect, useCallback } from 'react';

export function useLongPress(callback: () => void, ms: number = 500) {
  const [startLongPress, setStartLongPress] = useState(false);

  useEffect(() => {
    let timerId: number | undefined;
    if (startLongPress) {
      timerId = window.setTimeout(callback, ms);
    } else {
      clearTimeout(timerId);
    }

    return () => {
      clearTimeout(timerId);
    };
  }, [callback, ms, startLongPress]);

  const start = useCallback((e: any) => {
    // Only trigger on touch events to prevent conflicts with mouse clicks
    if (e.type === 'touchstart') {
      setStartLongPress(true);
    }
  }, []);

  const clear = useCallback(() => {
    setStartLongPress(false);
  }, []);

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
  };
}
