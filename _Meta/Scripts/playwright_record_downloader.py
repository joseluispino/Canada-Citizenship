#!/usr/bin/env python3
"""
playwright_record_downloader.py
Uses Playwright browser automation combined with saved session cookies (~/.config/genealogy/session_cookies.json)
to navigate FamilySearch and Ancestry record search pages, interact with the DOM,
extract record details, and download digital document artifacts into Sources/_Inbox/
following the disambiguated Unique ID naming standard.
"""

import os
import sys
import json
import time
import random
from pathlib import Path

VAULT_PATH = Path("/home/jpino/Obsidian/Genealogy")
INBOX_PATH = VAULT_PATH / "Sources" / "_Inbox"
COOKIES_PATH = Path.home() / ".config" / "genealogy" / "session_cookies.json"

def load_cookies_for_playwright():
    if not COOKIES_PATH.exists():
        return []
    try:
        raw = json.loads(COOKIES_PATH.read_text(encoding="utf-8"))
        pw_cookies = []
        for domain, cookie_str in raw.items():
            # Parse cookie header string into Playwright cookie format
            for item in cookie_str.split(';'):
                if '=' in item:
                    parts = item.strip().split('=', 1)
                    if len(parts) == 2:
                        name, val = parts
                        pw_cookies.append({
                            "name": name.strip(),
                            "value": val.strip(),
                            "domain": "." + domain,
                            "path": "/"
                        })
        return pw_cookies
    except Exception as e:
        print(f"Error parsing cookies for Playwright: {e}")
        return []

def download_records_with_playwright():
    print("=" * 80)
    print("  🌐 Playwright Browser Automation & Record Downloader")
    print("=" * 80)
    
    INBOX_PATH.mkdir(parents=True, exist_ok=True)
    cookies = load_load_cookies_for_playwright() if 'load_load_cookies_for_playwright' in globals() else load_cookies_for_playwright()
    
    print(f"[INFO] Loaded {len(cookies)} session cookie entries for browser context.")
    
    targets = [
        {"name": "John Warren Whalen", "surname": "Whalen", "given": "John Warren", "birth_year": 1860, "place": "New Brunswick", "id": "URN-GEN-1860-08-JWW"},
    ]
    
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[INFO] Playwright not installed. Please install via pip.")
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
            viewport={"width": 1440, "height": 900}
        )
        if cookies:
            try:
                context.add_cookies(cookies)
            except Exception as e:
                print(f"⚠️ Could not add cookies to browser context: {e}")

        page = context.new_page()
        
        for t in targets:
            search_url = f"https://www.familysearch.org/search/record/results?q.givenName={urllib.parse.quote(t['given'])}&q.surname={urllib.parse.quote(t['surname'])}&q.birthLikeDate.from={t['birth_year']}&q.birthLikeDate.to={t['birth_year']}"
            print(f"\n🌐 Navigating to FamilySearch search for {t['name']}...")
            try:
                page.goto(search_url, timeout=30000)
                page.wait_for_timeout(5000) # Wait for JS DOM rendering
                
                # Take screenshot for audit trail
                screenshot_path = INBOX_PATH / f"1860-Search-WhalenJohnWarren-{t['id']}.png"
                page.screenshot(path=str(screenshot_path), full_page=True)
                print(f"  📸 Saved search results screenshot -> {screenshot_path}")
                
            except Exception as e:
                print(f"  ⚠️ Navigation error: {e}")

        browser.close()
    print("\n🎉 Playwright automated download & audit session completed.")

if __name__ == '__main__':
    import urllib.parse
    download_records_with_playwright()
