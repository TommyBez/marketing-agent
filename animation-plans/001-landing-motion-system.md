# 001 - Build a restrained landing motion system

- **Status**: DONE
- **Commit**: 55069ff
- **Severity**: MEDIUM
- **Category**: Purpose, cohesion, accessibility, missed opportunities
- **Estimated scope**: 5 files, one client-leaf module plus targeted landing edits

## Problem

The landing currently animates only two large hero blocks, so the visual hierarchy
arrives all at once and the motion language stops after the first viewport.

```css
/* app/globals.css:130-137 - current */
@keyframes landing-enter { from { opacity: 0; transform: translateY(.7rem); } to { opacity: 1; transform: translateY(0); } }
@keyframes visual-enter { from { opacity: .25; transform: scale(.985); } to { opacity: 1; transform: scale(1); } }

@media (prefers-reduced-motion: no-preference) {
  .hero-copy { animation: landing-enter .65s var(--ease-landing-out) both; }
  .hero-visual { animation: visual-enter .8s .08s var(--ease-landing-out) both; }
  .context-image img { transition: transform .75s var(--ease-landing-out); }
  .context-image:hover img { transform: scale(1.018); }
}
```

The context image is a non-interactive `figure`, yet it zooms on hover. That
motion does not communicate feedback or state and can imply an unavailable action.
The context, workflow, and footer content have no entrance treatment at all.

```tsx
/* components/landing-page.tsx:62-70 - current */
<figure className="context-image">
  <Image
    src="/branderize-workspace-context.webp"
    alt="Branderize workspace showing Northline positioning, audience, offer, and voice as a shared brand brief"
    width={1000}
    height={1250}
    sizes="(max-width: 767px) 100vw, 52vw"
  />
</figure>
```

## Target

Keep the existing information architecture, copy, design tokens, and images. Add
one coherent motion language at intensity 6/10:

- Hero copy reveals in semantic order with a 70ms stagger.
- Hero media follows once, from `opacity: 0.75` and `scale(0.97)`.
- Discipline labels, context copy/media, workflow heading/cards, and footer reveal
  once as they enter the viewport.
- Only the context screenshot receives scroll-linked movement: at most 12px in
  either vertical direction, with a constant `scale(1.035)` to avoid exposed edges.
- Delete the static-image hover zoom.
- Landing CTAs get local, interruptible press feedback without editing the vendored
  Button primitive: `scale(0.97)`, 160ms on press and 120ms on release.
- Animate only `transform` and `opacity`. No loops, marquee, mouse tracking, layout
  properties, or hover movement on non-interactive content.
- Reduced-motion users retain a short opacity reveal but receive no translation,
  scale, parallax, or CTA movement.

Use these exact motion values:

```ts
const LANDING_EASE_OUT = [0.23, 1, 0.32, 1] as const
const LANDING_REVEAL_DURATION = 0.6
const LANDING_MEDIA_DURATION = 0.76
const LANDING_STAGGER = 0.07
const LANDING_TRAVEL = '1rem'
```

## Repo conventions to follow

- Semantic design tokens live in `tokens.css` and the current landing curve is
  `--ease-landing-out` at `tokens.css:58`.
- Marketing layout and visual selectors live in `app/globals.css`.
- `components/landing-page.tsx` is a Server Component. Declarative motion tags use
  Motion's RSC entry point; hooks and runtime configuration stay in an app-specific
  `'use client'` leaf module.
- `motion` 12.42.2 is already installed. Add no dependency.
- Preserve `priority` and explicit dimensions on the hero image.
- Preserve all current workspace/sidebar rules in `app/globals.css`.

## Steps

1. In `tokens.css`, update `--ease-landing-out` to
   `cubic-bezier(0.23, 1, 0.32, 1)` and add semantic reveal/media/stagger duration
   tokens while retaining the existing fast and short interaction tokens.
2. Add `components/landing-motion.tsx` with `'use client'` and
   `MotionConfig reducedMotion="user"`. Export a root provider and the hook-driven
   context parallax. Use `motion/react-client` directly in the Server Component so
   server-rendered content remains server-owned and only the interactive filling
   of the hamburger crosses the client boundary.
3. Use full `transform` strings such as
   `translate3d(0, 1rem, 0)` and `scale(0.97)`, not Motion `x`, `y`, or `scale`
   shorthands. All view reveals use `viewport={{ once: true, amount: 0.25 }}`.
4. For the context parallax, isolate `useScroll()` and `useTransform()` in a child
   mounted only after hydration and when `useReducedMotion()` is false. This keeps
   the server HTML and first client render identical. Map view progress to
   `translate3d(0, 0.75rem, 0) scale(1.035)` through
   `translate3d(0, -0.75rem, 0) scale(1.035)`.
5. In `components/landing-page.tsx`, wrap `<main>` in the client motion-config
   shell and replace the existing semantic owners directly with RSC-compatible
   motion primitives. Pass the server-rendered `Image` as children to the client
   parallax shell. Do not insert
   extra wrappers around nodes targeted by direct-child CSS selectors. Apply the
   hero sequence, discipline stagger, context reveal/media, workflow card stagger,
   and footer reveal described above.
6. Add `landing-cta` only at the landing's Button call sites. In `app/globals.css`,
   define landing-specific transition properties and gate the press transform
   behind `prefers-reduced-motion: no-preference`.
7. Delete `landing-enter`, `visual-enter`, and the context image hover animation
   from `app/globals.css` so CSS and Motion never compete for `transform`. Add only
   the layout support required by the parallax layer.

## Boundaries

- Do NOT edit `components/ui/**` or `components/ai-elements/**`.
- Do NOT change copy, navigation labels, routes, CTA intent, images, or alt text.
- Do NOT alter workspace/sidebar geometry or unrelated product UI styles.
- Do NOT add a dependency, global scroll listener, infinite animation, marquee,
  or animation of layout properties.
- If the current file shape differs from the excerpts above, stop and report the
  drift instead of overwriting adjacent work.

## Verification

- **Mechanical**: run `pnpm typecheck`, `git diff --check`, and
  `rg -n "transition: all|scale\\(0\\)|ease-in|addEventListener\\(['\"]scroll|!important" components/landing-motion.tsx components/landing-page.tsx app/globals.css tokens.css`.
- **Feel check**: load `/` at desktop and mobile sizes and confirm:
  - Hero elements arrive in semantic order without delaying CTA usability.
  - Each lower section reveals once and does not replay when scrolling back.
  - Workflow cards are staggered by 70ms but never look clickable.
  - The context media moves by no more than 12px and exposes no edge.
  - Pressing a CTA scales it subtly; release snaps slightly faster.
  - With reduced motion enabled, translation, scale, parallax, and CTA movement are
    absent while opacity/color feedback remains.
  - At 10% playback speed, coordinated elements share the same strong ease-out and
    no two systems write `transform` on the same node.
- **Done when**: typecheck and diff checks pass, the full landing motion story works
  in desktop/mobile and light/dark modes, and reduced motion is visibly calmer.

## Result

- TypeScript, production build, diff checks, and the anti-pattern scan pass.
- Desktop, mobile, light, dark, and reduced-motion states were exercised in a real
  browser; reveals run once, parallax stays within 12px, and CTA press feedback is
  disabled for reduced motion.
- Production Lighthouse: performance 92, accessibility 96, CLS 0, TBT 0ms.
