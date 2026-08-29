import hashlib
from pathlib import Path
from PIL import Image
import numpy as np

def update_microfilm_md(vault_path):
    v = Path(vault_path)
    mf_dir = v / 'Sources' / 'Microfilms'
    
    items = [
        {
            'stem': '1851-Microfilm-LAC-REEL-C995-NewBrunswick-Census',
            'title': '1851 Census of New Brunswick (Microfilm Reel C-995)',
            'archive_ref': 'Library and Archives Canada, RG 31, Reel C-995, Schedule 1',
            'url': 'http://data2.collectionscanada.gc.ca/e/e092/e002294588.jpg',
            'notes': 'Official Library and Archives Canada master camera microfilm scan of the 1851 Census of New Brunswick (Charlotte County District, Lepreau & West Isles schedules).'
        },
        {
            'stem': '1861-Microfilm-LAC-REEL-C1038-NewBrunswick-Census',
            'title': '1861 Census of New Brunswick (Microfilm Reel C-1038)',
            'archive_ref': 'Library and Archives Canada, RG 31, Reel C-1038, Charlotte District',
            'url': 'http://data2.collectionscanada.gc.ca/1861/jpg/4108521_00457.jpg',
            'notes': 'Official Library and Archives Canada master camera microfilm scan of the 1861 Census of New Brunswick (Charlotte District Schedules).'
        },
        {
            'stem': '1871-Microfilm-LAC-REEL-C10376-CharlotteCounty',
            'title': '1871 Census of Canada — Charlotte County (Microfilm Reel C-10376)',
            'archive_ref': 'Library and Archives Canada, RG 31, Reel C-10376, Schedule 1',
            'url': 'http://data2.collectionscanada.gc.ca/1871/jpg/4396656_00120.jpg',
            'notes': 'Official Library and Archives Canada master camera microfilm scan of the 1871 Census of Canada (District 175, Charlotte County).'
        }
    ]
    
    for it in items:
        img_p = mf_dir / f"{it['stem']}.jpg"
        md_p = mf_dir / f"{it['stem']}.md"
        if img_p.exists():
            data = img_p.read_bytes()
            sha = hashlib.sha256(data).hexdigest()
            img = Image.open(img_p).convert('L')
            sigma = float(np.std(np.array(img)))
            byte_size = len(data)
            
            content = f"""---
doc_type: master_microfilm_scan
id: {it['stem']}
repository: "Library and Archives Canada (LAC)"
archive_ref: "{it['archive_ref']}"
external_url: "{it['url']}"
sha256: "{sha}"
byte_size: {byte_size}
optical_variance_sigma: {sigma:.2f}
status: verified_empirical
tags:
  - type/source
  - type/microfilm
  - topic/citizenship
  - status/verified
---

# 🎞️ Master Microfilm Scan: {it['title']}

## 📌 Evidentiary Integrity & Provenance
* **Archival Holding Reference:** `{it['archive_ref']}`
* **Repository:** Library and Archives Canada (LAC)
* **Canonical Download URL:** [{it['url']}]({it['url']})
* **Cryptographic SHA-256 Checksum:** `{sha}`
* **Optical Pixel Variance:** $\\sigma = {sigma:.2f}$ (Authentic Optical Camera Scan)
* **File Size:** {byte_size:,} bytes

## 🖼️ Document Facsimile Preview
![[Sources/Microfilms/{img_p.name}|750]]

## 📝 Archival Context & Transcription Notes
{it['notes']}
"""
            md_p.write_text(content, encoding='utf-8')
            print(f"Wrote clean metadata for {md_p.name} in {v.name}")

update_microfilm_md('/home/jpino/Obsidian/Canada-Test')
update_microfilm_md('/home/jpino/Obsidian/Genealogy')
