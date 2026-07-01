---
name: conventional-commit-staged
description: >-
  Drafts git commit messages from staged changes following Conventional Commits
  1.0.0, with the title description and body in Simplified Chinese after the colon.
  Use when the user asks for commit text, a commit message, or Conventional Commits
  from staged or indexed changes; or mentions git commit with staged diff.
---

# Conventional Commits from Staged Changes

Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). **Do not guess the diff** — inspect what is actually staged.

## Language rule (required)

- **After the first `:` on the subject line** (the `description` segment): use **Simplified Chinese**, concise imperative style, **no trailing period**.
- **Body paragraphs** (正文): **Simplified Chinese**.
- **Footers** (`BREAKING CHANGE:`, `Refs:` 等): keep **footer tokens** in English per spec; the **explanatory text after `:`** in footers use **Simplified Chinese** (except issue IDs / SHAs).
- **`type` and `scope`** stay the usual English nouns (`feat`, `fix`, `api`, `mobile`, etc.).

## Required input: staged diff

1. Run in the relevant git repo (repository root or subtree with its own `.git`):
   - `git diff --cached` — full staged patch
   - If output is huge, use `git diff --cached --stat` first, then `git diff --cached -- path1 path2` for the important paths
2. If `git diff --cached` is empty: say there are no staged changes; suggest `git add` or offer to draft from unstaged (`git diff`) only if the user explicitly wants that.

## Commit shape (spec)

```
<type>[optional scope][optional !]: <中文简述>

[可选正文，中文]

[optional footer(s)]
```

- **type**: `feat` (new feature) or `fix` (bug fix) when applicable; otherwise use `docs`, `chore`, `refactor`, `perf`, `test`, `build`, `ci`, `style`, etc. as appropriate.
- **scope**: optional noun in parentheses, e.g. `feat(api): ...`. Use a short, real area from the changed paths (module, package, domain).
- **`!`**: include before `:` when the change is breaking (API/behavior). May pair with a `BREAKING CHANGE:` footer.
- **description**: **Chinese**; imperative mood, no trailing period, ~50 characters or less when possible; summarize the **staged** intent.
- **body**: optional; blank line after title; **Chinese**; explain *why* or non-obvious details if the diff needs it.
- **footers**: e.g. `BREAKING CHANGE: ...`, `Refs: #123` — trailer style; **Chinese** for the narrative after `BREAKING CHANGE:`.

Spec reference: types, `BREAKING CHANGE`, and SemVer correlation are defined on [conventionalcommits.org](https://www.conventionalcommits.org/en/v1.0.0/).

## Choosing type from the diff

| Staged change suggests | type |
|------------------------|------|
| New behavior, API, UI capability | `feat` |
| Correct wrong behavior | `fix` |
| Documentation only | `docs` |
| Tests only | `test` |
| CI/config/pipeline | `ci` |
| Build tooling, deps lockfile for tooling | `build` |
| Formatting, no logic change | `style` |
| Same behavior, structure cleanup | `refactor` |
| Performance | `perf` |
| Maintenance, deps bump, misc | `chore` |

If the diff mixes unrelated concerns, say so and recommend splitting commits; still output one message for *current* staged set if the user asked for a single commit.

## Output to the user

1. **Proposed title line** (single line, ready to paste).
2. **Optional**: full message (title + body + footers) in a fenced block.
3. **Optional**: one-line **why** tying bullets to files/hunks if non-obvious (中文可与英文文件名混排).
4. If breaking: flag clearly and include `!` or `BREAKING CHANGE:` per spec.

## Examples (format only — always derive from real `git diff --cached`)

```
feat(auth): 新增密码重置请求接口

校验邮箱并签发 1 小时有效的单次令牌。

Refs: #402
```

```
fix(reports): 空 CSV 时不再崩溃

无表头行时跳过解析，避免越界。

```

```
feat(api)!: 将用户 id 字段重命名为 subject

BREAKING CHANGE: 响应字段 `userId` 已改为 `subject`，客户端需更新解析逻辑。
```

## Anti-patterns

- Inventing changes not present in the staged diff.
- Vague titles: `fix: 小修`, `chore: 杂项`.
- Title line ending with a period (avoid).
- Wrong type for marketing-only or docs-only work (`feat`/`fix` misuse).
- English-only description after `:` when the user expects Chinese (per this skill).
