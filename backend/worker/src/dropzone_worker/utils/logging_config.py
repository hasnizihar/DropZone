import logging
import sys

def setup_worker_logging(level: int = logging.INFO) -> logging.Logger:
    """
    Configures logging to output strictly to stderr.
    Standard output (stdout) is reserved strictly for JSON Lines protocol messages.
    """
    logger = logging.getLogger("dropzone_worker")
    logger.setLevel(level)

    # Remove any existing handlers
    logger.handlers.clear()

    # Create stderr handler
    handler = logging.StreamHandler(stream=sys.stderr)
    handler.setLevel(level)

    formatter = logging.Formatter(
        fmt="[DROPZONE_WORKER %(levelname)s %(asctime)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Prevent propagation to root logger which might write to stdout
    logger.propagate = False

    return logger
