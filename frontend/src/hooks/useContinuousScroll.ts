import { useRef, useCallback, useEffect } from 'react';

export function useContinuousScroll(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  defaultStep: number = 300,
  speedPxPerFrame: number = 15
) {
  const isHoldingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const defaultStepRef = useRef(defaultStep);
  const speedRef = useRef(speedPxPerFrame);

  defaultStepRef.current = defaultStep;
  speedRef.current = speedPxPerFrame;

  const stopScrolling = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const startScrolling = useCallback((direction: 'left' | 'right', customSpeed?: number) => {
    stopScrolling();
    isHoldingRef.current = false;
    startTimeRef.current = performance.now();

    const baseSpeed = customSpeed ?? speedRef.current;
    const dir = direction === 'left' ? -1 : 1;

    const loop = () => {
      const elapsed = performance.now() - startTimeRef.current;
      if (elapsed > 160) {
        isHoldingRef.current = true;
      }

      if (scrollRef.current) {
        const speedMultiplier = elapsed < 100 ? 0.6 : 1.0;
        scrollRef.current.scrollLeft += dir * baseSpeed * speedMultiplier;
      }
      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
  }, [scrollRef, stopScrolling]);

  const handleClick = useCallback((direction: 'left' | 'right', customStep?: number) => {
    const wasHolding = isHoldingRef.current;
    stopScrolling();
    isHoldingRef.current = false;

    // If it was just a quick click (released before hold threshold), perform full stepped scroll
    if (!wasHolding && scrollRef.current) {
      const step = customStep ?? defaultStepRef.current;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -step : step,
        behavior: 'smooth'
      });
    }
  }, [scrollRef, stopScrolling]);

  // Clean up on unmount ONLY to prevent cancellation during parent re-renders
  useEffect(() => {
    return () => {
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
