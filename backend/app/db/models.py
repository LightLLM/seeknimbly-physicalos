from __future__ import annotations

from datetime import datetime

from sqlalchemy import Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class SchemaMigration(Base):
    __tablename__ = "schema_migrations"
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    applied_at: Mapped[str] = mapped_column(String(40))


class ResourceState(Base):
    __tablename__ = "resource_state"
    kind: Mapped[str] = mapped_column(String(32), primary_key=True)
    resource_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    status: Mapped[str] = mapped_column(String(32))


class Proposal(Base):
    __tablename__ = "proposals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[str] = mapped_column(String(32), index=True)
    worker_id: Mapped[int] = mapped_column(Integer)
    robot_id: Mapped[str] = mapped_column(String(32))
    machine_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source: Mapped[str] = mapped_column(String(64))
    rationale: Mapped[str] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[str] = mapped_column(String(40))
    decided_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    expires_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    workflow_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    decision_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    evidence_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class AuditEvent(Base):
    __tablename__ = "audit"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    action: Mapped[str] = mapped_column(String(64))
    detail: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40))
    actor: Mapped[str] = mapped_column(String(64), default="demo-supervisor")
    resource: Mapped[str | None] = mapped_column(String(128), nullable=True)
    previous_state: Mapped[str | None] = mapped_column(String(64), nullable=True)
    new_state: Mapped[str | None] = mapped_column(String(64), nullable=True)
    evidence_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)


class OperationalEvent(Base):
    __tablename__ = "operational_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_type: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(32))
    machine_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    order_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_udi: Mapped[int | None] = mapped_column(Integer, nullable=True)
    summary: Mapped[str] = mapped_column(Text)
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[str] = mapped_column(String(40))


class Workflow(Base):
    __tablename__ = "workflows"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[str] = mapped_column(String(32), index=True)
    state: Mapped[str] = mapped_column(String(64))
    origin: Mapped[str] = mapped_column(String(64))
    event_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    proposal_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    context_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[str] = mapped_column(String(40))
    updated_at: Mapped[str] = mapped_column(String(40))


class WorkflowTransition(Base):
    __tablename__ = "workflow_transitions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workflow_id: Mapped[int] = mapped_column(Integer, index=True)
    previous_state: Mapped[str] = mapped_column(String(64))
    new_state: Mapped[str] = mapped_column(String(64))
    actor: Mapped[str] = mapped_column(String(64))
    evidence_ref: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[str] = mapped_column(String(40))


class Execution(Base):
    __tablename__ = "executions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workflow_id: Mapped[int] = mapped_column(Integer, unique=True)
    proposal_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32))
    adapter: Mapped[str] = mapped_column(String(128))
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    result_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[str] = mapped_column(String(40))
    updated_at: Mapped[str] = mapped_column(String(40))
    __table_args__ = (UniqueConstraint("idempotency_key"),)


class DatasetImport(Base):
    __tablename__ = "dataset_imports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(64))
    row_count: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32))
    imported_at: Mapped[str] = mapped_column(String(40))
