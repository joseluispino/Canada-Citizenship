# Workspace Agent Rules

## Ergonomics & Hands-Free Autonomous Mode
- **Zero-Friction Execution**: The user is recovering from rotator cuff surgery and needs to minimize mousing and clicking.
- **Auto-Accept & Proceed**: Execute commands, tool calls, fixes, and workflow steps completely autonomously without waiting for manual confirmation or prompting for simple approvals whenever possible.
- **Direct Execution**: Perform code modifications, system service management, and verification commands directly.

## Basename WikiLink Invariant & Markdown Table Pipe Escaping
- **Basename WikiLinks Only**: ALL internal Obsidian links across all vaults MUST use clean file basenames (`[[Whalen, Patrick 1811-09-01|Patrick Whalen]]` and `[[1840 Marriage Whalen Patrick Leslie Eliza.pdf]]`). Hardcoded folder path prefixes (`People/...`, `Sources/...`) are strictly forbidden.
- **Mandatory Table Pipe Escaping**: In Markdown table rows, ALL WikiLinks containing alias pipes MUST be escaped as `[[Target\|Alias]]` to prevent table column splitting. Run `sanitize_markdown_tables.py` to enforce.

## Seven-Category Archival Source Taxonomy
- All source holdings in `Sources/` MUST reside in the 7 standardized functional categories:
  1. `Sources/Vital_Statistics/`: Birth, Marriage, Death, Baptismal, and Funeral certificates.
  2. `Sources/Census/`: US and Canadian decennial census sheets and enumerations.
  3. `Sources/Military/`: Service rolls, draft cards, pensions, and discharge records.
  4. `Sources/Land_and_Probate/`: Deeds, wills, probate inventories, and land settlements.
  5. `Sources/Immigration_and_Passports/`: Visas, passports, passenger manifests, and border crossings.
  6. `Sources/Microfilms/`: Authentic dual-asset archival film stitches (PANB, LAC, NARA).
  7. `Sources/Published_Histories/`: City directories, town reports, gazettes, and historical books.

## Strict Family Vault Boundary & Client Isolation
- **Family SSoT Mandate**: The master `Genealogy` vault is exclusively reserved for the family bloodlines (Pino, Whalen, Leslie, Dudley, Dunklee, Rexach, Serra).
- **Client Data Separation**: Commercial/friend client data (`Kamas`, `Nary`) is 100% excluded from `Genealogy` and maintained in standalone independent vaults.
- **Deliverable Projection**: `sync_client_deliverables.py` projects exclusively into `Canadian-Citizenship` for Lisa Michelle Phillips (Chain A Whalen lineage).

## Genealogical Source Ingestion & Microfilm Standard
- **Absolute Prohibition on Synthetic or Fabricated Evidence**: AI agents are STRICTLY FORBIDDEN from generating synthetic images, mock certificates, artificial census sheets, fabricated microfilms, simulated newspaper clippings, or fake validation seals/badges (e.g. "CANADIAN PROOF VERIFIED", "ARCHIVO VERIFICADO", "OFFICIAL") using PIL, ImageDraw, SVG, canvas, or AI image generators to pass off as historical evidence in `Sources/` or anywhere in the vault.
- **Genuine Primary Evidence Mandate**: Any document in `Sources/` MUST be an authentic, unaltered primary facsimile, genuine high-resolution archival scan, certified vital statistics record, or legitimate photograph obtained from real-world repositories (LAC, PANB, NARA, civil registers, parish books) or uploaded by the user.
- **Anti-SERP & Anti-Bot Block Mandate**: NEVER capture, ingest, or embed search engine result pages (SERPs), search query lists, unauthenticated login screens ("Sign In"), or anti-bot block pages (`Error 15`, `Access Denied`).
- **Authentic Dual-Asset Microfilm Retention**: When enhancing authentic archival scans (e.g. DeepZoom/IIIF tile stitches from LAC or PANB), stage the pristine original scan (`-Master.jpg`) alongside the enhanced copy (`-Enhanced.jpg`) in `Sources/Microfilms/` with companion `.md` containing live external canonical URLs. Never generate artificial canvas microfilms from scratch.
- **Atomic Linking Mandatory**: Every ingested document or microfilm facsimile MUST be atomically linked to its target profile (`People/`) in both frontmatter `sources:` and markdown body `## 📄 Source Documents`.
- **Definition of Done**: Run `audit_and_enforce_source_links.py` to assert 0 orphaned sources and 0 broken links before declaring completion.

## Dynamic Family Tree Graph Standard
- **Mandatory Family Tree Block**: Every newly created, enriched, or modified person profile (`People/`) MUST contain the dynamic ````family-tree` codeblock section directly beneath the Executive Summary:
  ```markdown
  ## 🌳 Family Tree & Dynamic Lineage Graph

  ```family-tree
  depth: 2
  spouses: true
  dates: true
  direction: TD
  ```
  ```
- **Universal Cross-Platform Compliance**: Traversal must use the universal Bases-native engine (`genealogy_graph_engine.js`), maintaining 100% compatibility across Obsidian and Kern Publisher Web without Dataview dependencies.
- **Automated Sentinel**: `audit_and_enforce_source_links.py` automatically asserts and repairs any missing family tree blocks across all vault profiles.

## Bidirectional Lineage Pointer Symmetry Standard
- **Reciprocal Pointer Invariance**: Every genealogical relationship in frontmatter MUST be bidirectionally symmetric:
  - **Child $\leftr→ Parent**: If Person A lists Person B in `parents:`, Person B MUST list Person A in `children:`, and vice versa.
  - **Spouse $\leftr→ Spouse**: If Person A lists Person B in `spouse:`, Person B MUST list Person A in `spouse:`.
  - **Sibling $\leftr→ Sibling**: All individuals sharing parents MUST symmetrically list each other in `siblings:`.
- **Automated Enforcement**: `audit_and_enforce_source_links.py` and `reconcile_bidirectional_lineage_pointers.py` automatically audit and repair any asymmetric links across the vault on every run.

## Universal Dual-Hemisphere Fan Chart Typography & Legal Citizenship Standard
- **Upper Hemisphere (Ancestors)**: **Full Legal Names** across all ancestral rings (Parents, Grandparents, Great-Grandparents).
- **Lower Hemisphere (Descendants)**: **Given Names Only** across all descendant rings (Children, Grandchildren, Great-Grandchildren), preserving authentic compound given names (*José Luis*, *María Luisa*, *Elena María*, *Alister Jude*) while omitting surnames to prevent text collision.
- **Center Hub**: Subject displays full legal name, vital dates, legal citizenship flags, and spouse badges.
- **Strict Legal Citizenship**: Flags infer strictly from `citizenship_status` / `citizenship` (or birth place as legacy fallback). Residence history (`locations_lived`) is strictly prohibited from generating nationality flags.
- **Pre-Flight Quality Gate**: Run `python3 Common/_Meta/Tests/test_kern_publisher.py` (31 unit tests) and `python3 _Meta/Tests/run_all_tests.py` (32 unit tests) prior to reloading Kern Publisher Web or completing tasks.
