# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the
actual label strings used in this repo's issue tracker (beads — see `issue-tracker.md`).

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the
corresponding label string from this table.

Defaults were kept: this repo had no pre-existing triage vocabulary to collide with.

## Applying them in beads

```bash
bd create ... --labels=needs-triage      # at creation
bd update <id> --add-label=ready-for-agent
bd list --label=ready-for-agent          # AND across labels
bd list --label-any=needs-triage,needs-info
```

Note beads **inherits labels from the parent** by default — pass `--no-inherit-labels` when
a child should not pick up the epic's triage state.

Edit the right-hand column to match whatever vocabulary you actually use.
