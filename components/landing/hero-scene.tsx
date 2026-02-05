"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import type { Group } from "three";

function RotatingGroup({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

function FloatingShapes() {
  return (
    <RotatingGroup>
      {/* Centerpiece torus knot */}
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1.2}>
        <mesh position={[0, 0, 0]}>
          <torusKnotGeometry args={[1, 0.35, 128, 16]} />
          <meshStandardMaterial
            color="#4F46E5"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      </Float>

      {/* Smaller shapes scattered around */}
      <Float speed={2} rotationIntensity={0.8} floatIntensity={1.5}>
        <mesh position={[-2.5, 1.2, -1]}>
          <icosahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial
            color="#7C3AED"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      </Float>

      <Float speed={1} rotationIntensity={0.3} floatIntensity={0.8}>
        <mesh position={[2.8, -0.8, -0.5]}>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial
            color="#2563EB"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      </Float>

      <Float speed={2.5} rotationIntensity={0.6} floatIntensity={1}>
        <mesh position={[1.5, 1.8, -1.5]}>
          <icosahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial
            color="#7C3AED"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      </Float>

      <Float speed={1.8} rotationIntensity={0.4} floatIntensity={0.5}>
        <mesh position={[-1.8, -1.5, -0.8]}>
          <octahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial
            color="#4F46E5"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      </Float>
    </RotatingGroup>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.5} />
      <Environment preset="city" />
      <FloatingShapes />
    </Canvas>
  );
}
