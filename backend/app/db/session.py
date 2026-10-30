from __future__ import annotations

import os
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.app.core.config import database_url, iso
from backend.app.db.models import Base, ResourceState, SchemaMigration
from backend.app.domain.catalog import MACHINES, ORDERS, ROBOTS, WORKERS

_engines: dict[str, sessionmaker[Session]] = {}


def _session_factory() -> sessionmaker[Session]:
    url = database_url()
    factory = _engines.get(url)
    if factory is None:
        kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
        engine = create_engine(url, **kwargs)
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine, expire_on_commit=False)
        _engines[url] = factory
    return factory


def open_session() -> Session:
    return _session_factory()()


def seed_resources(db: Session) -> None:
    if db.get(SchemaMigration, 1) is None:
        db.add(SchemaMigration(version=1, applied_at=iso()))
    for worker in WORKERS:
        status = "available" if worker["available"] else "unavailable"
        db.add(ResourceState(kind="worker", resource_id=str(worker["id"]), status=status))
    for order in ORDERS:
        db.add(ResourceState(kind="order", resource_id=order["id"], status=order["status"]))
    for robot in ROBOTS:
        status = "available" if robot["available"] else "unavailable"
        db.add(ResourceState(kind="robot", resource_id=robot["id"], status=status))
    for machine in MACHINES:
        db.add(ResourceState(kind="machine", resource_id=machine["id"], status=machine["status"]))


def ensure_seed(db: Session) -> None:
    if db.query(ResourceState).count() == 0:
        seed_resources(db)
        db.commit()


def sessions() -> Iterator[Session]:
    db = open_session()
    try:
        ensure_seed(db)
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def reset_state(db: Session) -> None:
    from backend.app.db.models import (
        AuditEvent,
        DatasetImport,
        Execution,
        OperationalEvent,
        Proposal,
        Workflow,
        WorkflowTransition,
    )

    for model in (
        WorkflowTransition,
        Execution,
        Proposal,
        AuditEvent,
        OperationalEvent,
        Workflow,
        DatasetImport,
        ResourceState,
    ):
        db.query(model).delete(synchronize_session=False)
    db.expire_all()
    seed_resources(db)
    db.commit()
