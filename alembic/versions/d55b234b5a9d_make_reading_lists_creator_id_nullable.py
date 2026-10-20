"""make_reading_lists_creator_id_nullable

Revision ID: d55b234b5a9d
Revises: d95f2778d377
Create Date: 2026-10-20 00:44:15.218500

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd55b234b5a9d'
down_revision: Union[str, Sequence[str], None] = 'd95f2778d377'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('reading_lists', schema=None) as batch_op:
        batch_op.alter_column('creator_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('reading_lists', schema=None) as batch_op:
        batch_op.alter_column('creator_id',
               existing_type=sa.INTEGER(),
               nullable=False)

