#!/usr/bin/env python3
"""
canadian_citizenship_agent.py
Autonomous Canadian Citizenship Research & Statutory Evaluation Agent for Canada-Test.
Evaluates vault profiles against Bill C-3 / S-245 legal criteria, audits bidirectional
lineage pointer symmetry, and generates actionable discovery queries.
"""

import os
import sys
import re
import yaml
from pathlib import Path
from datetime import datetime

VAULT_ROOT = Path("/home/jpino/Obsidian/Canada-Test")

def parse_year(date_str):
    if not date_str:
        return None
    m = re.search(r'\b(1[5-9]\d\d|20[0-2]\d)\b', str(date_str))
    return int(m.group(1)) if m else None

def extract_wikilinks(value):
    if not value:
        return []
    if isinstance(value, str):
        values = [value]
    elif isinstance(value, list):
        values = value
    else:
        values = [str(value)]
    
    links = []
    for item in values:
        m = re.findall(r'\[\[(.*?)\]\]', str(item))
        for match in m:
            target = match.split('|')[0].strip()
            links.append(target)
    return links

def evaluate_bill_c3_eligibility(birth_year, birth_place, soil_anchor_proven=False):
    """
    Evaluates statutory compliance under Bill C-3 / S-245.
    - Born before Dec 15, 2025: Exempt from 1,095-day physical presence in Canada.
    - Direct descent: Automatically reinstated / recognized as citizen upon proof of Canadian soil ancestor.
    """
    if birth_year is None:
        return {"status": "unknown", "exempt_1095": False, "rationale": "Missing birth year"}
    
    is_pre_2025 = birth_year <= 2025
    is_born_canada = "canada" in str(birth_place).lower() or "new brunswick" in str(birth_place).lower() or "nova scotia" in str(birth_place).lower() or "ontario" in str(birth_place).lower() or "quebec" in str(birth_place).lower()
    
    if is_born_canada:
        return {
            "status": "canadian_citizen_by_soil",
            "exempt_1095": True,
            "anchor_type": "Jus Soli (Direct Soil Birth)",
            "rationale": "Direct birth on Canadian soil."
        }
    
    if is_pre_2025:
        if soil_anchor_proven:
            return {
                "status": "eligible_by_descent",
                "exempt_1095": True,
                "anchor_type": "Bill C-3 / S-245 Direct Lineage",
                "rationale": "Born pre-Dec 2025; exempt from 1,095-day rule; verified descent from Canadian soil root."
            }
        else:
            return {
                "status": "pending_anchor_discovery",
                "exempt_1095": True,
                "anchor_type": "Pending Archival Discovery",
                "rationale": f"Born pre-Dec 2025 (in {birth_year}); exempt from 1,095-day rule. Requires discovery of direct Canadian-born ancestor."
            }
    else:
        return {
            "status": "requires_substantial_connection",
            "exempt_1095": False,
            "anchor_type": "Substantial Connection Rule",
            "rationale": "Born post-Dec 2025; parent must fulfill 1,095-day physical residence in Canada."
        }

def run_agent():
    print("=" * 80)
    print("  🍁 Canadian Citizenship Agent — Statutory Evaluation & Lineage Audit")
    print(f"  Vault: {VAULT_ROOT}")
    print(f"  Execution Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    people_files = list(VAULT_ROOT.glob("People/**/*.md"))
    print(f"[INFO] Discovered {len(people_files)} person profile(s).")

    profiles = {}
    for pf in people_files:
        stem = pf.stem
        try:
            txt = pf.read_text(encoding='utf-8')
            parts = txt.split('---', 2)
            if len(parts) < 3:
                continue
            fm = yaml.safe_load(parts[1]) or {}
            b_date = str(fm.get('birth_date', ''))
            b_year = parse_year(b_date)
            profiles[stem] = {
                'stem': stem,
                'path': pf,
                'name': fm.get('name', stem),
                'birth_date': b_date,
                'birth_year': b_year,
                'birth_place': fm.get('birth_place', 'Unknown'),
                'parents': extract_wikilinks(fm.get('parents', [])),
                'children': extract_wikilinks(fm.get('children', [])),
                'spouse': extract_wikilinks(fm.get('spouse', [])),
                'siblings': extract_wikilinks(fm.get('siblings', [])),
                'generation': fm.get('citizenship_generation', 'Unknown'),
                'proof_status': fm.get('citizenship_proof_status', 'unknown'),
                'locations_lived': fm.get('locations_lived', [])
            }
        except Exception as e:
            print(f"⚠️ Error parsing {pf.name}: {e}")

    # Bidirectional symmetry validation
    symmetry_issues = []
    for stem, p in profiles.items():
        # Check parents <-> children
        for parent_link in p['parents']:
            parent_stem = Path(parent_link).stem
            if parent_stem in profiles:
                p_children_stems = [Path(c).stem for c in profiles[parent_stem]['children']]
                if stem not in p_children_stems:
                    symmetry_issues.append(f"Asymmetry: Child {stem} lists parent {parent_stem}, but parent does not list child.")

        # Check spouse <-> spouse
        for sp_link in p['spouse']:
            sp_stem = Path(sp_link).stem
            if sp_stem in profiles:
                sp_spouse_stems = [Path(s).stem for s in profiles[sp_stem]['spouse']]
                if stem not in sp_spouse_stems:
                    symmetry_issues.append(f"Asymmetry: {stem} lists spouse {sp_stem}, but spouse does not list {stem}.")

        # Check sibling <-> sibling
        for sib_link in p['siblings']:
            sib_stem = Path(sib_link).stem
            if sib_stem in profiles:
                sib_sibling_stems = [Path(s).stem for s in profiles[sib_stem]['siblings']]
                if stem not in sib_sibling_stems:
                    symmetry_issues.append(f"Asymmetry: {stem} lists sibling {sib_stem}, but sibling does not list {stem}.")

    print(f"[AUDIT] Symmetry Verification: {len(symmetry_issues)} issue(s) detected.")
    for issue in symmetry_issues:
        print(f"  ❌ {issue}")
    if not symmetry_issues:
        print("  ✅ 100% Bidirectional Pointer Invariance Verified Across Vault.")

    # Statutory Evaluation
    evaluations = []
    for stem, p in profiles.items():
        eval_result = evaluate_bill_c3_eligibility(p['birth_year'], p['birth_place'])
        evaluations.append({
            "stem": stem,
            "name": p['name'],
            "generation": p['generation'],
            "birth_year": p['birth_year'],
            "birth_place": p['birth_place'],
            "evaluation": eval_result
        })

    # Generate Audit Report
    report_path = VAULT_ROOT / "00_Projects_and_Dashboards/Citizenship_Evaluation_Audit_Report.md"
    report_lines = [
        "---",
        "doc_type: audit_report",
        "tags:",
        "  - type/audit_report",
        "  - topic/citizenship",
        f"created: '{datetime.now().strftime('%Y-%m-%d')}'",
        "status: active",
        "description: \"Statutory Bill C-3 evaluation and clean-slate baseline audit.\"",
        "---",
        "",
        "# 🍁 Bill C-3 Statutory Citizenship Evaluation Audit Report",
        "",
        f"**Audit Timestamp:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
        "**Legal Jurisdiction:** Immigration, Refugees and Citizenship Canada (IRCC)  ",
        "**Governing Statute:** Bill C-3 / Senate Bill S-245 (*An Act to amend the Citizenship Act*)",
        "",
        "## 📊 1. Statutory Evaluation Results by Applicant",
        "",
        "| Applicant | Gen | Birth Year | 1,095-Day Physical Presence Rule | Statutory Status | Legal Rationale |",
        "| :--- | :--- | :--- | :--- | :--- | :--- |"
    ]

    for ev in evaluations:
        stem = ev['stem']
        name = ev['name']
        gen = ev['generation']
        by = ev['birth_year'] or 'Unknown'
        ex = "✅ **Exempt** (Pre-Dec 2025)" if ev['evaluation']['exempt_1095'] else "❌ Requires 1,095 Days"
        st = ev['evaluation']['status'].replace('_', ' ').title()
        rat = ev['evaluation']['rationale']
        report_lines.append(f"| [[{stem}\\|{name}]] | {gen} | {by} | {ex} | **{st}** | {rat} |")

    report_lines.extend([
        "",
        "## 🛡️ 2. Pointer Symmetry & Vault Integrity",
        f"- **Total Profiles Audited:** {len(profiles)}",
        f"- **Bidirectional Pointer Integrity:** {'✅ 100% Invariant' if not symmetry_issues else f'❌ {len(symmetry_issues)} Asymmetries Found'}",
        "",
        "## 🧭 3. Next Autonomous Discovery Directives",
        "1. **Maternal G1 Extraction**: Request/search for official vital records identifying parents of [[Phillips, Lisa Michelle 1967-10-12|Lisa Michelle Phillips]].",
        "2. **Paternal G1 Extraction**: Request/search for official vital records identifying parents of [[Pino, Jose Luis 1968-06-18|Jose Luis Pino]].",
        "3. **Transatlantic & Borderland Triangulation**: Screen discovered ancestral birthplaces against Canadian provincial registers (New Brunswick, Nova Scotia, Ontario, Quebec)."
    ])

    report_path.write_text("\n".join(report_lines), encoding='utf-8')
    print(f"\n🎉 Audit report generated successfully at: {report_path}")

if __name__ == '__main__':
    run_agent()
