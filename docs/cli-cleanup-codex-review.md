# CLI Cleanup Review (Codex)

> **Note**: This document is a historical artifact from the command consolidation process (2026-01).

This is a focused review of the proposed CLI cleanup with suggestions around grouping, discoverability, and long term ergonomics.

## 1) Command groupings (server, tab, mark)

What looks good
- Consolidating into `server`, `tab`, and `mark` reads clean and reduces top level sprawl.
- Subcommand verbs are familiar (`start`, `stop`, `status`, `list`, `new`, `close`).

Potential issues / questions
- The doc uses `fw server` in the grouping section and `nav server` in the summary. Pick one and use it consistently in docs and help text.
- `tab switch` is a bit wordy for the most common action; users will want a short path.
- `mark rm` is consistent with Unix, but it may be less discoverable than `mark delete` or `mark remove` for newer users.

Suggestions
- Keep backward compatible aliases for at least one major release: `serve`, `status`, `tabs`, `tab`, `new-tab`, `close-tab`, `mark`, `markers`, `marker`, `marker-compare`, `marker-delete`, `tidy`. Emit a deprecation warning with the new form.
- Consider allowing a shorthand for switching tabs: `nav tab <id>` as an alias for `nav tab switch <id>`.
- Consider adding aliases for `mark rm` -> `mark delete` and `mark remove` to avoid friction. The canonical verb can remain `rm`.
- Consider `mark show` as an alias for `mark get` since it reads better in human terms; keep `get` as the canonical (works with scripts).
- If you keep `tab new`, decide whether `tab open` should be an alias. (Some users will try it.)

## 2) `find` command with `--in` scoping

What looks good
- A dedicated `find` that avoids full snapshots will speed common flows.
- The pattern of matching by text, role, label, placeholder, test id is consistent with automation tools.
- `--in` scoping is a strong UX improvement for narrowing search without a full DOM snapshot.

Potential issues / questions
- `--in` is overloaded (ref, tag, CSS selector, text). Without a disambiguation strategy, the parser could guess wrong and users will hit surprising failures.
- `find @e42` doubles as a "get details" command. That is convenient but a little semantically odd, since `find` normally implies a query.
- It is not explicit whether matches are case sensitive, whether text is normalized (trim/collapse whitespace), or whether hidden elements are included.

Suggestions
- Add explicit prefixes for `--in` values to make parsing deterministic while keeping the existing shorthand:
  - `--in ref:@e42`
  - `--in tag:form`
  - `--in css:.modal`
  - `--in text:"Shopping Cart"`
  Keep `@ref` and bare tag names as shorthand, but document the precedence order and fallbacks.
- Consider `--in` accepting multiple scopes (AND): `--in ref:@e42 --in css:.row`.
- Provide a stricter mode to avoid ambiguous results:
  - `--one` -> error if 0 or >1 matches
  - `--limit N` -> cap results for predictable output
  - `--first` -> return the first match (deterministic ordering should be documented)
- Clarify `find` defaults: case sensitivity, text normalization, and visibility. Optional flags: `--case-sensitive`, `--include-hidden`.
- If you keep `find @e42` as a "ref inspect" shortcut, call that out explicitly, or consider `nav ref @e42` / `nav inspect @e42` as a clearer command and keep `find @e42` as an alias.

## 3) `press` command with modifier support

What looks good
- A dedicated `press` command fills a real gap for keyboard driven UIs.
- The proposed modifier syntax is simple and shell friendly.

Potential issues / questions
- Key naming varies across platforms and libraries (Playwright uses `Meta`, `Control`, `ArrowDown`, `Enter`, etc.).
- Users will eventually want to press `-` or `+` or other punctuation. Those can be parsed as flags by accident.

Suggestions
- Normalize common aliases and document the canonical set:
  - `cmd`, `meta`, `win` -> `Meta`
  - `ctrl`, `control` -> `Control`
  - `esc` -> `Escape`
- Accept both hyphen and plus separators for combos: `ctrl-shift-p` and `ctrl+shift+p`.
- Explicitly document escaping for edge cases: `nav press -- "-"` or `nav press -- "+"`.
- Consider optional `--repeat N` and `--delay MS` to support quick repeated actions without loops.
- If the underlying automation layer has a defined key list (ex: Playwright), link to it or include a short mapping table in docs.

## 4) `interact` subcommands

What looks good
- Grouping the less common and stateful interactions under `interact` keeps the top level tidy.
- Dialog pre registration is the right model for predictable automation.

Potential issues / questions
- `upload` commonly needs multiple files or directories and can be a frequent action in testing. It might deserve a more prominent alias.
- Dialog handler lifecycle should be explicit: does it persist, and does it auto clear after use?

Suggestions
- Add `nav upload ...` as a top level alias to `nav interact upload ...` if you expect frequent use.
- For `check` / `uncheck`, make it explicit that these are idempotent and will no-op if already in desired state.
- For `dialog` handlers, document the lifecycle:
  - default `once` vs `persist` (if it exists)
  - what happens with multiple queued dialogs
  - a `--once` flag could be helpful if persistence is the default
- Consider `interact select @e1 "Option"` or `interact option @e1 3` for select elements (if not already covered by `fill` or `type`).
- Consider a general `interact focus @e1` or `interact hover @e1` if you want to keep the top level small but still expose these actions.

## Small consistency nits
- In examples, use the same binary name (`nav` or `fw`) everywhere.
- Make sure `mark diff` output and ordering are stable so it can be used in scripts.
- If `clean` replaces `tidy`, keep `tidy` as a warning alias for a while.
