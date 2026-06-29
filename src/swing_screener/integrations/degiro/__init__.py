# DeGiro integration package.
#
# Submodules are imported directly (e.g.
# `from swing_screener.integrations.degiro.credentials import load_credentials`)
# so this __init__ stays empty: importing the package must not eagerly pull in
# degiro_connector, which client.py imports at module level.
