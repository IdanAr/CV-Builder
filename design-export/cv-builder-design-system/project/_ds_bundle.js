/* @ds-bundle: {"format":3,"namespace":"CVBuilderDesignSystem_1d5ed3","components":[{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"GlassCard","sourcePath":"components/core/GlassCard.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"RangeSlider","sourcePath":"components/core/RangeSlider.jsx"},{"name":"ScoreBar","sourcePath":"components/core/ScoreBar.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"Tabs","sourcePath":"components/core/Tabs.jsx"},{"name":"PlasmaBackground","sourcePath":"components/effects/PlasmaBackground.jsx"},{"name":"ClassicResume","sourcePath":"components/resume/ClassicResume.jsx"},{"name":"ExecutiveResume","sourcePath":"components/resume/ExecutiveResume.jsx"},{"name":"MinimalResume","sourcePath":"components/resume/MinimalResume.jsx"},{"name":"ModernResume","sourcePath":"components/resume/ModernResume.jsx"},{"name":"SidebarResume","sourcePath":"components/resume/SidebarResume.jsx"},{"name":"SampleResume","sourcePath":"components/resume/resumeSample.jsx"},{"name":"SampleMeta","sourcePath":"components/resume/resumeSample.jsx"},{"name":"ContactLine","sourcePath":"components/resume/resumeShared.jsx"},{"name":"SectionBody","sourcePath":"components/resume/resumeShared.jsx"},{"name":"Sections","sourcePath":"components/resume/resumeShared.jsx"},{"name":"ALL_SECTIONS","sourcePath":"components/resume/resumeShared.jsx"}],"sourceHashes":{"components/brand/Logo.jsx":"07efd9c814b5","components/core/Avatar.jsx":"5fdb6f0bba64","components/core/Badge.jsx":"eb3494910fc2","components/core/Button.jsx":"ba9edbd949fa","components/core/GlassCard.jsx":"a39941091036","components/core/Input.jsx":"fc5449e69e07","components/core/RangeSlider.jsx":"f047edc63ffc","components/core/ScoreBar.jsx":"f33c874f48b8","components/core/Select.jsx":"a0118c3ee667","components/core/Tabs.jsx":"62e97e07ccec","components/effects/PlasmaBackground.jsx":"5a6b74311c10","components/resume/ClassicResume.jsx":"8d8c48b0f03a","components/resume/ExecutiveResume.jsx":"9396dbf4b45a","components/resume/MinimalResume.jsx":"d83e592394b6","components/resume/ModernResume.jsx":"119ccefa77fa","components/resume/SidebarResume.jsx":"d3a6f4317619","components/resume/resumeSample.jsx":"62085db6fa46","components/resume/resumeShared.jsx":"fcbc0dd04037","ui_kits/cv-builder/kit-editor.jsx":"fe700c8606fc","ui_kits/cv-builder/kit-screens.jsx":"042dcd9daab4"},"inlinedExternals":[],"unexposedExports":[{"name":"fmtDate","sourcePath":"components/resume/resumeShared.jsx"},{"name":"sectionLabel","sourcePath":"components/resume/resumeShared.jsx"}]} */

(() => {

const __ds_ns = (window.CVBuilderDesignSystem_1d5ed3 = window.CVBuilderDesignSystem_1d5ed3 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Logo.jsx
try { (() => {
/* CV Builder brand mark — the violet hexagon network node with a star,
   optionally followed by the gradient wordmark. */
function Logo({
  size = 40,
  showWordmark = true,
  wordmark = 'CV Builder'
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      fontFamily: 'var(--font-ui)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 100 100",
    width: size,
    height: size,
    xmlns: "http://www.w3.org/2000/svg",
    "aria-label": "CV Builder logo"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "cvbLogoGrad",
    x1: "0%",
    y1: "0%",
    x2: "100%",
    y2: "100%"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#8B5CF6"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#6366F1"
  })), /*#__PURE__*/React.createElement("linearGradient", {
    id: "cvbLogoLight",
    x1: "0%",
    y1: "0%",
    x2: "100%",
    y2: "100%"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#A78BFA"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#8B5CF6"
  }))), /*#__PURE__*/React.createElement("polygon", {
    points: "50,25 65,35 65,55 50,65 35,55 35,35",
    fill: "url(#cvbLogoGrad)"
  }), [[30, 30], [70, 30], [20, 50], [80, 50], [30, 70], [70, 70]].map(([cx, cy], i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: cx,
    cy: cy,
    r: "4",
    fill: "url(#cvbLogoLight)"
  })), [[30, 30, 42, 38], [70, 30, 58, 38], [20, 50, 35, 45], [80, 50, 65, 45], [30, 70, 42, 58], [70, 70, 58, 58]].map(([x1, y1, x2, y2], i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: x1,
    y1: y1,
    x2: x2,
    y2: y2,
    stroke: "#A78BFA",
    strokeWidth: "2",
    opacity: "0.6"
  })), /*#__PURE__*/React.createElement("path", {
    d: "M 42 42 L 48 42 L 50 38 L 52 42 L 58 42 L 54 48 L 56 54 L 50 50 L 44 54 L 46 48 Z",
    fill: "#FFFFFF",
    opacity: "0.9"
  })), showWordmark && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: Math.round(size * 0.45),
      fontWeight: 700,
      whiteSpace: 'nowrap',
      background: 'var(--brand-gradient)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent'
    }
  }, wordmark));
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
/* Gradient initials avatar (falls back from a photo). Matches the profile pill
   and dropdown header in the app. */
function Avatar({
  name,
  image,
  size = 32
}) {
  const initials = (name || '?').split(' ').filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('');
  if (image) {
    return /*#__PURE__*/React.createElement("img", {
      src: image,
      alt: name || 'User',
      width: size,
      height: size,
      style: {
        borderRadius: 'var(--radius-full)',
        objectFit: 'cover'
      }
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: 'var(--radius-full)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--brand-gradient-br)',
      color: '#fff',
      fontFamily: 'var(--font-ui)',
      fontWeight: 700,
      fontSize: Math.floor(size * 0.42)
    }
  }, initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
/* Small pill label. Used for keyword chips (matched / missing), template tags,
   and status markers throughout the app. */
function Badge({
  variant = 'neutral',
  children,
  style = {}
}) {
  const variants = {
    neutral: {
      background: 'var(--indigo-50)',
      color: 'var(--indigo-700)',
      border: '1px solid var(--indigo-100)'
    },
    matched: {
      background: '#dcfce7',
      color: 'var(--green-600)',
      border: '1px solid #bbf7d0'
    },
    missing: {
      background: '#fee2e2',
      color: 'var(--red-600)',
      border: '1px solid #fecaca'
    },
    info: {
      background: 'var(--indigo-100)',
      color: 'var(--indigo-700)',
      border: '1px solid var(--indigo-200)'
    },
    warn: {
      background: '#fef9c3',
      color: 'var(--yellow-600)',
      border: '1px solid #fef08a'
    },
    solid: {
      background: 'var(--brand-primary)',
      color: '#fff',
      border: '1px solid transparent'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontFamily: 'var(--font-ui)',
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1.4,
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)',
      whiteSpace: 'nowrap',
      ...variants[variant],
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Primary action button for the CV Builder app chrome. Indigo fill by default,
   with outline / ghost / danger variants and two sizes. */
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  onClick,
  children,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: {
      padding: '6px 12px',
      fontSize: '12px',
      borderRadius: 'var(--radius-md)'
    },
    md: {
      padding: '8px 16px',
      fontSize: '14px',
      borderRadius: 'var(--radius-lg)'
    },
    lg: {
      padding: '12px 22px',
      fontSize: '15px',
      borderRadius: 'var(--radius-lg)'
    }
  };
  const variants = {
    primary: {
      background: 'var(--brand-primary)',
      color: '#fff',
      border: '1px solid transparent'
    },
    secondary: {
      background: 'var(--surface-solid)',
      color: 'var(--brand-primary)',
      border: '1px solid var(--border-default)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)',
      border: '1px solid transparent'
    },
    danger: {
      background: 'var(--surface-solid)',
      color: 'var(--red-600)',
      border: '1px solid var(--red-400)'
    }
  };
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'var(--font-ui)',
    fontWeight: 500,
    lineHeight: 1.2,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast)',
    whiteSpace: 'nowrap',
    ...sizes[size],
    ...variants[variant],
    ...style
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    onClick: onClick,
    disabled: disabled,
    style: base,
    onMouseEnter: e => {
      if (!disabled && variant === 'primary') e.currentTarget.style.background = 'var(--brand-primary-hover)';else if (!disabled && variant !== 'ghost') e.currentTarget.style.background = 'var(--indigo-50)';else if (!disabled) e.currentTarget.style.background = 'var(--indigo-50)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = variants[variant].background;
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/GlassCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Frosted glass surface — the signature container of the app. Wraps cards,
   panels, modals. Defaults to the standard 65%-white blur card. */
function GlassCard({
  as = 'div',
  elevation = 'lg',
  padding = 16,
  children,
  style = {},
  ...rest
}) {
  const Tag = as;
  const shadows = {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    xl: 'var(--shadow-xl)'
  };
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      background: 'var(--surface-card)',
      backdropFilter: 'blur(var(--blur-glass))',
      WebkitBackdropFilter: 'blur(var(--blur-glass))',
      border: '1px solid var(--border-glass)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: shadows[elevation],
      padding,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { GlassCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/GlassCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Text input matching the editor forms — soft white fill, indigo focus ring. */
function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  mono = false,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
      fontSize: '14px',
      color: 'var(--text-heading)',
      background: 'rgba(255,255,255,0.7)',
      padding: '7px 10px',
      border: `1px solid ${focus ? 'var(--ring-focus)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-lg)',
      outline: 'none',
      boxShadow: focus ? '0 0 0 2px rgba(99,102,241,0.25)' : 'none',
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      opacity: disabled ? 0.6 : 1,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/RangeSlider.jsx
try { (() => {
/* Labelled range control from the Design panel (margins, line spacing).
   Shows the current value inline and the min/max captions below. */
function RangeSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange,
  minLabel,
  maxLabel
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-ui)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: '12px',
      fontWeight: 500,
      color: 'var(--brand-primary)',
      marginBottom: '6px'
    }
  }, label, " \u2014 ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)'
    }
  }, value, unit)), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange && onChange(parseFloat(e.target.value)),
    style: {
      width: '100%',
      accentColor: 'var(--brand-primary)',
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '11px',
      color: 'var(--text-faint)',
      marginTop: '2px'
    }
  }, /*#__PURE__*/React.createElement("span", null, minLabel ?? `${min}${unit}`), /*#__PURE__*/React.createElement("span", null, maxLabel ?? `${max}${unit}`)));
}
Object.assign(__ds_scope, { RangeSlider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/RangeSlider.jsx", error: String((e && e.message) || e) }); }

// components/core/ScoreBar.jsx
try { (() => {
/* ATS score bar — fills green / yellow / red against thresholds. Used in the
   ATS panel breakdown and the dashboard format-score readout. */
function ScoreBar({
  value,
  max = 100,
  label,
  showValue = true
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round(value / max * 100))) : 0;
  const color = pct >= 70 ? 'var(--green-500)' : pct >= 40 ? 'var(--yellow-500)' : 'var(--red-400)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-ui)'
    }
  }, (label || showValue) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '12px',
      color: 'var(--text-body)',
      marginBottom: '4px'
    }
  }, /*#__PURE__*/React.createElement("span", null, label), showValue && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500
    }
  }, value, " / ", max)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '8px',
      width: '100%',
      borderRadius: 'var(--radius-full)',
      background: 'var(--indigo-100)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '8px',
      width: `${pct}%`,
      borderRadius: 'var(--radius-full)',
      background: color,
      transition: 'width var(--dur-slow) var(--ease-out)'
    }
  })));
}
Object.assign(__ds_scope, { ScoreBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ScoreBar.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Native select styled to match the Design panel dropdowns. */
function Select({
  value,
  onChange,
  options = [],
  disabled = false,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("select", _extends({
    value: value,
    onChange: onChange,
    disabled: disabled,
    style: {
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: 'var(--font-ui)',
      fontSize: '14px',
      color: 'var(--text-heading)',
      background: 'rgba(255,255,255,0.7)',
      padding: '7px 28px 7px 10px',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      outline: 'none',
      cursor: 'pointer',
      appearance: 'none',
      backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23818cf8\' stroke-width=\'2.5\'><polyline points=\'6 9 12 15 18 9\'/></svg>")',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 10px center',
      ...style
    }
  }, rest), options.map(o => {
    const val = typeof o === 'string' ? o : o.value;
    const label = typeof o === 'string' ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: val,
      value: val
    }, label);
  }));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/Tabs.jsx
try { (() => {
/* Underline tab bar — the editor's Edit / Design / ATS switcher. */
function Tabs({
  tabs = [],
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      borderBottom: '1px solid var(--border-subtle)',
      fontFamily: 'var(--font-ui)'
    }
  }, tabs.map(t => {
    const id = typeof t === 'string' ? t : t.id;
    const label = typeof t === 'string' ? t : t.label;
    const on = id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      type: "button",
      onClick: () => onChange && onChange(id),
      style: {
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${on ? 'var(--brand-primary)' : 'transparent'}`,
        marginBottom: '-1px',
        color: on ? 'var(--brand-primary)' : 'var(--text-muted)',
        transition: 'color var(--dur-fast)'
      }
    }, label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/effects/PlasmaBackground.jsx
try { (() => {
/* PlasmaBackground — the brand's animated WebGL plasma field, used behind the
   sign-in card and marketing hero. Recreates the product's PlasmaBackground.tsx:
   an indigo plasma rendered with OGL under a soft white wash, with the content
   composited on top. OGL is loaded from CDN at runtime so the component stays
   dependency-free inside the design-system bundle. Falls back to a static
   indigo wash where WebGL2 is unavailable. */

/* OGL ships ESM only (no UMD global), so we load it with a runtime dynamic
   import. The `new Function` wrapper keeps the import() opaque to the Babel
   transpiler used by the cards/UI kit. */
let oglPromise = null;
function ensureOGL() {
  if (oglPromise) return oglPromise;
  try {
    const dynImport = new Function('u', 'return import(u)');
    oglPromise = dynImport('https://esm.sh/ogl@1.0.11').then(m => m && m.Renderer ? m : m && m.default || m).catch(() => null);
  } catch (e) {
    oglPromise = Promise.resolve(null);
  }
  return oglPromise;
}
const VERT = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;
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
}`;
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return [0.31, 0.27, 0.9];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}
function PlasmaBackground({
  color = '#4f46e5',
  speed = 0.5,
  scale = 1.2,
  opacity = 0.5,
  direction = 'forward',
  mouseInteractive = true,
  overlay = true,
  children,
  style = {}
}) {
  const hostRef = React.useRef(null);
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let raf = 0,
      ro = null,
      canceled = false,
      canvas = null;
    let onMove = null;
    ensureOGL().then(ogl => {
      if (canceled || !ogl) return;
      const {
        Renderer,
        Program,
        Mesh,
        Triangle
      } = ogl;
      let renderer;
      try {
        renderer = new Renderer({
          webgl: 2,
          alpha: true,
          antialias: false,
          dpr: Math.min(window.devicePixelRatio || 1, 2)
        });
      } catch (e) {
        return;
      }
      const gl = renderer.gl;
      canvas = gl.canvas;
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      host.appendChild(canvas);
      const dir = direction === 'reverse' ? -1.0 : 1.0;
      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          iTime: {
            value: 0
          },
          iResolution: {
            value: new Float32Array([1, 1])
          },
          uCustomColor: {
            value: new Float32Array(hexToRgb(color))
          },
          uUseCustomColor: {
            value: color ? 1.0 : 0.0
          },
          uSpeed: {
            value: speed * 0.4
          },
          uDirection: {
            value: dir
          },
          uScale: {
            value: scale
          },
          uOpacity: {
            value: opacity
          },
          uMouse: {
            value: new Float32Array([0, 0])
          },
          uMouseInteractive: {
            value: mouseInteractive ? 1.0 : 0.0
          }
        }
      });
      const mesh = new Mesh(gl, {
        geometry: new Triangle(gl),
        program
      });
      if (mouseInteractive) {
        onMove = e => {
          const r = host.getBoundingClientRect();
          const u = program.uniforms.uMouse.value;
          u[0] = e.clientX - r.left;
          u[1] = e.clientY - r.top;
        };
        host.addEventListener('mousemove', onMove);
      }
      const setSize = () => {
        const r = host.getBoundingClientRect();
        renderer.setSize(Math.max(1, r.width | 0), Math.max(1, r.height | 0));
        const res = program.uniforms.iResolution.value;
        res[0] = gl.drawingBufferWidth;
        res[1] = gl.drawingBufferHeight;
      };
      ro = new ResizeObserver(setSize);
      ro.observe(host);
      setSize();
      const t0 = performance.now();
      const loop = t => {
        const time = (t - t0) * 0.001;
        if (direction === 'pingpong') program.uniforms.uDirection.value = Math.sin(time * 0.5) * dir;
        program.uniforms.iTime.value = time;
        renderer.render({
          scene: mesh
        });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => {});
    return () => {
      canceled = true;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (onMove && host) host.removeEventListener('mousemove', onMove);
      if (canvas && canvas.parentNode === host) host.removeChild(canvas);
    };
  }, [color, speed, scale, opacity, direction, mouseInteractive]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--app-bg, #f5f3ff)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: hostRef,
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 0
    }
  }), overlay && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 1,
      background: 'linear-gradient(to bottom, rgba(255,255,255,0.40), rgba(255,255,255,0.80))'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2,
      width: '100%',
      height: '100%'
    }
  }, children));
}
Object.assign(__ds_scope, { PlasmaBackground });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/effects/PlasmaBackground.jsx", error: String((e && e.message) || e) }); }

// components/resume/resumeSample.jsx
try { (() => {
/* Shared sample résumé used by template cards, the UI kit preview, and the
   starter templates so every surface shows realistic, consistent content. */
const SampleResume = {
  basics: {
    name: 'Maya Hartfield',
    label: 'Senior Product Designer',
    email: 'maya.hartfield@email.com',
    phone: '+1 (415) 555-0182',
    url: 'mayahart.design',
    location: {
      city: 'San Francisco',
      region: 'CA'
    },
    summary: 'Senior product designer with 8+ years shaping end-to-end experiences for SaaS and fintech. Led design for products serving 2M+ users, lifting activation by 34% through systems thinking and rigorous research.'
  },
  work: [{
    name: 'Lumen Financial',
    position: 'Senior Product Designer',
    startDate: '2021-03',
    endDate: '',
    highlights: ['Drove a 34% increase in onboarding completion by redesigning the account-funding flow.', 'Built and maintained a 60-component design system adopted by 4 product teams.', 'Mentored 3 designers; established weekly critique and research-readout rituals.']
  }, {
    name: 'Northwind Labs',
    position: 'Product Designer',
    startDate: '2018-06',
    endDate: '2021-02',
    highlights: ['Shipped the mobile dashboard that grew DAU 22% quarter-over-quarter.', 'Ran 40+ usability sessions translating findings into a prioritized roadmap.']
  }],
  education: [{
    institution: 'Rhode Island School of Design',
    studyType: 'BFA',
    area: 'Graphic Design',
    startDate: '2010-09',
    endDate: '2014-05',
    score: '3.8 GPA'
  }],
  skills: [{
    name: 'Design',
    level: 'Expert',
    keywords: ['Figma', 'Design Systems', 'Prototyping', 'Interaction']
  }, {
    name: 'Research',
    level: 'Advanced',
    keywords: ['Usability Testing', 'Surveys', 'A/B Testing']
  }, {
    name: 'Frontend',
    level: 'Intermediate',
    keywords: ['HTML', 'CSS', 'React']
  }],
  languages: [{
    language: 'English',
    fluency: 'Native'
  }, {
    language: 'Spanish',
    fluency: 'Professional'
  }],
  volunteer: [{
    organization: 'AIGA SF',
    position: 'Mentor',
    startDate: '2019-01',
    endDate: '',
    summary: 'Mentor early-career designers through portfolio reviews.'
  }]
};

/** Per-template default design metadata. */
const SampleMeta = {
  classic: {
    templateId: 'classic',
    fontFamily: 'Calibri',
    headerFontFamily: 'Calibri',
    primaryColor: '#1f2937',
    accentColor: '#2563eb'
  },
  modern: {
    templateId: 'modern',
    fontFamily: 'Lato',
    headerFontFamily: 'Lato',
    primaryColor: '#4338ca',
    accentColor: '#6366f1'
  },
  minimal: {
    templateId: 'minimal',
    fontFamily: 'Georgia',
    headerFontFamily: 'Georgia',
    primaryColor: '#333333',
    accentColor: '#444444'
  },
  executive: {
    templateId: 'executive',
    fontFamily: 'Georgia',
    headerFontFamily: 'Georgia',
    primaryColor: '#1a1a1a',
    accentColor: '#7c3aed'
  },
  sidebar: {
    templateId: 'sidebar',
    fontFamily: 'IBM Plex Sans',
    headerFontFamily: 'IBM Plex Sans',
    primaryColor: '#312e81',
    accentColor: '#6366f1'
  }
};
Object.assign(__ds_scope, { SampleResume, SampleMeta });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/resume/resumeSample.jsx", error: String((e && e.message) || e) }); }

// components/resume/resumeShared.jsx
try { (() => {
/* Shared rendering pieces for the CV templates.
   Every template draws the same section bodies (work / education / skills /
   languages / volunteer) and differs only in its section-title style, header
   block, and layout. These helpers keep the templates thin and consistent.
   Mirrors the JSON-Resume schema used by the CV Builder app. */

function fmtDate(d) {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})/.exec(d);
  if (m) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
  }
  return d;
}
function range(a, b, present) {
  const parts = [fmtDate(a), fmtDate(b) || (present ? 'Present' : '')].filter(Boolean);
  return parts.join(' – ');
}
function ContactLine({
  basics = {},
  color = '#555',
  sep = ' · '
}) {
  const loc = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ');
  const parts = [basics.email, basics.phone, basics.url, loc].filter(Boolean);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      color
    }
  }, parts.map((p, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, p, i < parts.length - 1 ? sep : '')));
}
function Entry({
  title,
  org,
  date,
  role,
  summary,
  highlights,
  accent
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      fontSize: '11pt',
      flex: 1,
      minWidth: 0
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '10pt',
      color: '#666',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, date)), role && /*#__PURE__*/React.createElement("div", {
    style: {
      color: accent,
      fontWeight: 500,
      fontSize: '10.5pt'
    }
  }, role), summary && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10pt',
      marginTop: '3px'
    }
  }, summary), (highlights ?? []).length > 0 && /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: '4px 0 0',
      paddingLeft: '18px',
      fontSize: '10pt'
    }
  }, highlights.map((h, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      marginBottom: '2px'
    }
  }, h))));
}

/* Renders one section body (no title). `kind` selects the shape. */
function SectionBody({
  kind,
  data,
  accent
}) {
  switch (kind) {
    case 'work':
      return (data.work ?? []).map((j, i) => /*#__PURE__*/React.createElement(Entry, {
        key: i,
        title: j.name,
        role: j.position,
        accent: accent,
        date: range(j.startDate, j.endDate, true),
        summary: j.summary,
        highlights: j.highlights
      }));
    case 'volunteer':
      return (data.volunteer ?? []).map((v, i) => /*#__PURE__*/React.createElement(Entry, {
        key: i,
        title: v.organization,
        role: v.position,
        accent: accent,
        date: range(v.startDate, v.endDate, true),
        summary: v.summary,
        highlights: v.highlights
      }));
    case 'education':
      return (data.education ?? []).map((e, i) => /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          marginBottom: '8px'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '12px'
        }
      }, /*#__PURE__*/React.createElement("strong", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, e.institution), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: '10pt',
          color: '#666',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }
      }, range(e.startDate, e.endDate))), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: '10.5pt'
        }
      }, [e.studyType, e.area].filter(Boolean).join(' in ')), e.score && /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: '10pt',
          color: '#666'
        }
      }, "Score: ", e.score)));
    case 'skills':
      return /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: '10pt',
          lineHeight: 1.7
        }
      }, (data.skills ?? []).map((s, i) => /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          display: 'flex',
          gap: '16px',
          marginBottom: '2px'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          minWidth: '130px',
          fontWeight: 600,
          flexShrink: 0
        }
      }, s.name, s.level && /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 400,
          color: '#666'
        }
      }, " \xB7 ", s.level)), (s.keywords ?? []).length > 0 && /*#__PURE__*/React.createElement("div", {
        style: {
          color: '#444',
          flex: 1
        }
      }, s.keywords.join(', ')))));
    case 'languages':
      return /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: '10pt',
          lineHeight: 1.8
        }
      }, (data.languages ?? []).map((l, i) => /*#__PURE__*/React.createElement("div", {
        key: i
      }, /*#__PURE__*/React.createElement("strong", null, l.language), l.fluency && /*#__PURE__*/React.createElement("span", {
        style: {
          color: '#666'
        }
      }, " \u2013 ", l.fluency))));
    default:
      return null;
  }
}
const SECTION_TITLES = {
  work: 'Work Experience',
  education: 'Education',
  skills: 'Skills',
  volunteer: 'Volunteer',
  languages: 'Languages'
};
function sectionLabel(key) {
  return SECTION_TITLES[key] ?? key;
}

/* Maps the meta.sectionOrder into <title + body> blocks using the
   template's own titleStyle. hasContent() lets templates hide empties. */
function Sections({
  data,
  order,
  titleStyle,
  accent,
  only
}) {
  const keys = (order && order.length ? order : ['work', 'education', 'skills', 'volunteer', 'languages']).filter(k => !only || only.includes(k));
  return keys.map(key => {
    const arr = data[key];
    if (!arr || arr.length === 0) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: key
    }, /*#__PURE__*/React.createElement("div", {
      style: titleStyle
    }, sectionLabel(key)), /*#__PURE__*/React.createElement(SectionBody, {
      kind: key,
      data: data,
      accent: accent
    }));
  });
}
const ALL_SECTIONS = ['work', 'education', 'skills', 'volunteer', 'languages'];
Object.assign(__ds_scope, { fmtDate, ContactLine, SectionBody, sectionLabel, Sections, ALL_SECTIONS });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/resume/resumeShared.jsx", error: String((e && e.message) || e) }); }

// components/resume/ClassicResume.jsx
try { (() => {
/* Classic — clean, single or two column, thin accent dividers under each
   section title. The CV Builder app's default template. */
function ClassicResume({
  data = {},
  meta = {}
}) {
  const m = {
    fontFamily: 'Calibri',
    headerFontFamily: 'Calibri',
    primaryColor: '#1f2937',
    accentColor: '#2563eb',
    pageMargins: 1.0,
    lineSpacing: 1.15,
    layout: 'single-column',
    sectionOrder: __ds_scope.ALL_SECTIONS,
    columnAssignment: {},
    ...meta
  };
  const basics = data.basics ?? {};
  const pad = m.pageMargins * 96;
  const order = m.sectionOrder?.length ? m.sectionOrder : __ds_scope.ALL_SECTIONS;
  const page = {
    fontFamily: `${m.fontFamily}, Arial, sans-serif`,
    fontSize: '11pt',
    lineHeight: m.lineSpacing,
    background: '#fff',
    color: '#000',
    width: '794px',
    minHeight: '1123px',
    padding: `${pad}px`,
    boxSizing: 'border-box'
  };
  const titleStyle = {
    fontFamily: `${m.headerFontFamily}, Arial, sans-serif`,
    fontSize: '13pt',
    fontWeight: 700,
    color: m.primaryColor,
    borderBottom: `1.5px solid ${m.primaryColor}`,
    paddingBottom: '2px',
    marginTop: '18px',
    marginBottom: '8px'
  };
  const header = /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: `${m.headerFontFamily}, Arial, sans-serif`,
      fontSize: '20pt',
      fontWeight: 700
    }
  }, basics.name), basics.label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '12pt',
      color: '#555',
      marginTop: '2px'
    }
  }, basics.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10pt',
      marginTop: '4px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.ContactLine, {
    basics: basics
  })));
  if (m.layout === 'two-column') {
    const ca = m.columnAssignment ?? {};
    const left = order.filter(s => (ca[s] ?? (['skills', 'languages'].includes(s) ? 'right' : 'left')) === 'left');
    const right = order.filter(s => (ca[s] ?? (['skills', 'languages'].includes(s) ? 'right' : 'left')) === 'right');
    return /*#__PURE__*/React.createElement("div", {
      style: page
    }, header, basics.summary && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '10pt',
        fontStyle: 'italic',
        marginBottom: '12px'
      }
    }, basics.summary), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '24px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: '0 0 58%'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Sections, {
      data: data,
      order: left,
      titleStyle: titleStyle,
      accent: m.accentColor
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Sections, {
      data: data,
      order: right,
      titleStyle: titleStyle,
      accent: m.accentColor
    }))));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: page
  }, header, basics.summary && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: titleStyle
  }, "Summary"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10pt'
    }
  }, basics.summary)), /*#__PURE__*/React.createElement(__ds_scope.Sections, {
    data: data,
    order: order,
    titleStyle: titleStyle,
    accent: m.accentColor
  }));
}
Object.assign(__ds_scope, { ClassicResume });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/resume/ClassicResume.jsx", error: String((e && e.message) || e) }); }

// components/resume/ExecutiveResume.jsx
try { (() => {
/* Executive — serif, left-aligned, restrained. A large name over a thin double
   rule, small-caps section titles. Reads as senior / traditional industries.
   New template added to the CV Builder set. */
function ExecutiveResume({
  data = {},
  meta = {}
}) {
  const m = {
    fontFamily: 'Georgia',
    headerFontFamily: 'Georgia',
    primaryColor: '#1a1a1a',
    accentColor: '#7c3aed',
    pageMargins: 1.0,
    lineSpacing: 1.15,
    sectionOrder: __ds_scope.ALL_SECTIONS,
    ...meta
  };
  const basics = data.basics ?? {};
  const pad = m.pageMargins * 96;
  const order = m.sectionOrder?.length ? m.sectionOrder : __ds_scope.ALL_SECTIONS;
  const page = {
    fontFamily: `${m.fontFamily}, 'Times New Roman', serif`,
    fontSize: '11pt',
    lineHeight: m.lineSpacing,
    background: '#fff',
    color: '#000',
    width: '794px',
    minHeight: '1123px',
    padding: `${pad}px`,
    boxSizing: 'border-box'
  };
  const titleStyle = {
    fontFamily: `${m.headerFontFamily}, serif`,
    fontSize: '11.5pt',
    fontWeight: 700,
    color: m.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    marginTop: '18px',
    marginBottom: '7px',
    paddingBottom: '3px',
    borderBottom: `1px solid #ccc`
  };
  return /*#__PURE__*/React.createElement("div", {
    style: page
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '4px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: `${m.headerFontFamily}, serif`,
      fontSize: '26pt',
      fontWeight: 700,
      letterSpacing: '0.01em',
      color: m.primaryColor
    }
  }, basics.name), basics.label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '12pt',
      color: m.accentColor,
      fontStyle: 'italic',
      marginTop: '1px'
    }
  }, basics.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: `2px solid ${m.primaryColor}`,
      borderBottom: `0.75px solid ${m.primaryColor}`,
      height: '3px',
      margin: '6px 0 8px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10pt'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.ContactLine, {
    basics: basics,
    sep: "   |   "
  })), basics.summary && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10.5pt',
      marginTop: '12px',
      textAlign: 'justify'
    }
  }, basics.summary), /*#__PURE__*/React.createElement(__ds_scope.Sections, {
    data: data,
    order: order,
    titleStyle: titleStyle,
    accent: m.accentColor
  }));
}
Object.assign(__ds_scope, { ExecutiveResume });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/resume/ExecutiveResume.jsx", error: String((e && e.message) || e) }); }

// components/resume/MinimalResume.jsx
try { (() => {
/* Minimal — typography only. Centered name, small uppercase letter-spaced grey
   labels, no rules or color blocks. Maximum ATS compatibility. */
function MinimalResume({
  data = {},
  meta = {}
}) {
  const m = {
    fontFamily: 'Georgia',
    headerFontFamily: 'Georgia',
    primaryColor: '#333333',
    accentColor: '#444444',
    pageMargins: 1.0,
    lineSpacing: 1.15,
    sectionOrder: __ds_scope.ALL_SECTIONS,
    ...meta
  };
  const basics = data.basics ?? {};
  const pad = m.pageMargins * 96;
  const order = m.sectionOrder?.length ? m.sectionOrder : __ds_scope.ALL_SECTIONS;
  const page = {
    fontFamily: `${m.fontFamily}, Arial, sans-serif`,
    fontSize: '11pt',
    lineHeight: m.lineSpacing,
    background: '#fff',
    color: '#000',
    width: '794px',
    minHeight: '1123px',
    padding: `${pad}px`,
    boxSizing: 'border-box'
  };
  const titleStyle = {
    fontFamily: `${m.headerFontFamily}, Arial, sans-serif`,
    fontSize: '10pt',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#333',
    marginTop: '20px',
    marginBottom: '8px'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: page
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: `${m.headerFontFamily}, Arial, sans-serif`,
      fontSize: '22pt',
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, basics.name), basics.label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11pt',
      color: '#555',
      marginTop: '3px'
    }
  }, basics.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10pt',
      color: '#777',
      marginTop: '4px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.ContactLine, {
    basics: basics,
    sep: "  \xB7  "
  }))), basics.summary && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10pt',
      color: '#444',
      marginBottom: '16px'
    }
  }, basics.summary), /*#__PURE__*/React.createElement(__ds_scope.Sections, {
    data: data,
    order: order,
    titleStyle: titleStyle,
    accent: m.accentColor
  }));
}
Object.assign(__ds_scope, { MinimalResume });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/resume/MinimalResume.jsx", error: String((e && e.message) || e) }); }

// components/resume/ModernResume.jsx
try { (() => {
/* Modern — bold full-width header block in the primary color with white text,
   uppercase letter-spaced accent section titles. */
function ModernResume({
  data = {},
  meta = {}
}) {
  const m = {
    fontFamily: 'Lato',
    headerFontFamily: 'Lato',
    primaryColor: '#4338ca',
    accentColor: '#6366f1',
    pageMargins: 1.0,
    lineSpacing: 1.15,
    layout: 'single-column',
    sectionOrder: __ds_scope.ALL_SECTIONS,
    columnAssignment: {},
    ...meta
  };
  const basics = data.basics ?? {};
  const pad = m.pageMargins * 96;
  const order = m.sectionOrder?.length ? m.sectionOrder : __ds_scope.ALL_SECTIONS;
  const page = {
    fontFamily: `${m.fontFamily}, Arial, sans-serif`,
    fontSize: '11pt',
    lineHeight: m.lineSpacing,
    background: '#fff',
    color: '#000',
    width: '794px',
    minHeight: '1123px',
    boxSizing: 'border-box'
  };
  const titleStyle = {
    fontFamily: `${m.headerFontFamily}, Arial, sans-serif`,
    fontSize: '12pt',
    fontWeight: 700,
    color: m.accentColor,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginTop: '16px',
    marginBottom: '8px'
  };
  const banner = /*#__PURE__*/React.createElement("div", {
    style: {
      background: m.primaryColor,
      color: '#fff',
      padding: `${pad}px ${pad}px ${pad * 0.75}px`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: `${m.headerFontFamily}, Arial, sans-serif`,
      fontSize: '22pt',
      fontWeight: 700
    }
  }, basics.name), basics.label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '12pt',
      opacity: 0.85,
      marginTop: '2px'
    }
  }, basics.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10pt',
      opacity: 0.78,
      marginTop: '4px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.ContactLine, {
    basics: basics
  })));
  if (m.layout === 'two-column') {
    const ca = m.columnAssignment ?? {};
    const left = order.filter(s => (ca[s] ?? (['skills', 'languages'].includes(s) ? 'right' : 'left')) === 'left');
    const right = order.filter(s => (ca[s] ?? (['skills', 'languages'].includes(s) ? 'right' : 'left')) === 'right');
    return /*#__PURE__*/React.createElement("div", {
      style: page
    }, banner, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: `${pad}px`
      }
    }, basics.summary && /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: '12px',
        fontSize: '10pt',
        color: '#444'
      }
    }, basics.summary), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '24px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: '0 0 58%'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Sections, {
      data: data,
      order: left,
      titleStyle: titleStyle,
      accent: m.accentColor
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Sections, {
      data: data,
      order: right,
      titleStyle: titleStyle,
      accent: m.accentColor
    })))));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: page
  }, banner, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `${pad}px`
    }
  }, basics.summary && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '12px',
      fontSize: '10pt',
      color: '#444'
    }
  }, basics.summary), /*#__PURE__*/React.createElement(__ds_scope.Sections, {
    data: data,
    order: order,
    titleStyle: titleStyle,
    accent: m.accentColor
  })));
}
Object.assign(__ds_scope, { ModernResume });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/resume/ModernResume.jsx", error: String((e && e.message) || e) }); }

// components/resume/SidebarResume.jsx
try { (() => {
/* Sidebar — fixed colored left rail (name, contact, skills, languages) beside a
   white main column (summary, work, education). Linear DOM order keeps it ATS-
   readable. New template added to the CV Builder set. */
function SidebarResume({
  data = {},
  meta = {}
}) {
  const m = {
    fontFamily: 'IBM Plex Sans',
    headerFontFamily: 'IBM Plex Sans',
    primaryColor: '#312e81',
    accentColor: '#6366f1',
    pageMargins: 1.0,
    lineSpacing: 1.15,
    sectionOrder: __ds_scope.ALL_SECTIONS,
    ...meta
  };
  const basics = data.basics ?? {};
  const pad = Math.max(m.pageMargins * 96 * 0.7, 34);
  const order = m.sectionOrder?.length ? m.sectionOrder : __ds_scope.ALL_SECTIONS;
  const page = {
    fontFamily: `${m.fontFamily}, Arial, sans-serif`,
    fontSize: '11pt',
    lineHeight: m.lineSpacing,
    background: '#fff',
    color: '#000',
    width: '794px',
    minHeight: '1123px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'stretch'
  };
  const railTitle = {
    fontFamily: `${m.headerFontFamily}, Arial, sans-serif`,
    fontSize: '10pt',
    fontWeight: 700,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginTop: '18px',
    marginBottom: '7px',
    paddingBottom: '3px',
    borderBottom: '1px solid rgba(255,255,255,0.35)'
  };
  const mainTitle = {
    fontFamily: `${m.headerFontFamily}, Arial, sans-serif`,
    fontSize: '12pt',
    fontWeight: 700,
    color: m.primaryColor,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginTop: '16px',
    marginBottom: '8px',
    paddingBottom: '2px',
    borderBottom: `2px solid ${m.accentColor}`
  };
  const railSections = order.filter(s => ['skills', 'languages'].includes(s));
  const mainSections = order.filter(s => !['skills', 'languages'].includes(s));
  return /*#__PURE__*/React.createElement("div", {
    style: page
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '0 0 33%',
      background: m.primaryColor,
      color: '#fff',
      padding: `${pad}px`,
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: `${m.headerFontFamily}, Arial, sans-serif`,
      fontSize: '18pt',
      fontWeight: 700,
      lineHeight: 1.1
    }
  }, basics.name), basics.label && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10.5pt',
      opacity: 0.85,
      marginTop: '3px'
    }
  }, basics.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '9pt',
      opacity: 0.9,
      marginTop: '12px',
      lineHeight: 1.9,
      wordBreak: 'break-word'
    }
  }, [basics.email, basics.phone, basics.url, [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')].filter(Boolean).map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, p))), railSections.includes('skills') && (data.skills ?? []).length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: railTitle
  }, "Skills"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '9.5pt',
      lineHeight: 1.6
    }
  }, (data.skills ?? []).map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      marginBottom: '6px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600
    }
  }, s.name, s.level && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 400,
      opacity: 0.8
    }
  }, " \xB7 ", s.level)), (s.keywords ?? []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      opacity: 0.85
    }
  }, s.keywords.join(', ')))))), railSections.includes('languages') && (data.languages ?? []).length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: railTitle
  }, "Languages"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '9.5pt',
      lineHeight: 1.7
    }
  }, (data.languages ?? []).map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("strong", null, l.language), l.fluency && /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.85
    }
  }, " \u2013 ", l.fluency)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: `${pad}px`,
      boxSizing: 'border-box'
    }
  }, basics.summary && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '10pt',
      color: '#444',
      marginBottom: '6px'
    }
  }, basics.summary), /*#__PURE__*/React.createElement(__ds_scope.Sections, {
    data: data,
    order: mainSections,
    titleStyle: mainTitle,
    accent: m.accentColor
  })));
}
Object.assign(__ds_scope, { SidebarResume });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/resume/SidebarResume.jsx", error: String((e && e.message) || e) }); }

// ui_kits/cv-builder/kit-editor.jsx
try { (() => {
/* CV Builder — UI kit editor screen. Split layout: left control panel
   (Edit / Design / ATS tabs) and a live, scaled résumé preview that updates as
   design knobs change. Builds on window.CVKit + the design-system primitives. */
const E_NS = window.CVBuilderDesignSystem_1d5ed3;
const {
  Button: EBtn,
  Input: EInput,
  Select: ESelect,
  Tabs: ETabs,
  RangeSlider: ESlider,
  ScoreBar: EScoreBar,
  Badge: EBadge,
  Avatar: EAvatar
} = E_NS;
const ATS_FONTS = ['Calibri', 'Arial', 'Helvetica', 'Garamond', 'Cambria', 'Georgia', 'Lato', 'Roboto', 'IBM Plex Sans'];
const TEMPLATE_CARDS = [{
  id: 'classic',
  label: 'Classic',
  desc: 'Clean, thin accent dividers'
}, {
  id: 'modern',
  label: 'Modern',
  desc: 'Bold colored header block'
}, {
  id: 'minimal',
  label: 'Minimal',
  desc: 'Typography only · max ATS'
}, {
  id: 'executive',
  label: 'Executive',
  desc: 'Serif, senior tone'
}, {
  id: 'sidebar',
  label: 'Sidebar',
  desc: 'Colored left rail'
}];
const SWATCHES = ['#1f2937', '#4338ca', '#312e81', '#7c3aed', '#0f766e', '#9d174d', '#b45309'];
function FieldLabel({
  children
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      fontWeight: 500,
      color: 'var(--brand-primary)',
      marginBottom: 6
    }
  }, children);
}

/* -------- Edit tab (simplified, cosmetic forms) -------- */
function EditPanel({
  data,
  setBasics
}) {
  const b = data.basics;
  const sectionHead = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-heading)',
    margin: '0 0 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: sectionHead
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--brand-accent)'
    }
  }, "\u25CF"), " Basics"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "Full name"), /*#__PURE__*/React.createElement(EInput, {
    value: b.name,
    onChange: e => setBasics('name', e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "Headline"), /*#__PURE__*/React.createElement(EInput, {
    value: b.label,
    onChange: e => setBasics('label', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "Email"), /*#__PURE__*/React.createElement(EInput, {
    value: b.email,
    onChange: e => setBasics('email', e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "Phone"), /*#__PURE__*/React.createElement(EInput, {
    value: b.phone,
    onChange: e => setBasics('phone', e.target.value)
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "Summary ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--brand-accent)',
      fontWeight: 600
    }
  }, "\u2728 AI")), /*#__PURE__*/React.createElement("textarea", {
    value: b.summary,
    onChange: e => setBasics('summary', e.target.value),
    style: {
      width: '100%',
      boxSizing: 'border-box',
      height: 84,
      resize: 'none',
      fontFamily: 'var(--font-ui)',
      fontSize: 13,
      color: 'var(--text-heading)',
      background: 'rgba(255,255,255,0.7)',
      padding: '8px 10px',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      outline: 'none'
    }
  })))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: sectionHead
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--brand-accent)'
    }
  }, "\u25CF"), " Work Experience"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, data.work.map((w, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '10px 12px',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      background: 'rgba(255,255,255,0.5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-heading)'
    }
  }, w.position), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, "\u283F")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, w.name, " \xB7 ", (w.highlights || []).length, " highlights"))), /*#__PURE__*/React.createElement("button", {
    style: {
      fontSize: 13,
      color: 'var(--brand-primary)',
      background: 'transparent',
      border: '1px dashed var(--border-strong)',
      borderRadius: 'var(--radius-lg)',
      padding: '8px',
      cursor: 'pointer'
    }
  }, "+ Add role"))));
}

/* -------- Design tab -------- */
function DesignPanel({
  meta,
  setMeta
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "Template"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, TEMPLATE_CARDS.map(t => {
    const on = meta.templateId === t.id;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      onClick: () => setMeta({
        templateId: t.id,
        ...SampleMetaFor(t.id)
      }),
      style: {
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        background: on ? 'var(--indigo-50)' : 'rgba(255,255,255,0.55)',
        border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border-subtle)'}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-heading)'
      }
    }, t.label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--text-muted)',
        marginTop: 1
      }
    }, t.desc));
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "Layout"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, ['single-column', 'two-column'].map(l => {
    const on = meta.layout === l;
    return /*#__PURE__*/React.createElement("button", {
      key: l,
      onClick: () => setMeta({
        layout: l
      }),
      style: {
        flex: 1,
        padding: '8px',
        fontSize: 13,
        fontWeight: on ? 600 : 400,
        cursor: 'pointer',
        borderRadius: 'var(--radius-lg)',
        background: on ? 'var(--indigo-50)' : 'transparent',
        color: on ? 'var(--brand-primary)' : 'var(--text-muted)',
        border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border-subtle)'}`
      }
    }, l === 'single-column' ? 'Single column' : 'Two columns');
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "Body font"), /*#__PURE__*/React.createElement(ESelect, {
    value: meta.fontFamily,
    onChange: e => setMeta({
      fontFamily: e.target.value
    }),
    options: ATS_FONTS
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "Heading font"), /*#__PURE__*/React.createElement(ESelect, {
    value: meta.headerFontFamily,
    onChange: e => setMeta({
      headerFontFamily: e.target.value
    }),
    options: ATS_FONTS
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "Accent color"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, SWATCHES.map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    onClick: () => setMeta({
      accentColor: c,
      primaryColor: c
    }),
    "aria-label": c,
    style: {
      width: 26,
      height: 26,
      borderRadius: 'var(--radius-full)',
      background: c,
      cursor: 'pointer',
      border: meta.accentColor === c ? '2px solid var(--text-heading)' : '2px solid #fff',
      boxShadow: 'var(--shadow-sm)',
      outline: meta.accentColor === c ? '1px solid var(--border-strong)' : 'none'
    }
  })))), /*#__PURE__*/React.createElement(ESlider, {
    label: "Page margins",
    value: meta.pageMargins,
    min: 0.5,
    max: 1.5,
    step: 0.1,
    unit: '"',
    onChange: v => setMeta({
      pageMargins: v
    }),
    minLabel: '0.5" (min)',
    maxLabel: '1.5"'
  }), /*#__PURE__*/React.createElement(ESlider, {
    label: "Line spacing",
    value: meta.lineSpacing,
    min: 1.0,
    max: 1.15,
    step: 0.05,
    onChange: v => setMeta({
      lineSpacing: v
    }),
    minLabel: "1.00",
    maxLabel: "1.15"
  }));
}
function SampleMetaFor(id) {
  const m = window.CVBuilderDesignSystem_1d5ed3.SampleMeta[id] || {};
  return {
    fontFamily: m.fontFamily,
    headerFontFamily: m.headerFontFamily,
    primaryColor: m.primaryColor,
    accentColor: m.accentColor
  };
}

/* -------- ATS tab -------- */
const BREAKDOWN = [{
  label: 'Format & Structure',
  value: 22,
  max: 25
}, {
  label: 'Keyword Coverage',
  value: 26,
  max: 35
}, {
  label: 'Keyword Placement',
  value: 19,
  max: 25
}, {
  label: 'Metric Presence',
  value: 12,
  max: 15
}];
const MATCHED = ['Figma', 'Design Systems', 'Prototyping', 'Usability Testing', 'A/B Testing', 'Roadmap'];
const MISSING = ['REST APIs', 'Design Tokens', 'WCAG', 'Storybook', 'Stakeholder'];
function AtsPanel() {
  const [analyzed, setAnalyzed] = React.useState(true);
  const total = 79;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "Paste job description"), /*#__PURE__*/React.createElement("textarea", {
    defaultValue: "Senior Product Designer \u2014 own end-to-end design for our fintech platform. Partner with engineering on REST APIs, maintain our design tokens and Storybook, and ensure WCAG accessibility\u2026",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      height: 92,
      resize: 'none',
      fontFamily: 'var(--font-ui)',
      fontSize: 13,
      color: 'var(--text-heading)',
      background: 'rgba(255,255,255,0.7)',
      padding: '8px 10px',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(EBtn, {
    size: "sm",
    onClick: () => setAnalyzed(true)
  }, "Analyze"))), analyzed && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '18px 0',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-glass)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-md)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, "ATS Score"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 52,
      fontWeight: 700,
      color: 'var(--green-600)',
      lineHeight: 1.1
    }
  }, total), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-faint)'
    }
  }, "out of 100")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: 16,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-glass)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-md)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-heading)'
    }
  }, "Score breakdown"), BREAKDOWN.map(b => /*#__PURE__*/React.createElement(EScoreBar, {
    key: b.label,
    label: b.label,
    value: b.value,
    max: b.max
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      background: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: 'var(--radius-xl)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--red-600)',
      marginBottom: 8
    }
  }, "Missing keywords (", MISSING.length, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, MISSING.map(k => /*#__PURE__*/React.createElement(EBadge, {
    key: k,
    variant: "missing"
  }, k)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: 'var(--radius-xl)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--green-600)',
      marginBottom: 8
    }
  }, "Matched keywords (", MATCHED.length, ")"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, MATCHED.map(k => /*#__PURE__*/React.createElement(EBadge, {
    key: k,
    variant: "matched"
  }, "\u2713 ", k))))));
}
window.CVKitEditor = {
  EditPanel,
  DesignPanel,
  AtsPanel
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/cv-builder/kit-editor.jsx", error: String((e && e.message) || e) }); }

// ui_kits/cv-builder/kit-screens.jsx
try { (() => {
/* CV Builder — UI kit screens. A cosmetic, click-through recreation of the
   product: sign-in → dashboard (My CVs) → editor (Edit / Design / ATS + live
   preview). Composes the design-system primitives off window.<Namespace>. */
const NS = window.CVBuilderDesignSystem_1d5ed3;
const {
  Button,
  Badge,
  Input,
  Select,
  Tabs,
  RangeSlider,
  ScoreBar,
  Avatar,
  Logo,
  PlasmaBackground,
  ClassicResume,
  ModernResume,
  MinimalResume,
  ExecutiveResume,
  SidebarResume,
  SampleResume,
  SampleMeta
} = NS;
const TEMPLATES = {
  classic: ClassicResume,
  modern: ModernResume,
  minimal: MinimalResume,
  executive: ExecutiveResume,
  sidebar: SidebarResume
};

/* ----------------------------- Frosted navbar ----------------------------- */
function Navbar({
  left,
  right
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      height: 64,
      padding: '0 20px',
      background: 'var(--surface-nav)',
      backdropFilter: 'blur(var(--blur-glass))',
      WebkitBackdropFilter: 'blur(var(--blur-glass))',
      borderBottom: '1px solid var(--border-glass)',
      boxShadow: 'var(--shadow-sm)',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      zIndex: 1
    }
  }, left), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)',
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    size: 34
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      zIndex: 1
    }
  }, right));
}
const USER = {
  name: 'Maya Hartfield',
  email: 'maya.hartfield@email.com'
};
function ProfilePill() {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 10px 4px 4px',
      borderRadius: 'var(--radius-full)',
      background: 'rgba(255,255,255,0.7)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-sm)'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: USER.name,
    size: 26
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 500,
      color: 'var(--text-body)'
    }
  }, "Maya"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-faint)',
      fontSize: 10
    }
  }, "\u25BE"));
}

/* ------------------------------ Sign-in ------------------------------ */
function SignInScreen({
  onSignIn
}) {
  const oauthBtn = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    padding: '10px 16px',
    borderRadius: 'var(--radius-lg)',
    fontFamily: 'var(--font-ui)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)'
  };
  return /*#__PURE__*/React.createElement(PlasmaBackground, {
    color: "#4f46e5",
    speed: 0.5,
    scale: 1.2,
    opacity: 0.5
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 340,
      background: 'rgba(255,255,255,0.7)',
      backdropFilter: 'blur(var(--blur-glass))',
      WebkitBackdropFilter: 'blur(var(--blur-glass))',
      border: '1px solid var(--border-glass)',
      borderRadius: 'var(--radius-2xl)',
      boxShadow: 'var(--shadow-xl)',
      padding: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    size: 44,
    showWordmark: false
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 700,
      background: 'var(--brand-gradient)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent'
    }
  }, "CV Builder"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, "Sign in to continue")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onSignIn,
    style: {
      ...oauthBtn,
      background: 'rgba(255,255,255,0.9)',
      color: 'var(--gray-700)',
      border: '1px solid var(--border-default)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z",
    fill: "#4285F4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z",
    fill: "#34A853"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z",
    fill: "#FBBC05"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z",
    fill: "#EA4335"
  })), "Continue with Google"), /*#__PURE__*/React.createElement("button", {
    onClick: onSignIn,
    style: {
      ...oauthBtn,
      background: 'var(--gray-900)',
      color: '#fff',
      border: '1px solid transparent'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "#fff",
    "aria-hidden": "true",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    clipRule: "evenodd",
    d: "M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
  })), "Continue with GitHub")))));
}

/* ------------------------------ Dashboard ------------------------------ */
const RESUMES = [{
  id: 1,
  title: 'Product Design — 2026',
  role: 'Senior Product Designer',
  template: 'modern',
  layout: 'single-column',
  sections: 6,
  score: 23,
  created: 'May 12, 2026',
  updated: '2 hours ago'
}, {
  id: 2,
  title: 'Maya Hartfield (Master)',
  role: 'Senior Product Designer',
  template: 'classic',
  layout: 'two-column',
  sections: 6,
  score: 21,
  created: 'Apr 02, 2026',
  updated: 'Yesterday'
}, {
  id: 3,
  title: 'Design Systems Lead',
  role: 'Design Systems Lead',
  template: 'executive',
  layout: 'single-column',
  sections: 5,
  score: 18,
  created: 'Mar 21, 2026',
  updated: '5 days ago'
}];
function ResumeRow({
  r,
  onOpen
}) {
  const scoreColor = r.score >= 20 ? 'var(--green-600)' : r.score >= 10 ? 'var(--yellow-600)' : 'var(--red-500)';
  const meta = [['Created', r.created], ['Last edited', r.updated], ['Sections', r.sections + ' filled'], ['Layout', r.layout.replace('-', ' ')]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      backdropFilter: 'blur(var(--blur-glass))',
      WebkitBackdropFilter: 'blur(var(--blur-glass))',
      border: '1px solid var(--border-glass)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-lg)',
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: 'var(--text-heading)',
      fontSize: 15
    }
  }, r.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, r.role, " \xB7 ", r.template, " template")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: onOpen
  }, "Open"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary"
  }, "\u2193 JSON"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost"
  }, "\u29C9"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 24,
      borderTop: '1px solid var(--border-subtle)',
      marginTop: 12,
      paddingTop: 12
    }
  }, meta.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '.06em',
      color: 'var(--text-muted)'
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-heading)',
      marginTop: 2,
      textTransform: k === 'Layout' ? 'capitalize' : 'none'
    }
  }, v))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '.06em',
      color: 'var(--text-muted)'
    }
  }, "Format score"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: scoreColor,
      marginTop: 2
    }
  }, r.score, "/25"))));
}
function DashboardScreen({
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%'
    }
  }, /*#__PURE__*/React.createElement(Navbar, {
    left: /*#__PURE__*/React.createElement("span", null),
    right: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: onOpen
    }, "+ New CV"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary"
    }, "\u2191 Upload CV"), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 1,
        height: 16,
        background: 'var(--border-default)'
      }
    }), /*#__PURE__*/React.createElement(ProfilePill, null))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760,
      margin: '0 auto',
      padding: '32px 20px'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 24,
      fontWeight: 700,
      color: 'var(--brand-primary)',
      margin: '0 0 20px'
    }
  }, "My CVs"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, RESUMES.map(r => /*#__PURE__*/React.createElement(ResumeRow, {
    key: r.id,
    r: r,
    onOpen: onOpen
  })))));
}
window.CVKit = {
  Navbar,
  ProfilePill,
  SignInScreen,
  DashboardScreen,
  TEMPLATES,
  USER,
  RESUMES
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/cv-builder/kit-screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.GlassCard = __ds_scope.GlassCard;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.RangeSlider = __ds_scope.RangeSlider;

__ds_ns.ScoreBar = __ds_scope.ScoreBar;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.PlasmaBackground = __ds_scope.PlasmaBackground;

__ds_ns.ClassicResume = __ds_scope.ClassicResume;

__ds_ns.ExecutiveResume = __ds_scope.ExecutiveResume;

__ds_ns.MinimalResume = __ds_scope.MinimalResume;

__ds_ns.ModernResume = __ds_scope.ModernResume;

__ds_ns.SidebarResume = __ds_scope.SidebarResume;

__ds_ns.SampleResume = __ds_scope.SampleResume;

__ds_ns.SampleMeta = __ds_scope.SampleMeta;

__ds_ns.ContactLine = __ds_scope.ContactLine;

__ds_ns.SectionBody = __ds_scope.SectionBody;

__ds_ns.Sections = __ds_scope.Sections;

__ds_ns.ALL_SECTIONS = __ds_scope.ALL_SECTIONS;

})();
