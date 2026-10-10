"""maps: hidden_from_recent («Убрать из недавних»)

Revision ID: 0004
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("maps", sa.Column("hidden_from_recent", sa.Boolean, nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("maps", "hidden_from_recent")
