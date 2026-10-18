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
  const hasResetScrollForSwipeRef = useRef<boolean>(false);
  const lastSwipedIndexRef = useRef<number | null>(null);
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
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  // Keep targetIndex in sync when currentIndex prop updates
  useEffect(() => {
    setTargetIndex(currentIndex);
  }, [currentIndex]);

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
      el.scrollTo({ left: targetLeft, behavior: 'smooth' });

      if (programmaticTimeoutRef.current) clearTimeout(programmaticTimeoutRef.current);
      programmaticTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        setIsAnimating(false);
      }, 380);
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

    // When the user or animation starts sliding away from the current tab on mobile,
    // ensure each tab starts from the top by resetting window scroll position immediately
    const isMovingAway = Math.abs(el.scrollLeft - currentIndexRef.current * width) > 4;
    if (isMovingAway && !hasResetScrollForSwipeRef.current) {
      hasResetScrollForSwipeRef.current = true;
      if (typeof window !== 'undefined' && window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }

    const currentProgress = el.scrollLeft / width;
    if (onScrollProgress) {
      onScrollProgress(currentProgress);
    }

    if (isProgrammaticScrollRef.current) return;

    setIsScrolling(true);

    const nearest = Math.round(currentProgress);
    if (nearest >= 0 && nearest < totalSlides) {
      setTargetIndex(nearest);
      // If the scroll has snapped very close to a slide, notify parent early so indicators update in sync
      if (Math.abs(el.scrollLeft - nearest * width) <= 15) {
        if (nearest !== currentIndexRef.current) {
          lastSwipedIndexRef.current = nearest;
          onSlideChange(nearest);
        }
      }
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
      if (!containerRef.current) return;
      if (isProgrammaticScrollRef.current) return;

      const finalWidth = containerRef.current.clientWidth;
      if (finalWidth <= 0) return;

      const finalNearest = Math.round(containerRef.current.scrollLeft / finalWidth);
      if (finalNearest >= 0 && finalNearest < totalSlides) {
        setTargetIndex(finalNearest);
        if (finalNearest !== currentIndexRef.current) {
          lastSwipedIndexRef.current = finalNearest;
          onSlideChange(finalNearest);
        }
      }
    }, 120);
  }, [isMobile, totalSlides, onSlideChange, onScrollProgress]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    hasResetScrollForSwipeRef.current = false;
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
    if (hasResetScrollForSwipeRef.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartXRef.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartYRef.current);
    if (dx > 6 && dx > dy) {
      hasResetScrollForSwipeRef.current = true;
      if (typeof window !== 'undefined' && window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    hasResetScrollForSwipeRef.current = false;
    if (containerRef.current) {
      containerRef.current.style.overflowX = 'auto';
      const width = containerRef.current.clientWidth;
      if (width > 0) {
        const nearest = Math.round(containerRef.current.scrollLeft / width);
        if (nearest >= 0 && nearest < totalSlides) {
          setTargetIndex(nearest);
          if (nearest !== currentIndexRef.current) {
            lastSwipedIndexRef.current = nearest;
            onSlideChange(nearest);
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
        const shouldBeFullHeight = isCurrent || isTarget || isAnimating || ((isDragging || isScrolling) && isNear);

        return (
          <div
            key={idx}
            className="swipe-pager-slide"
            style={{
              height: shouldBeFullHeight ? 'auto' : 0,
              minHeight: shouldBeFullHeight ? 'calc(100dvh - 160px)' : 0,
              overflow: shouldBeFullHeight ? 'visible' : 'hidden',
              visibility: shouldBeFullHeight ? 'visible' : 'hidden'
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
};
