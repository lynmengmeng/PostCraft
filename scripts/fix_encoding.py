# -*- coding: utf-8 -*-
"""Normalize all text files to UTF-8 without BOM."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read_text_auto(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "utf-16-le", "utf-16", "gbk", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def write_utf8(path: Path, content: str) -> None:
    content = content.lstrip("\ufeff")
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    if not content.endswith("\n"):
        content += "\n"
    path.write_text(content, encoding="utf-8", newline="\n")


def main() -> None:
    for path in ROOT.rglob("*.md"):
        write_utf8(path, read_text_auto(path))
        print("fixed:", path.relative_to(ROOT))

    write_utf8(
        ROOT / ".editorconfig",
        """root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true

[*.md]
trim_trailing_whitespace = true
""",
    )

    vscode_dir = ROOT / ".vscode"
    vscode_dir.mkdir(exist_ok=True)
    write_utf8(
        vscode_dir / "settings.json",
        """{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": true,
  "[markdown]": {
    "files.encoding": "utf8"
  }
}
""",
    )

    prd = (ROOT / "docs" / "PRD.md").read_text(encoding="utf-8")
    assert "产品需求文档" in prd
    raw = (ROOT / "docs" / "PRD.md").read_bytes()
    assert not raw.startswith(b"\xef\xbb\xbf")
    assert not raw.startswith(b"\xff\xfe")
    print("PRD OK:", prd.splitlines()[0])
    print("Done.")


if __name__ == "__main__":
    main()
