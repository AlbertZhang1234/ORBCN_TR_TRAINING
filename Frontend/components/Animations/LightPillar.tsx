'use client'

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface LightPillarProps {
  topColor?: string
  bottomColor?: string
  intensity?: number
  rotationSpeed?: number
  glowAmount?: number
  pillarWidth?: number
  pillarHeight?: number
  noiseIntensity?: number
  pillarRotation?: number
  interactive?: boolean
  mixBlendMode?: string
}

function Pillar({
  topColor = '#5227FF',
  bottomColor = '#FF9FFC',
  width = 3.0,
  height = 0.4,
  rotationSpeed = 0.3
}: {
  topColor?: string
  bottomColor?: string
  width?: number
  height?: number
  rotationSpeed?: number
}) {
  const mesh = useRef<THREE.Mesh>(null!)
  
  const uniforms = useMemo(
    () => ({
      uTopColor: { value: new THREE.Color(topColor) },
      uBottomColor: { value: new THREE.Color(bottomColor) },
      uTime: { value: 0 },
    }),
    [topColor, bottomColor]
  )

  useFrame((state) => {
    if (mesh.current) {
      (mesh.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.getElapsedTime()
      mesh.current.rotation.y += rotationSpeed * 0.01
    }
  })

  // Vertex Shader
  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  // Fragment Shader
  const fragmentShader = `
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vPosition;

    void main() {
      // Horizontal fade (make it look like a beam)
      // 0.5 is center
      float dist = abs(vUv.x - 0.5) * 2.0;
      float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
      
      // Sharpen the core
      alpha = pow(alpha, 2.0);

      // Vertical gradient
      vec3 color = mix(uBottomColor, uTopColor, vUv.y);
      
      // Add subtle noise/movement
      float noise = sin(vUv.y * 10.0 - uTime * 2.0) * 0.05;
      alpha += noise * alpha;

      // Soft fade at top and bottom
      float verticalFade = smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));
      alpha *= verticalFade;

      gl_FragColor = vec4(color, alpha);
    }
  `

  return (
    <mesh ref={mesh} position={[0, 0, 0]}>
      {/* Cylinder: radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded */}
      <cylinderGeometry args={[width * 0.5, width * 0.5, height * 10, 32, 1, true]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

export default React.memo(function LightPillar(props: LightPillarProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <Pillar 
          topColor={props.topColor}
          bottomColor={props.bottomColor}
          width={props.pillarWidth}
          height={props.pillarHeight}
          rotationSpeed={props.rotationSpeed}
        />
      </Canvas>
    </div>
  )
})
