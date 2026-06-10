import React from 'react'

/* PlasmaBackground — the brand's animated WebGL plasma field, used behind the
   sign-in card and marketing hero. Recreates the product's PlasmaBackground.tsx:
   an indigo plasma rendered with OGL under a soft white wash, with the content
   composited on top. OGL is loaded from CDN at runtime so the component stays
   dependency-free inside the design-system bundle. Falls back to a static
   indigo wash where WebGL2 is unavailable. */

/* OGL ships ESM only (no UMD global), so we load it with a runtime dynamic
   import. The `new Function` wrapper keeps the import() opaque to the Babel
   transpiler used by the cards/UI kit. */
let oglPromise = null
function ensureOGL() {
  if (oglPromise) return oglPromise
  try {
    const dynImport = new Function('u', 'return import(u)')
    oglPromise = dynImport('https://esm.sh/ogl@1.0.11')
      .then((m) => (m && m.Renderer ? m : (m && m.default) || m))
      .catch(() => null)
  } catch (e) {
    oglPromise = Promise.resolve(null)
  }
  return oglPromise
}

const VERT = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 uCustomColor;
uniform float uUseCustomColor;
uniform float uSpeed;
uniform float uDirection;
uniform float uScale;
uniform float uOpacity;
uniform vec2 uMouse;
uniform float uMouseInteractive;
out vec4 fragColor;
void mainImage(out vec4 o, vec2 C) {
  vec2 center = iResolution.xy * 0.5;
  C = (C - center) / uScale + center;
  vec2 mouseOffset = (uMouse - center) * 0.0002;
  C += mouseOffset * length(C - center) * step(0.5, uMouseInteractive);
  float i, d, z, T = iTime * uSpeed * uDirection;
  vec3 O, p, S;
  for (vec2 r = iResolution.xy, Q; ++i < 60.; O += o.w/d*o.xyz) {
    p = z*normalize(vec3(C-.5*r,r.y));
    p.z -= 4.;
    S = p;
    d = p.y-T;
    p.x += .4*(1.+p.y)*sin(d + p.x*0.1)*cos(.34*d + p.x*0.05);
    Q = p.xz *= mat2(cos(p.y+vec4(0,11,33,0)-T));
    z += d = abs(sqrt(length(Q*Q)) - .25*(5.+S.y))/3.+8e-4;
    o = 1.+sin(S.y+p.z*.5+S.z-length(S-p)+vec4(2,1,0,8));
  }
  o.xyz = tanh(O/1e4);
}
bool finite1(float x){ return !(isnan(x) || isinf(x)); }
vec3 sanitize(vec3 c){
  return vec3(finite1(c.r)?c.r:0.0, finite1(c.g)?c.g:0.0, finite1(c.b)?c.b:0.0);
}
void main() {
  vec4 o = vec4(0.0);
  mainImage(o, gl_FragCoord.xy);
  vec3 rgb = sanitize(o.rgb);
  float intensity = (rgb.r + rgb.g + rgb.b) / 3.0;
  vec3 customColor = intensity * uCustomColor;
  vec3 finalColor = mix(rgb, customColor, step(0.5, uUseCustomColor));
  float alpha = length(rgb) * uOpacity;
  fragColor = vec4(finalColor, alpha);
}`

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!m) return [0.31, 0.27, 0.9]
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
}

export function PlasmaBackground({
  color = '#4f46e5', speed = 0.5, scale = 1.2, opacity = 0.5,
  direction = 'forward', mouseInteractive = true, overlay = true,
  children, style = {},
}) {
  const hostRef = React.useRef(null)

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let raf = 0, ro = null, canceled = false, canvas = null
    let onMove = null

    ensureOGL().then((ogl) => {
      if (canceled || !ogl) return
      const { Renderer, Program, Mesh, Triangle } = ogl
      let renderer
      try {
        renderer = new Renderer({ webgl: 2, alpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, 2) })
      } catch (e) { return }
      const gl = renderer.gl
      canvas = gl.canvas
      canvas.style.display = 'block'; canvas.style.width = '100%'; canvas.style.height = '100%'
      host.appendChild(canvas)

      const dir = direction === 'reverse' ? -1.0 : 1.0
      const program = new Program(gl, {
        vertex: VERT, fragment: FRAG,
        uniforms: {
          iTime: { value: 0 }, iResolution: { value: new Float32Array([1, 1]) },
          uCustomColor: { value: new Float32Array(hexToRgb(color)) },
          uUseCustomColor: { value: color ? 1.0 : 0.0 },
          uSpeed: { value: speed * 0.4 }, uDirection: { value: dir },
          uScale: { value: scale }, uOpacity: { value: opacity },
          uMouse: { value: new Float32Array([0, 0]) }, uMouseInteractive: { value: mouseInteractive ? 1.0 : 0.0 },
        },
      })
      const mesh = new Mesh(gl, { geometry: new Triangle(gl), program })

      if (mouseInteractive) {
        onMove = (e) => {
          const r = host.getBoundingClientRect()
          const u = program.uniforms.uMouse.value
          u[0] = e.clientX - r.left; u[1] = e.clientY - r.top
        }
        host.addEventListener('mousemove', onMove)
      }

      const setSize = () => {
        const r = host.getBoundingClientRect()
        renderer.setSize(Math.max(1, r.width | 0), Math.max(1, r.height | 0))
        const res = program.uniforms.iResolution.value
        res[0] = gl.drawingBufferWidth; res[1] = gl.drawingBufferHeight
      }
      ro = new ResizeObserver(setSize); ro.observe(host); setSize()

      const t0 = performance.now()
      const loop = (t) => {
        const time = (t - t0) * 0.001
        if (direction === 'pingpong') program.uniforms.uDirection.value = Math.sin(time * 0.5) * dir
        program.uniforms.iTime.value = time
        renderer.render({ scene: mesh })
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }).catch(() => {})

    return () => {
      canceled = true
      if (raf) cancelAnimationFrame(raf)
      if (ro) ro.disconnect()
      if (onMove && host) host.removeEventListener('mousemove', onMove)
      if (canvas && canvas.parentNode === host) host.removeChild(canvas)
    }
  }, [color, speed, scale, opacity, direction, mouseInteractive])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: 'var(--app-bg, #f5f3ff)', ...style }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      {overlay && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.40), rgba(255,255,255,0.80))' }} />
      )}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%' }}>{children}</div>
    </div>
  )
}
