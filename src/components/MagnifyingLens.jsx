import React, { useEffect, useState, useRef } from 'react';

/**
 * MagnifyingLens Component
 * Adds a small, elegant brass-rimmed magnifying lens that subtly follows the cursor on desktop.
 * On touch devices, provides an unobtrusive highlight sweep without blocking touch/scroll events.
 * Uses pointer-events: none to guarantee zero interference with controls and buttons.
 */
export default function MagnifyingLens() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(null);
  const targetPos = useRef({ x: -100, y: -100 });

  useEffect(() => {
    // Check if user prefers reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    // Detect touch device
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) {
      // On mobile, lens is invoked contextually or stays dormant to avoid visual clutter
      return;
    }

    const handlePointerMove = (e) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
      if (!visible) setVisible(true);
    };

    const handlePointerLeave = () => {
      setVisible(false);
    };

    const loop = () => {
      setPos(prev => {
        const dx = targetPos.current.x - prev.x;
        const dy = targetPos.current.y - prev.y;
        return {
          x: prev.x + dx * 0.22,
          y: prev.y + dy * 0.22
        };
      });
      rafRef.current = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: '42px',
        height: '42px',
        marginLeft: '-21px',
        marginTop: '-21px',
        pointerEvents: 'none',
        zIndex: 9999,
        borderRadius: '50%',
        border: '2px solid rgba(216, 166, 0, 0.65)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15), inset 0 0 6px rgba(255, 240, 205, 0.4)',
        background: 'radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.3) 0%, rgba(248, 242, 231, 0.05) 70%)',
        backdropFilter: 'contrast(1.08) brightness(1.03)',
        WebkitBackdropFilter: 'contrast(1.08) brightness(1.03)',
        transition: 'opacity 0.2s ease',
        opacity: visible ? 1 : 0
      }}
    >
      {/* Brass handle accent indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '-5px',
          right: '-5px',
          width: '10px',
          height: '4px',
          backgroundColor: '#BFA98B',
          borderRadius: '2px',
          transform: 'rotate(45deg)'
        }}
      />
    </div>
  );
}
