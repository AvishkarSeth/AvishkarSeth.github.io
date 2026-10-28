"""Report ORCID works that are missing from _data/publications.yml.

Writes a Markdown report to --out only when something is missing, so a
workflow can open an issue from it. It never edits the site: you decide what
to add (copy an entry in _data/publications.yml and add an image).
"""
import argparse
import re
import sys

import requests
import yaml


def norm(text):
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def fetch_works(orcid):
    r = requests.get(
        f"https://pub.orcid.org/v3.0/{orcid}/works",
        headers={"Accept": "application/json"},
        timeout=30,
    )
    r.raise_for_status()
    works = []
    for group in r.json().get("group", []):
        summary = group["work-summary"][0]
        title = ((summary.get("title") or {}).get("title") or {}).get("value", "")
        year = (((summary.get("publication-date") or {}).get("year")) or {}).get("value", "")
        doi = ""
        for ext in (group.get("external-ids") or {}).get("external-id", []):
            if ext.get("external-id-type") == "doi":
                doi = ext.get("external-id-value", "")
                break
        works.append({"title": title, "year": year, "doi": doi})
    return works


def known_titles(path):
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or []
    return {norm(item["title"]) for group in data for item in group.get("items", [])}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--orcid", required=True)
    ap.add_argument("--data", default="_data/publications.yml")
    ap.add_argument("--out", default="orcid-report.md")
    args = ap.parse_args()

    known = known_titles(args.data)
    missing = [w for w in fetch_works(args.orcid)
               if w["title"] and not any(norm(w["title"]) in k or k in norm(w["title"]) for k in known)]
    if not missing:
        print("All ORCID works are already on the site.")
        return 0

    lines = ["These works are on your ORCID record but not in `_data/publications.yml`:", ""]
    for w in sorted(missing, key=lambda w: w["year"], reverse=True):
        doi = f" - https://doi.org/{w['doi']}" if w["doi"] else ""
        lines.append(f"- [ ] {w['year']}: {w['title']}{doi}")
    lines += ["", "To add one, copy an entry in `_data/publications.yml` and add a thumbnail under `assets/img/research/`."]
    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"{len(missing)} work(s) missing; report written to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
