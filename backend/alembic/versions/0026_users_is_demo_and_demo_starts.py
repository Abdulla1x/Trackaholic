"""users.is_demo, and demo_starts

Revision ID: 0026
Revises: 0025
Create Date: 2026-10-24

Groundwork for "Try the demo": a temporary account per visitor, filled with
made-up data and deleted a day later. Nothing creates one yet. This migration
ships first, on its own, because of what daily_stats is.

users.is_demo -- ONE NOT NULL COLUMN, DEFAULT FALSE.

daily_stats freezes each finished day and never rewrites it. A demo account
alive at the moment a day is frozen would sit in that day's signups and in its
retention cohort for good, and its backdated seed data would make it look like
someone who logged on two days within minutes of arriving. So every usage
number learns to leave demo accounts out (app/activity.py) before the first one
can exist. NOT NULL with server_default false: every existing account is a real
one, and signup never has to mention the column.

demo_starts -- A NEW TABLE WITH NO user_id.

How many demos were started each UTC day: the number the front door is judged
by, and the daily cap the demo endpoint will read. A counter, because the
accounts themselves are deleted after a day and counting rows would erase the
history. Same shape as daily_stats (unique date, so app/upsert.py can turn a
same-second race into a retry), and the same argument for why most of the
eleven-item new-table checklist does not apply: no account owns a row, so there
is nothing to export, delete or isolate. What applies is the admin page (item
10) and the privacy assertion (item 11).

No batch_alter_table: nothing existing is rebuilt, only added to.

⚠️ DOWNGRADE FORGETS WHICH ACCOUNTS WERE DEMOS. Proved on Postgres: a demo row
that survives `downgrade -1` comes back from the next upgrade as is_demo false,
an ordinary signup in every metric, and the next freeze makes that permanent.
Before downgrading with demo accounts present, delete them first:
`DELETE FROM users WHERE is_demo` (their data cascades).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0026'
down_revision: str | None = '0025'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'is_demo',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_table(
        'demo_starts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_demo_starts_date', 'demo_starts', ['date'], unique=True,
    )


def downgrade() -> None:
    op.drop_index('ix_demo_starts_date', table_name='demo_starts')
    op.drop_table('demo_starts')
    op.drop_column('users', 'is_demo')
