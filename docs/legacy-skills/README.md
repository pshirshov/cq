# Legacy Skills Archive

This directory contains the five skills retired on 2026-06-07 as part of goal
G25 (K40 decision). Each file is a flattened archive: the skill's `meta.yaml`
fields are folded into a YAML front-matter header, followed by the original
`content.md` body verbatim (except that `[[wikilinks]]` to peer skills are
repointed to the corresponding `./<name>.md` archive file).

## Retired skills and their cq successors

| Archived skill | cq successor |
|---|---|
| [research-loop.md](./research-loop.md) | `/cq:investigate` and `/cq:investigate:advance` |
| [vsm-loop.md](./vsm-loop.md) | `/cq:advance` + `/cq:plan:advance` + `/cq:implement:advance` |
| [vsm-node.md](./vsm-node.md) | `/cq:advance` + `/cq:implement:advance` (implement-flow worker contract) |
| [review-loop.md](./review-loop.md) | `/cq:advance` + `/cq:implement:advance` + `/cq:implement-review` |
| [question-batch.md](./question-batch.md) | questions-ledger clarification path (`mcp__ledger__create_item` in the `questions` ledger) |

## Provenance

- Source skill dirs: `nix/pkg/llm-skills/skills/<name>/` (to be removed by T212).
- `content.md` bodies were moved here via `git mv` so `git log --follow` shows
  rename history.
- Wikilinks inside the bodies were repointed to peer archive files using
  standard Markdown links (`[name](./name.md)`). Hypothesis-ID cross-references
  (`[[H1]]`, `[[H1.1]]` etc.) inside example skeleton blocks are not skill
  wikilinks and were left as-is.
- Decision: K40. Questions resolved: Q117–Q120.
