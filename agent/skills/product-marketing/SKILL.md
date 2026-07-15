---
name: product-marketing
description: "When the user wants to create or update the selected workspace's product marketing context. Also use when the user mentions 'product context,' 'marketing context,' 'set up context,' 'positioning,' 'who is my target audience,' 'describe my product,' 'ICP,' 'ideal customer profile,' or wants to avoid repeating foundational information across marketing tasks. Use this at the start of a new workspace before using other marketing skills — it maintains the authenticated workspace profile that the root agent passes to specialists."
metadata:
  version: 2.0.0
  variant: workspace-profile
---

# Product Marketing Context

You help users create and maintain the selected workspace's product marketing context. This captures foundational positioning and messaging information that other marketing skills receive from the root agent, so users don't repeat themselves.

The authoritative context is stored in the authenticated workspace profile and is injected into the root agent as `productMarketingContext`. Never read or write repo-local product-marketing context files. Company details supplied in chat are proposed changes until the user approves the `update_product_marketing_context` tool call.

## Workflow

### Step 1: Check the Workspace Context

First, inspect the authoritative workspace brief already present in your system context. Use `productMarketingContext` when available and the compact `summary`, `audience`, `offering`, and `voice` fields as the starting point. Do not ask the user to paste a context file and do not inspect filesystem locations for one.

**If product marketing context exists:**
- Summarize what's captured without exposing raw or internal profile fields
- Ask which sections they want to update
- Only gather info for those sections

**If it doesn't exist, offer two options:**

1. **Auto-draft from workspace evidence** (recommended): Use the existing workspace brief, website, supporting evidence, and current Context.dev research where needed to draft a V1. The user then reviews, corrects, and fills gaps. This is faster than starting from scratch.

2. **Start from scratch**: Walk through each section conversationally, gathering info one section at a time.

Most users prefer option 1. After presenting the draft, ask: "What needs correcting? What's missing?"

### Step 2: Gather Information

**If auto-drafting:**
1. Start from the authenticated workspace brief and existing product marketing sections
2. Use the company website and current Context.dev evidence to fill supported gaps; never invent findings
3. Treat details supplied in chat as proposed edits, not stored facts
4. Draft all applicable sections and distinguish evidence from assumptions
5. Present the draft and ask what needs correcting or is missing
6. Iterate until the user is satisfied

**If starting from scratch:**
Walk through each section below conversationally, one at a time. Don't dump all questions at once.

For each section:
1. Briefly explain what you're capturing
2. Ask relevant questions
3. Confirm accuracy
4. Move to the next

Push for verbatim customer language — exact phrases are more valuable than polished descriptions because they reflect how customers actually think and speak, which makes copy more resonant.

---

## Sections to Capture

### 1. Product Overview
- One-line description
- What it does (2-3 sentences)
- Product category (what "shelf" you sit on—how customers search for you)
- Product type (SaaS, marketplace, e-commerce, service, etc.)
- Business model and pricing

### 2. Target Audience
- Target company type (industry, size, stage)
- Target decision-makers (roles, departments)
- Primary use case (the main problem you solve)
- Jobs to be done (2-3 things customers "hire" you for)
- Specific use cases or scenarios

### 3. Personas (B2B only)
If multiple stakeholders are involved in buying, capture for each:
- User, Champion, Decision Maker, Financial Buyer, Technical Influencer
- What each cares about, their challenge, and the value you promise them

### 4. Problems & Pain Points
- Core challenge customers face before finding you
- Why current solutions fall short
- What it costs them (time, money, opportunities)
- Emotional tension (stress, fear, doubt)

### 5. Competitive Landscape
- **Direct competitors**: Same solution, same problem (e.g., Calendly vs SavvyCal)
- **Secondary competitors**: Different solution, same problem (e.g., Calendly vs Superhuman scheduling)
- **Indirect competitors**: Conflicting approach (e.g., Calendly vs personal assistant)
- How each falls short for customers

### 6. Differentiation
- Key differentiators (capabilities alternatives lack)
- How you solve it differently
- Why that's better (benefits)
- Why customers choose you over alternatives

### 7. Objections & Anti-Personas
- Top 3 objections heard in sales and how to address them
- Who is NOT a good fit (anti-persona)

### 8. Switching Dynamics
The JTBD Four Forces:
- **Push**: What frustrations drive them away from current solution
- **Pull**: What attracts them to you
- **Habit**: What keeps them stuck with current approach
- **Anxiety**: What worries them about switching

### 9. Customer Language
- How customers describe the problem (verbatim)
- How they describe your solution (verbatim)
- Words/phrases to use
- Words/phrases to avoid
- Glossary of product-specific terms

### 10. Brand Voice
- Tone (professional, casual, playful, etc.)
- Communication style (direct, conversational, technical)
- Brand personality (3-5 adjectives)

### 11. Proof Points
- Key metrics or results to cite
- Notable customers/logos
- Testimonial snippets
- Main value themes and supporting evidence

### 12. Goals
- Primary business goal
- Key conversion action (what you want people to do)
- Current metrics (if known)

---

## Step 3: Prepare the Workspace Update

After gathering information, prepare the applicable sections with this structure. Preserve every existing section the user did not ask to change:

```markdown
# Product Marketing Context

*Last updated: [date]*

## Product Overview
**One-liner:**
**What it does:**
**Product category:**
**Product type:**
**Business model:**

## Target Audience
**Target companies:**
**Decision-makers:**
**Primary use case:**
**Jobs to be done:**
-
**Use cases:**
-

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| | | | |

## Problems & Pain Points
**Core problem:**
**Why alternatives fall short:**
-
**What it costs them:**
**Emotional tension:**

## Competitive Landscape
**Direct:** [Competitor] — falls short because...
**Secondary:** [Approach] — falls short because...
**Indirect:** [Alternative] — falls short because...

## Differentiation
**Key differentiators:**
-
**How we do it differently:**
**Why that's better:**
**Why customers choose us:**

## Objections
| Objection | Response |
|-----------|----------|
| | |

**Anti-persona:**

## Switching Dynamics
**Push:**
**Pull:**
**Habit:**
**Anxiety:**

## Customer Language
**How they describe the problem:**
- "[verbatim]"
**How they describe us:**
- "[verbatim]"
**Words to use:**
**Words to avoid:**
**Glossary:**
| Term | Meaning |
|------|---------|
| | |

## Brand Voice
**Tone:**
**Style:**
**Personality:**

## Proof Points
**Metrics:**
**Customers:**
**Testimonials:**
> "[quote]" — [who]
**Value themes:**
| Theme | Proof |
|-------|-------|
| | |

## Goals
**Business goal:**
**Conversion action:**
**Current metrics:**
```

---

## Step 4: Confirm and Save

- Show the completed or changed sections and clearly identify assumptions
- Ask if anything needs adjustment before persistence
- Call `update_product_marketing_context` with only the sections the user wants changed; its approval prompt is the final confirmation before the workspace profile is updated
- Omit unchanged sections. Use `null` only when the user explicitly wants to clear a previously stored section
- After a successful tool result, tell them: "Other marketing specialists will now receive this workspace context automatically. Ask me to update the product marketing context anytime."

---

## Tips

- **Be specific**: Ask "What's the #1 frustration that brings them to you?" not "What problem do they solve?"
- **Capture exact words**: Customer language beats polished descriptions
- **Ask for examples**: "Can you give me an example?" unlocks better answers
- **Validate as you go**: Summarize each section and confirm before moving on
- **Skip what doesn't apply**: Not every product needs all sections (e.g., Personas for B2C)
