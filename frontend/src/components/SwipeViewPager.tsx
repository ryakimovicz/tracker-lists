import React, { useRef, useEffect, useState, useCallback } from 'react';

interface SwipeViewPagerProps {
  currentIndex: number;
  totalSlides: number;
  onSlideChange: (index: number) => void;
  onScrollProgress?: (progress: number) => void;
  children: React.ReactNode;
  ignoreSelector?: string;
  className?: string;
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
  const programmaticTimeoutRef = useRef<any>(null);
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

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  // Keep targetIndex in sync when currentIndex prop updates
  useEffect(() => {
    setTargetIndex(currentIndex);
  }, [currentIndex]);

  // Settle slide change once the new slide has actually been reached
  const settleSlideChange = useCallback((newIndex: number) => {
    if (newIndex === currentIndexRef.current) return;
    if (lastSwipedIndexRef.current === newIndex) return;
    lastSwipedIndexRef.current = newIndex;

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

  // Sync scrollLeft when currentIndex prop changes programmatically
  useEffect(() => {
    if (!isMobile) return;
    const el = containerRef.current;
    if (!el) return;

    // If this currentIndex update was caused by the user swiping natively,
    // do not trigger a conflicting scrollTo!
    if (lastSwipedIndexRef.current === currentIndex) {
      lastSwipedIndexRef.current = null;
      return;
    }

    const width = el.clientWidth;
    if (width <= 0) return;

    const targetLeft = currentIndex * width;
    if (Math.abs(el.scrollLeft - targetLeft) > 5) {
      isProgrammaticScrollRef.current = true;
      setIsAnimating(true);
      el.style.scrollSnapType = 'none';
      el.scrollTo({ left: targetLeft, behavior: 'smooth' });

      if (programmaticTimeoutRef.current) clearTimeout(programmaticTimeoutRef.current);
      programmaticTimeoutRef.current = setTimeout(() => {
        if (el) el.style.scrollSnapType = 'x mandatory';
        isProgrammaticScrollRef.current = false;
        setIsAnimating(false);
      }, 350);
    }
  }, [currentIndex, isMobile]);

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

    if (isProgrammaticScrollRef.current) return;

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
      if (isProgrammaticScrollRef.current) return;
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
      className={`swipe-pager-container ${className}`}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {childArray.map((child, idx) => {
        const isCurrent = idx === currentIndex;
        const isTarget = idx === targetIndex;
        const isNear = Math.abs(idx - currentIndex) <= 1 || Math.abs(idx - targetIndex) <= 1;
        // While dragging, scrolling or animating, the current slide, target slide, and immediate neighbors are fully expanded
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
