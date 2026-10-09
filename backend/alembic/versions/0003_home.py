"""home: starred, trash, last opened, shared with me

Revision ID: 0003
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("maps", sa.Column("starred", sa.Boolean, nullable=False, server_default=sa.false()))
    op.add_column("maps", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("maps", sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "map_visits",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("map_id", pg.UUID(as_uuid=True), sa.ForeignKey("maps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("share_token", sa.String(64), nullable=False),
        sa.Column("visited_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "map_id", name="uq_visit_user_map"),
    )


def downgrade() -> None:
    op.drop_table("map_visits")
    for c in ("last_opened_at", "deleted_at", "starred"):
        op.drop_column("maps", c)
