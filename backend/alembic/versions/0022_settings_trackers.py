"""settings.trackers_json

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-11

One column on an existing table, so the six-item settings-column checklist
applies rather than the eleven-item one for a new table.

Which trackers Today shows besides the weigh-in, which is always on: a JSON
list drawn from "water", "steps" and "supplements". NULL means the account has
not chosen yet, which is every account that exists today: they keep the cards
they see now, and are asked once which to keep. New signups get "[]" from the
model's default and choose during setup. So no backfill: NULL is the honest
value for everyone this migration meets.

`_json` on the column for the reason water_quick_adds_json gives: the API
speaks a list, the column stores text, and the different names force the
conversion in routers/settings.py.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0022'
down_revision: str | None = '0021'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('settings', sa.Column('trackers_json', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('settings', 'trackers_json')
