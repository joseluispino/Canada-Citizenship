#!/usr/bin/env python3
"""
genealogy_cookie_heartbeat.py — Unified Pre-Flight Cookie Heartbeat & Interactive Recovery Sentinel
===================================================================================================
Provides automated session heartbeat verification across genealogical research portals.
When a cookie expires:
  - If a human is in the loop (interactive=True), it automatically launches the single-shot
    stealth authentication window on DISPLAY=:0, lets the user log in, saves the fresh token,
    and resumes execution seamlessly!
  - If unattended, it logs the remediation command and gracefully falls back to public repositories.
"""

import os
os.environ["DISPLAY"] = os.environ.get("DISPLAY", ":0")
import sys
import json
import time
import re
import urllib.request
import subprocess
from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "genealogy"
COOKIES_FILE = CONFIG_DIR / "session_cookies.json"
USER_DATA_DIR = CONFIG_DIR / "playwright_profile"

HEALTH_ENDPOINTS = {
    "familysearch.org": {
        "name": "FamilySearch Global Records",
        "url": "https://www.familysearch.org/platform/users/current",
        "login_url": "https://www.familysearch.org/auth/familysearch/login",
        "accept": "application/x-gedcomx-v1+json, application/json",
        "reject_patterns": ["/login", "/auth", "ident.familysearch.org"]
    },
    "ancestry.com": {
        "name": "Ancestry.com Historical Records",
        "url": "https://www.ancestry.com/account/profile",
        "login_url": "https://www.ancestry.com/account/signin",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "reject_patterns": ["/signin", "/account/signin", "login"]
    },
    "wikitree.com": {
        "name": "WikiTree Global Tree",
        "url": "https://www.wikitree.com",
        "login_url": "https://www.wikitree.com",
        "reject_patterns": ["action=login"]
    },
    "canadiana.ca": {
        "name": "Canadiana Online (CRKN)",
        "url": "https://www.canadiana.ca",
        "login_url": "https://www.canadiana.ca",
        "reject_patterns": ["/login"]
    }
}

def load_cookies():
    if not COOKIES_FILE.exists():
        return {}
    try:
        return json.loads(COOKIES_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}

def check_portal_heartbeat(domain: str) -> tuple[bool, str]:
    """Checks whether the session cookie for a given domain is valid and active."""
    cookies = load_cookies()
    cookie_str = cookies.get(domain, "")
    if not cookie_str:
        return False, "Missing session cookie in ~/.config/genealogy/session_cookies.json"

    # Strict auth token requirements
    if domain == "familysearch.org" and "fssessionid=" not in cookie_str:
        return False, "Missing 'fssessionid' authenticated login token (guest cookies only)"

    endpoint_info = HEALTH_ENDPOINTS.get(domain)
    if not endpoint_info:
        return True, "No specific health endpoint defined; cookie present"

    try:
        accept_hdr = endpoint_info.get("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        hdrs = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Cookie": cookie_str,
            "Accept": accept_hdr
        }
        if domain == "familysearch.org":
            m_fs = re.search(r'fssessionid=([^;]+)', cookie_str)
            if m_fs:
                hdrs["Authorization"] = f"Bearer {m_fs.group(1).strip()}"

        req = urllib.request.Request(endpoint_info["url"], headers=hdrs)
        with urllib.request.urlopen(req, timeout=10) as resp:
            final_url = resp.geturl()
            status_code = resp.getcode()
            
            for rej in endpoint_info["reject_patterns"]:
                if rej in final_url:
                    return False, f"Redirected to Auth Wall: {final_url}"
                    
            if status_code in [401, 403]:
                return False, f"HTTP Access Denied ({status_code})"
                
            return True, f"200 OK — Active ({final_url[:45]}...)"
    except urllib.error.HTTPError as e:
        return False, f"HTTP Error {e.code}"
    except Exception as e:
        return False, f"Heartbeat check failed: {e}"

def launch_interactive_reauth(domain: str) -> bool:
    """Launches the single-shot interactive login wizard on DISPLAY=:0."""
    info = HEALTH_ENDPOINTS.get(domain, {})
    login_url = info.get("login_url", "https://www.familysearch.org/en/")
    name = info.get("name", domain)
    
    print("\n" + "=" * 80)
    print(f"  🔐 HUMAN-IN-THE-LOOP AUTHENTICATION TRIGGERED: {name}")
    print("=" * 80)
    print(f"👉 Opening browser window for {name} on DISPLAY=:0...")
    print("👉 Please log in to your account. When complete, close the browser window.")
    print("=" * 80)

    wizard_script = Path(__file__).parent / "setup_genealogy_credentials.py"
    if not wizard_script.exists():
        # Fallback to local execution
        wizard_script = Path("/home/jpino/Obsidian/Genealogy/_Meta/Scripts/setup_genealogy_credentials.py")

    cmd = [sys.executable, str(wizard_script), login_url]
    res = subprocess.run(cmd)
    
    # Re-verify heartbeat after browser closes
    is_ok, msg = check_portal_heartbeat(domain)
    if is_ok:
        print(f"\n🎉 Re-authentication successful! {domain} is now 🟢 ACTIVE ({msg}).")
        return True
    else:
        print(f"\n⚠️ Re-authentication check failed for {domain}: {msg}")
        return False

def ensure_authenticated_session(domains: list[str], interactive: bool = True) -> bool:
    """
    Pre-flight guard for all genealogy tools and agents.
    If any domain is expired, triggers interactive reauth if interactive=True.
    """
    all_ok = True
    for d in domains:
        is_ok, msg = check_portal_heartbeat(d)
        if not is_ok:
            print(f"⚠️ Pre-flight notice: Session for {d} is expired or missing ({msg}).")
            if interactive and os.environ.get("DISPLAY"):
                print(f"Launching interactive session restoration for {d}...")
                recovered = launch_interactive_reauth(d)
                if not recovered:
                    all_ok = False
            else:
                print(f"👉 To fix manually, run: python3 _Meta/Scripts/setup_genealogy_credentials.py")
                all_ok = False
    return all_ok

def check_all_heartbeats(auto_reauth: bool = False) -> dict:
    print("=" * 80)
    print("  💓 Federated Genealogy Session Cookie Heartbeat Sentinel")
    print("=" * 80)
    
    results = {}
    expired_domains = []
    
    for domain, info in HEALTH_ENDPOINTS.items():
        is_ok, msg = check_portal_heartbeat(domain)
        status_icon = "🟢 ACTIVE" if is_ok else "🔴 EXPIRED"
        print(f"  {status_icon:<12} | {info['name']:<32} | {msg}")
        results[domain] = {"active": is_ok, "message": msg}
        if not is_ok:
            expired_domains.append(domain)
            
    if expired_domains and auto_reauth:
        for dom in expired_domains:
            launch_interactive_reauth(dom)
            
    return results

if __name__ == '__main__':
    auto = "--reauth" in sys.argv
    check_all_heartbeats(auto_reauth=auto)
