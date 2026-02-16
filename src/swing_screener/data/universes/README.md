# Universe Naming

Packaged universes are currency-first:

- `usd_*` -> USD universe files
- `eur_*` -> EUR universe files
- `*_all` -> all symbols for that currency or category

Examples:

- `usd_all`, `eur_all`
- `usd_defense_all`, `usd_defense_stocks`, `usd_defense_etfs`
- `eur_amsterdam_all`, `eur_amsterdam_aex`, `eur_amsterdam_amx`

Universe aliases are managed in `manifest.json` so legacy names like
`mega_all`, `healthcare_all`, `amsterdam_all`, and `europe_large` still resolve.
