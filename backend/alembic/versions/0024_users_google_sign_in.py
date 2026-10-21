"""users.google_sub, and password_hash nullable

Revision ID: 0024
Revises: 0023
Create Date: 2026-10-21

Sign in with Google. `google_sub` is Google's permanent id for the account
(the ID token's `sub` claim), unique across accounts and NULL for an account
that has never signed in with Google. An email address can change on Google's
side; the sub never does, so it is what a returning Google sign-in is matched
on, and the email only links an existing account the first time.

`password_hash` becomes nullable because an account created through Google has
no password until it sets one through the reset flow.

batch_alter_table for the NOT NULL change: SQLite can only change a column's
nullability by rebuilding the table, and Alembic's batch mode does that there
while emitting a plain ALTER on Postgres.

Downgrade never deletes an account. A Google-only account gets an unusable
password marker, which verify_password rejects, so it is locked out of
password login rather than gone; a reset link still opens it.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0024'
down_revision: str | None = '0023'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Not a hash pwdlib can produce or parse, so it can never verify.
UNUSABLE_PASSWORD = '!'


def upgrade() -> None:
    op.add_column('users', sa.Column('google_sub', sa.String(length=255), nullable=True))
    op.create_index('ix_users_google_sub', 'users', ['google_sub'], unique=True)
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('password_hash', existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    users = sa.table('users', sa.column('password_hash', sa.String))
    op.execute(
        users.update()
        .where(users.c.password_hash.is_(None))
        .values(password_hash=UNUSABLE_PASSWORD)
    )
    with op.batch_alter_table('users') as batch_op:
        batch_op.alter_column('password_hash', existing_type=sa.String(length=255), nullable=False)
    op.drop_index('ix_users_google_sub', table_name='users')
    op.drop_column('users', 'google_sub')
