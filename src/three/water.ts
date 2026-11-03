import { BackSide, Color, LinearSRGBColorSpace, ShaderMaterial, Vector2, Vector3 } from 'three'

// Shaders here write display colours directly, so keep these hex values unconverted.
const displayColor = (hex: string) => new Color().setStyle(hex, LinearSRGBColorSpace)
export const SKY_HORIZON = displayColor('#1e3a5f')
export const SKY_ZENITH = displayColor('#020617')

// Three summed directional sine waves; the same function drives ship bobbing in JS.
const WAVES = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  float waveHeight(vec2 p) {
    float t = uTime;
    return uAmp * (
      sin(dot(p, vec2(0.62, 0.38)) * 1.3 + t * 1.1) +
      0.6 * sin(dot(p, vec2(-0.3, 0.85)) * 1.9 + t * 1.5) +
      0.35 * sin(dot(p, vec2(0.9, -0.2)) * 3.1 + t * 2.3)
    );
  }
`

/** JS twin of the shader's waveHeight, for floating objects. */
export function waveHeight(x: number, z: number, t: number, amp: number): number {
  return (
    amp *
    (Math.sin((x * 0.62 + z * 0.38) * 1.3 + t * 1.1) +
      0.6 * Math.sin((x * -0.3 + z * 0.85) * 1.9 + t * 1.5) +
      0.35 * Math.sin((x * 0.9 + z * -0.2) * 3.1 + t * 2.3))
  )
}

export interface WaterUniforms {
  [key: string]: { value: unknown }
  uTime: { value: number }
  uAmp: { value: number }
  uEnemy: { value: Vector2 }
  uMine: { value: Vector2 }
  uHalf: { value: number }
  uHover: { value: Vector2 }
  uActive: { value: number }
  uSun: { value: Vector3 }
  uFog: { value: Color }
}

export function createWaterMaterial(): ShaderMaterial & { uniforms: WaterUniforms } {
  const uniforms: WaterUniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.07 },
    uEnemy: { value: new Vector2() },
    uMine: { value: new Vector2() },
    uHalf: { value: 5 },
    uHover: { value: new Vector2(-1, -1) },
    uActive: { value: 1 },
    uSun: { value: new Vector3(0.45, 0.75, -0.5).normalize() },
    uFog: { value: SKY_HORIZON.clone() },
  }
  return new ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      ${WAVES}
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        float e = 0.08;
        float h = waveHeight(world.xz);
        world.y += h;
        float hx = waveHeight(world.xz + vec2(e, 0.0)) - h;
        float hz = waveHeight(world.xz + vec2(0.0, e)) - h;
        vNormal = normalize(vec3(-hx / e, 1.0, -hz / e));
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uEnemy;
      uniform vec2 uMine;
      uniform float uHalf;
      uniform vec2 uHover;
      uniform float uActive;
      uniform vec3 uSun;
      uniform vec3 uFog;
      varying vec3 vWorld;
      varying vec3 vNormal;

      // 1 on cell borders inside a board, 0 elsewhere.
      float gridLines(vec2 local) {
        if (abs(local.x) > uHalf || abs(local.y) > uHalf) return 0.0;
        vec2 g = local + uHalf;
        vec2 d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
        float line = 1.0 - min(min(d.x, d.y), 1.0);
        vec2 edge = smoothstep(uHalf - 0.06, uHalf, abs(local));
        return max(line * 0.55, max(edge.x, edge.y));
      }

      void main() {
        vec3 n = normalize(vNormal);
        vec3 view = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(n, view), 0.0), 3.0);
        vec3 deep = vec3(0.01, 0.07, 0.16);
        vec3 shallow = vec3(0.03, 0.24, 0.38);
        vec3 col = mix(deep, shallow, clamp(n.y * 0.5 + (vWorld.y + 0.1) * 2.5, 0.0, 1.0));
        col = mix(col, vec3(0.3, 0.45, 0.62), fresnel * 0.5);
        float spec = pow(max(dot(reflect(-uSun, n), view), 0.0), 220.0);
        col += vec3(1.0, 0.92, 0.75) * spec * 0.3;

        vec2 enemy = vWorld.xz - uEnemy;
        vec2 mine = vWorld.xz - uMine;
        float boardTint = (abs(enemy.x) < uHalf && abs(enemy.y) < uHalf) ? 1.0 : 0.0;
        float lines = gridLines(enemy) * (0.55 + 0.45 * uActive) + gridLines(mine) * 0.7;
        col = mix(col, col * 1.18 + vec3(0.0, 0.03, 0.05), boardTint * 0.5);
        col = mix(col, vec3(0.62, 0.86, 1.0), lines * 0.6);

        if (uHover.x >= 0.0) {
          vec2 cell = floor(enemy + uHalf);
          if (cell == uHover) {
            vec2 f = abs(fract(enemy + uHalf) - 0.5);
            float ring = smoothstep(0.36, 0.48, max(f.x, f.y));
            col = mix(col, vec3(1.0, 0.75, 0.2), 0.25 + ring * 0.6);
          }
        }

        float dist = length(cameraPosition - vWorld);
        col = mix(col, uFog, smoothstep(30.0, 95.0, dist));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }) as ShaderMaterial & { uniforms: WaterUniforms }
}

export function createSkyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { uHorizon: { value: SKY_HORIZON }, uZenith: { value: SKY_ZENITH } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        gl_FragColor = vec4(mix(uHorizon, uZenith, pow(h, 0.55)), 1.0);
      }
    `,
  })
}
