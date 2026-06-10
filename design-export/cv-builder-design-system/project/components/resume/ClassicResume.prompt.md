CV document templates — full A4 résumé layouts rendered from JSON-Resume data. Use one as the canvas when generating or previewing a candidate's CV.

```jsx
const { ClassicResume, ModernResume, MinimalResume, ExecutiveResume, SidebarResume, SampleResume, SampleMeta } = window.CVBuilder

<ClassicResume data={SampleResume} meta={SampleMeta.classic} />
<ModernResume  data={SampleResume} meta={{ primaryColor: '#4338ca', accentColor: '#6366f1' }} />
```

All five take `{ data, meta }`:
- **ClassicResume** — centered header, thin accent dividers (default).
- **ModernResume** — bold colored header banner, uppercase accent titles.
- **MinimalResume** — typography only, max ATS compatibility.
- **ExecutiveResume** — serif, senior/traditional tone.
- **SidebarResume** — colored left rail for skills/contact + main column.

`meta` knobs: `fontFamily`, `headerFontFamily`, `primaryColor`, `accentColor`, `pageMargins` (0.5–1.5 in), `lineSpacing` (1.0–1.15), `sectionOrder`, `layout` ('single-column' | 'two-column'). Classic & Modern support two-column via `columnAssignment`. Each renders a fixed 794px-wide (A4) page — scale it down for thumbnails with `transform: scale()`.
