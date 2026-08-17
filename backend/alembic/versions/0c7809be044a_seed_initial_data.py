"""Seed initial data

Revision ID: 0c7809be044a
Revises: 4d1b1f70fefd
Create Date: 2026-08-14 18:08:17.718118

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0c7809be044a'
down_revision: Union[str, Sequence[str], None] = '4d1b1f70fefd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Insert seed data
    bind = op.get_bind()
    
    # Environments
    environments = [
        {'name': 'dev', 'description': 'Development environment'},
        {'name': 'qa', 'description': 'QA environment'},
        {'name': 'uat', 'description': 'UAT environment'},
        {'name': 'production', 'description': 'Production environment'},
    ]
    env_result = bind.execute(sa.table('environments', sa.column('id'), sa.column('name'), sa.column('description')))
    for env in environments:
        bind.execute(sa.text("INSERT INTO environments (name, description) VALUES (:name, :description)"), env)
    
    # Get environment IDs
    env_rows = bind.execute(sa.text("SELECT id, name FROM environments")).fetchall()
    env_map = {row[1]: row[0] for row in env_rows}
    
    # Projects
    projects = [
        {'name': 'mom', 'description': 'MOM project', 'repository_url': 'https://github.com/company/mom'},
    ]
    for proj in projects:
        bind.execute(sa.text("INSERT INTO projects (name, description, repository_url) VALUES (:name, :description, :repository_url)"), proj)
    
    # Get project IDs
    proj_rows = bind.execute(sa.text("SELECT id, name FROM projects")).fetchall()
    proj_map = {row[1]: row[0] for row in proj_rows}
    
    # Servers
    servers = [
        {'name': 'dev-server-01', 'hostname': 'dev01.internal', 'port': 22, 'username': 'deploy', 'environment_id': env_map.get('dev')},
        {'name': 'qa-server-01', 'hostname': 'qa01.internal', 'port': 22, 'username': 'deploy', 'environment_id': env_map.get('qa')},
        {'name': 'uat-server-01', 'hostname': 'uat01.internal', 'port': 22, 'username': 'deploy', 'environment_id': env_map.get('uat')},
        {'name': 'prod-server-01', 'hostname': 'prod01.internal', 'port': 22, 'username': 'deploy', 'environment_id': env_map.get('production')},
    ]
    for srv in servers:
        bind.execute(sa.text("INSERT INTO servers (name, hostname, port, username, environment_id) VALUES (:name, :hostname, :port, :username, :environment_id)"), srv)
    
    # Project Deployments
    deployments = [
        {'project_id': proj_map.get('mom'), 'environment_id': env_map.get('dev'), 'component': 'frontend', 'repository_path': '/opt/mom/frontend', 'deployment_script': './deploy_frontend.sh', 'health_check_url': 'http://localhost:3000/health'},
        {'project_id': proj_map.get('mom'), 'environment_id': env_map.get('dev'), 'component': 'backend', 'repository_path': '/opt/mom/backend', 'deployment_script': './deploy_backend.sh', 'health_check_url': 'http://localhost:8000/health'},
        {'project_id': proj_map.get('mom'), 'environment_id': env_map.get('qa'), 'component': 'frontend', 'repository_path': '/opt/mom/frontend', 'deployment_script': './deploy_frontend.sh', 'health_check_url': 'http://localhost:3000/health'},
        {'project_id': proj_map.get('mom'), 'environment_id': env_map.get('qa'), 'component': 'backend', 'repository_path': '/opt/mom/backend', 'deployment_script': './deploy_backend.sh', 'health_check_url': 'http://localhost:8000/health'},
        {'project_id': proj_map.get('mom'), 'environment_id': env_map.get('uat'), 'component': 'frontend', 'repository_path': '/opt/mom/frontend', 'deployment_script': './deploy_frontend.sh', 'health_check_url': 'http://localhost:3000/health'},
        {'project_id': proj_map.get('mom'), 'environment_id': env_map.get('uat'), 'component': 'backend', 'repository_path': '/opt/mom/backend', 'deployment_script': './deploy_backend.sh', 'health_check_url': 'http://localhost:8000/health'},
        {'project_id': proj_map.get('mom'), 'environment_id': env_map.get('production'), 'component': 'frontend', 'repository_path': '/opt/mom/frontend', 'deployment_script': './deploy_frontend.sh', 'health_check_url': 'http://localhost:3000/health'},
        {'project_id': proj_map.get('mom'), 'environment_id': env_map.get('production'), 'component': 'backend', 'repository_path': '/opt/mom/backend', 'deployment_script': './deploy_backend.sh', 'health_check_url': 'http://localhost:8000/health'},
    ]
    for dep in deployments:
        bind.execute(sa.text("INSERT INTO project_deployments (project_id, environment_id, component, repository_path, deployment_script, health_check_url) VALUES (:project_id, :environment_id, :component, :repository_path, :deployment_script, :health_check_url)"), dep)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM project_deployments"))
    bind.execute(sa.text("DELETE FROM servers"))
    bind.execute(sa.text("DELETE FROM projects"))
    bind.execute(sa.text("DELETE FROM environments"))
