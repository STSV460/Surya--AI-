"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

const PARTICLE_COUNT = 2000;
const LINE_COLOR = "#4FC3F7";
const PARTICLE_COLOR = "#1A73E8";
const CONNECT_DISTANCE = 2.5;
const MAX_LINES = 3000;

function seededUnit(index: number) {
  const x = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function ParticleField() {
  const groupRef = useRef<THREE.Group>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT * 3; i += 3) {
      arr[i]     = (seededUnit(i) - 0.5) * 24;  // x
      arr[i + 1] = (seededUnit(i + 1) - 0.5) * 24;  // y
      arr[i + 2] = (seededUnit(i + 2) - 0.5) * 10;  // z
    }
    return arr;
  }, []);

  // Build connecting lines via spatial bucketing
  const linePositions = useMemo(() => {
    const cellSize = CONNECT_DISTANCE;
    const buckets = new Map<string, number[]>();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const key = `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(i);
    }

    const lineVerts: number[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < PARTICLE_COUNT && lineVerts.length / 6 < MAX_LINES; i++) {
      const ax = positions[i * 3];
      const ay = positions[i * 3 + 1];
      const az = positions[i * 3 + 2];
      const cx = Math.floor(ax / cellSize);
      const cy = Math.floor(ay / cellSize);
      const cz = Math.floor(az / cellSize);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const neighbors = buckets.get(`${cx+dx},${cy+dy},${cz+dz}`);
            if (!neighbors) continue;
            for (const j of neighbors) {
              if (j <= i) continue;
              const pairKey = `${i}-${j}`;
              if (seen.has(pairKey)) continue;
              seen.add(pairKey);

              const bx = positions[j * 3];
              const by = positions[j * 3 + 1];
              const bz = positions[j * 3 + 2];
              const dist = Math.sqrt((ax-bx)**2 + (ay-by)**2 + (az-bz)**2);
              if (dist < CONNECT_DISTANCE) {
                lineVerts.push(ax, ay, az, bx, by, bz);
                if (lineVerts.length / 6 >= MAX_LINES) break;
              }
            }
            if (lineVerts.length / 6 >= MAX_LINES) break;
          }
          if (lineVerts.length / 6 >= MAX_LINES) break;
        }
        if (lineVerts.length / 6 >= MAX_LINES) break;
      }
    }

    return new Float32Array(lineVerts);
  }, [positions]);

  useFrame(({ clock, mouse }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = mouse.x * 0.08 + clock.elapsedTime * 0.06;
    groupRef.current.rotation.x = mouse.y * 0.08;
  });

  return (
    <group ref={groupRef}>
      {/* Particles */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={PARTICLE_COLOR}
          size={0.06}
          transparent
          opacity={0.6}
          sizeAttenuation
        />
      </points>

      {/* Connecting lines */}
      {linePositions.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[linePositions, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color={LINE_COLOR} transparent opacity={0.08} />
        </lineSegments>
      )}
    </group>
  );
}

export function BackgroundScene() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <Canvas
        camera={{ position: [0, 0, 15], fov: 70 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <ParticleField />
        <EffectComposer>
          <Bloom luminanceThreshold={0.2} intensity={0.8} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
