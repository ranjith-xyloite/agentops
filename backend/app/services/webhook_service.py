import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import httpx
from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.models import WebhookSubscription

logger = logging.getLogger(__name__)


class WebhookDispatcher:
    """
    Asynchronous Webhook and Notification Dispatcher.
    Delivers signed JSON payloads to Slack, Discord, PagerDuty, or custom receivers.
    """

    async def dispatch_event(self, event_type: str, payload: Dict[str, Any]):
        """Query active webhooks subscribed to event_type and dispatch concurrently."""
        async with AsyncSessionLocal() as session:
            stmt = select(WebhookSubscription).where(WebhookSubscription.is_active.is_(True))
            res = await session.execute(stmt)
            subs = res.scalars().all()

        for sub in subs:
            # Check if event_type matches subscription filter
            event_types = sub.event_types or []
            if event_types and "*" not in event_types and event_type not in event_types:
                continue

            # Dispatch in background task
            try:
                await self._send_webhook(sub.url, sub.secret, event_type, payload)
            except Exception as e:
                logger.error(f"Failed to dispatch webhook {sub.name} ({sub.url}): {e}")

    async def test_webhook(self, url: str, secret: Optional[str] = None) -> Dict[str, Any]:
        """Send a test ping event to verify URL connectivity."""
        test_payload = {
            "event": "agentops.ping",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": "AgentOps Webhook Delivery Verification Test",
            "system": {
                "status": "operational",
                "version": "0.6.0-phase6"
            }
        }
        return await self._send_webhook(url, secret, "agentops.ping", test_payload)

    async def _send_webhook(self, url: str, secret: Optional[str], event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        body = json.dumps({
            "event": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data
        })

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AgentOps-WebhookDispatcher/0.6.0",
            "X-AgentOps-Event": event_type
        }

        if secret:
            sig = hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()
            headers["X-AgentOps-Signature"] = f"sha256={sig}"

        # Slack / Discord webhook format compatibility check
        if "hooks.slack.com" in url or "discord.com/api/webhooks" in url:
            slack_body = {
                "text": f"🚨 *[AgentOps Notification]* `{event_type}`: {json.dumps(data, default=str)}"
            }
            body = json.dumps(slack_body)

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, content=body, headers=headers)
            return {
                "status_code": res.status_code,
                "response_text": res.text[:200],
                "success": res.is_success
            }


webhook_dispatcher = WebhookDispatcher()
