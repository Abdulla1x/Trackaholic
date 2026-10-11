"""settings.protein_focus

Revision ID: 0021
Revises: 0020
Create Date: 2026-10-11

One column on an existing table, so the six-item settings-column checklist
applies rather than the eleven-item one for a new table.

The answer to "What matters most to you?" in first-use setup, which sets only
the protein target: 'muscle' (keeping or building it) or 'scale' (just the
number). NULL means not answered, which keeps the protein every account had
before this existed (1.8 g/kg), so no backfill. Stored rather than asked once
because automatic targets are recomputed on every weigh-in, and an answer that
was not kept would be forgotten the next morning.

The CHECK is added in batch mode, as in 0008: SQLite cannot ALTER a table to
add one.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0021'
down_revision: str | None = '0020'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'settings', sa.Column('protein_focus', sa.String(length=6), nullable=True)
    )
    with op.batch_alter_table('settings', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_settings_protein_focus', "protein_focus IN ('muscle', 'scale')"
        )


def downgrade() -> None:
    with op.batch_alter_table('settings', schema=None) as batch_op:
        batch_op.drop_constraint('ck_settings_protein_focus', type_='check')
    op.drop_column('settings', 'protein_focus')
