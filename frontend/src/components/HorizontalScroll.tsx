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
        <div style={{ paddingLeft: "60px", paddingRight: "60px", marginBottom: "1.25rem" }}>
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: "0.5rem", paddingBottom: "0.4rem" }}>
            <h3 style={{ 
              fontSize: "1.25rem", 
              fontWeight: 700, 
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
              margin: 0
            }}>
              {title}
            </h3>
          </div>
          <div style={{ 
            width: "100%", 
            height: "2px", 
            background: outlineColor 
              ? `linear-gradient(90deg, ${outlineColor} 0%, ${outlineColor}88 35%, transparent 100%)` 
              : "linear-gradient(90deg, var(--border-color) 0%, transparent 100%)",
            borderRadius: "2px",
            marginTop: "0.25rem"
          }} />
        </div>
      )}
      
      <button 
        onClick={() => scroll("left")}
        style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", zIndex: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}
      >
        <ChevronLeft size={20} color="var(--text-primary)" />
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
        style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", zIndex: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}
      >
        <ChevronRight size={20} color="var(--text-primary)" />
      </button>
    </div>
  );
};
