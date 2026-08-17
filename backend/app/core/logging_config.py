import logging
import sys
from contextvars import ContextVar
from typing import Optional
from pythonjsonlogger import jsonlogger

# Context variable for request correlation ID
correlation_id_ctx: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        if not log_record.get("timestamp"):
            import datetime
            log_record["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if log_record.get("level"):
            log_record["level"] = log_record["level"].upper()
        else:
            log_record["level"] = record.levelname

        # Attach request correlation ID if present
        cid = correlation_id_ctx.get()
        if cid:
            log_record["correlation_id"] = cid


def setup_structured_logging(level: int = logging.INFO):
    """Configure root logger with structured JSON output."""
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Clear existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    log_handler = logging.StreamHandler(sys.stdout)
    formatter = CustomJsonFormatter(
        "%(timestamp)s %(level)s %(name)s %(message)s %(module)s %(lineno)d"
    )
    log_handler.setFormatter(formatter)
    root_logger.addHandler(log_handler)

    # Set third party loggers to warning
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("asyncssh").setLevel(logging.WARNING)
