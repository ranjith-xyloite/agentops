"""Phase 6: Multi-step DAGs, Scheduled Tasks, Webhooks, and DevOps Policy Guardrails

Revision ID: 6f0a1b22c33d
Revises: 5e9c0b11f42a
Create Date: 2026-08-17 11:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f0a1b22c33d'
down_revision: Union[str, Sequence[str], None] = '5e9c0b11f42a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add Phase 6 columns to tasks
    try:
        op.add_column('tasks', sa.Column('workflow_dag', sa.JSON(), nullable=True))
    except Exception:
        pass
    try:
        op.add_column('tasks', sa.Column('current_step_index', sa.Integer(), nullable=True))
    except Exception:
        pass
    try:
        op.add_column('tasks', sa.Column('is_rollback', sa.Boolean(), nullable=False, server_default=sa.false()))
    except Exception:
        pass

    # 2. Add is_rollback column to task_executions
    try:
        op.add_column('task_executions', sa.Column('is_rollback', sa.Boolean(), nullable=False, server_default=sa.false()))
    except Exception:
        pass

    # 3. Create scheduled_tasks table
    try:
        op.create_table(
            'scheduled_tasks',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('name', sa.String(length=120), nullable=False),
            sa.Column('cron_expression', sa.String(length=100), nullable=False),
            sa.Column('user_request', sa.Text(), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('next_run_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
    except Exception:
        pass

    # 4. Create webhook_subscriptions table
    try:
        op.create_table(
            'webhook_subscriptions',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('url', sa.String(length=500), nullable=False),
            sa.Column('secret', sa.String(length=255), nullable=True),
            sa.Column('event_types', sa.JSON(), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
    except Exception:
        pass

    # 5. Create policy_rules table
    try:
        op.create_table(
            'policy_rules',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('environment', sa.String(length=50), nullable=False),
            sa.Column('block_weekends', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('allowed_hours_start', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('allowed_hours_end', sa.Integer(), nullable=False, server_default='24'),
            sa.Column('require_double_confirm', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_table('policy_rules')
    except Exception:
        pass
    try:
        op.drop_table('webhook_subscriptions')
    except Exception:
        pass
    try:
        op.drop_table('scheduled_tasks')
    except Exception:
        pass
    try:
        op.drop_column('task_executions', 'is_rollback')
    except Exception:
        pass
    try:
        op.drop_column('tasks', 'is_rollback')
    except Exception:
        pass
    try:
        op.drop_column('tasks', 'current_step_index')
    except Exception:
        pass
    try:
        op.drop_column('tasks', 'workflow_dag')
    except Exception:
        pass
