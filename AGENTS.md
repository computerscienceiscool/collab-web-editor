# TODO Tracking

## TODO ID Format

TODO IDs use the format `LNNN` where:
- `L` is a single letter prefix identifying the author
- `NNN` is a zero-padded 3-digit integer

Examples: `S015`, `J016`

## Author Prefixes

- `S` = Steve
- `J` = JJ

## Transition Rules

### Default Prefix

The default repo prefix for this repository is `S` (Steve started it).

If an existing TODO is referenced without a letter prefix (e.g., `015`), treat it as the default repo prefix + same integer (e.g., `S015`).

### Global Uniqueness During Transition

During the transition period, keep the integer part globally unique across all prefixes within the same repository.

**Avoid creating both `J001` and `S001` in the same repo until all existing TODOs are renamed.**

Once all legacy unprefixed TODOs have been migrated to prefixed format, the integer space can be reused across different author prefixes.

### Bulk Renaming Process

When bulk-renaming existing TODO files to add prefixes:
1. Use `git mv` (not `mv` or `rm`) to preserve git history
2. Perform all renames in a single dedicated commit
3. Do not mix TODO renaming with other work in the same commit
