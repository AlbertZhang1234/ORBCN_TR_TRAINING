'use client'

import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface GalaxyProps {
  mouseRepulsion?: boolean
  mouseInteraction?: boolean
  density?: number
  glowIntensity?: number
  saturation?: number
  hueShift?: number
}

function GalaxyParticles({
  count = 2000,
  mouseRepulsion = true,
  radius = 5
}: {
  count?: number
  mouseRepulsion?: boolean
  radius?: number
}) {
  const points = useRef<THREE.Points>(null!)
  const hover = useRef(new THREE.Vector3(0, 0, 0))

  const particles = useMemo(() => {
    const temp = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // Spiral galaxy distribution
      const r = Math.random() * radius + Math.random() // Distance from center
      const spinAngle = r * 3 // Spin
      const branchAngle = ((i % 3) * 2 * Math.PI) / 3 // 3 branches

      const x = Math.cos(branchAngle + spinAngle) * r + (Math.random() - 0.5) * 0.5
      const y = (Math.random() - 0.5) * (r * 0.2) // Flattened
      const z = Math.sin(branchAngle + spinAngle) * r + (Math.random() - 0.5) * 0.5

      temp[i3] = x
      temp[i3 + 1] = y
      temp[i3 + 2] = z

      // Color based on radius
      const mixedColor = color.setHSL(Math.random() * 0.2 + 0.5, 0.8, 0.5)
      colors[i3] = mixedColor.r
      colors[i3 + 1] = mixedColor.g
      colors[i3 + 2] = mixedColor.b
    }
    return { positions: temp, colors }
  }, [count, radius])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    
    // Rotate the entire galaxy
    if (points.current) {
      points.current.rotation.y = time * 0.05
    }

    // Mouse interaction
    if (mouseRepulsion) {
        // Simple mapping of mouse to 3D space (approximate for performance)
        const x = (state.pointer.x * state.viewport.width) / 2
        const y = (state.pointer.y * state.viewport.height) / 2
        hover.current.set(x, y, 0)
    }
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.positions.length / 3}
          array={particles.positions}
          itemSize={3}
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particles.colors.length / 3}
          array={particles.colors}
          itemSize={3}
          args={[particles.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        transparent={true}
        opacity={0.8}
      />
    </points>
  )
}

export default React.memo(function Galaxy({
  mouseRepulsion = true,
  density = 1.5,
  glowIntensity = 0.5,
  saturation = 0.8,
  hueShift = 240
}: GalaxyProps) {
  // Map density to particle count
  const count = Math.floor(density * 2000)

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <Canvas camera={{ position: [0, 5, 5], fov: 60 }}>
        <color attach="background" args={['#020205']} />
        <ambientLight intensity={0.5} />
        <GalaxyParticles count={count} mouseRepulsion={mouseRepulsion} />
      </Canvas>
    </div>
  )
})
