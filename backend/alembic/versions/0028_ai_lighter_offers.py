"""ai_lighter_offers

Revision ID: 0028
Revises: 0027
Create Date: 2026-10-25

The lighter AI: when the main AI is out or busy, the Log panel offers a meal
estimate from Flash-Lite. This counts what happened to the offer.

ai_lighter_offers -- A NEW TABLE WITH NO user_id.

One row per UTC day: offers shown, used and declined. Same shape as
demo_starts (unique date, so app/upsert.py can turn a same-second race into a
retry) and the same argument for the new-table checklist: no account owns a
row, so there is nothing to export, delete or isolate. What applies is the
admin page and the privacy assertion.

No batch_alter_table: nothing existing is rebuilt, only added to.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0028'
down_revision: str | None = '0027'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'ai_lighter_offers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('shown', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('used', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('declined', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_ai_lighter_offers_date', 'ai_lighter_offers', ['date'], unique=True,
    )


def downgrade() -> None:
    op.drop_index('ix_ai_lighter_offers_date', table_name='ai_lighter_offers')
    op.drop_table('ai_lighter_offers')
