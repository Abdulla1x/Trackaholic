"""settings.installed_at

Revision ID: 0025
Revises: 0024
Create Date: 2026-10-22

One column on an existing table, so the six-item settings-column checklist
applies rather than the eleven-item one for a new table.

When this account first opened Trackaholic from a home screen, or said it
already has it there. It is what stops the "Add to home screen" popup asking
in a browser tab: an iPhone's Safari cannot see what is on the home screen,
so the only way a tab can know is that the installed app told the server.
Nullable with no default, because NULL ("never seen installed") is the true
answer for every existing account; nothing is backfilled.

No batch_alter_table: nothing existing is rebuilt, only added to.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0025'
down_revision: str | None = '0024'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('settings', sa.Column('installed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('settings', 'installed_at')
