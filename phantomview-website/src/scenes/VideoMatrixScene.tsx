import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

function useIsVisible() {
  const { gl } = useThree();
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const el = gl.domElement;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [gl.domElement]);

  return visible;
}

interface MonitorProps {
  position: [number, number, number];
  color: string;
  delay: number;
}

function MonitorMesh({ position, color, delay }: MonitorProps) {
  const meshRef = useRef<THREE.Group>(null!);
  const screenRef = useRef<THREE.Mesh>(null!);

  const visible = useIsVisible();

  useFrame(({ clock }) => {
    if (!visible) return;
    const t = clock.getElapsedTime() + delay;
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.1;
      meshRef.current.rotation.y = Math.sin(t * 0.8) * 0.08;
    }
    if (screenRef.current) {
      // Simulate screen flickering/shimmering
      const intensity = 0.6 + Math.sin(t * 5) * 0.2;
      (screenRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
    }
  });

  useEffect(() => {
    return () => {
      if (meshRef.current) {
        meshRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
      }
    };
  }, []);

  return (
    <group ref={meshRef} position={position}>
      {/* Outer Monitor Frame */}
      <mesh>
        <boxGeometry args={[1.6, 1.0, 0.08]} />
        <meshStandardMaterial color="#161920" roughness={0.5} metalness={0.8} />
      </mesh>
      
      {/* Emissive Screen Surface */}
      <mesh ref={screenRef} position={[0, 0, 0.045]}>
        <planeGeometry args={[1.5, 0.9]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.7}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

function MonitorArray() {
  const monitors: { pos: [number, number, number]; color: string }[] = [
    { pos: [-1.8, 1.1, -1], color: '#7B5CFA' },
    { pos: [0, 1.1, -0.5], color: '#00D4FF' },
    { pos: [1.8, 1.1, -1], color: '#F59E0B' },

    { pos: [-1.8, 0, -0.5], color: '#10B981' },
    { pos: [0, 0, 0], color: '#7B5CFA' }, // Center active
    { pos: [1.8, 0, -0.5], color: '#EC4899' },

    { pos: [-1.8, -1.1, -1], color: '#6366F1' },
    { pos: [0, -1.1, -0.5], color: '#00D4FF' },
    { pos: [1.8, -1.1, -1], color: '#8B5CF6' },
  ];

  return (
    <group>
      {monitors.map((m, idx) => (
        <MonitorMesh key={idx} position={m.pos} color={m.color} delay={idx * 0.2} />
      ))}
    </group>
  );
}

export function VideoMatrixScene3D() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 0, 5]} color="#ffffff" intensity={1.5} />
        <pointLight position={[-3, 2, 2]} color="#7B5CFA" intensity={2} />
        <pointLight position={[3, -2, 2]} color="#00D4FF" intensity={2} />

        <MonitorArray />
      </Canvas>
    </div>
  );
}

// Ultra-premium interactive HTML/CSS perspective 3D grid fallback
export function VideoMatrixFallback() {
  const screens = [
    { title: 'YouTube 4K', channel: 'Cinematic Sound', color: 'from-[#7B5CFA]/20 to-[#7B5CFA]/40', border: 'border-[#7B5CFA]/40' },
    { title: 'Twitch Live', channel: 'Esports Arena', color: 'from-[#00D4FF]/20 to-[#00D4FF]/40', border: 'border-[#00D4FF]/40' },
    { title: 'TradingView', channel: 'BTC/USD Chart', color: 'from-[#F59E0B]/20 to-[#F59E0B]/40', border: 'border-[#F59E0B]/40' },
    { title: 'Bloomberg Live', channel: 'Markets Desk', color: 'from-[#10B981]/20 to-[#10B981]/40', border: 'border-[#10B981]/40' },
    { title: 'Resource AI', channel: 'System Stats', color: 'from-[#7B5CFA]/40 to-[#00D4FF]/40', border: 'border-[#7B5CFA] shadow-[0_0_20px_rgba(123,92,250,0.3)]' },
    { title: 'LinkedIn Feed', channel: 'Tech News', color: 'from-[#EC4899]/20 to-[#EC4899]/40', border: 'border-[#EC4899]/40' },
    { title: 'Discord Voice', channel: 'Dark Ops Team', color: 'from-[#6366F1]/20 to-[#6366F1]/40', border: 'border-[#6366F1]/40' },
    { title: 'Terminal', channel: 'Node.js Shell', color: 'from-[#00D4FF]/20 to-[#00D4FF]/40', border: 'border-[#00D4FF]/40' },
    { title: 'Logs Stream', channel: 'Security Proxy', color: 'from-[#8B5CF6]/20 to-[#8B5CF6]/40', border: 'border-[#8B5CF6]/40' },
  ];

  return (
    <div className="relative w-full max-w-5xl mx-auto py-12 px-4">
      <div className="grid grid-cols-3 gap-4 md:gap-6 transform-gpu perspective-1000 rotate-x-[10deg]">
        {screens.map((screen, idx) => (
          <div
            key={idx}
            className={`aspect-video rounded-xl bg-gradient-to-br ${screen.color} ${screen.border} border border-solid p-3 flex flex-col justify-between backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-white hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]`}
          >
            <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono text-gray-300">
              <span className="truncate">{screen.title}</span>
              <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-ping" />
            </div>
            <div className="text-left">
              <div className="w-3/4 h-1.5 bg-white/20 rounded mb-1 animate-pulse" />
              <div className="w-1/2 h-1.5 bg-white/10 rounded" />
            </div>
            <div className="text-[9px] sm:text-[11px] font-mono text-[#00D4FF] bg-black/40 px-2 py-0.5 rounded self-start truncate max-w-full">
              {screen.channel}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
