# AI Model Explorer Implementation Plan

> Version: V1.1  
> Status: Execution Guide  
> Scope: AI Model Explorer V2 UI/UX Reconstruction  
> Related:
> - DESIGN.md
> - DESIGN_REVIEW.md

---

# 0. Implementation Rules

## Core Principle

Incremental reconstruction.

Do not rewrite the project.

The existing system already contains:

- Model database
- Routes
- Compare feature
- Provider pages
- Validation scripts
- Existing components


The goal:

Improve product experience while preserving existing assets.


---

# 1. Development Constraints


## Must Preserve


### Data

Do not change:

- Model schema
- Provider schema
- Pricing data format
- API contracts


---

### Routes

Existing routes must continue working:



#home

#browse

#model

#compare

#providers

#provider

#family

#gateways

#glossary



---

### Validation


After each phase:

Run:



node --check app.js

validate_normalized.js

smoke_render.js

model_quality_check.py



---

# 2. Do Not Do


Do not:

- Rewrite backend
- Replace data source
- Remove existing routes
- Delete existing features
- Introduce unnecessary frameworks
- Create duplicate model components


---

# 3. Phase Overview



Phase 0

Design Foundation

↓

Phase 1

Core Product Experience

↓

Phase 2

Intelligence Enhancement



---

# Phase 0 — Design Foundation


## Goal


Establish consistent visual system before changing pages.


---

## Scope


### 0.1 Design Tokens


Update:



styles.css :root



Implement:


- Semantic colors
- Typography tokens
- Radius system
- Spacing scale
- Border system


---

## Color Roles


Replace hard-coded colors with:



background

surface

foreground

muted

border

brand

success

warning

error

category



---

## Typography


Add:


Primary:


Geist Sans



Chinese:


Noto Sans SC



Mono:


Geist Mono



Use Mono for:


- Price
- Token
- Latency
- Model ID


---

## 0.2 Component Foundation


Create/update:


### Buttons

Variants:



primary

secondary

ghost



---

### Tags


Used for:


- Capability
- Filters
- Status


---

### Table System


Create:



data-table

data-table--browse

data-table--compare



Share:

- typography
- spacing
- borders


Do not share business logic.


---

## Phase 0 Acceptance


Complete when:


✓ Token system exists

✓ Existing pages still render

✓ No data changes

✓ Validation passes


---

# Phase 1 — Core Product Experience


## Goal


Transform the product from model catalog into decision tool.


---

# 1. Homepage Reconstruction


File:



viewHome()



---

## Remove


Delete:


- Orbit visualization
- Decorative floating cards
- Large statistic block


---

## Add


New structure:



Hero

↓

Recommended Models

↓

Task Templates

↓

Trust Section



---

# Hero


Implement:



Headline

Task input

Start Matching

Example queries



Primary action:

Start Matching


Secondary:

Browse Models

as text link.


---

# Task Input


Version 1:


Structured input.


Example:


User:


"Cheap Chinese coding model"


System extracts:



Task: Coding

Language: Chinese

Budget: Low



Display:


Editable chips.


Do not implement full AI reasoning yet.


---

# Recommended Models


Homepage shows:


5-6 models.


Reuse:



ModelRow



Each row:



Model

Provider

Context

Input Price

Output Price

Capabilities

Compare



---

# Task Templates


Do not create large cards.


Use:



compact chips



Examples:



Coding

Reasoning

Document

Vision

Agent



---

# Browse Reconstruction


Route:



#browse



---

## Responsibilities


Browse owns:


- Full model discovery
- Filtering
- Sorting
- Large dataset browsing


---

## Add


Toolbar:



Search

Filters

Sort

Table/Card switch



---

## Model Table


Columns:



Model

Provider

Context

Input Price

Output Price

Capability

Latency

Compare



---

# Model Detail Improvement


Route:



#model



Add:


## Recommendation Explanation


Example:



Why recommended:

✓ Strong coding

✓ Long context

✓ Good cost efficiency



---

## Playground


Only display when available.


Do not create fake trial buttons.


---

# Phase 1 Acceptance


Complete when:


✓ Homepage has one clear entry

✓ Browse owns full exploration

✓ Recommended models appear early

✓ Compare accessible

✓ Pricing is clear

✓ Existing routes work


---

# Phase 2 — Intelligence Enhancement


## Goal


Add AI-assisted decision features.


---

# 2.1 Natural Language Understanding


Do not start with unrestricted AI ranking.


Implement:



Input

↓

Condition extraction

↓

Editable filters

↓

Search



Supported fields:



Task

Modality

Budget

Context

Language

Capability



---

# 2.2 Recommendation Explanation


Improve:


"Why this model"


Possible factors:



Task match

Capability

Price efficiency

Speed



---

# 2.3 Recommendation Score


Only introduce after methodology exists.


Initial model:



Task Match 40%

Capability Quality 30%

Cost Efficiency 20%

Speed 10%



---

# 2.4 User Preference


Future:



Saved filters

Recent searches

Favorite models



---

# Phase 2 Acceptance


Complete when:


✓ Search understands structured requirements

✓ Recommendation explanation exists

✓ User preferences can persist


---

# 4. Testing Checklist


After every phase:


## Functional



Routes work

Navigation works

Comparison works

Search works



---

## Visual


Check:



Desktop

1360x878

Mobile

390px



---

## Regression


Confirm:



No missing models

No pricing regression

No broken links

No console errors



---

# 5. Workbuddy Execution Protocol


Before coding:


Read:


DESIGN.md

DESIGN_REVIEW.md

IMPLEMENTATION_PLAN.md



---

Execution rule:


Do one phase at a time.


After completion output:


Changed files
Implementation summary
Screenshots
Test results
Remaining issues


---

Current execution target:


## Phase 0 only.


Do not start Phase 1 until Phase 0 is reviewed.


---

End of IMPLEMENTATION_PLAN.md