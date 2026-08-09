# Issue tracker: Beads (`bd`)

Issues for this repo live in **beads**, a local Dolt-backed issue database driven by the `bd` CLI.

This is a deliberate choice over GitHub Issues. `CLAUDE.md` mandates `bd` for all task
tracking, and the engineering skills follow that rule rather than fighting it.

> **The repo has a second, separate surface.** GitHub Issues on
> `kunwarVivek/mcp-github-project-manager` still holds externally-reported bugs. That is a
> *reporting* surface for users; beads is the *working* tracker these skills operate on.
> Do not mirror between them automatically. If an external report needs work, open a bead
> for it and reference the GitHub issue number in the description.

## Conventions

- Issue ids look like `mcp-github-project-manager-hb8.15` — a project prefix, a parent id,
  then a child suffix. Always pass the full id.
- Hierarchy is first-class: `bd create --parent=<id>` makes a child. Use an `epic` type for
  the umbrella and `task`/`bug`/`feature` for children.
- Priority is `0`–`4` or `P0`–`P4` (`0` = critical, `2` = medium, `4` = backlog).
  **Not** `high`/`medium`/`low` — those are rejected.
- Triage state is carried on **labels** (see `triage-labels.md`), set with
  `--labels` at create time or `--add-label` on update.
- Comments/history go in notes: `bd update <id> --append-notes "..."`.
- **Never run `bd edit`** — it opens `$EDITOR` and blocks a non-interactive agent.

## When a skill says "publish to the issue tracker"

```bash
bd create --title="..." --description="..." --type=task --priority=2 \
          [--parent=<epic-id>] [--labels=needs-triage]
```

For a multi-ticket effort, create the epic first, then children with `--parent`, then wire
order with `bd dep add <issue> <depends-on>`.

## When a skill says "fetch the relevant ticket"

```bash
bd show <id>          # full detail incl. dependencies
bd list --status=open # everything open, as a tree
bd search "<query>"   # keyword search
```

## Wayfinding operations

Beads models this natively — no file conventions needed.

- **Map**: the parent epic. Its description holds Notes / Decisions-so-far / Fog; append
  with `bd update <epic> --append-notes "..."`.
- **Child ticket**: `bd create --parent=<epic> --type=<task|bug|feature>`. Record the
  ticket type via `--type`, and any of research/prototype/grilling via a label.
- **Blocking**: `bd dep add <issue> <depends-on>`. Inspect with `bd blocked`.
- **Frontier**: `bd ready` — issues with no unresolved blockers. This is the whole point of
  the tool; do not hand-roll a scan.
- **Claim**: `bd update <id> --claim` before any work.
- **Resolve**: `bd close <id> --reason="..."`. Use `bd close <id> --suggest-next` to see
  what the closure unblocked.

## Sync

Issues live in a local Dolt DB; `.beads/issues.jsonl` is a **passive export**, not the
source of truth. Remote sync is `bd dolt push` / `bd dolt pull` over `refs/dolt/data`.

**Do not push or sync without explicit instruction** — the repo's agent profile is
conservative by default.
