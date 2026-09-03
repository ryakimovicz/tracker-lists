import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalScrollProps {
  children: React.ReactNode;
  title?: string;
  outlineColor?: string;
  className?: string;
}

export const HorizontalScroll: React.FC<HorizontalScrollProps> = ({ children, title, outlineColor, className = "" }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 350;
      scrollRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className={`horizontal-scroll-container ${className}`} style={{ position: "relative", marginBottom: "2rem", width: "100%", maxWidth: "100%", overflow: "hidden" }}>
      {title && (
        <div style={{ display: "flex", paddingLeft: "45px", marginBottom: "1rem" }}>
          <h3 style={{ 
            fontSize: "1.2rem", 
            fontWeight: 600, 
            color: "var(--text-primary)", 
            border: `2px solid ${outlineColor || "var(--border-color)"}`, 
            borderRadius: "8px", 
            padding: "0.2rem 0.75rem", 
            background: "var(--bg-secondary)" 
          }}>
            {title}
          </h3>
        </div>
      )}
      
      {(() => {
        const catColor = outlineColor || "var(--accent-primary)";
        const buttonBaseStyle: React.CSSProperties = {
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
          background: "var(--bg-tertiary)",
          border: "1.5px solid var(--border-color)",
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
          color: "var(--text-primary)",
          transition: "border-color 0.15s ease, background 0.1s ease, color 0.1s ease, transform 0.1s ease"
        };

        const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.borderColor = catColor;
        };
        const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.borderColor = "var(--border-color)";
          e.currentTarget.style.background = "var(--bg-tertiary)";
          e.currentTarget.style.color = "var(--text-primary)";
        };
        const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.background = catColor;
          e.currentTarget.style.borderColor = catColor;
          e.currentTarget.style.color = "var(--bg-primary)";
        };
        const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
          e.currentTarget.style.background = "var(--bg-tertiary)";
          e.currentTarget.style.borderColor = catColor;
          e.currentTarget.style.color = "var(--text-primary)";
        };

        return (
          <>
            <button 
              onClick={() => scroll("left")}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              style={{ ...buttonBaseStyle, left: "10px" }}
              aria-label="Scroll left"
            >
              <ChevronLeft size={20} color="currentColor" />
            </button>
            
            <div 
              ref={scrollRef} 
              style={{ 
                display: "flex", 
                gap: "1.25rem", 
                overflowX: "auto", 
                scrollbarWidth: "none", 
                msOverflowStyle: "none", 
                paddingBottom: "1.5rem", 
                paddingLeft: "60px", 
                paddingRight: "60px" 
              }}
            >
              {children}
            </div>

            <button 
              onClick={() => scroll("right")}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              style={{ ...buttonBaseStyle, right: "10px" }}
              aria-label="Scroll right"
            >
              <ChevronRight size={20} color="currentColor" />
            </button>
          </>
        );
      })()}
    </div>
  );
};
