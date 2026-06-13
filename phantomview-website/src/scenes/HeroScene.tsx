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

// 1000 Stars / Particles
function ParticleField() {
  const ref = useRef<THREE.Points>(null!);
  const [positions] = React.useState(() => {
    const pos = new Float32Array(1000 * 3);
    for (let i = 0; i < 1000; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    return pos;
  });

  const visible = useIsVisible();

  useFrame((_, delta) => {
    if (!visible) return;
    if (ref.current) {
      ref.current.rotation.y += delta * 0.02;
      ref.current.rotation.x += delta * 0.01;
    }
  });

  useEffect(() => {
    return () => {
      if (ref.current) {
        ref.current.geometry?.dispose();
        if (Array.isArray(ref.current.material)) {
          ref.current.material.forEach(m => m.dispose());
        } else {
          ref.current.material?.dispose();
        }
      }
    };
  }, []);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.025}
        color="#00D4FF"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// Center Torus Ring
function GlowingTorus() {
  const torusRef = useRef<THREE.Mesh>(null!);

  const visible = useIsVisible();

  useFrame((_, delta) => {
    if (!visible) return;
    if (torusRef.current) {
      torusRef.current.rotation.y += delta * 0.2;
      torusRef.current.rotation.x += delta * 0.1;
    }
  });

  useEffect(() => {
    return () => {
      if (torusRef.current) {
        torusRef.current.geometry?.dispose();
        if (Array.isArray(torusRef.current.material)) {
          torusRef.current.material.forEach(m => m.dispose());
        } else {
          torusRef.current.material?.dispose();
        }
      }
    };
  }, []);

  return (
    <mesh ref={torusRef}>
      <torusGeometry args={[1.8, 0.06, 16, 100]} />
      <meshStandardMaterial
        color="#7B5CFA"
        emissive="#7B5CFA"
        emissiveIntensity={0.8}
        roughness={0.2}
        metalness={0.8}
      />
    </mesh>
  );
}

// 6 Floating Orbiting Panels representing the 6 Engines
function OrbitingPanels() {
  const groupRef = useRef<THREE.Group>(null!);

  // Colors for the 6 engines
  const engineColors = ['#7B5CFA', '#00D4FF', '#F59E0B', '#10B981', '#EC4899', '#6366F1'];

  const visible = useIsVisible();

  useFrame(({ clock }) => {
    if (!visible) return;
    const t = clock.getElapsedTime() * 0.3;
    if (groupRef.current) {
      groupRef.current.rotation.y = t;
      groupRef.current.position.y = Math.sin(t * 2) * 0.1;
    }
  });

  useEffect(() => {
    return () => {
      if (groupRef.current) {
        groupRef.current.traverse((child) => {
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
    <group ref={groupRef}>
      {engineColors.map((color, index) => {
        const angle = (index / 6) * Math.PI * 2;
        const radius = 2.6;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return (
          <mesh
            key={index}
            position={[x, Math.sin(angle * 3) * 0.4, z]}
            rotation={[0, -angle + Math.PI / 2, 0]}
          >
            <planeGeometry args={[0.7, 0.45]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.6}
              side={THREE.DoubleSide}
              transparent
              opacity={0.85}
              wireframe={index % 2 === 0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// Interactive Parallax Camera Controller
function CameraController() {
  const { camera, mouse } = useThree();

  const visible = useIsVisible();

  useFrame(() => {
    if (!visible) return;
    const targetX = mouse.x * 0.6;
    const targetY = mouse.y * 0.6;
    camera.position.set(
      camera.position.x + (targetX - camera.position.x) * 0.05,
      camera.position.y + (targetY - camera.position.y) * 0.05,
      camera.position.z
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
}

export function HeroScene3D() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.2} />
        <pointLight position={[2, 2, 2]} color="#7B5CFA" intensity={2} />
        <pointLight position={[-2, -1, 3]} color="#00D4FF" intensity={2} />
        <pointLight position={[0, -3, -2]} color="#F59E0B" intensity={1} />

        <ParticleField />
        <GlowingTorus />
        <OrbitingPanels />
        <CameraController />
      </Canvas>
    </div>
  );
}

// Fallback / Standalone CSS animation representation for Hero Scene if WebGL is unavailable or mobile
export function HeroSceneFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0 opacity-40">
      {/* Outer Rotating Cyber Ring */}
      <div className="absolute w-[450px] h-[450px] border border-[#7B5CFA]/30 rounded-full animate-[spin_20s_linear_infinite]" />
      <div className="absolute w-[600px] h-[600px] border border-[#00D4FF]/20 rounded-full animate-[spin_30s_linear_infinite_reverse]" />
      
      {/* Center Glow */}
      <div className="absolute w-72 h-72 bg-gradient-to-tr from-[#7B5CFA]/20 to-[#00D4FF]/20 rounded-full blur-3xl animate-pulse" />
      
      {/* Orbiting Elements */}
      <div className="absolute w-[350px] h-[350px] animate-[spin_12s_linear_infinite]">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-16 h-10 bg-[#7B5CFA]/40 backdrop-blur-md border border-[#7B5CFA] rounded-md" />
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-16 h-10 bg-[#00D4FF]/40 backdrop-blur-md border border-[#00D4FF] rounded-md" />
        <div className="absolute top-1/2 -left-6 -translate-y-1/2 w-16 h-10 bg-[#F59E0B]/40 backdrop-blur-md border border-[#F59E0B] rounded-md" />
        <div className="absolute top-1/2 -right-6 -translate-y-1/2 w-16 h-10 bg-[#10B981]/40 backdrop-blur-md border border-[#10B981] rounded-md" />
      </div>
    </div>
  );
}
