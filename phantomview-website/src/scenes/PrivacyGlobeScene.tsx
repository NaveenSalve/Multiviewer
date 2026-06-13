import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function GlobeWireframe() {
  const globeRef = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.15;
      globeRef.current.rotation.x += delta * 0.05;
    }
  });

  return (
    <mesh ref={globeRef}>
      <icosahedronGeometry args={[1.5, 3]} />
      <meshBasicMaterial
        color="#00D4FF"
        wireframe
        transparent
        opacity={0.35}
      />
    </mesh>
  );
}

// Inner Core
function InnerCore() {
  return (
    <mesh>
      <sphereGeometry args={[1.2, 32, 32]} />
      <meshStandardMaterial
        color="#0E1014"
        emissive="#00D4FF"
        emissiveIntensity={0.2}
        roughness={0.8}
      />
    </mesh>
  );
}

// Violet Shield Deflecting Beams
function DeflectionShield() {
  const shieldRef = useRef<THREE.Mesh>(null!);
  const [hit, setHit] = useState(false);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (shieldRef.current) {
      // Shield pulsing
      const scale = 1.65 + Math.sin(t * 3) * 0.05;
      shieldRef.current.scale.set(scale, scale, scale);
    }
  });

  // Periodically trigger deflection flash
  React.useEffect(() => {
    const interval = setInterval(() => {
      setHit(true);
      setTimeout(() => setHit(false), 300);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <mesh ref={shieldRef}>
      <sphereGeometry args={[1, 32, 16]} />
      <meshBasicMaterial
        color={hit ? "#F59E0B" : "#7B5CFA"}
        wireframe
        transparent
        opacity={hit ? 0.8 : 0.25}
      />
    </mesh>
  );
}

// Incoming Beams / Rays
function DeflectingBeams() {
  const beamsGroupRef = useRef<THREE.Group>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 2;
    if (beamsGroupRef.current) {
      beamsGroupRef.current.rotation.z = t * 0.1;
    }
  });

  // 12 Beams
  const beams = Array.from({ length: 12 }).map((_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    return { angle, speed: 1 + (i % 3) * 0.5 };
  });

  return (
    <group ref={beamsGroupRef}>
      {beams.map((b, idx) => (
        <BeamMesh key={idx} angle={b.angle} speed={b.speed} />
      ))}
    </group>
  );
}

function BeamMesh({ angle, speed }: { angle: number; speed: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() * speed) % 2;
    if (meshRef.current) {
      // Animate beam in and bounce out
      const dist = 4 - t * 2.5; 
      meshRef.current.position.x = Math.cos(angle) * dist;
      meshRef.current.position.y = Math.sin(angle) * dist;
      meshRef.current.rotation.z = angle;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.5, 0.04, 0.04]} />
      <meshBasicMaterial color="#EC4899" transparent opacity={0.8} />
    </mesh>
  );
}

export function PrivacyGlobeScene3D() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.2} />
        <pointLight position={[2, 2, 3]} color="#7B5CFA" intensity={2} />
        <pointLight position={[-2, -2, 3]} color="#00D4FF" intensity={2} />

        <GlobeWireframe />
        <InnerCore />
        <DeflectionShield />
        <DeflectingBeams />
      </Canvas>
    </div>
  );
}

// Interactive High-Fidelity SVG Shield Fallback
export function PrivacyGlobeFallback() {
  return (
    <div className="relative w-72 h-72 mx-auto flex items-center justify-center my-8">
      {/* Outer Pulse Rings */}
      <div className="absolute inset-0 border border-[#7B5CFA]/30 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
      <div className="absolute inset-4 border border-[#00D4FF]/20 rounded-full animate-pulse" />
      
      {/* Shield Deflection Graphic */}
      <svg className="w-full h-full text-[#00D4FF]" viewBox="0 0 400 400">
        <defs>
          <radialGradient id="shieldGrad" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#7B5CFA" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00D4FF" stopOpacity="0.8" />
          </radialGradient>
        </defs>
        
        {/* Globe Grid Circles */}
        <circle cx="200" cy="200" r="120" fill="none" stroke="#00D4FF" strokeWidth="1.5" strokeDasharray="6 6" opacity="0.4" className="animate-[spin_20s_linear_infinite]" />
        <ellipse cx="200" cy="200" rx="120" ry="50" fill="none" stroke="#00D4FF" strokeWidth="1" opacity="0.3" className="animate-[spin_15s_linear_infinite]" />
        <ellipse cx="200" cy="200" rx="50" ry="120" fill="none" stroke="#00D4FF" strokeWidth="1" opacity="0.3" className="animate-[spin_15s_linear_infinite]" />
        
        {/* Shield Dome */}
        <circle cx="200" cy="200" r="140" fill="url(#shieldGrad)" />
        
        {/* Deflected Light Rays */}
        <g stroke="#EC4899" strokeWidth="3" strokeLinecap="round" className="animate-pulse">
          <line x1="20" y1="80" x2="80" y2="120" />
          <line x1="380" y1="80" x2="320" y2="120" />
          <line x1="20" y1="320" x2="80" y2="280" />
          <line x1="380" y1="320" x2="320" y2="280" />
        </g>

        {/* Center Privacy Lock Icon */}
        <g transform="translate(170, 165)" fill="#ffffff">
          <rect x="10" y="25" width="40" height="30" rx="6" fill="#7B5CFA" />
          <path d="M20 25V15C20 9.477 24.477 5 30 5S40 9.477 40 15V25" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
          <circle cx="30" cy="40" r="4" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}
