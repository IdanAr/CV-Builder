import React, { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

interface PlasmaProps {
  color?: string;
  speed?: number;
  direction?: "forward" | "reverse" | "pingpong";
  scale?: number;
  opacity?: number;
  mouseInteractive?: boolean;
}

// This is a low-opacity (default 0.2, further diluted by a gradient overlay)
// ambient background rendered continuously behind every dashboard route,
// including the editor — it can't rely on being off-screen to cut its cost,
// because during normal active use it never is. So its per-frame cost is
// capped unconditionally: 30fps is visually indistinguishable from 60+ for
// this kind of slow ambient motion, and DPR 1 is imperceptible at this
// opacity while quartering the shader's per-frame pixel count on retina
// displays — both cut sustained GPU load (and the thermal/main-thread-stall
// risk that comes with it) regardless of visibility or focus state.
const TARGET_FPS = 30;
const MIN_FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
const MAX_DPR = 1;

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 0.5, 0.2];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
};

const vertex = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
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
    z+= d = abs(sqrt(length(Q*Q)) - .25*(5.+S.y))/3.+8e-4;
    o = 1.+sin(S.y+p.z*.5+S.z-length(S-p)+vec4(2,1,0,8));
  }

  o.xyz = tanh(O/1e4);
}

bool finite1(float x){ return !(isnan(x) || isinf(x)); }
vec3 sanitize(vec3 c){
  return vec3(
    finite1(c.r) ? c.r : 0.0,
    finite1(c.g) ? c.g : 0.0,
    finite1(c.b) ? c.b : 0.0
  );
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
}`;

export const Plasma: React.FC<PlasmaProps> = ({
  color = "#ffffff",
  speed = 1,
  direction = "forward",
  scale = 1,
  opacity = 1,
  mouseInteractive = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const useCustomColor = color ? 1.0 : 0.0;
    const customColorRgb = color ? hexToRgb(color) : [1, 1, 1];

    const directionMultiplier = direction === "reverse" ? -1.0 : 1.0;

    // WebGL2 is missing in more places than it looks: older Safari, locked-down
    // corporate GPU policies, VDI/remote-desktop sessions, some low-end Android.
    // ogl throws synchronously out of the Renderer constructor there, and shader
    // compilation can fail just as abruptly. This effect runs inside
    // PlasmaBackground, which wraps *every* /dashboard/* route, and there is no
    // error boundary above it — so an unguarded throw takes the whole
    // authenticated app down rather than dropping one ambient decoration.
    // On failure we bail out and leave PlasmaBackground's static gradient as the
    // fallback, which is what the design degrades to anyway.
    let scene: { renderer: Renderer; program: Program; mesh: Mesh; canvas: HTMLCanvasElement } | null = null;
    let appendedCanvas: HTMLCanvasElement | null = null;
    try {
      const rendererInstance = new Renderer({
        webgl: 2,
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR),
      });
      const glContext = rendererInstance.gl;
      const rendererCanvas = glContext.canvas as HTMLCanvasElement;
      rendererCanvas.style.display = "block";
      rendererCanvas.style.width = "100%";
      rendererCanvas.style.height = "100%";
      containerRef.current.appendChild(rendererCanvas);
      appendedCanvas = rendererCanvas;

      const geometry = new Triangle(glContext);

      const programInstance = new Program(glContext, {
        vertex: vertex,
        fragment: fragment,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new Float32Array([1, 1]) },
          uCustomColor: { value: new Float32Array(customColorRgb as number[]) },
          uUseCustomColor: { value: useCustomColor },
          uSpeed: { value: speed * 0.4 },
          uDirection: { value: directionMultiplier },
          uScale: { value: scale },
          uOpacity: { value: opacity },
          uMouse: { value: new Float32Array([0, 0]) },
          uMouseInteractive: { value: mouseInteractive ? 1.0 : 0.0 },
        },
      });

      scene = {
        renderer: rendererInstance,
        program: programInstance,
        mesh: new Mesh(glContext, { geometry, program: programInstance }),
        canvas: rendererCanvas,
      };
    } catch {
      // Undo a canvas that was appended before a later step threw, so a failed
      // init leaves the container exactly as it found it.
      appendedCanvas?.remove();
    }
    if (!scene) return;

    const { renderer, program, mesh, canvas } = scene;
    const gl = renderer.gl;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseInteractive || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mousePos.current.x = e.clientX - rect.left;
      mousePos.current.y = e.clientY - rect.top;
      const mouseUniform = program.uniforms.uMouse.value as Float32Array;
      mouseUniform[0] = mousePos.current.x;
      mouseUniform[1] = mousePos.current.y;
    };

    if (mouseInteractive) {
      containerRef.current.addEventListener("mousemove", handleMouseMove);
    }

    const setSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height);
      const res = program.uniforms.iResolution.value as Float32Array;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
    };

    const ro = new ResizeObserver(setSize);
    ro.observe(containerRef.current);
    setSize();

    const t0 = performance.now();
    const renderFrame = (t: number) => {
      const timeValue = (t - t0) * 0.001;

      if (direction === "pingpong") {
        const cycle = Math.sin(timeValue * 0.5) * directionMultiplier;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (program.uniforms.uDirection as any).value = cycle;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.uniforms.iTime as any).value = timeValue;
      renderer.render({ scene: mesh });
    };

    let raf = 0;
    let animating = false;
    let lastRenderTime = 0;
    const loop = (t: number) => {
      // rAF still fires at full display refresh rate — cheap dispatch — but
      // the expensive GPU draw call is throttled to TARGET_FPS.
      if (t - lastRenderTime >= MIN_FRAME_INTERVAL_MS) {
        lastRenderTime = t;
        renderFrame(t);
      }
      raf = requestAnimationFrame(loop);
    };
    const startLoop = () => {
      if (animating) return;
      animating = true;
      raf = requestAnimationFrame(loop);
    };
    const stopLoop = () => {
      if (!animating) return;
      animating = false;
      cancelAnimationFrame(raf);
    };

    // Sustained full-viewport WebGL rendering is expensive; only pay for it
    // when the shader is actually visible and the tab is in the foreground.
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let io: IntersectionObserver | undefined;
    let isIntersecting = true;

    const syncAnimationState = () => {
      if (!isIntersecting || document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    };
    const handleVisibilityChange = () => syncAnimationState();

    if (prefersReducedMotion) {
      renderFrame(t0);
    } else {
      io = new IntersectionObserver(([entry]) => {
        isIntersecting = entry.isIntersecting;
        syncAnimationState();
      });
      io.observe(containerRef.current);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      syncAnimationState();
    }

    return () => {
      stopLoop();
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (mouseInteractive && containerRef.current) {
        containerRef.current.removeEventListener("mousemove", handleMouseMove);
      }
      try {
        containerRef.current?.removeChild(canvas);
      } catch {}
    };
  }, [color, speed, direction, scale, opacity, mouseInteractive]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
    />
  );
};
