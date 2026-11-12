"""Replace the legacy JSON import ledger with a portfolio state row.

The singleton ``legacy_imports`` row doubled as the portfolio write lock and
the store for the orders/positions ``asof`` dates. ``portfolio_state`` keeps
those two jobs; the import checksums, counts and the import lock go away.

Revision ID: 20261112_0004
Revises: 20261008_0003
"""

from alembic import op
import sqlalchemy as sa

revision = "20261112_0004"
down_revision = "20261008_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolio_state",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("orders_asof", sa.String(32)),
        sa.Column("positions_asof", sa.String(32)),
    )
    op.execute(
        "INSERT INTO portfolio_state (id, orders_asof, positions_asof) "
        "SELECT 1, orders_asof, positions_asof FROM legacy_imports WHERE id = 1"
    )
    op.execute(
        "INSERT INTO portfolio_state (id) "
        "SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM portfolio_state)"
    )
    op.drop_table("legacy_import_lock")
    op.drop_table("legacy_imports")


def downgrade() -> None:
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
    op.execute(
        "INSERT INTO legacy_imports (id, schema_revision, orders_sha256, "
        "positions_sha256, order_count, position_count, orders_asof, positions_asof) "
        "SELECT 1, '20260715_0001', '', '', 0, 0, orders_asof, positions_asof "
        "FROM portfolio_state WHERE id = 1"
    )
    op.create_table(
        "legacy_import_lock",
        sa.Column("id", sa.Integer(), primary_key=True),
    )
    op.bulk_insert(
        sa.table("legacy_import_lock", sa.column("id", sa.Integer())),
        [{"id": 1}],
    )
    op.drop_table("portfolio_state")
