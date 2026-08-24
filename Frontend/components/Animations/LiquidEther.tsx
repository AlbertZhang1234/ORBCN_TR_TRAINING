'use client'

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface LiquidEtherProps {
  colors?: string[]
  mouseForce?: number
  cursorSize?: number
  isViscous?: boolean
  viscous?: number
  iterationsViscous?: number
  iterationsPoisson?: number
  resolution?: number
  isBounce?: boolean
  autoDemo?: boolean
  autoSpeed?: number
  autoIntensity?: number
  takeoverDuration?: number
  autoResumeDelay?: number
  autoRampDuration?: number
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  varying vec2 vUv;

  // Simplex 3D Noise 
  // by Ian McEwan, Ashima Arts
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec3 v){ 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    //  x0 = x0 - 0.0 + 0.0 * C 
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    // Permutations
    i = mod(i, 289.0 ); 
    vec4 p = permute( permute( permute( 
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    // Gradients
    // ( N=0.1.2.3 )
    float n_ = 1.0/7.0; // N=7
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    float time = uTime * 0.5;
    
    // Create base liquid movement
    float n1 = snoise(vec3(vUv * 3.0 + vec2(time * 0.1), time * 0.2));
    float n2 = snoise(vec3(vUv * 2.0 - vec2(time * 0.1), time * 0.1 + 10.0));
    
    float noiseSum = (n1 + n2) * 0.5; // -1 to 1

    // Mix colors based on noise
    vec3 color = mix(uColor1, uColor2, smoothstep(-0.5, 0.5, noiseSum));
    color = mix(color, uColor3, smoothstep(0.0, 1.0, abs(noiseSum))); // Add third color highlights

    gl_FragColor = vec4(color, 1.0);
  }
`

function LiquidPlane({
  colors = ['#5227FF', '#FF9FFC', '#B19EEF']
}: {
  colors?: string[]
}) {
  const mesh = useRef<THREE.Mesh>(null!)
  
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(colors[0] || '#5227FF') },
      uColor2: { value: new THREE.Color(colors[1] || '#FF9FFC') },
      uColor3: { value: new THREE.Color(colors[2] || '#B19EEF') },
    }),
    [colors]
  )

  useFrame((state) => {
    if (mesh.current) {
      (mesh.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.getElapsedTime()
    }
  })

  return (
    <mesh ref={mesh}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}

export default React.memo(function LiquidEther(props: LiquidEtherProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0, 1] }}>
        <LiquidPlane colors={props.colors} />
      </Canvas>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison to handle array prop 'colors'
  if (prevProps.colors !== nextProps.colors) {
    if (prevProps.colors?.length !== nextProps.colors?.length) return false;
    if (prevProps.colors && nextProps.colors) {
      // Check if all colors are the same
      const allColorsMatch = prevProps.colors.every((color, index) => color === nextProps.colors![index]);
      if (!allColorsMatch) return false;
    } else {
      // One is undefined/null and they are not strictly equal (handled by first check), so return false
      return false;
    }
  }
  
  // Compare other props (shallow)
  const keys = Object.keys(nextProps) as (keyof LiquidEtherProps)[];
  for (const key of keys) {
    if (key === 'colors') continue;
    if (prevProps[key] !== nextProps[key]) return false;
  }
  
  return true;
})
