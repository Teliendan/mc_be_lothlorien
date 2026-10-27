# Wiki export status

Reviewed 2026-10-25 against the current working gameplay sources; no new in-game observations.

The full preview export passes: 83 features, 54 recipes, all 986 evidence locators
match their sources. Exporter/contract tests and the village-area, root-shrine and
flower-garden suites pass. The complete commit check also regenerated the stale landscape-probe shrine copy.

Reviewed source changes and dispositions:

- loop_marker.js and main.js now recognize village territory before repair planning
  completes. The growing/gathering overview remains valid. Added public Harmony
  and Renown records for village decks and adjacent/underlying ground, including
  village portions outside the forest biome. Both records cite the actual wiring,
  territory helper and planner. Mapped village_area.js to Harmony script coverage.
- Root-shrine structure and generator: 104 previously empty cells became dirt;
  dimensions, container contents and loot bindings are unchanged. Shrine location,
  chest and pot claims remain valid; their evidence was reviewed and repinned.
- The landscape-probe shrine copy was regenerated from the same builder: the
  same 104 empty cells become dirt, with unchanged dimensions and containers.
  Its shrine overview evidence was reviewed and repinned.
- Flower-garden generator: start height now compensates for the buried foundation.
  Existing gathering and container claims remain valid; the table-binding evidence
  was reviewed and repinned.

Preview artifacts: workspace temp/wiki-export-repair/full-preview/.
Source snapshot: 719e8af21553e86b35d9bb59048655255a099437.
This is a temporary Git snapshot of the working files for full export validation;
no branch or normal staging index was changed. The manifest marks preview true.
A release export should select the eventual normal source commit containing the
reviewed gameplay and wiki files, as described in workspace docs/wiki.md.
