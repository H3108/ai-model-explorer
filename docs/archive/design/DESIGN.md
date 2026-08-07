# AI Model Explorer Design System V1.1

> Version: V1.1
> Status: Implementation Ready
> Scope: AI Model Explorer UI / UX / Design System Reconstruction
> Purpose: Transform AI Model Explorer from a model catalog into an AI model decision platform.

---

# 0. Product Positioning

## Vision

AI Model Explorer is not a model database.

It is a decision assistant that helps users find the right AI model for a specific task.

Core workflow:

User requirement

↓

Model discovery

↓

Comparison

↓

Decision


## Product Goal

Help users answer:

"What AI model should I use for this task?"

Examples:

- Best coding model under a budget
- Best Chinese long-context model
- Best vision model
- Best Agent model


## Not The Goal

Avoid becoming:

- A simple model list
- A provider directory
- A marketing landing page

---

# 1. Design Principles

## 1.1 Decision First

The homepage has one primary goal:

Find the right model.

Everything else supports this goal.

---

## 1.2 Information Density

The product should feel closer to:

- OpenRouter
- Linear
- Vercel

Not:

- Marketing website
- Feature landing page

Prioritize:

- Search
- Compare
- Evaluate
- Decide


---

## 1.3 Clear Information Hierarchy

Every interface element must answer:

1. What is this?
2. Why should I care?
3. What can I do next?


---

## 1.4 Explain Recommendation

Do not only show:

Score: 95


Show:

Why recommended:

✓ Strong coding capability
✓ Long context support
✓ Low cost


---

# 2. Information Architecture

Replace the previous four-screen concept.

The product consists of three layers.

---

# Layer 1 — Decision Entry

Purpose:

Let users describe their needs.


Homepage contains:

Title

Task description input

Example queries

Quick filters

Recommended models preview

Example:

Find the best AI model for your task

[ I need a cheap Chinese coding model with long context ]

Examples:
Coding
Long Context
Free Models
Vision
Agent


---

# Layer 2 — Model Discovery

Purpose:

Deep exploration and comparison.


Route:

/browse


Contains:

- Search
- Filters
- Sorting
- Model table
- Card view


Responsibilities:

Browse owns full exploration.

Homepage does not duplicate this.


---

# Layer 3 — Trust Layer

Purpose:

Build confidence.


Contains:

- Data update time
- Pricing source
- Model coverage
- Recommendation methodology
- Correction entry


Located:

Footer / About section


---

# 3. Homepage Specification

## Header

Keep simple:

Logo

Models

Providers

Compare

Docs

Search



Remove:

- Version badge
- Decorative labels


---

# Hero

## Goal

One primary action.


Structure:

Headline

Task input

Primary CTA

Example queries



Example:


Find the right AI model for your task

[ Describe your requirement ]

[Start Matching]

Popular:
Coding
Reasoning
Long Context
Free



---

## Removed

Remove:

- Orbit graphic
- Decorative model visualization
- Large floating cards


Reason:

They consume attention but provide no interaction.


---

# Recommended Models

Homepage only shows selected models.

Not full explorer.


Display:

5-6 models maximum.


Component:

Reuse ModelRow.


Example:

Recommended Models

Claude Sonnet 4
Anthropic
200K
Input $3/M
Output $15/M

Compare

Qwen3-Coder
Alibaba
128K
...
Action:

View all models →

Navigate:

/browse


---

# Task Templates

Task templates are input helpers.

They are not independent homepage sections.


Display:

Compact chips:


Coding
Reasoning
Document
Vision
Agent



Selecting one:

Adds filter conditions.


---

# 4. Browse Specification

Route:

/browse


Purpose:

Complete model exploration.


Layout:



Search

Filters

Sort

View Switch

Model Table



---

## Table Columns

Recommended:



Model

Provider

Context

Input Price

Output Price

Capabilities

Latency

Compare



---

## Card View

Optional.

Must reuse the same model data source.

Do not create separate components.


---

# 5. Model Component Specification

## ModelRow

Used by:

- Homepage
- Browse
- Search results


Information hierarchy:



Model Name

Provider

Capability Tags

Context

Pricing

Actions



---

## Actions


Primary:

Click row/card

↓

Model Detail


Secondary:

Compare


Trial:

Only available in Detail page.


Do not put three buttons on every card.


---

# 6. Model Detail Specification


Contains:


## Overview

Basic information.


## Recommendation Explanation

Example:


Recommended because:

- Excellent coding performance
- Good price efficiency
- Supports long context


## Capability

- Coding
- Reasoning
- Vision
- Tool Calling


## Pricing

Clear separation:


Input:
$/Million Tokens

Output:
$/Million Tokens



## API

Provider API information.


## Playground

Optional.

Only show when available.


---

# 7. Design Token System

## Principle

Use semantic roles instead of limiting color numbers.


---

# Color Roles



Background

Surface

Foreground

Muted Text

Border

Brand

Success

Warning

Error

Category



---

## Category Colors

Used only for model capability classification.


Examples:


Text
Image
Audio
Video
Agent



Not counted as brand colors.


---

# Typography


Primary:

Geist Sans


Chinese:

Noto Sans SC


Mono:

Geist Mono


Use Mono for:

- Price
- Token count
- Latency
- Model ID


---

# Spacing


Base unit:

4px


Recommended:



4
8
12
16
24
32
48
64



---

# Radius


Avoid excessive rounded style.


Use:



Small:
6px

Medium:
10px

Large:
14px



Pills only for:

- Tags
- Status
- Filters


---

# 8. Recommendation System Display

Do not display artificial scores before methodology exists.


Preferred:


Why recommended


rather than:


Score 95



Future score model:



Task Match 40%

Capability Quality 30%

Cost Efficiency 20%

Speed 10%



---

# 9. Implementation Constraints


## Must

- Preserve existing routes
- Preserve data schema
- Reuse existing components
- Keep validation scripts passing


## Must Not

- Rewrite backend
- Replace model database
- Remove existing features
- Change API contracts without approval


---

# 10. Acceptance Criteria


## Product

✓ Homepage has one primary decision entry

✓ Browse owns complete exploration

✓ Recommended models visible without scrolling deeply

✓ Model comparison reachable


## UI

✓ Consistent token system

✓ Reduced decorative elements

✓ Clear pricing semantics

✓ Dense but readable layout


## Engineering

✓ Existing tests pass

✓ Existing routes work

✓ No data regression


---

End of DESIGN.md