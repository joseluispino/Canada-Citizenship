# 🌳 Obsidian Family Tree & Lineage Graph Engine

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Obsidian Community Plugin](https://img.shields.io/badge/Obsidian-Community%20Plugin-7C3AED.svg)](https://obsidian.md/plugins)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-emerald.svg)]()
[![Mobile Compatible](https://img.shields.io/badge/Platform-Desktop%20%7C%20Mobile-blueviolet.svg)]()

A dynamic, high-performance genealogy and lineage visualization plugin for **Obsidian**. Renders **360° Dual-Hemisphere Radial Fan Charts**, **Gramps-style Hierarchical Pedigree Brackets**, and **Mermaid Flowcharts** directly inside your Markdown notes with zero database lock-in.

---

```
 ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                           FAMILY TREE TOOLBAR                                               │
 │ [🪭 Fan] [📊 Compact] [🔀 Flow] | [−] 4 Gen [+] | [✨ Trace ▾] [🎨 Theme ▾] [📄 Print ▾] [🔍− 100% 🔍+ ↕] [📥 SVG] │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 1. 🪭 360° Dual-Hemisphere Radial Fan Charts
- **Upper Hemisphere ($0^\circ \to 180^\circ$)**: Ancestors with full legal names, vital dates, and citizenship flags.
- **Lower Hemisphere ($180^\circ \to 360^\circ$)**: Descendants with given names and recursive sub-branches.
- **Curved Arc Typography**: Smooth SVG text paths along concentric arcs.

### 2. 🧬 Genetic Lineage Path Tracing (Y-DNA & mtDNA)
- **Patrilineal (Y-DNA)**: 1-click golden halo highlight (`#fbbf24`) tracing direct father lineages.
- **Matrilineal (mtDNA)**: 1-click golden halo highlight tracing direct mother lineages.
- **Target Shortest Path**: Breadth-first search finding direct lineage path between subject and any ancestor.
- **Collateral Dimming**: Automatically fades collateral lines to 22% opacity to bring target lineages into sharp focus.

### 3. 🎯 In-Place Re-Centering & Pivot Navigation (`Alt + Click`)
- Hold **`Alt` (or `Option`) + Click** on any person slice, card, or node to instantly re-center the tree in-place without opening notes or editing YAML.
- Interactive breadcrumb button (`[ ↩ Back to Root ]`) maintains full session history.

### 4. 🎨 Accessible & Colorblind-Safe Themes
- **`🎨 Classic Modern`**: Vibrant blues (paternal) and ambers (maternal).
- **`🧬 Viridis`**: Perceptually uniform colorblind-safe sequential colormap (deuteranopia & protanopia).
- **`👁️ High Contrast (Tol)`**: Distinct high-visibility colors.
- **`📜 Archival Monochrome`**: Crisp grayscale optimized for academic publishing.

### 5. 🖨️ Archival Poster & Clean Print Engine
- Presets for **`📄 Letter / A4`**, **`📜 Tabloid / A3`**, and **`🏛️ Poster / A2`**.
- `@media print` rules automatically hide toolbars and format vector graphics for physical family reunion charts.
- **1-Click SVG Export**: Downloads standalone, scalable vector graphics.

---

## 🚀 Quick Start

Add the following code block anywhere in a person's note:

````markdown
```family-tree
depth: 3
view: fan
highlight: patrilineal
palette: classic
```
````

### Supported Parameters:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `depth` | Integer (1–5) | `2` | Number of generations displayed (both up and down). |
| `view` | String | `'fan'` | Default visualizer: `'fan'` (radial), `'pedigree'` (bracket), or `'hourglass'` (flow). |
| `highlight` | String | `'none'` | Path trace: `'patrilineal'`, `'matrilineal'`, WikiLink, or `'citizenship_anchor:true'`. |
| `palette` | String | `'classic'` | Theme: `'classic'`, `'viridis'` (colorblind-safe), `'contrast'`, or `'monochrome'`. |
| `print` | String | `'letter'` | Viewport preset: `'letter'`, `'tabloid'`, or `'poster'`. |
| `spouses` | Boolean | `true` | Show spouse badges and lateral marriage chips. |
| `dates` | Boolean | `true` | Display birth and death years. |

---

## 🏛️ Frontmatter Schema (Standard Markdown & Bases Native)

The plugin reads directly from standard Obsidian YAML frontmatter:

```yaml
---
name: King Henry VIII
sex: M # Supports M, F, X (Non-binary / Other), U (Unknown / Blank)
birth_date: 1491-06-28
death_date: 1547-01-28
birth_place: Palace of Placentia, Greenwich, England
citizenship: british # Automatically maps to national flag badge 🇬🇧
parents:
  - "[[King Henry VII]]"
  - "[[Elizabeth of York]]"
spouse:
  - "[[Catherine of Aragon]]"
  - "[[Anne Boleyn]]"
  - "[[Jane Seymour]]"
children:
  - "[[Mary I of England]]"
  - "[[Elizabeth I of England]]"
  - "[[Edward VI of England]]"
---
```

---

## 🇨🇦 Canadian Citizenship Proof & Archival Consulting

Need specialized archival assistance reconstructing complex family lineages, locating historical records, or compiling certified proof dossiers for:
- **🇨🇦 Canadian Citizenship by Descent** (Bill C-3 / Senate Bill S-245 Dual-Anchor Lineage Proof Packages & IRCC Dossiers)
- **🏛️ Complex Archival & Transatlantic Provenance Triangulation** (Parish registers, provincial vital records, and census reconstruction)

📧 **Case Assessment & Consultations**: [jose@pino.family](mailto:jose@pino.family)  
🌐 **Website & Client Portal**: [https://pino.family](https://pino.family)

---

## 💖 Support Open Source Development

If this plugin helps you organize, visualize, or preserve your family history:
- ⭐ **Star this repository** on GitHub!
- ☕ **[Sponsor on GitHub](https://github.com/sponsors/josepino)** or **[Buy Me a Coffee](https://buymeacoffee.com/josepino)** to fund ongoing development of open-source genealogy tools.

---

## 📄 License

Licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for details.
