import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';

interface SwipeViewPagerProps {
  currentIndex: number;
  totalSlides: number;
  onSlideChange: (index: number) => void;
  onScrollProgress?: (progress: number) => void;
  children: React.ReactNode;
  ignoreSelector?: string;
  className?: string;
}

interface DirectTransition {
  fromIndex: number;
  toIndex: number;
  direction: 'forward' | 'backward';
}

export const SwipeViewPager: React.FC<SwipeViewPagerProps> = ({
  currentIndex,
  totalSlides,
  onSlideChange,
  onScrollProgress,
  children,
  ignoreSelector,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean>(false);
  const swipeScrollYRef = useRef<number>(0);
  const [swipeScrollY, setSwipeScrollY] = useState<number>(0);
  const lastSwipedIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [targetIndex, setTargetIndex] = useState<number>(currentIndex);

  // Tracks active index for detecting programmatic jumps
  const activeSlideIndexRef = useRef<number>(currentIndex);
  const [prevPropIndex, setPrevPropIndex] = useState<number>(currentIndex);
  const [directTransition, setDirectTransition] = useState<DirectTransition | null>(null);
  const directTransitionRef = useRef<DirectTransition | null>(null);
  directTransitionRef.current = directTransition;
  const transitionTimerRef = useRef<any>(null);

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      if (typeof document !== 'undefined') {
        document.body.classList.remove('is-swipe-dragging');
      }
    };
  }, []);

  // Synchronous transition detection during render:
  // When currentIndex changes via a tab click (programmatic jump), immediately configure the direct transition
  // in the exact same render pass so the CSS keyframes trigger with zero latency and perfect synchronization!
  if (currentIndex !== prevPropIndex) {
    setPrevPropIndex(currentIndex);
    setTargetIndex(currentIndex);

    if (isMobile) {
      if (lastSwipedIndexRef.current === currentIndex) {
        lastSwipedIndexRef.current = null;
        activeSlideIndexRef.current = currentIndex;
      } else {
        const fromIndex = activeSlideIndexRef.current;
        const toIndex = currentIndex;
        if (fromIndex !== toIndex) {
          activeSlideIndexRef.current = toIndex;
          const direction: 'forward' | 'backward' = toIndex > fromIndex ? 'forward' : 'backward';
          setDirectTransition({
            fromIndex,
            toIndex,
            direction
          });
          setIsAnimating(true);
        }
      }
    } else {
      activeSlideIndexRef.current = currentIndex;
    }
  }

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  // Settle slide change once the new slide has actually been reached by finger swipe
  const settleSlideChange = useCallback((newIndex: number) => {
    if (newIndex === currentIndexRef.current) return;
    if (lastSwipedIndexRef.current === newIndex) return;
    lastSwipedIndexRef.current = newIndex;
    activeSlideIndexRef.current = newIndex;

    const hadScroll = swipeScrollYRef.current > 0;
    swipeScrollYRef.current = 0;
    setSwipeScrollY(0);
    isHorizontalSwipeRef.current = false;

    // Notify slide change FIRST so parent updates tab state before window.scrollTo
    onSlideChange(newIndex);

    if (hadScroll && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [onSlideChange]);

  const cancelSwipeScroll = useCallback(() => {
    if (swipeScrollYRef.current > 0 || isHorizontalSwipeRef.current) {
      swipeScrollYRef.current = 0;
      setSwipeScrollY(0);
      isHorizontalSwipeRef.current = false;
    }
  }, []);

  // Handle programmatic tab changes (e.g. clicking a tab in the header)
  // useLayoutEffect runs BEFORE paint so animation starts in the exact same frame as the tab click!
  useLayoutEffect(() => {
    if (!isMobile || !directTransition) return;
    const el = containerRef.current;
    if (!el) return;

    const { toIndex } = directTransition;
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);

    isProgrammaticScrollRef.current = true;
    const width = el.clientWidth;
    if (width > 0) {
      // Pre-position container immediately at target slide offset BEFORE painting.
      // Because incoming slide animates into translateX(0%), when the animation finishes
      // it is already at its exact natural scroll position — eliminating any end-of-transition flicker!
      el.scrollLeft = toIndex * width;
      el.scrollTo({ left: toIndex * width, behavior: 'instant' as any });
    }

    // Settle at toIndex after 240ms (matches .home-tabs-sliding-indicator CSS transition)
    const TRANSITION_DURATION = 240;
    transitionTimerRef.current = setTimeout(() => {
      setDirectTransition(null);
      setIsAnimating(false);
      setTargetIndex(toIndex);

      if (onScrollProgress) {
        onScrollProgress(toIndex);
      }

      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 50);
    }, TRANSITION_DURATION);

    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [directTransition, isMobile, onScrollProgress]);

  // Initial scroll position on mount or resize
  useEffect(() => {
    if (!isMobile) return;
    const el = containerRef.current;
    if (!el) return;

    const setPosition = () => {
      const width = el.clientWidth;
      if (width > 0) {
        el.scrollTo({ left: currentIndexRef.current * width, behavior: 'instant' as any });
        if (onScrollProgress) {
          onScrollProgress(currentIndexRef.current);
        }
      }
    };

    setPosition();
    const raf = requestAnimationFrame(setPosition);
    return () => cancelAnimationFrame(raf);
  }, [isMobile, onScrollProgress]);

  const handleScroll = useCallback(() => {
    if (!isMobile) return;
    const el = containerRef.current;
    if (!el) return;

    const width = el.clientWidth;
    if (width <= 0) return;

    if (isProgrammaticScrollRef.current || directTransitionRef.current) return;

    // When the user starts sliding away from the current tab on mobile,
    // capture the current scroll offset so incoming tabs appear starting from the top
    const isMovingAway = Math.abs(el.scrollLeft - currentIndexRef.current * width) > 4;
    if (isMovingAway && !isHorizontalSwipeRef.current) {
      isHorizontalSwipeRef.current = true;
      const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
      if (currentScrollY > 0) {
        swipeScrollYRef.current = currentScrollY;
        setSwipeScrollY(currentScrollY);
      }
    }

    const currentProgress = el.scrollLeft / width;
    if (onScrollProgress) {
      onScrollProgress(currentProgress);
    }

    setIsScrolling(true);

    const nearest = Math.round(currentProgress);
    if (nearest >= 0 && nearest < totalSlides) {
      setTargetIndex(nearest);
      // Only notify parent when slide has fully settled and user is not actively dragging
      if (!isDraggingRef.current && Math.abs(el.scrollLeft - nearest * width) <= 5) {
        if (nearest !== currentIndexRef.current) {
          settleSlideChange(nearest);
        } else {
          cancelSwipeScroll();
        }
      }
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
      if (!containerRef.current) return;
      if (isProgrammaticScrollRef.current || directTransitionRef.current) return;
      if (isDraggingRef.current) return;

      const finalWidth = containerRef.current.clientWidth;
      if (finalWidth <= 0) return;

      const finalNearest = Math.round(containerRef.current.scrollLeft / finalWidth);
      if (finalNearest >= 0 && finalNearest < totalSlides) {
        setTargetIndex(finalNearest);
        if (finalNearest !== currentIndexRef.current) {
          settleSlideChange(finalNearest);
        } else {
          cancelSwipeScroll();
        }
      }
    }, 120);
  }, [isMobile, totalSlides, onScrollProgress, settleSlideChange, cancelSwipeScroll]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // If a direct transition is currently animating, finish it immediately so the user can interact
    if (directTransitionRef.current) {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      const target = directTransitionRef.current.toIndex;
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        if (width > 0) {
          containerRef.current.scrollTo({ left: target * width, behavior: 'instant' as any });
        }
      }
      setDirectTransition(null);
      setIsAnimating(false);
      isProgrammaticScrollRef.current = false;
    }

    isDraggingRef.current = true;
    setIsDragging(true);
    isHorizontalSwipeRef.current = false;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;

    if (ignoreSelector && containerRef.current) {
      const target = e.target as HTMLElement;
      if (target && target.closest(ignoreSelector)) {
        containerRef.current.style.overflowX = 'hidden';
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isHorizontalSwipeRef.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartXRef.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartYRef.current);
    if (dx > 6 && dx > dy) {
      isHorizontalSwipeRef.current = true;
      if (typeof document !== 'undefined') {
        document.body.classList.add('is-swipe-dragging');
      }
      const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
      if (currentScrollY > 0) {
        swipeScrollYRef.current = currentScrollY;
        setSwipeScrollY(currentScrollY);
      }
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('is-swipe-dragging');
    }
    if (containerRef.current) {
      containerRef.current.style.overflowX = 'auto';
      const width = containerRef.current.clientWidth;
      if (width > 0) {
        const nearest = Math.round(containerRef.current.scrollLeft / width);
        if (nearest >= 0 && nearest < totalSlides) {
          setTargetIndex(nearest);
          if (Math.abs(containerRef.current.scrollLeft - nearest * width) <= 5) {
            if (nearest !== currentIndexRef.current) {
              settleSlideChange(nearest);
            } else {
              cancelSwipeScroll();
            }
          }
        }
      }
    }
  };

  if (!isMobile) {
    const childArray = React.Children.toArray(children);
    return <div className={className}>{childArray[currentIndex] || null}</div>;
  }

  const childArray = React.Children.toArray(children);

  return (
    <div
      ref={containerRef}
      className={`swipe-pager-container ${directTransition ? 'is-direct-transitioning' : ''} ${className}`}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {childArray.map((child, idx) => {
        // Direct transition when jumping between tabs via click
        if (directTransition) {
          const { fromIndex, toIndex, direction } = directTransition;
          const isFrom = idx === fromIndex;
          const isTo = idx === toIndex;

          if (!isFrom && !isTo) {
            return (
              <div
                key={idx}
                className="swipe-pager-slide is-hidden-slide"
                style={{
                  visibility: 'hidden',
                  opacity: 0,
                  pointerEvents: 'none',
                  height: 0,
                  overflow: 'hidden'
                }}
              >
                {child}
              </div>
            );
          }

          if (isFrom) {
            const fromStart = (toIndex - fromIndex) * 100;
            const fromTarget = direction === 'forward' ? fromStart - 100 : fromStart + 100;

            return (
              <div
                key={idx}
                className="swipe-pager-slide is-transitioning slide-out-custom"
                style={{
                  height: 'auto',
                  minHeight: 'calc(100dvh - 160px)',
                  overflow: 'visible',
                  visibility: 'visible',
                  zIndex: 1,
                  ['--slide-from-start' as any]: `${fromStart}%`,
                  ['--slide-from-target' as any]: `${fromTarget}%`
                }}
              >
                {child}
              </div>
            );
          }

          // isTo
          const toStart = direction === 'forward' ? 100 : -100;

          return (
            <div
              key={idx}
              className="swipe-pager-slide is-transitioning slide-in-target"
              style={{
                height: 'auto',
                minHeight: 'calc(100dvh - 160px)',
                overflow: 'visible',
                visibility: 'visible',
                zIndex: 2,
                ['--slide-to-start' as any]: `${toStart}%`
              }}
            >
              {child}
            </div>
          );
        }

        // Normal continuous mode (swiping or idle)
        const isCurrent = idx === currentIndex;
        const isTarget = idx === targetIndex;
        const isNear = Math.abs(idx - currentIndex) <= 1 || Math.abs(idx - targetIndex) <= 1;
        const shouldBeFullHeight = isCurrent || isTarget || isAnimating || ((isDragging || isScrolling || swipeScrollY > 0) && isNear);

        return (
          <div
            key={idx}
            className="swipe-pager-slide"
            style={{
              height: shouldBeFullHeight ? 'auto' : 0,
              minHeight: shouldBeFullHeight ? 'calc(100dvh - 160px)' : 0,
              overflow: shouldBeFullHeight ? 'visible' : 'hidden',
              visibility: shouldBeFullHeight ? 'visible' : 'hidden',
              transform: idx !== currentIndex && swipeScrollY > 0 ? `translateY(${swipeScrollY}px)` : undefined
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
};
