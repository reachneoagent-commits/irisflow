#!/usr/bin/env python3
"""Compare the LiveKit pieces Irisflow ships with their latest releases.

Prints a Markdown report. Exit 0 when everything is current, 10 when something newer is out,
1 on error. Used by .github/workflows/upstream-check.yml; safe to run locally.
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NPM = [  # (lockfile, package)
    ("app/web/package-lock.json", "livekit-client"),
    ("app/web/package-lock.json", "@livekit/components-react"),
    ("app/web/package-lock.json", "@livekit/components-styles"),
    ("app/server/package-lock.json", "livekit-server-sdk"),
]
COMPOSE = "deploy/docker-compose.yml"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "irisflow-upstream-check", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    rows, behind = [], 0
    for lock, pkg in NPM:
        have = json.loads((ROOT / lock).read_text())["packages"][f"node_modules/{pkg}"]["version"]
        latest = get(f"https://registry.npmjs.org/{pkg}/latest")["version"]
        new = have != latest
        behind += new
        rows.append((pkg, lock, have, latest, f"https://www.npmjs.com/package/{pkg}?activeTab=versions", new))
    m = re.search(r"livekit/livekit-server:(\S+)", (ROOT / COMPOSE).read_text())
    have = m.group(1) if m else "?"
    latest = get("https://api.github.com/repos/livekit/livekit/releases/latest")["tag_name"]
    new = have != latest
    behind += new
    rows.append(("livekit-server", COMPOSE, have, latest, "https://github.com/livekit/livekit/releases", new))

    print("| Piece | Where | Irisflow | Latest | |\n|---|---|---|---|---|")
    for name, where, h, l, link, new in rows:
        print(f"| {name} | `{where}` | {h} | {l} | {'**update** ' if new else ''}[releases]({link}) |")
    print()
    if behind:
        print("Update on a branch: `npm install <pkg>@latest` in the app folder (or the image tag in "
              f"`{COMPOSE}`), run the tests and a call between two devices, then open a pull request.")
    return 10 if behind else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001
        print(f"upstream check failed: {e}", file=sys.stderr)
        sys.exit(1)
