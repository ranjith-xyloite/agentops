import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.models import PolicyRule

logger = logging.getLogger(__name__)


class PolicyEngine:
    """
    DevOps Deployment Guardrails & Compliance Policy Engine.
    Enforces change freezes, deployment time-windows, and production verification gates.
    """

    async def evaluate_task(self, tool_name: str, parameters: Dict[str, Any], current_user_role: str = "operator") -> Tuple[bool, Optional[str]]:
        """
        Evaluates active policies for a task tool and its target environment.
        Returns (is_allowed: bool, rejection_reason: Optional[str]).
        """
        # Read-only tools bypass deployment policies
        if tool_name in ("server_health_check", "docker_status"):
            return True, None

        target_env = (parameters.get("environment") or "").lower()
        if not target_env:
            return True, None

        async with AsyncSessionLocal() as session:
            stmt = select(PolicyRule).where(PolicyRule.is_active.is_(True))
            res = await session.execute(stmt)
            policies = res.scalars().all()

        now = datetime.now(timezone.utc)
        weekday = now.weekday()  # Monday is 0, Sunday is 6, Friday is 4, Saturday is 5
        current_hour = now.hour

        for policy in policies:
            if policy.environment.lower() != target_env:
                continue

            # 1. Check Weekend Freeze (Friday 18:00 UTC through Sunday 23:59 UTC)
            if policy.block_weekends:
                if (weekday == 4 and current_hour >= 18) or weekday in (5, 6):
                    if current_user_role != "admin":
                        return False, f"Deployment blocked by policy '{policy.name}': Production Change Freeze in effect over the weekend. Admin override required."

            # 2. Check Allowed Working Hours Window
            if policy.allowed_hours_start is not None and policy.allowed_hours_end is not None:
                if current_hour < policy.allowed_hours_start or current_hour >= policy.allowed_hours_end:
                    if current_user_role != "admin":
                        return False, f"Deployment blocked by policy '{policy.name}': Outside allowed deployment window ({policy.allowed_hours_start:02d}:00 - {policy.allowed_hours_end:02d}:00 UTC)."

        return True, None


policy_engine = PolicyEngine()
