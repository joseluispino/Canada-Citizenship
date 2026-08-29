import re
import yaml
from pathlib import Path

def inject_source_safely(file_path: Path, src_link: str, s_file_stem: str) -> bool:
    """
    Safely injects a source link into frontmatter and markdown body
    without using brittle string replacement. Guarantees 100% valid YAML.
    """
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"  ❌ Cannot read {file_path.name}: {e}")
        return False
        
    if not content.startswith('---'):
        # No frontmatter, create minimal frontmatter
        new_fm = {"sources": [src_link]}
        fm_yaml = yaml.dump(new_fm, sort_keys=False, allow_unicode=True)
        new_content = f"---\n{fm_yaml}---\n\n{content}\n\n## 📄 Source Documents\n- [[{s_file_stem}]]\n"
        file_path.write_text(new_content, encoding='utf-8')
        return True

    parts = content.split('---', 2)
    if len(parts) < 3:
        return False

    fm_raw = parts[1]
    body = parts[2]

    # Pre-clean any legacy mixed-indentation issues before loading
    cleaned_lines = []
    for line in fm_raw.splitlines():
        # normalize list items to 2 spaces
        if re.match(r"^\s*-\s*", line):
            val = re.sub(r"^\s*-\s*", "", line).strip()
            cleaned_lines.append(f"  - {val}")
        else:
            cleaned_lines.append(line)
    cleaned_fm_str = "\n".join(cleaned_lines)

    try:
        data = yaml.safe_load(cleaned_fm_str)
    except Exception as e:
        # Fallback sanitize wiki links in YAML if unquoted
        safe_fm = re.sub(r"- \[\[(.*?)\]\]", r'- "[[\1]]"', cleaned_fm_str)
        safe_fm = re.sub(r": \[\[(.*?)\]\]", r': "[[\1]]"', safe_fm)
        try:
            data = yaml.safe_load(safe_fm)
        except Exception as e2:
            print(f"  ❌ Unrecoverable YAML syntax in {file_path.name}: {e2}")
            return False

    if not isinstance(data, dict):
        data = {}

    # Safely update sources list
    existing_sources = data.get("sources")
    if existing_sources is None:
        data["sources"] = [src_link]
    elif isinstance(existing_sources, list):
        # Check if already present under various formats
        already_present = False
        for s in existing_sources:
            s_str = str(s).strip()
            if src_link in s_str or s_file_stem in s_str:
                already_present = True
                break
        if not already_present:
            data["sources"].append(src_link)
    elif isinstance(existing_sources, str):
        if src_link not in existing_sources and s_file_stem not in existing_sources:
            data["sources"] = [existing_sources, src_link]

    # Dump cleanly to YAML
    new_fm_yaml = yaml.dump(data, sort_keys=False, allow_unicode=True)
    
    # Pre-flight parse verification before disk write
    try:
        yaml.safe_load(new_fm_yaml)
    except Exception as e:
        print(f"  ❌ Generated invalid YAML for {file_path.name}: {e}")
        return False

    # Update body
    if "## 📄 Source Documents" in body:
        if f"[[{s_file_stem}]]" not in body and src_link not in body:
            body = body.replace("## 📄 Source Documents\n", f"## 📄 Source Documents\n- [[{s_file_stem}]]\n")
    elif "## 📄 Documentary Evidence" in body:
        if f"[[{s_file_stem}]]" not in body and src_link not in body:
            body = body.replace("## 📄 Documentary Evidence\n", f"## 📄 Documentary Evidence\n- [[{s_file_stem}]]\n")
    else:
        if f"[[{s_file_stem}]]" not in body and src_link not in body:
            body = body.rstrip() + f"\n\n## 📄 Source Documents\n- [[{s_file_stem}]]\n"

    new_content = f"---\n{new_fm_yaml}---\n{body.lstrip()}"
    file_path.write_text(new_content, encoding='utf-8')
    return True
