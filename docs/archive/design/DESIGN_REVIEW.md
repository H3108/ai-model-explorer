# AI Model Explorer Design Review

> Version: V1.1  
> Type: Design Decision Record  
> Purpose: Review previous design proposal and define final product decisions.

---

# 0. Review Purpose

This document reviews the previous AI Model Explorer redesign proposal.

The purpose:

- Identify product direction issues
- Reduce implementation risk
- Resolve conflicting design decisions
- Provide reasoning behind DESIGN.md V1.1


Relationship:


DESIGN_REVIEW.md

(decision background)

    ↓

DESIGN.md

(final specification)

    ↓

IMPLEMENTATION_PLAN.md

(execution order)


---

# 1. Overall Assessment

Previous DESIGN.md direction:

Correct.

Main strengths:

- Recognized product positioning problem
- Moved from content portal to decision tool
- Introduced design token system
- Improved information hierarchy
- Added measurable acceptance criteria


However:

The proposal still contained several issues:

1. Homepage responsibility was too broad.
2. Model browsing duplicated between Home and Browse.
3. Component actions were overloaded.
4. Design token rules were not fully consistent.
5. Implementation order could cause repeated refactoring.

---

# 2. Product Positioning Decision

## Previous Position

"AI Model Explorer"

Could be interpreted as:

- Model database
- Model directory
- Provider catalog


## Final Decision

AI Model Explorer should become:


AI Model Decision Platform


Core value:

Help users select the right model.

Not:

Show all available models.

---

# 3. Information Architecture Review

## Previous Proposal

Four screens:

Decision Entry
Model Browser
Task Templates
Trust Section


## Problem

Task templates are not an independent destination.

They are input helpers.


Having:

- Search input
- Quick filters
- Task template section

creates repeated entry points.


## Final Decision

Use three layers:


Layer 1

Decision Entry

↓

Layer 2

Model Discovery

↓

Layer 3

Trust Layer



Benefits:

- Clear user journey
- Less duplicated UI
- Easier implementation

---

# 4. Homepage Responsibility Review


## Previous Proposal

Homepage contains:

- Search
- Filters
- Full model list
- Table/card switch
- Task templates


## Problem

Homepage becomes another Browse page.


Users cannot understand:

Should I search?

Should I filter?

Should I browse?


## Final Decision


Homepage:

Responsible for:


Start decision

Show recommendations

Guide exploration



Browse:

Responsible for:


Complete discovery

Filtering

Comparison

Large dataset exploration



---

# 5. Hero Interaction Review


## Previous Proposal


Hero included:

- Large title
- Search
- Quick filters
- Multiple CTA
- Recommendation preview


## Problem


Too many competing actions.


A first screen should answer:


"What should I do now?"


## Final Decision


Hero only contains:


Headline

Task input

Primary CTA

Examples



Secondary navigation:

Hidden or moved below.

---

# 6. Orbit Visualization Review


## Previous Design

Hero contained:

- Orbit graphic
- Floating model cards
- Decorative statistics


## Problem


Visual impact is high.

Functional value is low.


The product is a tool.

Not a marketing landing page.


## Decision


Remove decorative orbit.


Replace with:

Real recommendation preview.

Example:



User requirement

↓

Recommended models

↓

Reason



---

# 7. Model Component Review


## Previous Proposal

Every model card:


View

Compare

Try



## Problem


Too many actions.

Creates UI noise.

"Try" also lacks consistent destination.


Different models may have:

- No playground
- Different providers
- Different APIs


## Final Decision


Model list:


Primary interaction:


Click row/card

↓

Detail



Secondary:


Compare



Trial:

Only in detail page.


---

# 8. Model Recommendation Review


## Previous Proposal


Display:


Score: 95



## Problem


A score without methodology reduces trust.


Users may ask:

- Why 95?
- Based on what?
- Updated when?


## Final Decision


First version:


Display explanation:



Why recommended:

✓ Coding capability

✓ Long context

✓ Cost efficiency



Future:


Introduce scoring system after data model exists.

---

# 9. Design Token Review


## Previous Rule

"Limit colors under 5"


## Problem


Actual product requires:

- Brand colors
- Status colors
- Capability colors
- Data visualization colors


Strict number limitation is unrealistic.


## Final Decision


Use semantic roles:



Background

Surface

Foreground

Muted

Border

Brand

Status

Category



Category colors:

Used only for capability classification.


---

# 10. Layout Review


## Previous Rule


"Section spacing 64-96px"


## Problem


Too vague.

Implementation may vary.


## Final Decision


Define concrete spacing:



Hero vertical spacing:

64px

Section spacing:

48px

Section title gap:

24px

List row spacing:

12-16px

Card padding:

20-24px



---

# 11. Typography Review


## Previous Rule


Large display:

56px


## Problem


Large hero conflicts with information density.


At common laptop resolutions:

Model content appears too late.


## Final Decision


Desktop:


Hero title:

44-48px



Mobile:


32-36px



Goal:

Show first recommended models earlier.

---

# 12. Implementation Order Review


## Previous Proposal


Phase:


P0 Product Structure

P1 Design System



## Problem


Components are rebuilt twice.


Example:


P0:

Create model cards


P1:

Change tokens and card structure


Result:

Duplicate work.


## Final Decision


Implementation order:



Phase 0

Foundation

↓

Phase 1

Core Product Flow

↓

Phase 2

Intelligence Features



---

# 13. Natural Language Search Review


## Previous Proposal


"Add AI model matching"


## Problem


Scope unclear.


Requires:

- NLP
- Field extraction
- Ranking
- Validation


## Final Decision


First version:


Structured extraction.


Flow:



User input

↓

Extract conditions

↓

Show editable chips

↓

Apply filters



AI reasoning layer comes later.

---

# 14. Browse Table Review


## Previous Proposal


Reuse compare table styles.


## Problem


Different semantics.


Browse:



Models as rows

Properties as columns



Compare:



Models as columns

Properties as rows



## Final Decision


Share:

- Table tokens
- Typography
- Spacing


Do not share:

- Business components


Structure:



data-table

├── data-table--browse

└── data-table--compare



---

# 15. Final Design Decisions Summary


| Topic | Decision |
|---|---|
| Product | Model Decision Platform |
| Homepage | Decision entry + recommendations |
| Browse | Full exploration |
| Task templates | Input helpers |
| Hero | Single primary action |
| Orbit | Removed |
| Model actions | Detail + Compare |
| Trial | Detail page only |
| Score | Delayed |
| Recommendation | Explain first |
| Colors | Semantic roles |
| Layout | Dense and structured |
| Implementation | Foundation first |


---

End of DESIGN_REVIEW.md