# Brewly design direction

Brewly uses a restrained, keyboard-first command surface inspired by the interaction model of Spotlight and Raycast without copying either product's visual identity.

## Principles

- One obvious task: find a package.
- Results update while typing and remain fully keyboard navigable.
- Warm copper communicates selection and focus; blue distinguishes casks.
- Package details stay visible without opening a second interface.
- Mobile changes the split view into a linear results-and-detail flow.
- Motion is optional and must respect `prefers-reduced-motion`.

## Reference artefacts

- `concept-desktop.png`: desktop visual specification.
- `concept-mobile.png`: responsive visual specification.
- `implementation-desktop.png`: latest 1440 × 900 production render.
- `implementation-mobile.png`: latest 430 × 932 responsive render.

## Fidelity ledger

| Area | Concept | Implementation | Resolution |
| --- | --- | --- | --- |
| Layout | Search/results left, selected detail right | Same desktop split and mobile stacked flow | Matched |
| Palette | Near-black neutrals with restrained copper focus | Shared CSS tokens reproduce the same hierarchy | Matched |
| Typography | Large direct heading, quiet support text, monospace commands | Same scale relationships and command treatment | Matched |
| Search states | Active input, selected row, type labels, keyboard rail | All states are code-native and functional | Matched |
| Responsive structure | Separate search, result list, and detail surfaces | Mobile uses three bordered surfaces without horizontal overflow | Matched |
| Visible copy | Brewly, headline, supporting line, navigation, keyboard labels | Copy is unchanged except live package values | Matched |
| Package data | Static illustrative PostgreSQL values | Current Homebrew API values and popularity ranking | Intentional data-driven deviation |
| Package imagery | Illustrative third-party product marks | One neutral package glyph for formulas and casks | Intentional trademark-safe deviation |
| Detail density | Compact illustrative subset | Adds homepage, licence, analytics, and complete dependencies | Intentional requirement-driven deviation |

The implementation was compared against both concepts at their native desktop and mobile viewport sizes. No unresolved layout, contrast, overflow, or interaction mismatch remains.
