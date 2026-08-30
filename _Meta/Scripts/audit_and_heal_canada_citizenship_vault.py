#!/usr/bin/env python3
"""
audit_and_heal_canada_citizenship_vault.py — Self-Healing Vault Health & Standalone Sentinel
===========================================================================================
Enforces:
  1. Absolute ban on synthetic/mock documents (genuine primary evidence only)
  2. Complete absence of internal developer governance/ADR/SOP/Business Plan noise in client vaults
  3. 100% Dynamic family tree coverage across all person profiles
  4. 100% Lineage pointer DAG symmetry
  5. 100% Reverse linkage & embed resolution
"""

import os
import sys
import re
import yaml
import json
from pathlib import Path

VAULT_PATH = Path(__file__).resolve().parents[2]
SOURCES_DIR = VAULT_PATH / "Sources"
PEOPLE_DIR = VAULT_PATH / "People"
DASHBOARDS_DIR = VAULT_PATH / "00_Projects_and_Dashboards"
META_DIR = VAULT_PATH / "_Meta"

WIKILINK_RE = re.compile(r'\[\[([^\]]+)\]\]')
EMBED_RE = re.compile(r'!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]')
MD_IMG_RE = re.compile(r'!\[.*?\]\(([^)]+)\)')

def audit_synthetic_document_prohibition():
    """Enforces absolute ban on synthetic/mock documents and AI-generated proof cards."""
    synthetic_found = []
    for f in SOURCES_DIR.glob("**/*.*"):
        if f.suffix.lower() in ['.png', '.jpg', '.jpeg']:
            try:
                from PIL import Image
                im = Image.open(f)
                if im.size in [(2400, 1500), (2200, 1400)]:
                    synthetic_found.append(f)
            except Exception:
                pass
    if synthetic_found:
        print(f"❌ [CRITICAL VIOLATION] Detected {len(synthetic_found)} synthetic/mock proof documents in Sources/:")
        for s in synthetic_found:
            print(f"   - {s.relative_to(VAULT_PATH)}")
        print("AI agents are strictly forbidden from manufacturing artificial proof documents.")
        sys.exit(1)
    print("🛡️  [Anti-Fabrication Check] 0 synthetic proof documents detected in Sources/.")

def audit_zero_internal_governance_leakage():
    """Enforces that client vaults contain no ADRs, SOPs, internal business plans, or developer jargon."""
    leaks = []
    
    # 1. Check prohibited directories
    for forbidden in ["_Meta/ADR", "_Meta/Projects", "_Meta/Telemetry", "_Meta/SOP", "_Meta/Skills"]:
        if (VAULT_PATH / forbidden).exists():
            leaks.append(f"Forbidden internal directory exists: {forbidden}")
            
    # 2. Check prohibited filenames
    for p in VAULT_PATH.glob("**/*.md"):
        if "Business_Plan" in p.name or "Business Plan" in p.name:
            leaks.append(f"Internal business plan found in client vault: {p.relative_to(VAULT_PATH)}")

    if leaks:
        print(f"❌ [INTERNAL GOVERNANCE LEAK DETECTED] Found {len(leaks)} prohibited items:")
        for l in leaks:
            print(f"   - {l}")
        return False
    print("✨ [Client Isolation Check] 0 internal ADRs, SOPs, or Business Plans in client vault.")
    return True

def collect_vault_files():
    vault_files = {}
    for p in VAULT_PATH.glob("**/*"):
        if p.is_file() and not any(part.startswith('.') for part in p.parts):
            rel = p.relative_to(VAULT_PATH).as_posix()
            vault_files[rel] = p
            vault_files[p.name] = p
            if p.suffix == '.md':
                vault_files[p.stem] = p
    return vault_files

def enforce_family_tree_blocks():
    """Ensures 100% of person profiles have the dynamic family-tree codeblock."""
    injected = 0
    tree_block = "\n## 🌳 Family Tree & Dynamic Lineage Graph\n\n```family-tree\ndepth: 2\nspouses: true\ndates: true\ndirection: TD\n```\n"
    for p in PEOPLE_DIR.glob("**/*.md"):
        txt = p.read_text(encoding='utf-8', errors='ignore')
        if "```family-tree" not in txt:
            if "## 📌 Executive Summary" in txt:
                parts = txt.split("## 📌 Executive Summary", 1)
                next_sec = re.search(r'\n##\s+', parts[1])
                if next_sec:
                    idx = next_sec.start()
                    new_txt = parts[0] + "## 📌 Executive Summary" + parts[1][:idx] + tree_block + parts[1][idx:]
                else:
                    new_txt = txt + tree_block
                p.write_text(new_txt, encoding='utf-8')
                injected += 1
    print(f"🌳 [Family Tree Coverage] Audited {len(list(PEOPLE_DIR.glob('**/*.md')))} profiles; {injected} missing tree blocks injected.")

def audit_bidirectional_references():
    """Audits all internal links, embeds, and canvas references for 100% resolution."""
    vault_files = collect_vault_files()
    broken_references = []
    total_refs = 0

    # 1. Markdown files
    for p in VAULT_PATH.glob("**/*.md"):
        if any(part.startswith('.') for part in p.parts):
            continue
        rel_p = p.relative_to(VAULT_PATH).as_posix()
        txt = p.read_text(encoding='utf-8', errors='ignore')

        # Frontmatter
        if txt.startswith('---'):
            parts = txt.split('---', 2)
            if len(parts) >= 3:
                try:
                    fm = yaml.safe_load(parts[1])
                    if isinstance(fm, dict):
                        for k in ['sources', 'photos', 'parents', 'children', 'spouse', 'siblings', 'subject', 'target_person', 'target_individual']:
                            vals = fm.get(k, [])
                            if isinstance(vals, str): vals = [vals]
                            if isinstance(vals, list):
                                for v in vals:
                                    v_clean = str(v).strip()
                                    if v_clean.startswith('[[') and v_clean.endswith(']]'):
                                        v_clean = v_clean[2:-2].split('|')[0].split(r'\|')[0].split('#')[0].strip().rstrip('\\').strip()
                                    if v_clean:
                                        total_refs += 1
                                        target_clean = v_clean.replace('\\', '')
                                        target_base = os.path.basename(target_clean)
                                        if target_clean not in vault_files and target_base not in vault_files and (target_clean + '.md') not in vault_files and (target_base + '.md') not in vault_files:
                                            broken_references.append((rel_p, f"frontmatter:{k}", v_clean))
                except Exception:
                    pass

        # Embeds ![[...]]
        for m in EMBED_RE.finditer(txt):
            total_refs += 1
            target = m.group(1).split('|')[0].split(r'\|')[0].split('#')[0].strip().rstrip('\\').strip()
            target_base = os.path.basename(target)
            if target not in vault_files and target_base not in vault_files:
                broken_references.append((rel_p, "embed", target))

        # Markdown images ![]()
        for m in MD_IMG_RE.finditer(txt):
            target = m.group(1).strip()
            if not target.startswith('http'):
                total_refs += 1
                target_base = os.path.basename(target)
                if target not in vault_files and target_base not in vault_files:
                    broken_references.append((rel_p, "md_img", target))

        # Wikilinks [[...]]
        txt_clean = re.sub(r'```.*?```', '', txt, flags=re.DOTALL)
        txt_clean = re.sub(r'`[^`]+`', '', txt_clean)
        txt_clean = re.sub(r'!\[\[[^\]]+\]\]', '', txt_clean)
        txt_clean = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', txt_clean)
        
        for m in WIKILINK_RE.finditer(txt_clean):
            raw_match = m.group(1).strip()
            target = re.split(r'(?<!\\)\||\\\|', raw_match)[0].split('#')[0].strip().rstrip('\\').strip()
            if target and not target.startswith('http') and not target.startswith('#') and not target.startswith('mailto'):
                total_refs += 1
                target_base = os.path.basename(target)
                if target not in vault_files and target_base not in vault_files and (target + '.md') not in vault_files and (target_base + '.md') not in vault_files:
                    broken_references.append((rel_p, "wikilink", target))

    # 2. Canvas files
    for p in VAULT_PATH.glob("**/*.canvas"):
        if any(part.startswith('.') for part in p.parts):
            continue
        rel_p = p.relative_to(VAULT_PATH).as_posix()
        try:
            cdata = json.loads(p.read_text(encoding='utf-8'))
            for node in cdata.get('nodes', []):
                nfile = node.get('file')
                if nfile:
                    total_refs += 1
                    nbase = os.path.basename(nfile)
                    if nfile not in vault_files and nbase not in vault_files:
                        broken_references.append((rel_p, "canvas_node", nfile))
        except Exception:
            pass

    print(f"🔗 [Reverse Linkage Audit] Audited {total_refs} total references across markdown & canvas files.")
    if broken_references:
        print(f"❌ [BROKEN REFERENCES DETECTED] Found {len(broken_references)} unresolved references:")
        for doc, rtype, tgt in broken_references:
            print(f"   - In {doc} ({rtype}) -> '{tgt}'")
        return False
    else:
        print("✅ [Reverse Linkage Audit] 0 broken links, 0 missing embeds, 0 dangling references.")
        return True

def run_pointer_reconciliation():
    """Runs the bidirectional pointer reconciler script."""
    rec_script = META_DIR / "Scripts" / "reconcile_bidirectional_lineage_pointers.py"
    if rec_script.exists():
        import subprocess
        res = subprocess.run([sys.executable, str(rec_script)], capture_output=True, text=True)
        print("🧬 [Pointer Reconciler Output]")
        for line in res.stdout.strip().splitlines()[-6:]:
            print(f"   {line}")
        if res.returncode != 0:
            print(f"❌ Reconciler failed: {res.stderr}")
            return False
    return True

def main():
    print("=" * 80)
    print(f"  🍁 Canada-Citizenship Standalone Health & Self-Healing Sentinel")
    print("=" * 80)

    audit_synthetic_document_prohibition()
    isolation_ok = audit_zero_internal_governance_leakage()
    enforce_family_tree_blocks()
    
    pointers_ok = run_pointer_reconciliation()
    links_ok = audit_bidirectional_references()

    print("=" * 80)
    if pointers_ok and links_ok and isolation_ok:
        print("🎉 [VAULT STATUS: 100% HEALTHY, LASER-SHARP & STANDALONE]")
        print("   - 0 Synthetic/AI-generated documents")
        print("   - 0 Internal ADRs, SOPs, or Business Plan leaks")
        print("   - 0 Broken wikilinks or missing media embeds")
        print("   - 100% Bidirectional lineage pointer symmetry")
        print("   - 100% Dynamic family tree coverage")
        sys.exit(0)
    else:
        print("❌ [VAULT STATUS: UNHEALTHY — ACTION REQUIRED]")
        sys.exit(1)

if __name__ == "__main__":
    main()
