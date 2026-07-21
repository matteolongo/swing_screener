"""Serialize legacy JSON import across application instances.

Revision ID: 20260721_0002
Revises: 20260715_0001
"""

from alembic import op
import sqlalchemy as sa


revision = "20260721_0002"
down_revision = "20260715_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "legacy_import_lock",
        sa.Column("id", sa.Integer(), primary_key=True),
    )
    op.bulk_insert(
        sa.table("legacy_import_lock", sa.column("id", sa.Integer())),
        [{"id": 1}],
    )


def downgrade() -> None:
    op.drop_table("legacy_import_lock")
