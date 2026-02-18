from __future__ import annotations

import json
from pathlib import Path

from swing_screener.execution.degiro_bootstrap import bootstrap_orders_positions_from_degiro
from swing_screener.execution.orders import load_orders
from swing_screener.portfolio.state import load_positions


CSV_HEADER = (
    "Data,Ora,Prodotto,ISIN,Borsa di riferimento,Borsa,Quantità,Quotazione,,Valore locale,,"
    "Valore EUR,Tasso di cambio,Commissione AutoFX,Costi di transazione e/o di terze parti EUR,Totale EUR,ID Ordine,\n"
)


def test_bootstrap_degiro_rebuilds_orders_and_positions(tmp_path: Path) -> None:
    orders_path = tmp_path / "orders.json"
    positions_path = tmp_path / "positions.json"
    csv_path = tmp_path / "Transactions.csv"
    map_path = tmp_path / "isin_map.json"

    map_path.write_text(
        json.dumps(
            {
                "US0378331005": "AAPL",
                "US5949181045": "MSFT",
            }
        ),
        encoding="utf-8",
    )

    csv_path.write_text(
        CSV_HEADER
        + "17-02-2026,09:00,APPLE,US0378331005,NSY,XNYS,2,\"200,0000\",USD,\"-400,00\",USD,\"-338,41\",\"1,1820\",\"-0,68\",\"-2,00\",\"-340,41\",,11111111-1111-1111-1111-111111111111\n"
        + "17-02-2026,11:00,APPLE,US0378331005,NSY,XNYS,-2,\"201,0000\",USD,\"402,00\",USD,\"340,00\",\"1,1820\",\"-0,70\",\"-2,00\",\"337,30\",,22222222-2222-2222-2222-222222222222\n"
        + "17-02-2026,12:00,MSFT,US5949181045,NSY,XNAS,1,\"300,0000\",USD,\"-300,00\",USD,\"253,80\",\"1,1820\",\"-0,50\",\"-2,00\",\"-256,30\",,33333333-3333-3333-3333-333333333333\n",
        encoding="utf-8",
    )

    result = bootstrap_orders_positions_from_degiro(
        csv_path=csv_path,
        isin_map_path=map_path,
        orders_path=orders_path,
        positions_path=positions_path,
        apply_changes=True,
    )

    assert result.orders_generated == 3
    assert result.positions_generated == 2
    assert result.open_positions == 1
    assert result.closed_positions == 1
    assert result.unresolved_isins == ()

    orders = load_orders(orders_path)
    positions = load_positions(positions_path)
    assert len(orders) == 3
    assert len(positions) == 2

    open_pos = next(p for p in positions if p.status == "open")
    assert open_pos.ticker == "MSFT"
    assert open_pos.shares == 1

    closed_pos = next(p for p in positions if p.status == "closed")
    assert closed_pos.ticker == "AAPL"
    assert closed_pos.shares == 2
    assert closed_pos.exit_price == 201.0
