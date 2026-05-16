"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function seededUnit(index: number) {
  const x = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function ChatParticles() {
  const ref = useRef<THREE.Points>(null!);
  const groupRef = useRef<THREE.Group>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(300 * 3);
    for (let i = 0; i < 300 * 3; i++) {
      arr[i] = (seededUnit(i) - 0.5) * 16;
    }
    return arr;
  }, []);

  useFrame(({ clock, mouse }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = clock.elapsedTime * 0.04;
    groupRef.current.position.x = mouse.x * 0.3;
    groupRef.current.position.y = mouse.y * 0.3;
  });

  return (
    <group ref={groupRef}>
      <points ref={ref}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#1A73E8"
          size={0.04}
          transparent
          opacity={0.35}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

export function ChatBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        gl={{ antialias: false, powerPreference: "low-power" }}
        dpr={[1, 1.5]}
      >
        <ChatParticles />
      </Canvas>
    </div>
  );
}
