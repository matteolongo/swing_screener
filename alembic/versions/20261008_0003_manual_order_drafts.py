"""Allow non-actionable manual order drafts.

Revision ID: 20261008_0003
Revises: 20260721_0002
"""

from alembic import op
import sqlalchemy as sa

revision = "20261008_0003"
down_revision = "20260721_0002"
branch_labels = None
depends_on = None


def _replace_status_constraint(statuses: str) -> None:
    name = op.f("ck_portfolio_orders_status_valid")
    existing = next(
        constraint["name"]
        for constraint in sa.inspect(op.get_bind()).get_check_constraints(
            "portfolio_orders"
        )
        if "status" in constraint["sqltext"]
    )
    with op.batch_alter_table("portfolio_orders") as batch:
        batch.drop_constraint(op.f(existing), type_="check")
        batch.create_check_constraint(name, f"status IN ({statuses})")


def upgrade() -> None:
    _replace_status_constraint("'draft','pending','submitted','filled','cancelled'")


def downgrade() -> None:
    op.execute(
        "UPDATE portfolio_orders SET status = 'cancelled' WHERE status = 'draft'"
    )
    _replace_status_constraint("'pending','submitted','filled','cancelled'")
