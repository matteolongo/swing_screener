"""Create transactional portfolio state.

Revision ID: 20260715_0001
Revises:
"""

from alembic import op
import sqlalchemy as sa


revision = "20260715_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolio_orders",
        sa.Column("order_id", sa.String(64), primary_key=True),
        sa.Column("ticker", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("order_type", sa.String(32), nullable=False),
        sa.Column("order_kind", sa.String(24), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("limit_price", sa.Numeric(20, 8)),
        sa.Column("stop_price", sa.Numeric(20, 8)),
        sa.Column("target_price", sa.Numeric(20, 8)),
        sa.Column("entry_price", sa.Numeric(20, 8)),
        sa.Column("order_date", sa.String(10), nullable=False),
        sa.Column("filled_date", sa.String(10)),
        sa.Column("position_id", sa.String(64)),
        sa.Column("quote_currency", sa.String(8)),
        sa.Column("account_currency", sa.String(8)),
        sa.Column("approval_fx_rate", sa.Numeric(20, 8)),
        sa.Column("fill_fx_rate", sa.Numeric(20, 8)),
        sa.Column("fee_eur", sa.Numeric(20, 4)),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('pending','submitted','filled','cancelled')",
            name="ck_portfolio_orders_status_valid",
        ),
        sa.CheckConstraint(
            "quantity > 0", name="ck_portfolio_orders_quantity_positive"
        ),
    )
    op.create_index("ix_portfolio_orders_ticker", "portfolio_orders", ["ticker"])
    op.create_index("ix_portfolio_orders_status", "portfolio_orders", ["status"])
    op.create_index(
        "ix_portfolio_orders_order_kind", "portfolio_orders", ["order_kind"]
    )
    op.create_index(
        "ix_portfolio_orders_position_id", "portfolio_orders", ["position_id"]
    )

    op.create_table(
        "portfolio_positions",
        sa.Column("position_id", sa.String(64), primary_key=True),
        sa.Column("source_order_id", sa.String(64)),
        sa.Column("ticker", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("shares", sa.Integer(), nullable=False),
        sa.Column("entry_date", sa.String(10), nullable=False),
        sa.Column("exit_date", sa.String(10)),
        sa.Column("entry_price", sa.Numeric(20, 8), nullable=False),
        sa.Column("stop_price", sa.Numeric(20, 8), nullable=False),
        sa.Column("target_price", sa.Numeric(20, 8)),
        sa.Column("current_price", sa.Numeric(20, 8)),
        sa.Column("exit_price", sa.Numeric(20, 8)),
        sa.Column("quote_currency", sa.String(8)),
        sa.Column("account_currency", sa.String(8)),
        sa.Column("entry_fx_rate", sa.Numeric(20, 8)),
        sa.Column("exit_fx_rate", sa.Numeric(20, 8)),
        sa.Column("entry_fee_eur", sa.Numeric(20, 4)),
        sa.Column("exit_fee_eur", sa.Numeric(20, 4)),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('open','closed')", name="ck_portfolio_positions_status_valid"
        ),
        sa.CheckConstraint("shares > 0", name="ck_portfolio_positions_shares_positive"),
        sa.UniqueConstraint("source_order_id", name="uq_position_source_order"),
    )
    op.create_index("ix_portfolio_positions_ticker", "portfolio_positions", ["ticker"])
    op.create_index("ix_portfolio_positions_status", "portfolio_positions", ["status"])
    op.create_index(
        "ix_portfolio_positions_source_order_id",
        "portfolio_positions",
        ["source_order_id"],
    )

    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("operation", sa.String(64), nullable=False),
        sa.Column("key", sa.String(200), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("resource", sa.String(255), nullable=False, server_default=""),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("response", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("operation", "key", name="uq_idempotency_operation_key"),
    )
    op.create_table(
        "legacy_imports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("schema_revision", sa.String(64), nullable=False),
        sa.Column("orders_sha256", sa.String(64), nullable=False),
        sa.Column("positions_sha256", sa.String(64), nullable=False),
        sa.Column("order_count", sa.Integer(), nullable=False),
        sa.Column("position_count", sa.Integer(), nullable=False),
        sa.Column("orders_asof", sa.String(32)),
        sa.Column("positions_asof", sa.String(32)),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("legacy_imports")
    op.drop_table("idempotency_records")
    op.drop_index(
        "ix_portfolio_positions_source_order_id", table_name="portfolio_positions"
    )
    op.drop_index("ix_portfolio_positions_status", table_name="portfolio_positions")
    op.drop_index("ix_portfolio_positions_ticker", table_name="portfolio_positions")
    op.drop_table("portfolio_positions")
    op.drop_index("ix_portfolio_orders_position_id", table_name="portfolio_orders")
    op.drop_index("ix_portfolio_orders_order_kind", table_name="portfolio_orders")
    op.drop_index("ix_portfolio_orders_status", table_name="portfolio_orders")
    op.drop_index("ix_portfolio_orders_ticker", table_name="portfolio_orders")
    op.drop_table("portfolio_orders")
