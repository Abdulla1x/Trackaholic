"""settings.target_set

Revision ID: 0020
Revises: 0019
Create Date: 2026-10-11

One column on an existing table, so the six-item settings-column checklist
applies rather than the eleven-item one for a new table.

Whether the account has ever chosen a target. Every signup starts at
2000/150/250/70, so the goals alone cannot tell a number somebody picked from
one nobody did, and first use must not show a target nobody set.

Added as false, the default a new signup gets, and then every existing account
is marked as set unless it is untouched: the four default goals, no automatic
targets, an empty body profile and not a single meal. Those are accounts that
signed up and never did anything, and when they come back they should meet
first use rather than a 2,000 kcal target they never chose. In this order
rather than adding it as true and clearing the untouched ones, so the database
default and the model's default agree for any row written later.

A guess, but a narrow one: an account that typed exactly the defaults by hand
and has never logged a meal reads as unset, which costs it one short form.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0020'
down_revision: str | None = '0019'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'settings',
        sa.Column(
            'target_set',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    # Lightweight table stubs, so the backfill is built by SQLAlchemy and comes
    # out right on both SQLite and Postgres (booleans and NULL tests differ).
    settings = sa.table(
        'settings',
        sa.column('user_id', sa.Integer),
        sa.column('calorie_goal', sa.Float),
        sa.column('protein_goal', sa.Float),
        sa.column('carbs_goal', sa.Float),
        sa.column('fat_goal', sa.Float),
        sa.column('targets_auto', sa.Boolean),
        sa.column('height_cm', sa.Float),
        sa.column('birth_date', sa.Date),
        sa.column('sex', sa.String),
        sa.column('activity_level', sa.String),
        sa.column('goal_rate_kg_per_week', sa.Float),
        sa.column('target_set', sa.Boolean),
    )
    meals = sa.table('meals', sa.column('user_id', sa.Integer))

    untouched = sa.and_(
        settings.c.calorie_goal == 2000,
        settings.c.protein_goal == 150,
        settings.c.carbs_goal == 250,
        settings.c.fat_goal == 70,
        settings.c.targets_auto == sa.false(),
        settings.c.height_cm.is_(None),
        settings.c.birth_date.is_(None),
        settings.c.sex.is_(None),
        settings.c.activity_level.is_(None),
        settings.c.goal_rate_kg_per_week.is_(None),
        ~sa.exists().where(meals.c.user_id == settings.c.user_id),
    )
    op.execute(settings.update().where(~untouched).values(target_set=sa.true()))


def downgrade() -> None:
    op.drop_column('settings', 'target_set')
