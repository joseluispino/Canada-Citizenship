import re
from pathlib import Path
from safe_frontmatter_injector import inject_source_safely

vault_root = Path("/home/jpino/Obsidian/Canada-Test")

# 1. Patrick Whalen
pw_file = vault_root / "People/W/Whalen/Whalen, Patrick 1811-09-01.md"
if pw_file.exists():
    src_link = "[[Sources/Microfilms/1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001.md]]"
    inject_source_safely(pw_file, src_link, "1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001")
    txt = pw_file.read_text(encoding='utf-8')
    if "1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001-Enhanced.jpg" not in txt:
        block = """
### 🇨🇦 Primary Pre-Confederation Microfilm Facsimile (1861 Census of New Brunswick)
![[Sources/Microfilms/1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001-Enhanced.jpg|850]]
* **Archive Reference:** Library and Archives Canada (LAC) Microfilm Reel C-1001, West Isles Parish, Charlotte County, Page 13, Lines 26–36.
* **Recovered Vital Facts:** Patrick Whalen (Age 45, Head, **Fisherman**, **Church of England**), Eliza (Age 40), with children including infant Warren (Age 1).
"""
        txt = txt.replace("## 📄 Source Documents\n", f"## 📄 Source Documents\n{block}\n")
        pw_file.write_text(txt, encoding='utf-8')
        print("✅ Hydrated Patrick Whalen in Canada-Test")

# 2. John Warren Whalen
jww_file = vault_root / "People/W/Whalen/Whalen, John Warren 1860-08-12.md"
if jww_file.exists():
    src_link = "[[Sources/Microfilms/1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001.md]]"
    inject_source_safely(jww_file, src_link, "1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001")
    txt = jww_file.read_text(encoding='utf-8')
    if "1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001-Enhanced.jpg" not in txt:
        block = """
### 🇨🇦 Primary Pre-Confederation Microfilm Facsimile (1861 Census of New Brunswick)
![[Sources/Microfilms/1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001-Enhanced.jpg|850]]
* **Archive Reference:** LAC Microfilm Reel C-1001, West Isles Parish, Charlotte County, Page 13, Line 36 (listed as infant *Warren Whalen*, Age 1).
* **Evidentiary Significance:** Contemporaneous civil enumeration proving Canadian soil birth on August 12, 1860 in Deer Island / West Isles, NB.
"""
        txt = txt.replace("## 📄 Source Documents\n", f"## 📄 Source Documents\n{block}\n")
        jww_file.write_text(txt, encoding='utf-8')
        print("✅ Hydrated John Warren Whalen in Canada-Test")

# 3. Eliza Leslie
el_file = vault_root / "People/L/Leslie/Leslie, Eliza 1824.md"
if el_file.exists():
    src_link = "[[Sources/Microfilms/1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001.md]]"
    inject_source_safely(el_file, src_link, "1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001")
    txt = el_file.read_text(encoding='utf-8')
    if "1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001-Enhanced.jpg" not in txt:
        block = """
### 🇨🇦 Primary Pre-Confederation Microfilm Facsimile (1861 Census of New Brunswick)
![[Sources/Microfilms/1861-Census-WestIsles-CharlotteNB-PatrickWhalinFamily-LAC-C1001-Enhanced.jpg|850]]
* **Archive Reference:** LAC Microfilm Reel C-1001, West Isles Parish, Charlotte County, Page 13, Line 27 (listed as *Eliza Whalin*, Age 40, Church of England).
"""
        txt = txt.replace("## 📄 Source Documents\n", f"## 📄 Source Documents\n{block}\n")
        el_file.write_text(txt, encoding='utf-8')
        print("✅ Hydrated Eliza Leslie in Canada-Test")
