---
doc_type: project_plan
tags:
  - type/plan
  - topic/citizenship
status: active
title: Lineage Discovery & Search Plan
description: Operational research protocol for autonomous archival queries and primary record discovery.
---

# 🔎 Lineage Discovery & Archival Search Protocol

## 🎯 Objective
Execute targeted archival searches starting from minimal baseline facts to discover ancestral birthplaces, identify any Canadian soil birth roots (*jus soli*), and compile primary source documents for IRCC proof dossiers.

---

## 🏛️ Search Targets & Repository Matrix

### Phase 1: Parentage Discovery ($G0 \rightarrow G1$)
* **Target 1A**: Lisa Michelle Phillips (b. 1967-10-12, USA)
  * **Primary Objective**: Discover full legal names of Mother and Father.
  * **Repositories**: State Vital Records (Birth Certificate indexing), Social Security Applications and Claims Index, Marriage Records.
* **Target 1B**: Jose Luis Pino (b. 1968-06-18, USA)
  * **Primary Objective**: Discover full legal names and birthplaces of Mother and Father.
  * **Repositories**: US Vital Records, Consular Registrations.

### Phase 2: Grandparental & Great-Grandparental Discovery ($G1 \rightarrow G2 \rightarrow G3$)
* **Target 2**: Trace each identified ancestral line to determine geography:
  * **Borderland Migration Paths**: Maine / New Brunswick / Nova Scotia border crossing records (St. Albans Lists, Border Manifests).
  * **Federal Censuses**: US Federal Censuses (1950, 1940, 1930, 1920, 1910, 1900) to examine reported birthplace of parents ("Canada English", "Canada French", "New Brunswick", "Nova Scotia", etc.).
  * **Canadian Censuses**: 1851, 1861, 1871, 1881, 1891, 1901, 1911, 1921, 1931 Library & Archives Canada (LAC) returns.

### Phase 3: Canadian Archival Verification ($G3$ Anchor)
* **Provincial Archives of New Brunswick (PANB)**:
  * Vital Statistics Database (RS141).
  * County Council records, Parish baptismal registers.
* **Nova Scotia Archives (NSA)**:
  * Historical Vital Statistics (Births, Marriages, Deaths).
* **Library & Archives Canada (LAC)**:
  * Microfilm reels (`C-994`, `C-1000`, `C-1038`, etc.).
  * Heritage Canadiana digitized reels.

---

## 🛡️ Anti-SERP & Evidence Quality Protocol
Per the Workspace Ingestion Standard:
- **No SERPs or Stubs**: Only authentic certified certificates, high-resolution microfilms, and parish registers are accepted into `Sources/`.
- **Atomic Linking**: Every discovered document is linked to both frontmatter `sources:` and markdown body `## 📄 Source Documents`.
