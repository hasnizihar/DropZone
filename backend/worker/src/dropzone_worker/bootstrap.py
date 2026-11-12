import sys
import logging
import threading
from .utils.logging_config import setup_worker_logging
from .protocol.models import create_event, create_error
from .protocol.parser import parse_incoming_line
from .protocol.serializer import serialize_message
from .protocol.errors import WorkerProtocolError, ProtocolErrorCode
from .core.health import WorkerHealthMonitor
from .core.lifecycle import WorkerLifecycle
from .core.dispatcher import CommandDispatcher
from . import __version__, PROTOCOL_VERSION

stdout_lock = threading.Lock()

def write_stdout_message(msg) -> None:
    """
    Writes a single protocol message to stdout with trailing newline and flushes immediately.
    Thread-safe to prevent interleaved messages from concurrent tasks.
    """
    try:
        raw_json = serialize_message(msg)
        with stdout_lock:
            sys.stdout.write(raw_json + "\n")
            sys.stdout.flush()
    except Exception as exc:
        sys.stderr.write(f"[DROPZONE_WORKER ERROR] Failed writing to stdout: {exc}\n")
        sys.stderr.flush()

def run() -> int:
    """
    Main entry point for DROPZONE worker execution.
    """
    logger = setup_worker_logging(logging.INFO)
    logger.info(f"Starting DROPZONE Worker v{__version__} (Protocol v{PROTOCOL_VERSION})...")

    health = WorkerHealthMonitor()
    lifecycle = WorkerLifecycle()
    lifecycle.setup_signal_handlers()

    # Pass write_stdout_message callback so asynchronous commands can stream output thread-safely
    dispatcher = CommandDispatcher(health, lifecycle, write_message_fn=write_stdout_message)

    # Emit initial worker.ready event
    ready_event = create_event(
        "worker.ready",
        {
            "workerVersion": __version__,
            "protocolVersion": PROTOCOL_VERSION,
            "pid": health.get_status_payload()["pid"],
        },
    )
    write_stdout_message(ready_event)
    logger.info("Emitted 'worker.ready' handshake event.")

    try:
        while lifecycle.is_running:
            line = sys.stdin.readline()
            if line == "":
                # EOF reached (Host process terminated or closed pipe)
                logger.info("Standard input reached EOF. Exiting worker loop.")
                break

            line_clean = line.strip()
            if not line_clean:
                continue

            current_req_id = None
            try:
                request = parse_incoming_line(line_clean)
                current_req_id = request.id

                # Dispatch command
                response = dispatcher.dispatch(request)
                if response is not None:
                    write_stdout_message(response)

            except WorkerProtocolError as proto_err:
                health.record_error()
                logger.warning(f"Protocol error [{proto_err.code}]: {proto_err.message}")
                err_msg = create_error(
                    request_id=current_req_id,
                    code=proto_err.code,
                    message=proto_err.message,
                    details=proto_err.details,
                )
                write_stdout_message(err_msg)

            except Exception as unhandled_err:
                health.record_error()
                logger.error(f"Unexpected internal error: {unhandled_err}", exc_info=True)
                err_msg = create_error(
                    request_id=current_req_id,
                    code=ProtocolErrorCode.INTERNAL_ERROR,
                    message="Internal worker error occurred",
                    details={"error": str(unhandled_err)},
                )
                write_stdout_message(err_msg)

            if lifecycle.is_shutting_down:
                logger.info("Worker lifecycle marked as shutting down; terminating loop.")
                break

    except KeyboardInterrupt:
        logger.info("Received KeyboardInterrupt. Exiting...")
    finally:
        # Emit final shutting_down event
        shutdown_event = create_event(
            "worker.shutting_down",
            {"workerVersion": __version__, "clean": True},
        )
        write_stdout_message(shutdown_event)
        logger.info("DROPZONE Worker exited cleanly.")

    return 0
