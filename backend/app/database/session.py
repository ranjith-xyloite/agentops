import time
from typing import Optional, Dict, Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, AsyncEngine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, NullPool, StaticPool
from app.config import settings

_engine: Optional[AsyncEngine] = None
_session_maker: Optional[sessionmaker] = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        db_url = settings.DATABASE_URL
        if "sqlite" in db_url:
            connect_args = {"check_same_thread": False}
            _engine = create_async_engine(
                db_url,
                future=True,
                echo=False,
                connect_args=connect_args
            )
        else:
            # Production PostgreSQL engine with tuned connection pool
            _engine = create_async_engine(
                db_url,
                future=True,
                echo=False,
                pool_size=20,
                max_overflow=10,
                pool_timeout=30,
                pool_recycle=1800,
                pool_pre_ping=True
            )
    return _engine


def get_session_maker() -> sessionmaker:
    global _session_maker
    if _session_maker is None:
        _session_maker = sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _session_maker


def set_engine_and_session(new_engine: AsyncEngine, new_session_maker: sessionmaker):
    global _engine, _session_maker
    _engine = new_engine
    _session_maker = new_session_maker


class _AsyncSessionLocalProxy:
    """Dynamic proxy for AsyncSessionLocal to allow clean test-engine overriding."""
    def __call__(self, *args, **kwargs):
        maker = get_session_maker()
        return maker(*args, **kwargs)

    def __getattr__(self, name):
        maker = get_session_maker()
        return getattr(maker, name)


AsyncSessionLocal = _AsyncSessionLocalProxy()
engine = get_engine()


async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def check_db_health() -> Dict[str, Any]:
    """Check database connectivity, response latency, and pool statistics."""
    start_time = time.perf_counter()
    eng = get_engine()
    try:
        async with AsyncSessionLocal() as session:
            res = await session.execute(text("SELECT 1"))
            val = res.scalar()
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            
            # Pool stats if QueuePool
            pool = getattr(eng.sync_engine, 'pool', None)
            pool_stats = {}
            if pool and hasattr(pool, 'size'):
                pool_stats = {
                    "pool_size": pool.size(),
                    "checkedin": pool.checkedin(),
                    "checkedout": pool.checkedout(),
                    "overflow": pool.overflow()
                }

            return {
                "status": "healthy" if val == 1 else "unhealthy",
                "latency_ms": latency_ms,
                "pool": pool_stats
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
            "pool": {}
        }
