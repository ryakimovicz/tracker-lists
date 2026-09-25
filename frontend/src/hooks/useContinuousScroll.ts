import { useRef, useCallback, useEffect } from 'react';

export function useContinuousScroll(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  defaultStep: number = 350,
  speedPxPerFrame: number = 14,
  onScrollUpdate?: () => void
) {
  const isHoldingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<any>(null);
  const defaultStepRef = useRef(defaultStep);
  const speedRef = useRef(speedPxPerFrame);
  const onScrollUpdateRef = useRef(onScrollUpdate);

  defaultStepRef.current = defaultStep;
  speedRef.current = speedPxPerFrame;
  onScrollUpdateRef.current = onScrollUpdate;

  const stopScrolling = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (onScrollUpdateRef.current) {
      onScrollUpdateRef.current();
    }
  }, []);

  const startScrolling = useCallback((direction: 'left' | 'right', customSpeed?: number) => {
    stopScrolling();
    isHoldingRef.current = false;

    const baseSpeed = customSpeed ?? speedRef.current;
    const dir = direction === 'left' ? -1 : 1;

    // Only start continuous RAF scrolling after holding beyond 180ms
    holdTimeoutRef.current = setTimeout(() => {
      isHoldingRef.current = true;

      const loop = () => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft += dir * baseSpeed;
          if (onScrollUpdateRef.current) {
            onScrollUpdateRef.current();
          }
        }
        rafIdRef.current = requestAnimationFrame(loop);
      };

      rafIdRef.current = requestAnimationFrame(loop);
    }, 180);
  }, [scrollRef, stopScrolling]);

  const handleClick = useCallback((direction: 'left' | 'right', customStep?: number) => {
    const wasHolding = isHoldingRef.current;
    stopScrolling();
    isHoldingRef.current = false;

    // If it was just a quick click (not a sustained hold), execute the step scroll
    if (!wasHolding && scrollRef.current) {
      const step = customStep ?? defaultStepRef.current;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -step : step,
        behavior: 'smooth'
      });
      // Trigger check immediately and during animation frames for ultra-responsive indicators
      if (onScrollUpdateRef.current) {
        onScrollUpdateRef.current();
      }
      requestAnimationFrame(() => {
        if (onScrollUpdateRef.current) onScrollUpdateRef.current();
      });
      setTimeout(() => {
        if (onScrollUpdateRef.current) onScrollUpdateRef.current();
      }, 50);
      setTimeout(() => {
        if (onScrollUpdateRef.current) onScrollUpdateRef.current();
      }, 150);
      setTimeout(() => {
        if (onScrollUpdateRef.current) onScrollUpdateRef.current();
      }, 350);
    }
  }, [scrollRef, stopScrolling]);

  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    startScrolling,
    stopScrolling,
    handleClick
  };
}
