# 002 - Turn the brief into an orchestration score

- **Status**: DONE
- **Commit**: 76bb020
- **Severity**: HIGH
- **Category**: Purpose, physicality, cohesion, accessibility, missed opportunities
- **Estimated scope**: several implementation files, one server-rendered landing restructure plus one conditional client motion leaf

## Problem

The landing uses a sound reveal system, but almost every section receives the same
fade and vertical translation. The product's defining behavior - one company brief
coordinating the relevant specialist disciplines into one answer - is explained as small
labels and a generic three-card grid instead of being demonstrated through motion.

```tsx
/* components/landing-page.tsx:117-135 - current */
<motion.section
  className="landing-shell discipline-rail"
  aria-label="Marketing specialists"
  {...landingRailViewMotion}
>
  <motion.p variants={landingRevealVariants}>One brief, relevant expertise</motion.p>
  <div>
    {specialists.map(({ name }, index) => (
      <motion.span
        key={name}
        variants={createLandingRevealVariants((index + 1) * LANDING_STAGGER)}
      >
        {name}
      </motion.span>
    ))}
  </div>
</motion.section>
```

```tsx
/* components/landing-page.tsx:185-205 - current */
<div className="workflow-grid">
  <motion.article className="workflow-lead" variants={landingRevealVariants} {...landingViewMotion}>
    <span>Understand</span>
    <h3>Start with the business, not a blank prompt.</h3>
    <p>Add your website once. Branderize turns it into durable context for every project that follows.</p>
  </motion.article>
  <motion.article variants={createLandingRevealVariants(LANDING_STAGGER)} {...landingViewMotion}>
    <span>Orchestrate</span>
    <h3>The right minds enter the room.</h3>
    <p>The relevant specialists collaborate without making the user repeat the brief.</p>
  </motion.article>
  <motion.article
    className="workflow-accent"
    variants={createLandingRevealVariants(LANDING_STAGGER * 2)}
    {...landingViewMotion}
  >
    <span>Deliver</span>
    <h3>One answer, ready to shape.</h3>
    <p>Ideas arrive connected, traceable, and grounded in the same brand truth.</p>
  </motion.article>
</div>
```

The hero follows a conventional copy-left, screenshot-right SaaS composition. The
real screenshots prove the product, but they are separate examples rather than one
continuous context-to-answer story.

## Target

Create one coherent motion concept called **The Orchestration Score**. Motion must
visualize the product mechanism, never decorate arbitrary containers.

1. Hero copy reveals in semantic order. The two headline lines reveal inside
   overflow masks with `translate3d(0, 0.8em, 0)` to
   `translate3d(0, 0, 0)`, 50ms stagger, 700ms duration, and
   `[0.23, 1, 0.32, 1]`. The product screenshot follows at 780ms with opacity and
   `scale(0.98)` to `scale(1)`.
2. Example disciplines become a responsive typographic score. Names reveal once
   with a 55ms stagger while one vermilion baton line scales horizontally from
   `scaleX(0)` to `scaleX(1)`. The line uses a left transform origin and runs once;
   it never loops or scrolls automatically.
3. Replace the three-card workflow with a desktop sticky story. Three semantic
   beats scroll normally beside a sticky 4:3 product stage. A transform-only
   inverse-wrapper wipe turns the real company-context screenshot into the real
   coordinated-output screenshot, with a vermilion edge clarifying the handoff.
   Scroll progress stays in a MotionValue and is smoothed with
   `{ stiffness: 170, damping: 30, mass: 0.3 }`; do not set React state per frame.
4. On desktop, beat opacity/transform ranges are:
   - Context: progress `[0, 0.08, 0.3, 0.4]`, opacity `[0.4, 1, 1, 0.35]`.
   - Orchestration: `[0.28, 0.42, 0.6, 0.7]`, opacity `[0.35, 1, 1, 0.35]`.
   - Synthesis: `[0.6, 0.74, 1]`, opacity `[0.35, 1, 1]` so the final
     conclusion remains active at the end of the story.
   - Inactive beats use `translate3d(0, 1rem, 0)`; active beats use
     `translate3d(0, 0, 0)`.
5. The context screenshot remains fixed through progress `0.44`, then nudges to
   `translate3d(-0.5rem, 0, 0) scale(0.99)` by `0.66`. Across the same range, the
   coordinated result wrapper moves from `translate3d(100%, 0, 0)` to identity
   while its inner layer moves from `translate3d(-100%, 0, 0)` to identity. This
   reveals a stable image instead of sliding its content across the canvas.
6. Below 48rem, the story becomes a normal static stack with both screenshots and
   no sticky positioning. With `prefers-reduced-motion: reduce`, all scroll-linked
   transforms, scale, and the baton are removed; the full narrative remains visible
   in source order.
7. Animate only transform and opacity for scroll-linked motion. No blur, no manual
   scroll listener, no layout property animation, no `transition: all`, and no
   cursor-following or infinite motion.

## Repo conventions to follow

- Shared motion values live in `lib/landing-motion-tokens.ts`; matching CSS custom
  properties live in `tokens.css`.
- The existing strong ease-out token is `--ease-landing-out` in `tokens.css:59` and
  `LANDING_EASE_OUT` in `lib/landing-motion-tokens.ts:5`.
- `components/landing-page.tsx` remains a Server Component and uses
  `motion/react-client` only for declarative primitives.
- Hook-driven scroll behavior stays in `components/landing-motion.tsx`. Pass
  server-rendered headings, copy, and `next/image` nodes into the client component
  as ReactNode props - the existing hamburger pattern used by
  `LandingContextParallax` is the exemplar.
- Use full transform strings, not Motion `x`, `y`, or `scale` shorthands.
- App-specific landing styles live in `app/globals.css`; vendored components remain
  untouched.

## Steps

1. Add `LANDING_HEADLINE_STAGGER = 0.05`,
   `LANDING_DISCIPLINE_STAGGER = 0.055`, and `LANDING_STORY_SPRING` with exact
   `{ stiffness: 170, damping: 30, mass: 0.3 }` values to
   `lib/landing-motion-tokens.ts`. Mirror applicable durations in `tokens.css`.
2. In `components/landing-page.tsx`, keep the header and route behavior, replace the
   hero copy with a two-line masked headline, concise evidence-backed copy, and
   consistent `Create your workspace` or `Open workspace` CTA labels.
3. Replace `DisciplineRail` with a large semantic discipline score. Put the view
   observer on the parent once at `amount: 0.35`; give each role an overflow mask
   and add one `aria-hidden` baton element with scaleX variants.
4. Replace `ContextSection` and `WorkflowSection` with a server-owned story
   composition. Pass three semantic article nodes plus the existing real context
   and output `Image` nodes to a new `LandingStoryMotion` client leaf.
5. In `components/landing-motion.tsx`, implement `LandingStoryMotion` with a static
   layout plus a desktop-only `LandingStoryAnimated` leaf using `useScroll`,
   `useSpring`, and `useTransform`. Use the hydration guard and media-query listeners
   so server HTML and first client render are static and identical; do not mount the
   scroll-linked leaf on mobile or when reduced motion is requested.
6. Rewrite only landing-specific selectors in `app/globals.css`: editorial hero,
   discipline score, sticky story, product stage, mobile static fallback, and final
   accent closing section. Remove the obsolete context/workflow grid selectors.
7. Keep `next/image` dimensions, accurate alt text, and `priority` only on the hero
   image. The lower screenshots remain lazy-loaded.

## Boundaries

- Do NOT edit `components/ui/**` or `components/ai-elements/**`.
- Do NOT add dependencies or generate stock imagery.
- Do NOT invent testimonials, usage metrics, customer logos, pricing, or a free
  plan. The real Northline product screenshots are the proof.
- Do NOT change authentication behavior, workspace routes, agent logic, or database
  code.
- Do NOT use `!important`, `transition: all`, manual scroll listeners, keyframe
  loops, cursor-following, magnetic buttons, or marquee motion.
- Do NOT animate layout properties such as width, height, margin, padding, top, or
  left.
- If the landing structure or tokens drift from commit `76bb020`, stop and audit
  the changed code before applying this plan.

## Verification

- **Mechanical**: run `pnpm typecheck`, `git diff --check`, and
  `rg -n "transition: all|scale\\(0\\)|ease-in|addEventListener\\(['\"]scroll|!important" components/landing-motion.tsx components/landing-page.tsx app/globals.css tokens.css`.
  Run `BETTER_AUTH_URL=http://localhost:3000 pnpm build`; all commands must pass.
- **Feel check**: run the landing in a real browser and confirm:
  - At 1280x720, the hero promise, both CTAs, and meaningful product proof are
    visible without scrolling.
  - Headline lines reveal as one sentence, then the real product stage arrives.
  - The discipline baton runs once and every discipline remains readable on mobile.
  - The sticky story uses normal page scroll, never traps or hijacks input, and the
    context-to-output change feels like one continuous decision.
  - At viewport heights of 600px and 900px, the sticky stage never clips its frame.
  - At mobile widths of 390px and 430px, sticky behavior is absent and the story is
    a readable static stack.
  - In dark mode, light product screenshots sit inside a deliberate neutral matte
    rather than appearing as accidental white islands.
  - At 10% playback speed, no two systems write transform to the same node and no
    layer double-exposes distractingly during the crossfade.
  - With reduced motion enabled, all content is visible, the story is not sticky,
    the decorative baton does not animate, and position/scale motion is gone.
- **Done when**: the page has one recognizable context-to-command motion story,
  all mechanical checks pass, and desktop/mobile/light/dark/reduced-motion states
  remain legible and navigable.

## Result

Implemented the orchestration score, masked hero sequence, and responsive 4:3
context-to-answer wipe. The page uses real product captures, keeps the authored
copy and imagery server-rendered, removes scroll work from mobile and reduced-motion
states, and falls back to a complete static narrative. Verified at 320, 390, 767,
768, and 1280px widths; 600 and 720px viewport heights; light, dark, fresh reduced
motion, and live preference changes.
