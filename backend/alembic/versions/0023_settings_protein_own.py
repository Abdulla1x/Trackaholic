"""settings.protein_own

Revision ID: 0023
Revises: 0022
Create Date: 2026-10-13

One column on an existing table, so the six-item settings-column checklist
applies rather than the eleven-item one for a new table.

Whether protein is the user's own number while calories stay worked out.
With targets_auto on, the stored protein_goal is then kept on every
recompute (settings save, weigh-in) and carbs and fat are split around it;
with targets_auto off it changes nothing. A plain on/off with no third state,
so NOT NULL with a server_default, the targets_auto pairing. False keeps
every existing account exactly as it was.

No batch_alter_table: nothing existing is rebuilt, only added to.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0023'
down_revision: str | None = '0022'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'settings',
        sa.Column(
            'protein_own',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column('settings', 'protein_own')
