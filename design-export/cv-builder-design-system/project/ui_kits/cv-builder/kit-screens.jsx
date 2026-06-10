/* CV Builder — UI kit screens. A cosmetic, click-through recreation of the
   product: sign-in → dashboard (My CVs) → editor (Edit / Design / ATS + live
   preview). Composes the design-system primitives off window.<Namespace>. */
const NS = window.CVBuilderDesignSystem_1d5ed3;
const { Button, Badge, Input, Select, Tabs, RangeSlider, ScoreBar, Avatar, Logo,
        PlasmaBackground,
        ClassicResume, ModernResume, MinimalResume, ExecutiveResume, SidebarResume,
        SampleResume, SampleMeta } = NS;

const TEMPLATES = {
  classic: ClassicResume, modern: ModernResume, minimal: MinimalResume,
  executive: ExecutiveResume, sidebar: SidebarResume,
};

/* ----------------------------- Frosted navbar ----------------------------- */
function Navbar({ left, right }) {
  return (
    <nav style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 64,
      padding: '0 20px', background: 'var(--surface-nav)', backdropFilter: 'blur(var(--blur-glass))',
      WebkitBackdropFilter: 'blur(var(--blur-glass))', borderBottom: '1px solid var(--border-glass)',
      boxShadow: 'var(--shadow-sm)', zIndex: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, zIndex: 1 }}>{left}</div>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
        <Logo size={34} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 }}>{right}</div>
    </nav>
  );
}

const USER = { name: 'Maya Hartfield', email: 'maya.hartfield@email.com' };

function ProfilePill() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px',
      borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.7)',
      border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
      <Avatar name={USER.name} size={26} />
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-body)' }}>Maya</span>
      <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>▾</span>
    </span>
  );
}

/* ------------------------------ Sign-in ------------------------------ */
function SignInScreen({ onSignIn }) {
  const oauthBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%',
    padding: '10px 16px', borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-ui)',
    fontSize: 14, fontWeight: 500, cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
  };
  return (
    <PlasmaBackground color="#4f46e5" speed={0.5} scale={1.2} opacity={0.5}>
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 340, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(var(--blur-glass))',
        WebkitBackdropFilter: 'blur(var(--blur-glass))', border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-xl)', padding: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 22 }}>
          <Logo size={44} showWordmark={false} />
          <div style={{ fontSize: 22, fontWeight: 700, background: 'var(--brand-gradient)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>CV Builder</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sign in to continue</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={onSignIn} style={{ ...oauthBtn, background: 'rgba(255,255,255,0.9)',
            color: 'var(--gray-700)', border: '1px solid var(--border-default)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          <button onClick={onSignIn} style={{ ...oauthBtn, background: 'var(--gray-900)', color: '#fff', border: '1px solid transparent' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            Continue with GitHub
          </button>
        </div>
      </div>
      </div>
    </PlasmaBackground>
  );
}

/* ------------------------------ Dashboard ------------------------------ */
const RESUMES = [
  { id: 1, title: 'Product Design — 2026', role: 'Senior Product Designer', template: 'modern', layout: 'single-column', sections: 6, score: 23, created: 'May 12, 2026', updated: '2 hours ago' },
  { id: 2, title: 'Maya Hartfield (Master)', role: 'Senior Product Designer', template: 'classic', layout: 'two-column', sections: 6, score: 21, created: 'Apr 02, 2026', updated: 'Yesterday' },
  { id: 3, title: 'Design Systems Lead', role: 'Design Systems Lead', template: 'executive', layout: 'single-column', sections: 5, score: 18, created: 'Mar 21, 2026', updated: '5 days ago' },
];

function ResumeRow({ r, onOpen }) {
  const scoreColor = r.score >= 20 ? 'var(--green-600)' : r.score >= 10 ? 'var(--yellow-600)' : 'var(--red-500)';
  const meta = [['Created', r.created], ['Last edited', r.updated], ['Sections', r.sections + ' filled'],
    ['Layout', r.layout.replace('-', ' ')]];
  return (
    <div style={{ background: 'var(--surface-card)', backdropFilter: 'blur(var(--blur-glass))',
      WebkitBackdropFilter: 'blur(var(--blur-glass))', border: '1px solid var(--border-glass)',
      borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: 15 }}>{r.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{r.role} · {r.template} template</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button size="sm" onClick={onOpen}>Open</Button>
          <Button size="sm" variant="secondary">↓ JSON</Button>
          <Button size="sm" variant="ghost">⧉</Button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, borderTop: '1px solid var(--border-subtle)',
        marginTop: 12, paddingTop: 12 }}>
        {meta.map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>{k}</div>
            <div style={{ fontSize: 13, color: 'var(--text-heading)', marginTop: 2, textTransform: k === 'Layout' ? 'capitalize' : 'none' }}>{v}</div>
          </div>
        ))}
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>Format score</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: scoreColor, marginTop: 2 }}>{r.score}/25</div>
        </div>
      </div>
    </div>
  );
}

function DashboardScreen({ onOpen }) {
  return (
    <div style={{ minHeight: '100%' }}>
      <Navbar
        left={<span />}
        right={<><Button size="sm" onClick={onOpen}>+ New CV</Button>
          <Button size="sm" variant="secondary">↑ Upload CV</Button>
          <div style={{ width: 1, height: 16, background: 'var(--border-default)' }} />
          <ProfilePill /></>} />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand-primary)', margin: '0 0 20px' }}>My CVs</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {RESUMES.map((r) => <ResumeRow key={r.id} r={r} onOpen={onOpen} />)}
        </div>
      </div>
    </div>
  );
}

window.CVKit = { Navbar, ProfilePill, SignInScreen, DashboardScreen, TEMPLATES, USER, RESUMES };
