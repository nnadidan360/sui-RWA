'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Box, Sphere, Torus } from '@react-three/drei';
import { Mesh } from 'three';

function AssetModel({ position, color, shape }: { position: [number, number, number], color: string, shape: 'box' | 'sphere' | 'torus' }) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.2;
      meshRef.current.rotation.y = Math.cos(state.clock.elapsedTime) * 0.2;
    }
  });

  const Component = shape === 'box' ? Box : shape === 'sphere' ? Sphere : Torus;

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <Component ref={meshRef} position={position} args={shape === 'torus' ? [1, 0.4, 8, 16] : [1, 1, 1]}>
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </Component>
    </Float>
  );
}

export function FloatingAssets() {
  const assets = [
    { position: [-4, 2, -2], color: '#3b82f6', shape: 'box' as const }, // House (blue)
    { position: [4, -1, -1], color: '#f59e0b', shape: 'sphere' as const }, // Car (amber)
    { position: [-2, -3, 1], color: '#10b981', shape: 'torus' as const }, // Stocks (emerald)
    { position: [3, 3, -3], color: '#8b5cf6', shape: 'box' as const }, // Crypto (violet)
    { position: [0, -2, -4], color: '#ef4444', shape: 'sphere' as const }, // Commodities (red)
    { position: [-3, 1, 2], color: '#06b6d4', shape: 'torus' as const }, // Bonds (cyan)
  ];

  return (
    <group>
      {assets.map((asset, index) => (
        <AssetModel
          key={index}
          position={asset.position}
          color={asset.color}
          shape={asset.shape}
        />
      ))}
    </group>
  );
}