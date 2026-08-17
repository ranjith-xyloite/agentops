import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.models import ScheduledTask

logger = logging.getLogger(__name__)


def matches_cron(cron_expr: str, dt: datetime) -> bool:
    """Simple robust cron matching for standard expressions and aliases."""
    expr = cron_expr.strip().lower()
    if expr == "@hourly":
        return dt.minute == 0
    if expr == "@daily":
        return dt.minute == 0 and dt.hour == 0
    if expr == "@weekly":
        return dt.minute == 0 and dt.hour == 0 and dt.weekday() == 0

    parts = expr.split()
    if len(parts) != 5:
        return False

    min_part, hour_part, dom_part, month_part, dow_part = parts

    def match_part(part: str, val: int) -> bool:
        if part == "*":
            return True
        if part.startswith("*/"):
            step = int(part[2:])
            return val % step == 0
        if "," in part:
            return any(match_part(p, val) for p in part.split(","))
        try:
            return int(part) == val
        except ValueError:
            return False

    # minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-6)
    return (
        match_part(min_part, dt.minute) and
        match_part(hour_part, dt.hour) and
        match_part(dom_part, dt.day) and
        match_part(month_part, dt.month) and
        match_part(dow_part, dt.weekday())
    )


class AsyncScheduler:
    """Background service executing recurring cron tasks."""
    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None

    def start(self):
        if not self._running:
            self._running = True
            self._task = asyncio.create_task(self._scheduler_loop())
            logger.info("AgentOps AsyncScheduler background worker started.")

    def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            logger.info("AgentOps AsyncScheduler stopped.")

    async def _scheduler_loop(self):
        while self._running:
            try:
                await self.check_and_run_schedules()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
            await asyncio.sleep(60)

    async def check_and_run_schedules(self):
        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as session:
            stmt = select(ScheduledTask).where(ScheduledTask.is_active.is_(True))
            res = await session.execute(stmt)
            tasks = res.scalars().all()

            for st in tasks:
                if matches_cron(st.cron_expression, now):
                    logger.info(f"Triggering scheduled task #{st.id}: '{st.name}' ({st.user_request})")
                    st.last_run_at = now
                    # Dispatch to Orchestrator in background
                    from app.agents.orchestrator import Orchestrator
                    orch = Orchestrator()
                    asyncio.create_task(orch.handle_user_message(st.user_request, {"source": "scheduler", "schedule_id": st.id}))
            
            await session.commit()


scheduler = AsyncScheduler()
