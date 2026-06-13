import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';

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

function AnimatedBars() {
  const { resourceAiActive } = useAppStore();
  
  // 8 bars
  const barsRef = useRef<THREE.Mesh[]>([]);
  const plateRef = useRef<THREE.Mesh>(null!);

  const visible = useIsVisible();

  useFrame(({ clock }) => {
    if (!visible) return;
    const t = clock.getElapsedTime();
    barsRef.current.forEach((mesh, idx) => {
      if (!mesh) return;
      // If AI active: smooth, smart, efficient low heights. If inactive: spiky, high RAM usage
      const baseHeight = resourceAiActive ? 0.8 + Math.sin(t * 2 + idx) * 0.3 : 2.5 + Math.sin(t * 5 + idx) * 1.2;
      const targetHeight = Math.max(0.2, baseHeight);

      mesh.scale.y += (targetHeight - mesh.scale.y) * 0.1;
      // Reposition so it grows upward from base
      mesh.position.y = mesh.scale.y / 2 - 1.5;
      
      // Update color intensity based on load
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = resourceAiActive ? 0.5 : 1.0;
    });
  });

  useEffect(() => {
    return () => {
      barsRef.current.forEach(mesh => {
        if (mesh) {
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
      if (plateRef.current) {
        plateRef.current.geometry?.dispose();
        if (Array.isArray(plateRef.current.material)) {
          plateRef.current.material.forEach(m => m.dispose());
        } else {
          plateRef.current.material?.dispose();
        }
      }
    };
  }, []);

  const barConfigs = [
    { x: -2.8, color: '#7B5CFA' },
    { x: -2.0, color: '#00D4FF' },
    { x: -1.2, color: '#10B981' },
    { x: -0.4, color: '#7B5CFA' },
    { x: 0.4, color: '#F59E0B' },
    { x: 1.2, color: '#00D4FF' },
    { x: 2.0, color: '#EC4899' },
    { x: 2.8, color: '#6366F1' },
  ];

  return (
    <group>
      {/* Base Grid Plate */}
      <mesh ref={plateRef} position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7, 2]} />
        <meshStandardMaterial color="#161920" roughness={0.6} />
      </mesh>

      {barConfigs.map((cfg, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) barsRef.current[i] = el;
          }}
          position={[cfg.x, 0, 0]}
        >
          <boxGeometry args={[0.5, 1, 0.5]} />
          <meshStandardMaterial
            color={resourceAiActive ? cfg.color : "#EF4444"}
            emissive={resourceAiActive ? cfg.color : "#EF4444"}
            emissiveIntensity={0.6}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

export function ResourceGraphScene3D() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <Canvas
        camera={{ position: [0, 2, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 4, 4]} color="#ffffff" intensity={2} />
        <pointLight position={[-3, 1, 2]} color="#7B5CFA" intensity={1.5} />
        <pointLight position={[3, 1, 2]} color="#00D4FF" intensity={1.5} />

        <AnimatedBars />
      </Canvas>
    </div>
  );
}

// Highly responsive interactive HTML/CSS live fluctuating bar chart fallback
export function ResourceGraphFallback() {
  const { resourceAiActive } = useAppStore();

  const bars = [
    { name: 'Stream Engine 1', aiHeight: 'h-24', noAiHeight: 'h-64', color: 'from-[#7B5CFA] to-[#00D4FF]' },
    { name: 'Video Cache', aiHeight: 'h-16', noAiHeight: 'h-52', color: 'from-[#00D4FF] to-[#10B981]' },
    { name: 'Neural Proxy', aiHeight: 'h-28', noAiHeight: 'h-72', color: 'from-[#10B981] to-[#F59E0B]' },
    { name: 'DOM Isolation', aiHeight: 'h-20', noAiHeight: 'h-60', color: 'from-[#F59E0B] to-[#EC4899]' },
    { name: 'Audio Matrix', aiHeight: 'h-12', noAiHeight: 'h-48', color: 'from-[#EC4899] to-[#7B5CFA]' },
    { name: 'AI Dispatcher', aiHeight: 'h-32', noAiHeight: 'h-80', color: 'from-[#6366F1] to-[#00D4FF]' },
  ];

  return (
    <div className="relative w-full max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-end justify-between gap-2 sm:gap-4 h-80 bg-[#0E1014]/80 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
        {bars.map((bar, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
            <div className="text-[10px] font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap -rotate-45 sm:rotate-0">
              {resourceAiActive ? '120MB' : '850MB'}
            </div>
            <div
              className={`w-full max-w-[40px] rounded-t-lg bg-gradient-to-t ${resourceAiActive ? bar.color : 'from-red-600 to-amber-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]'} transition-all duration-700 ${resourceAiActive ? bar.aiHeight : bar.noAiHeight}`}
            />
            <div className="text-[9px] sm:text-[11px] font-mono text-gray-400 truncate max-w-full">
              {`E0${idx+1}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
