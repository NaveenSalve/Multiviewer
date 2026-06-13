import { useState, useEffect } from 'react';

export function useMouseParallax() {
  const [mouse, setMouse] = useState({ x: 0, y: 0, nX: 0, nY: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = e.clientX;
      const y = e.clientY;
      // Normalized between -1 and 1
      const nX = (x / innerWidth) * 2 - 1;
      const nY = -(y / innerHeight) * 2 + 1;
      setMouse({ x, y, nX, nY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return mouse;
}
