#!/usr/bin/env python3
"""
reconcile_bidirectional_lineage_pointers.py
==============================================================================
Vault-Wide Lineage Pointer Reconciler & Reciprocal Symmetry Auditor (ADR-016 & GEN-ADR-004)
Ensures 100% bidirectional symmetry across all profile frontmatter in People/:
  1. Parents <-> Children (Every parent contains child; every child contains parent)
  2. Spouse <-> Spouse (Every spouse contains reciprocal spouse)
  3. Sibling <-> Sibling (Every sibling group shares symmetric sibling arrays)
==============================================================================
"""

import os
import re
import sys
import json
import yaml
from pathlib import Path
from collections import defaultdict

VAULT_ROOT = Path(__file__).resolve().parents[2]
PEOPLE_DIR = VAULT_ROOT / "People"
DAG_FILE = VAULT_ROOT / "_Meta/family_tree_dag.json"

def clean_link(val):
    if not val:
        return None
    s = str(val).strip()
    s = re.sub(r"^\[\[", "", s).rstrip("]").split("|")[0].strip()
    return s

def extract_links(val):
    if not val:
        return []
    raw_list = val if isinstance(val, list) else [val]
    out = []
    for item in raw_list:
        if not item:
            continue
        if isinstance(item, str):
            matches = re.findall(r"\[\[(.*?)\]\]", item)
            if matches:
                for m in matches:
                    cl = clean_link(m)
                    if cl: out.append(cl)
            else:
                cl = clean_link(item)
                if cl: out.append(cl)
    return list(dict.fromkeys(out))

def format_wikilink_list(items):
    out = []
    for it in items:
        if not it: continue
        clean = clean_link(it)
        if clean:
            out.append(f"[[{clean}]]")
    return list(dict.fromkeys(out))

def reconcile_all_pointers(dry_run=False):
    print("=" * 80)
    print("  🧬 Vault-Wide Bidirectional Lineage Pointer Reconciler")
    print("=" * 80)

    # 1. Load All Profiles into Index
    records = {}
    file_by_key = {} # stem.lower(), id.lower(), name.lower() -> canonical_stem

    all_files = list(PEOPLE_DIR.rglob("*.md"))
    print(f"Loading {len(all_files)} profiles from {PEOPLE_DIR.name}/...")

    for p in all_files:
        if p.name.startswith("."):
            continue
        stem = p.stem
        try:
            txt = p.read_text(encoding="utf-8")
            parts = txt.split("---", 2)
            if len(parts) >= 3:
                fm_raw = parts[1]
                body = parts[2]
                fm = yaml.safe_load(fm_raw) or {}

                parents = extract_links(fm.get("parents")) + extract_links(fm.get("father")) + extract_links(fm.get("mother"))
                spouse = extract_links(fm.get("spouse")) + extract_links(fm.get("spouses"))
                children = extract_links(fm.get("children"))
                siblings = extract_links(fm.get("siblings"))

                rec = {
                    "path": p,
                    "stem": stem,
                    "name": fm.get("name") or stem,
                    "id": fm.get("id"),
                    "parents": list(dict.fromkeys(parents)),
                    "spouse": list(dict.fromkeys(spouse)),
                    "children": list(dict.fromkeys(children)),
                    "siblings": list(dict.fromkeys(siblings)),
                    "fm": fm,
                    "body": body
                }
                records[stem] = rec
                file_by_key[stem.lower()] = stem
                if rec["id"]:
                    file_by_key[str(rec["id"]).lower()] = stem
                if fm.get("name"):
                    file_by_key[str(fm.get("name")).lower()] = stem
        except Exception as e:
            print(f"⚠️ Error reading {p.name}: {e}")

    print(f"Indexed {len(records)} valid person profiles.")

    SUFFIX_TOKENS = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v", "2nd", "3rd"}

    def extract_suffix(s):
        tokens = re.findall(r"\b[\w\.]+\b", str(s).lower())
        for t in reversed(tokens):
            if t in SUFFIX_TOKENS:
                return t
        return ""

    def normalize_tokens(s):
        # Remove URN and bracket cruft
        clean = re.sub(r"urn-gen-[^\s]+", "", str(s).lower())
        clean = re.sub(r"[^\w\s]", " ", clean)
        tokens = [t for t in clean.split() if t not in SUFFIX_TOKENS and len(t) > 1]
        return tokens

    def resolve_stem(key):
        if not key: return None
        k_l = str(key).strip().lower()
        if k_l in file_by_key:
            return file_by_key[k_l]

        k_suffix = extract_suffix(k_l)
        k_tokens = normalize_tokens(k_l)
        if not k_tokens:
            return None

        # Safe matching: require exact token subset match AND matching suffix
        for lookup, target_stem in file_by_key.items():
            t_suffix = extract_suffix(lookup)
            if k_suffix != t_suffix:
                # Suffix mismatch (e.g. Jr vs Sr or Jr vs plain)
                continue
            l_tokens = normalize_tokens(lookup)
            if k_tokens == l_tokens:
                return target_stem

        return None

    # Canonicalize existing links to known stems and eliminate self-loops
    for stem, rec in records.items():
        rec["parents"] = list(dict.fromkeys([resolve_stem(x) or x for x in rec["parents"] if x and (resolve_stem(x) or x) != stem]))
        rec["spouse"] = list(dict.fromkeys([resolve_stem(x) or x for x in rec["spouse"] if x and (resolve_stem(x) or x) != stem]))
        rec["children"] = list(dict.fromkeys([resolve_stem(x) or x for x in rec["children"] if x and (resolve_stem(x) or x) != stem]))
        rec["siblings"] = list(dict.fromkeys([resolve_stem(x) or x for x in rec["siblings"] if x and (resolve_stem(x) or x) != stem]))

    # 2. Reconcile Parent <-> Child Symmetry (prevent self-loops)
    p_to_c_added = 0
    c_to_p_added = 0

    for stem, rec in list(records.items()):
        # Child -> Parents: ensure all listed parents have this child
        for p_stem in list(rec["parents"]):
            if p_stem in records and p_stem != stem:
                p_rec = records[p_stem]
                if stem not in p_rec["children"]:
                    p_rec["children"].append(stem)
                    p_to_c_added += 1

        # Parent -> Children: ensure all listed children have this parent
        for c_stem in list(rec["children"]):
            if c_stem in records and c_stem != stem:
                c_rec = records[c_stem]
                if stem not in c_rec["parents"]:
                    c_rec["parents"].append(stem)
                    c_to_p_added += 1

    # 3. Reconcile Spouse <-> Spouse Symmetry (prevent self-loops)
    spouse_added = 0
    for stem, rec in list(records.items()):
        for s_stem in list(rec["spouse"]):
            if s_stem in records and s_stem != stem:
                s_rec = records[s_stem]
                if stem not in s_rec["spouse"]:
                    s_rec["spouse"].append(stem)
                    spouse_added += 1

    # 4. Reconcile Siblings (from shared parents + explicit sibling links)
    # Group siblings by shared parents tuple
    parent_groups = defaultdict(set)
    for stem, rec in records.items():
        # Only group if at least one parent is resolved
        valid_parents = tuple(sorted([p for p in rec["parents"] if p in records and p != stem]))
        if valid_parents:
            parent_groups[valid_parents].add(stem)

    sibling_added = 0
    # Add shared parent siblings
    for parents_tuple, children_set in parent_groups.items():
        if len(children_set) > 1:
            for child_stem in children_set:
                co_siblings = children_set - {child_stem}
                for sib in co_siblings:
                    if sib not in records[child_stem]["siblings"]:
                        records[child_stem]["siblings"].append(sib)
                        sibling_added += 1

    # Reciprocal symmetry on explicitly listed siblings
    for stem, rec in list(records.items()):
        for sib_stem in list(rec["siblings"]):
            if sib_stem in records and sib_stem != stem:
                s_rec = records[sib_stem]
                if stem not in s_rec["siblings"]:
                    s_rec["siblings"].append(stem)
                    sibling_added += 1

    # Audit for multi-parent (>2) profiles
    multi_parent_count = 0
    for stem, rec in records.items():
        if len(rec["parents"]) > 2:
            multi_parent_count += 1
            # print(f"⚠️ Multi-Parent Profile (>2): {stem} -> {rec['parents']}")

    print("\n--- Reconciliation Calculations ---")
    print(f"  👶 Parent -> Child reciprocal links to inject: {p_to_c_added}")
    print(f"  👨 Child -> Parent reciprocal links to inject: {c_to_p_added}")
    print(f"  💑 Spouse reciprocal links to inject: {spouse_added}")
    print(f"  👫 Sibling reciprocal links to inject: {sibling_added}")
    print(f"  ⚠️ Profiles with >2 parents detected: {multi_parent_count}")

    if dry_run:
        print("\n🔍 DRY RUN Complete. No files written.")
        return

    # 5. Write Updated Frontmatter Back to Files
    modified_files = 0
    dag_export = {}

    for stem, rec in records.items():
        fm = rec["fm"]
        orig_parents = extract_links(fm.get("parents"))
        orig_spouse = extract_links(fm.get("spouse"))
        orig_children = extract_links(fm.get("children"))
        orig_siblings = extract_links(fm.get("siblings"))

        new_parents = sorted(list(rec["parents"]))
        new_spouse = sorted(list(rec["spouse"]))
        new_children = sorted(list(rec["children"]))
        new_siblings = sorted(list(rec["siblings"]))

        changed = (
            set(orig_parents) != set(new_parents) or
            set(orig_spouse) != set(new_spouse) or
            set(orig_children) != set(new_children) or
            set(orig_siblings) != set(new_siblings)
        )

        # Update fm dict
        fm["parents"] = format_wikilink_list(new_parents)
        fm["spouse"] = format_wikilink_list(new_spouse)
        fm["children"] = format_wikilink_list(new_children)
        fm["siblings"] = format_wikilink_list(new_siblings)

        # Clean up legacy single-string keys if present
        if "father" in fm and fm["father"]: del fm["father"]
        if "mother" in fm and fm["mother"]: del fm["mother"]
        if "spouses" in fm and fm["spouses"]: del fm["spouses"]

        # Populate DAG export node
        dag_export[stem] = {
            "name": fm.get("name") or stem.split(" - URN-GEN")[0],
            "sex": fm.get("sex") or fm.get("gender") or "U",
            "birth_date": str(fm.get("birth_date", "") or ""),
            "death_date": str(fm.get("death_date", "") or ""),
            "birth_place": str(fm.get("birth_place", "") or ""),
            "death_place": str(fm.get("death_place", "") or ""),
            "locations_lived": fm.get("locations_lived") or [],
            "citizenship_status": fm.get("citizenship_status") or "",
            "path": str(rec["path"].relative_to(VAULT_ROOT)),
            "parents": new_parents,
            "spouse": new_spouse,
            "children": new_children,
            "siblings": new_siblings
        }

        if changed:
            # Reconstruct YAML frontmatter
            fm_yaml = yaml.dump(fm, allow_unicode=True, sort_keys=False, default_flow_style=False)
            new_file_content = f"---\n{fm_yaml}---\n{rec['body'].lstrip()}"
            rec["path"].write_text(new_file_content, encoding="utf-8")
            modified_files += 1

    print(f"\n✅ Successfully updated {modified_files} profile files with 100% bidirectional pointer symmetry.")

    # 6. Write Updated DAG File
    DAG_FILE.write_text(json.dumps(dag_export, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✅ Re-indexed complete DAG with {len(dag_export)} nodes into: {DAG_FILE.name}")

if __name__ == "__main__":
    is_dry = "--dry-run" in sys.argv
    reconcile_all_pointers(dry_run=is_dry)
