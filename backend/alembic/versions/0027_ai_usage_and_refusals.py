"""ai_analyses usage columns, and ai_refusals

Revision ID: 0027
Revises: 0026
Create Date: 2026-10-25

"AI usage you can see": what each AI call was, and what each refused one was.

ai_analyses -- SEVEN NULLABLE COLUMNS.

model (which model answered), attempts (requests sent to Google, refused ones
included), four token counts from Google's usage_metadata, and
attached_food_ids (the saved foods attached to an analysis, a JSON list of
ids). All nullable with no default: NULL is the true answer for every existing
row ("not measured"), and a backfilled zero would read as a measured zero and
pull every average down. Nothing is backfilled.

ai_refusals -- A NEW TABLE WITH NO user_id.

A counter per UTC day x kind x cause, the same shape as demo_starts and for the
same reason: the refusals have to outlive the accounts that met them. No
account owns a row, so the user-table checklist's export, deletion and
isolation items do not apply; the admin page and the privacy assertion do.

No batch_alter_table: nothing existing is rebuilt, only added to.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0027'
down_revision: str | None = '0026'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INT_COLUMNS = (
    'attempts',
    'input_tokens',
    'audio_input_tokens',
    'output_tokens',
    'thinking_tokens',
)


def upgrade() -> None:
    op.add_column('ai_analyses', sa.Column('model', sa.String(length=64), nullable=True))
    for name in _INT_COLUMNS:
        op.add_column('ai_analyses', sa.Column(name, sa.Integer(), nullable=True))
    op.add_column('ai_analyses', sa.Column('attached_food_ids', sa.Text(), nullable=True))
    op.create_table(
        'ai_refusals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('cause', sa.String(length=32), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'uq_ai_refusals_date_kind_cause', 'ai_refusals', ['date', 'kind', 'cause'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('uq_ai_refusals_date_kind_cause', table_name='ai_refusals')
    op.drop_table('ai_refusals')
    op.drop_column('ai_analyses', 'attached_food_ids')
    for name in reversed(_INT_COLUMNS):
        op.drop_column('ai_analyses', name)
    op.drop_column('ai_analyses', 'model')
