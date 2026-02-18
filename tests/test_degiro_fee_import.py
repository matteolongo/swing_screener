from __future__ import annotations

from pathlib import Path

from swing_screener.execution.degiro_fees import import_degiro_fees_to_orders
from swing_screener.execution.orders import Order, load_orders, save_orders


CSV_HEADER = (
    "Data,Ora,Prodotto,ISIN,Borsa di riferimento,Borsa,Quantità,Quotazione,,Valore locale,,"
    "Valore EUR,Tasso di cambio,Commissione AutoFX,Costi di transazione e/o di terze parti EUR,Totale EUR,ID Ordine,\n"
)


def test_import_degiro_fees_dedupes_duplicate_rows_and_updates_order(tmp_path: Path) -> None:
    orders_path = tmp_path / "orders.json"
    csv_path = tmp_path / "Transactions.csv"

    save_orders(
        orders_path,
        [
            Order(
                order_id="AAPL-ENTRY-1",
                ticker="AAPL",
                status="filled",
                order_type="BUY_LIMIT",
                quantity=2,
                limit_price=200.0,
                filled_date="2026-02-17",
                entry_price=200.00,
                order_kind="entry",
            )
        ],
        asof="2026-02-17",
    )

    # Two duplicate rows for the same execution: one without transaction cost,
    # one with full cost. Importer should keep the higher-fee effective row.
    csv_path.write_text(
        CSV_HEADER
        + "17-02-2026,15:30,APPLE INC,US0378331005,NSY,XNYS,2,\"200,0000\",USD,\"-400,00\",USD,\"-338,41\",\"1,1820\",\"-0,68\",,\"-338,41\",,11111111-1111-1111-1111-111111111111\n"
        + "17-02-2026,15:30,APPLE INC,US0378331005,NSY,XNYS,2,\"200,0000\",USD,\"-400,00\",USD,\"-338,41\",\"1,1820\",\"-0,68\",\"-2,00\",\"-340,41\",,11111111-1111-1111-1111-111111111111\n",
        encoding="utf-8",
    )

    preview = import_degiro_fees_to_orders(
        orders_path=orders_path,
        csv_path=csv_path,
        apply_changes=False,
    )
    assert preview.total_csv_rows == 2
    assert preview.deduped_rows == 1
    assert preview.matched_rows == 1
    assert preview.unmatched_rows == 0
    assert preview.updated_orders == 0

    applied = import_degiro_fees_to_orders(
        orders_path=orders_path,
        csv_path=csv_path,
        apply_changes=True,
    )
    assert applied.updated_orders == 1

    updated_orders = load_orders(orders_path)
    assert len(updated_orders) == 1
    assert updated_orders[0].fee_eur == 2.0
    assert updated_orders[0].fill_fx_rate == 1.182


def test_import_degiro_fees_reports_unmatched_rows(tmp_path: Path) -> None:
    orders_path = tmp_path / "orders.json"
    csv_path = tmp_path / "Transactions.csv"

    save_orders(
        orders_path,
        [
            Order(
                order_id="MSFT-ENTRY-1",
                ticker="MSFT",
                status="filled",
                order_type="BUY_LIMIT",
                quantity=1,
                limit_price=100.0,
                filled_date="2026-02-16",
                entry_price=100.00,
                order_kind="entry",
            )
        ],
        asof="2026-02-17",
    )

    csv_path.write_text(
        CSV_HEADER
        + "17-02-2026,09:00,UNMATCHED,US0000000001,NSY,XNYS,3,\"99,0000\",USD,\"-297,00\",USD,\"-250,00\",\"1,1880\",\"-0,50\",\"-2,00\",\"-252,50\",,22222222-2222-2222-2222-222222222222\n",
        encoding="utf-8",
    )

    result = import_degiro_fees_to_orders(
        orders_path=orders_path,
        csv_path=csv_path,
        apply_changes=True,
    )
    assert result.matched_rows == 0
    assert result.unmatched_rows == 1
    assert result.updated_orders == 0
    assert result.unmatched[0].reason == "no_match"
