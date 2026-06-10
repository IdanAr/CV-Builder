Indigo action button for the app chrome — navbar exports, editor controls, dashboard actions.

```jsx
const { Button } = window.CVBuilder
<Button onClick={save}>Save</Button>
<Button variant="secondary">JSON</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="danger" size="sm">Delete</Button>
```

Variants: `primary` (indigo fill), `secondary` (white + border), `ghost` (text only), `danger` (red outline). Sizes: `sm`, `md`, `lg`.
