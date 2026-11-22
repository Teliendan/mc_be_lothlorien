# Lothlórien: development

- Namespace `lothlorien:`.
- Packs: `lothlorien_bp/` (JSON plus Script API in `scripts/`), `lothlorien_rp/` and the skin pack
  `lothlorien_skins/` ([SKINS.md](SKINS.md)).
- `tools/` holds generators for art, audio and structures; `tests/` holds the regression tests
  ([TESTING.md](TESTING.md)).
- Deploy with `.\mods deploy lothlorien` from the workspace; build the add-on locally with
  `.\mods package lothlorien`. Tests: `node tests/run.mjs` (also run by `.\mods verify lothlorien`).
- Design, decisions and limits are indexed in [README.md](README.md); what is left to do is in
  [TODO.md](TODO.md). Testers: [TESTER_BRIEF.md](TESTER_BRIEF.md).
- Localization: nine locales; read [LOCALIZATION.md](LOCALIZATION.md) before adding or changing
  player-facing text.
