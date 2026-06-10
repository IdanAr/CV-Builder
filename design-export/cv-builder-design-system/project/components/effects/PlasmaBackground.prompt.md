Animated WebGL plasma backdrop — the brand's sign-in and marketing-hero background. Indigo plasma under a soft white wash, content on top.

```jsx
const { PlasmaBackground } = window.CVBuilderDesignSystem_1d5ed3

<div style={{ height: '100vh' }}>
  <PlasmaBackground color="#4f46e5" speed={0.5} scale={1.2} opacity={0.5}>
    <SignInCard />
  </PlasmaBackground>
</div>
```

Fill a positioned, explicitly-sized parent (it is `width:100%; height:100%`). Loads OGL from CDN on mount and cleans up on unmount; falls back to a flat indigo wash without WebGL2. Set `overlay={false}` for a bolder, un-washed field; `mouseInteractive={false}` to disable cursor parallax.
