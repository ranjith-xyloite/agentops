import enum
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Enum
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project_memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    tasks = relationship("Task", back_populates="user", lazy="selectin")
    schedules = relationship("ScheduledTask", back_populates="user", cascade="all, delete-orphan", lazy="selectin")


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="project_memberships", lazy="selectin")
    project = relationship("Project", back_populates="members", lazy="selectin")


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    key_prefix = Column(String(16), nullable=False, index=True)
    key_hash = Column(String(255), nullable=False, unique=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="api_keys", lazy="selectin")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(String(100), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    repository_url = Column(String(300))
    deployments = relationship("ProjectDeployment", back_populates="project", lazy="selectin")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan", lazy="selectin")


class Environment(Base):
    __tablename__ = "environments"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    servers = relationship("Server", back_populates="environment", lazy="selectin")


class Server(Base):
    __tablename__ = "servers"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    hostname = Column(String(200), nullable=False)
    port = Column(Integer, default=22)
    username = Column(String(100), nullable=False)
    environment_id = Column(Integer, ForeignKey("environments.id"))
    authentication_method = Column(String(50), default="ssh_key")
    environment = relationship("Environment", back_populates="servers", lazy="selectin")


class ProjectDeployment(Base):
    __tablename__ = "project_deployments"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=False)
    component = Column(String(50), nullable=False)
    repository_path = Column(String(500))
    deployment_script = Column(Text)
    health_check_url = Column(String(500))
    project = relationship("Project", back_populates="deployments", lazy="selectin")


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_request = Column(Text, nullable=False)
    intent = Column(String(100))
    status = Column(String(50), default="PENDING")
    requires_confirmation = Column(Boolean, default=False)
    workflow_dag = Column(JSON, nullable=True)  # List of planned steps
    current_step_index = Column(Integer, default=0)
    is_rollback = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    last_message = Column(Text)
    executions = relationship("TaskExecution", back_populates="task", lazy="selectin")
    user = relationship("User", back_populates="tasks", lazy="selectin")


class TaskExecution(Base):
    __tablename__ = "task_executions"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    tool_name = Column(String(200))
    parameters = Column(JSON)
    output = Column(Text)
    error = Column(Text)
    status = Column(String(50), default="PENDING")
    is_rollback = Column(Boolean, default=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    task = relationship("Task", back_populates="executions", lazy="selectin")


# =========================================================
# Phase 6 Models: Scheduler, Webhooks & Policies
# =========================================================

class ScheduledTask(Base):
    __tablename__ = "scheduled_tasks"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(150), nullable=False)
    cron_expression = Column(String(50), nullable=False)  # e.g., "0 2 * * *" or "@hourly"
    user_request = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="schedules", lazy="selectin")


class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    url = Column(String(500), nullable=False)
    secret = Column(String(100), nullable=True)  # Secret for HMAC signing
    event_types = Column(JSON, default=["task.failed", "task.success", "task.awaiting_confirmation"])
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PolicyRule(Base):
    __tablename__ = "policy_rules"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    environment = Column(String(50), nullable=False, default="production")
    block_weekends = Column(Boolean, default=True)  # Block Friday evening / weekend deploys
    allowed_hours_start = Column(Integer, default=8)  # 08:00
    allowed_hours_end = Column(Integer, default=20)  # 20:00
    require_double_confirm = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
