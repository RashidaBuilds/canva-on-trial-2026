import React, { useEffect, useState, useRef } from 'react';

/**
 * MagnifyingLens Component
 * Adds an elegant brass-rimmed magnifying lens.
 * - Desktop: Smoothly follows cursor via pointer movements across screens.
 * - Mobile Touch: Active ONLY when enableMobileTouch is true (Login page).
 *   Follows the finger smoothly on touch, hides immediately on finger release or cancel.
 *   Strictly protects the nickname input field: never triggers inside or near the input.
 *   Uses pointer-events: none and passive touch listeners to never block scrolling, taps, or virtual keyboard.
 */
export default function MagnifyingLens({ enableMobileTouch = false }) {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(null);
  const targetPos = useRef({ x: -100, y: -100 });
  const isTouchActiveRef = useRef(false);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    // Check if user prefers reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    // Helper: detect if target is or is within the nickname input
    const isInputElement = (target) => {
      if (!target || !(target instanceof Element)) return false;
      return (
        target.id === 'nickname-input' ||
        !!target.closest('#nickname-input, input, textarea, label[for="nickname-input"]')
      );
    };

    // Helper: check if coordinates overlap or are adjacent to nickname input
    const isNearInputElement = (clientX, clientY) => {
      const inputEl = document.getElementById('nickname-input');
      if (!inputEl) return false;
      const rect = inputEl.getBoundingClientRect();
      const pad = 24; // safety margin around input
      return (
        clientX >= rect.left - pad &&
        clientX <= rect.right + pad &&
        clientY >= rect.top - pad &&
        clientY <= rect.bottom + pad
      );
    };

    const showLens = (x, y) => {
      targetPos.current = { x, y };
      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        setVisible(true);
      }
    };

    const hideLens = () => {
      if (isVisibleRef.current) {
        isVisibleRef.current = false;
        setVisible(false);
      }
    };

    // 1. DESKTOP MOUSE / POINTER LOGIC (Preserved across all screens)
    const handlePointerMove = (e) => {
      // Ignore touch pointers here; touch is handled separately when enableMobileTouch is true
      if (e.pointerType === 'touch') return;

      showLens(e.clientX, e.clientY);
    };

    const handlePointerLeave = () => {
      if (!isTouchActiveRef.current) {
        hideLens();
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);

    // 2. MOBILE TOUCH LOGIC (Only active when enableMobileTouch === true, e.g. Login Page)
    let handleTouchStart = null;
    let handleTouchMove = null;
    let handleTouchEnd = null;

    if (enableMobileTouch) {
      handleTouchStart = (e) => {
        if (!e.touches || e.touches.length === 0) return;
        const touch = e.touches[0];

        // Never trigger when user touches or types inside nickname input
        if (isInputElement(e.target) || isNearInputElement(touch.clientX, touch.clientY)) {
          isTouchActiveRef.current = false;
          hideLens();
          return;
        }

        isTouchActiveRef.current = true;
        // Position immediately at touch point to prevent jump
        targetPos.current = { x: touch.clientX, y: touch.clientY };
        setPos({ x: touch.clientX, y: touch.clientY });
        if (!isVisibleRef.current) {
          isVisibleRef.current = true;
          setVisible(true);
        }
      };

      handleTouchMove = (e) => {
        if (!isTouchActiveRef.current || !e.touches || e.touches.length === 0) return;
        const touch = e.touches[0];

        // If finger enters proximity of nickname input, hide lens to avoid obstructing it
        if (isNearInputElement(touch.clientX, touch.clientY)) {
          hideLens();
          return;
        }

        showLens(touch.clientX, touch.clientY);
      };

      handleTouchEnd = () => {
        isTouchActiveRef.current = false;
        hideLens();
      };

      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
      window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    }

    // 3. SMOOTH ANIMATION LOOP (rAF lerp for fluid physical motion)
    const loop = () => {
      setPos((prev) => {
        const dx = targetPos.current.x - prev.x;
        const dy = targetPos.current.y - prev.y;
        return {
          x: prev.x + dx * 0.22,
          y: prev.y + dy * 0.22
        };
      });
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
      if (enableMobileTouch) {
        if (handleTouchStart) window.removeEventListener('touchstart', handleTouchStart);
        if (handleTouchMove) window.removeEventListener('touchmove', handleTouchMove);
        if (handleTouchEnd) {
          window.removeEventListener('touchend', handleTouchEnd);
          window.removeEventListener('touchcancel', handleTouchEnd);
        }
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enableMobileTouch]);

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
