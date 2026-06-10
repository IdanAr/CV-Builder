/* CV Builder — UI kit editor screen. Split layout: left control panel
   (Edit / Design / ATS tabs) and a live, scaled résumé preview that updates as
   design knobs change. Builds on window.CVKit + the design-system primitives. */
const E_NS = window.CVBuilderDesignSystem_1d5ed3;
const { Button: EBtn, Input: EInput, Select: ESelect, Tabs: ETabs, RangeSlider: ESlider,
        ScoreBar: EScoreBar, Badge: EBadge, Avatar: EAvatar } = E_NS;

const ATS_FONTS = ['Calibri', 'Arial', 'Helvetica', 'Garamond', 'Cambria', 'Georgia', 'Lato', 'Roboto', 'IBM Plex Sans'];
const TEMPLATE_CARDS = [
  { id: 'classic', label: 'Classic', desc: 'Clean, thin accent dividers' },
  { id: 'modern', label: 'Modern', desc: 'Bold colored header block' },
  { id: 'minimal', label: 'Minimal', desc: 'Typography only · max ATS' },
  { id: 'executive', label: 'Executive', desc: 'Serif, senior tone' },
  { id: 'sidebar', label: 'Sidebar', desc: 'Colored left rail' },
];
const SWATCHES = ['#1f2937', '#4338ca', '#312e81', '#7c3aed', '#0f766e', '#9d174d', '#b45309'];

function FieldLabel({ children }) {
  return <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--brand-primary)', marginBottom: 6 }}>{children}</label>;
}

/* -------- Edit tab (simplified, cosmetic forms) -------- */
function EditPanel({ data, setBasics }) {
  const b = data.basics;
  const sectionHead = { fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 10px',
    display: 'flex', alignItems: 'center', gap: 8 };
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <p style={sectionHead}><span style={{ color: 'var(--brand-accent)' }}>●</span> Basics</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <div><FieldLabel>Full name</FieldLabel><EInput value={b.name} onChange={(e) => setBasics('name', e.target.value)} /></div>
          <div><FieldLabel>Headline</FieldLabel><EInput value={b.label} onChange={(e) => setBasics('label', e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><FieldLabel>Email</FieldLabel><EInput value={b.email} onChange={(e) => setBasics('email', e.target.value)} /></div>
            <div><FieldLabel>Phone</FieldLabel><EInput value={b.phone} onChange={(e) => setBasics('phone', e.target.value)} /></div>
          </div>
          <div>
            <FieldLabel>Summary <span style={{ color: 'var(--brand-accent)', fontWeight: 600 }}>✨ AI</span></FieldLabel>
            <textarea value={b.summary} onChange={(e) => setBasics('summary', e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', height: 84, resize: 'none', fontFamily: 'var(--font-ui)',
                fontSize: 13, color: 'var(--text-heading)', background: 'rgba(255,255,255,0.7)', padding: '8px 10px',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', outline: 'none' }} />
          </div>
        </div>
      </div>
      <div>
        <p style={sectionHead}><span style={{ color: 'var(--brand-accent)' }}>●</span> Work Experience</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.work.map((w, i) => (
            <div key={i} style={{ padding: '10px 12px', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{w.position}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⠿</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{w.name} · {(w.highlights || []).length} highlights</div>
            </div>
          ))}
          <button style={{ fontSize: 13, color: 'var(--brand-primary)', background: 'transparent', border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius-lg)', padding: '8px', cursor: 'pointer' }}>+ Add role</button>
        </div>
      </div>
    </div>
  );
}

/* -------- Design tab -------- */
function DesignPanel({ meta, setMeta }) {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <FieldLabel>Template</FieldLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TEMPLATE_CARDS.map((t) => {
            const on = meta.templateId === t.id;
            return (
              <button key={t.id} onClick={() => setMeta({ templateId: t.id, ...SampleMetaFor(t.id) })}
                style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                  background: on ? 'var(--indigo-50)' : 'rgba(255,255,255,0.55)',
                  border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border-subtle)'}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>{t.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{t.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <FieldLabel>Layout</FieldLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {['single-column', 'two-column'].map((l) => {
            const on = meta.layout === l;
            return (
              <button key={l} onClick={() => setMeta({ layout: l })}
                style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: on ? 600 : 400, cursor: 'pointer',
                  borderRadius: 'var(--radius-lg)', background: on ? 'var(--indigo-50)' : 'transparent',
                  color: on ? 'var(--brand-primary)' : 'var(--text-muted)',
                  border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border-subtle)'}` }}>
                {l === 'single-column' ? 'Single column' : 'Two columns'}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><FieldLabel>Body font</FieldLabel><ESelect value={meta.fontFamily} onChange={(e) => setMeta({ fontFamily: e.target.value })} options={ATS_FONTS} /></div>
        <div><FieldLabel>Heading font</FieldLabel><ESelect value={meta.headerFontFamily} onChange={(e) => setMeta({ headerFontFamily: e.target.value })} options={ATS_FONTS} /></div>
      </div>
      <div>
        <FieldLabel>Accent color</FieldLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {SWATCHES.map((c) => (
            <button key={c} onClick={() => setMeta({ accentColor: c, primaryColor: c })} aria-label={c}
              style={{ width: 26, height: 26, borderRadius: 'var(--radius-full)', background: c, cursor: 'pointer',
                border: meta.accentColor === c ? '2px solid var(--text-heading)' : '2px solid #fff',
                boxShadow: 'var(--shadow-sm)', outline: meta.accentColor === c ? '1px solid var(--border-strong)' : 'none' }} />
          ))}
        </div>
      </div>
      <ESlider label="Page margins" value={meta.pageMargins} min={0.5} max={1.5} step={0.1} unit={'"'}
        onChange={(v) => setMeta({ pageMargins: v })} minLabel={'0.5" (min)'} maxLabel={'1.5"'} />
      <ESlider label="Line spacing" value={meta.lineSpacing} min={1.0} max={1.15} step={0.05}
        onChange={(v) => setMeta({ lineSpacing: v })} minLabel="1.00" maxLabel="1.15" />
    </div>
  );
}

function SampleMetaFor(id) {
  const m = window.CVBuilderDesignSystem_1d5ed3.SampleMeta[id] || {};
  return { fontFamily: m.fontFamily, headerFontFamily: m.headerFontFamily, primaryColor: m.primaryColor, accentColor: m.accentColor };
}

/* -------- ATS tab -------- */
const BREAKDOWN = [
  { label: 'Format & Structure', value: 22, max: 25 },
  { label: 'Keyword Coverage', value: 26, max: 35 },
  { label: 'Keyword Placement', value: 19, max: 25 },
  { label: 'Metric Presence', value: 12, max: 15 },
];
const MATCHED = ['Figma', 'Design Systems', 'Prototyping', 'Usability Testing', 'A/B Testing', 'Roadmap'];
const MISSING = ['REST APIs', 'Design Tokens', 'WCAG', 'Storybook', 'Stakeholder'];

function AtsPanel() {
  const [analyzed, setAnalyzed] = React.useState(true);
  const total = 79;
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <FieldLabel>Paste job description</FieldLabel>
        <textarea defaultValue="Senior Product Designer — own end-to-end design for our fintech platform. Partner with engineering on REST APIs, maintain our design tokens and Storybook, and ensure WCAG accessibility…"
          style={{ width: '100%', boxSizing: 'border-box', height: 92, resize: 'none', fontFamily: 'var(--font-ui)',
            fontSize: 13, color: 'var(--text-heading)', background: 'rgba(255,255,255,0.7)', padding: '8px 10px',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', outline: 'none' }} />
        <div style={{ marginTop: 8 }}><EBtn size="sm" onClick={() => setAnalyzed(true)}>Analyze</EBtn></div>
      </div>
      {analyzed && (
        <>
          <div style={{ textAlign: 'center', padding: '18px 0', background: 'var(--surface-card)',
            border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ATS Score</div>
            <div style={{ fontSize: 52, fontWeight: 700, color: 'var(--green-600)', lineHeight: 1.1 }}>{total}</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>out of 100</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'var(--surface-card)',
            border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>Score breakdown</div>
            {BREAKDOWN.map((b) => <EScoreBar key={b.label} label={b.label} value={b.value} max={b.max} />)}
          </div>
          <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red-600)', marginBottom: 8 }}>Missing keywords ({MISSING.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{MISSING.map((k) => <EBadge key={k} variant="missing">{k}</EBadge>)}</div>
          </div>
          <div style={{ padding: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-600)', marginBottom: 8 }}>Matched keywords ({MATCHED.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{MATCHED.map((k) => <EBadge key={k} variant="matched">✓ {k}</EBadge>)}</div>
          </div>
        </>
      )}
    </div>
  );
}

window.CVKitEditor = { EditPanel, DesignPanel, AtsPanel };
