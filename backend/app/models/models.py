from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB

Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    repository_url = Column(String(300))
    deployments = relationship("ProjectDeployment", back_populates="project")

class Environment(Base):
    __tablename__ = "environments"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    servers = relationship("Server", back_populates="environment")

class Server(Base):
    __tablename__ = "servers"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    hostname = Column(String(200), nullable=False)
    port = Column(Integer, default=22)
    username = Column(String(100), nullable=False)
    environment_id = Column(Integer, ForeignKey("environments.id"))
    authentication_method = Column(String(50), default="ssh_key")
    environment = relationship("Environment", back_populates="servers")

class ProjectDeployment(Base):
    __tablename__ = "project_deployments"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=False)
    component = Column(String(50), nullable=False)
    repository_path = Column(String(500))
    deployment_script = Column(Text)
    health_check_url = Column(String(500))
    project = relationship("Project", back_populates="deployments")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    user_request = Column(Text, nullable=False)
    intent = Column(String(100))
    status = Column(String(50), default="PENDING")
    requires_confirmation = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    last_message = Column(Text)
    executions = relationship("TaskExecution", back_populates="task")

class TaskExecution(Base):
    __tablename__ = "task_executions"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    tool_name = Column(String(200))
    parameters = Column(JSONB)
    output = Column(Text)
    error = Column(Text)
    status = Column(String(50), default="PENDING")
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    task = relationship("Task", back_populates="executions")
