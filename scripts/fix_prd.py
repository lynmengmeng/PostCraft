# -*- coding: utf-8 -*-
"""Repair PRD.md: encoding + broken markdown code fences."""
from pathlib import Path
import re

PRD = Path(__file__).resolve().parent.parent / "docs" / "PRD.md"


def load(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "utf-16-le", "utf-16", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def save(path: Path, text: str) -> None:
    text = text.lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    if not text.endswith("\n"):
        text += "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def fix_code_fences(text: str) -> str:
    text = text.replace("\x08", "")

    # Broken patterns from Python \t escape in generated content
    replacements = [
        ("```t`\t" + "ext", "```text"),
        ("`\t" + "ext", "```text"),
        ("```b`\t" + "ash", "```bash"),
        ("`\t" + "ash", "```bash"),
        ("``\t" + "http", "```http"),
        ("`\t" + "http", "```http"),
        ("```t`\text", "```text"),
        ("```b`\bash", "```bash"),
    ]
    for old, new in replacements:
        text = text.replace(old, new)

    # Regex fallback
    text = re.sub(r"```t`\s*ext", "```text", text)
    text = re.sub(r"^`\s*ext$", "```text", text, flags=re.MULTILINE)

    lines = text.splitlines()
    fixed = []
    for line in lines:
        stripped = line.strip()
        if stripped in ("ext", "`ext", "``ext"):
            fixed.append("```text")
        elif re.match(r"^`+\s*ext$", stripped):
            fixed.append("```text")
        elif stripped == "http" or stripped == "`http" or stripped == "``http":
            fixed.append("```http")
        elif stripped == "ash" or stripped == "`ash":
            fixed.append("```bash")
        else:
            fixed.append(line)
    return "\n".join(fixed) + "\n"


def main() -> None:
    text = load(PRD)
    text = fix_code_fences(text)
    save(PRD, text)

    content = PRD.read_text(encoding="utf-8")
    lines = content.splitlines()

    bad = []
    for i, line in enumerate(lines, 1):
        if line.startswith("```"):
            if not re.match(r"^```[a-zA-Z0-9]*$", line.strip()) and line.strip() != "```":
                bad.append((i, line))

    fence_count = sum(1 for l in lines if l.strip().startswith("```"))
    assert "产品需求文档" in content
    assert bad == [], f"Still bad fences: {bad}"
    assert fence_count % 2 == 0, f"Unbalanced fences: {fence_count}"

    print("PRD repaired successfully")
    print("Lines:", len(lines))
    print("Code fences:", fence_count)
    print("First line:", lines[0])
    print("Sample fence L90:", lines[89] if len(lines) >= 90 else "n/a")


if __name__ == "__main__":
    main()
