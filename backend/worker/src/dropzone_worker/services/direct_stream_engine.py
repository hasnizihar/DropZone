import os
import json
import time
import logging
import threading
from typing import Dict, Any, Optional, Callable
import requests

from .url_validator import validate_url, validate_redirect
from .direct_http_service import (
    DirectHttpService,
    sanitize_filename,
    parse_content_disposition_filename,
)
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode

logger = logging.getLogger("dropzone_worker")

CHUNK_SIZE = 64 * 1024  # 64 KB

class DirectDownloadCancelled(Exception):
    """Raised when direct streaming is aborted cooperatively."""
    pass

class DirectStreamEngine:
    def __init__(
        self,
        write_event_fn: Optional[Callable[[str, Dict[str, Any]], None]] = None,
        http_service: Optional[DirectHttpService] = None,
    ):
        self.write_event_fn = write_event_fn
        self.http_service = http_service or DirectHttpService()
        self._cancellations: Dict[str, threading.Event] = {}
        self._pause_flags: Dict[str, bool] = {}
        self._last_progress_emit: Dict[str, float] = {}
        self._lock = threading.Lock()

    def cancel_download(self, job_id: str) -> bool:
        """Cooperatively signals active direct stream to cancel."""
        with self._lock:
            event = self._cancellations.get(job_id)
            if event:
                self._pause_flags[job_id] = False
                event.set()
                logger.info(f"Direct stream cancel signaled for job: {job_id}")
                return True
            return False

    def pause_download(self, job_id: str) -> bool:
        """Cooperatively signals active direct stream to pause, preserving .part file."""
        with self._lock:
            event = self._cancellations.get(job_id)
            if event:
                self._pause_flags[job_id] = True
                event.set()
                logger.info(f"Direct stream pause signaled for job: {job_id}")
                return True
            return False

    def execute_download(
        self,
        job_id: str,
        url: str,
        target_directory: str,
        custom_filename: Optional[str] = None,
        check_dns: bool = True,
        allow_loopback: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes a direct HTTP/HTTPS streaming download with chunked transfer and Range resume.
        """
        cancel_event = threading.Event()
        with self._lock:
            self._cancellations[job_id] = cancel_event
            self._pause_flags[job_id] = False
            self._last_progress_emit[job_id] = 0.0

        target_dir = os.path.abspath(target_directory)
        os.makedirs(target_dir, exist_ok=True)

        # 1. Inspect URL metadata first
        inspect_res = self.http_service.inspect_url(url, check_dns=check_dns, allow_loopback=allow_loopback)
        remote_filename = inspect_res.get("filename") or "download"
        final_filename = sanitize_filename(custom_filename or remote_filename)
        expected_total_bytes = inspect_res.get("fileSizeBytes")
        etag = inspect_res.get("etag")
        last_modified = inspect_res.get("lastModified")

        final_output_path = os.path.abspath(os.path.join(target_dir, final_filename))
        part_path = f"{final_output_path}.part"
        meta_path = f"{final_output_path}.part.meta.json"

        # Defensive path traversal check
        try:
            common = os.path.commonpath([target_dir, final_output_path])
            if common != target_dir:
                raise WorkerProtocolError(
                    ProtocolErrorCode.SECURITY_VIOLATION,
                    f"Path traversal detected: destination '{final_output_path}' escapes '{target_dir}'"
                )
        except ValueError:
            raise WorkerProtocolError(
                ProtocolErrorCode.SECURITY_VIOLATION,
                f"Invalid output path across drive boundaries: '{final_output_path}'"
            )

        # Emit download.started
        if self.write_event_fn:
            self.write_event_fn(
                "download.started",
                {
                    "jobId": job_id,
                    "url": url,
                    "targetDirectory": target_dir,
                    "filename": final_filename,
                },
            )

        # 2. Check for existing partial file to resume
        headers = dict(DirectHttpService.DEFAULT_HEADERS)
        existing_bytes = 0
        is_resuming = False

        if os.path.exists(part_path):
            existing_bytes = os.path.getsize(part_path)
            # Read sidecar metadata if available
            can_resume = True
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        saved_meta = json.load(f)
                    # Verify ETag or URL matches
                    if etag and saved_meta.get("etag") and saved_meta["etag"] != etag:
                        can_resume = False
                    if saved_meta.get("url") and saved_meta["url"] != url:
                        can_resume = False
                except Exception:
                    can_resume = False

            if can_resume and existing_bytes > 0:
                is_resuming = True
                headers["Range"] = f"bytes={existing_bytes}-"
                if etag:
                    headers["If-Range"] = etag
                elif last_modified:
                    headers["If-Range"] = last_modified

        # 3. Stream from network
        session = requests.Session()
        session.headers.update(headers)
        current_req_url = inspect_res.get("finalUrl") or url

        redirect_count = 0
        response = None
        downloaded_bytes = existing_bytes

        try:
            while redirect_count <= 5:
                if cancel_event.is_set():
                    raise DirectDownloadCancelled()

                try:
                    resp = session.get(
                        current_req_url,
                        stream=True,
                        timeout=20,
                        allow_redirects=False,
                    )
                except Exception as exc:
                    raise WorkerProtocolError(
                        ProtocolErrorCode.NETWORK_ERROR,
                        f"Connection failed for '{current_req_url}': {exc}"
                    )

                if resp.status_code in (301, 302, 303, 307, 308):
                    location = resp.headers.get("Location")
                    if not location:
                        break
                    current_req_url = validate_redirect(
                        current_req_url,
                        location,
                        redirect_count=redirect_count,
                        check_dns=check_dns,
                        allow_loopback=allow_loopback,
                    )
                    redirect_count += 1
                    resp.close()
                    continue

                response = resp
                break

            if not response:
                raise WorkerProtocolError(ProtocolErrorCode.NETWORK_ERROR, "No response from download stream.")

            status_code = response.status_code

            # Handle 416 Range Not Satisfiable
            if status_code == 416:
                response.close()
                if expected_total_bytes and existing_bytes == expected_total_bytes:
                    # File is already complete!
                    os.replace(part_path, final_output_path)
                    if os.path.exists(meta_path):
                        try:
                            os.remove(meta_path)
                        except Exception:
                            pass
                    res_data = {
                        "jobId": job_id,
                        "outputPath": final_output_path,
                        "totalBytes": existing_bytes,
                        "filename": final_filename,
                        "success": True,
                    }
                    if self.write_event_fn:
                        self.write_event_fn("download.completed", res_data)
                    return res_data
                else:
                    # Partial file corrupted or stale, restart from 0
                    existing_bytes = 0
                    headers.pop("Range", None)
                    headers.pop("If-Range", None)
                    session.headers.update(headers)
                    response = session.get(current_req_url, stream=True, timeout=20, allow_redirects=False)
                    status_code = response.status_code

            if status_code not in (200, 206):
                raise WorkerProtocolError(
                    ProtocolErrorCode.DOWNLOAD_FAILED,
                    f"HTTP error {status_code} during download stream."
                )

            # Determine mode
            if status_code == 206:
                mode = "ab"
                downloaded_bytes = existing_bytes
            else:
                mode = "wb"
                downloaded_bytes = 0

            # Write sidecar metadata
            try:
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(
                        {
                            "url": url,
                            "etag": etag,
                            "lastModified": last_modified,
                            "expectedBytes": expected_total_bytes,
                            "finalFilename": final_filename,
                        },
                        f,
                    )
            except Exception as exc:
                logger.debug(f"Could not write sidecar metadata: {exc}")

            start_time = time.time()
            last_speed_calc_time = start_time
            bytes_since_last_calc = 0
            current_speed = 0.0

            total_bytes = expected_total_bytes or 0
            if status_code == 200 and "Content-Length" in response.headers:
                try:
                    total_bytes = int(response.headers["Content-Length"])
                except Exception:
                    pass

            with open(part_path, mode) as part_file:
                for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                    if cancel_event.is_set():
                        raise DirectDownloadCancelled()

                    if not chunk:
                        continue

                    part_file.write(chunk)
                    chunk_len = len(chunk)
                    downloaded_bytes += chunk_len
                    bytes_since_last_calc += chunk_len

                    # Throttled progress event
                    now = time.time()
                    elapsed_speed = now - last_speed_calc_time
                    if elapsed_speed >= 0.5:
                        current_speed = bytes_since_last_calc / elapsed_speed
                        last_speed_calc_time = now
                        bytes_since_last_calc = 0

                    last_emit = self._last_progress_emit.get(job_id, 0.0)
                    if (now - last_emit) >= 0.25:  # Max 4/sec
                        self._last_progress_emit[job_id] = now
                        progress_pct = (
                            round((downloaded_bytes / total_bytes) * 100, 2)
                            if total_bytes > 0
                            else 0.0
                        )
                        eta_seconds = (
                            round((total_bytes - downloaded_bytes) / current_speed, 1)
                            if (total_bytes > downloaded_bytes and current_speed > 0)
                            else None
                        )

                        if self.write_event_fn:
                            self.write_event_fn(
                                "download.progress",
                                {
                                    "jobId": job_id,
                                    "progress": progress_pct,
                                    "downloadedBytes": downloaded_bytes,
                                    "totalBytes": total_bytes,
                                    "speedBytesPerSec": round(current_speed),
                                    "etaSeconds": eta_seconds,
                                    "filename": final_filename,
                                },
                            )

            response.close()

            # Verify integrity
            if total_bytes > 0 and downloaded_bytes < total_bytes:
                raise WorkerProtocolError(
                    ProtocolErrorCode.DOWNLOAD_FAILED,
                    f"Incomplete download: received {downloaded_bytes} of {total_bytes} bytes."
                )

            # Atomic rename to final output path
            os.replace(part_path, final_output_path)
            if os.path.exists(meta_path):
                try:
                    os.remove(meta_path)
                except Exception:
                    pass

            res_data = {
                "jobId": job_id,
                "outputPath": final_output_path,
                "totalBytes": downloaded_bytes,
                "filename": final_filename,
                "success": True,
            }
            if self.write_event_fn:
                self.write_event_fn("download.completed", res_data)

            return res_data

        except DirectDownloadCancelled:
            is_pause = self._pause_flags.get(job_id, False)
            if is_pause:
                logger.info(f"Direct stream download paused: {job_id}")
                if self.write_event_fn:
                    self.write_event_fn(
                        "download.paused",
                        {"jobId": job_id, "downloadedBytes": downloaded_bytes},
                    )
                return {"jobId": job_id, "paused": True, "success": True}
            else:
                logger.info(f"Direct stream download cancelled: {job_id}")
                # Clean up partial files on explicit cancel
                if os.path.exists(part_path):
                    try:
                        os.remove(part_path)
                    except Exception:
                        pass
                if os.path.exists(meta_path):
                    try:
                        os.remove(meta_path)
                    except Exception:
                        pass
                if self.write_event_fn:
                    self.write_event_fn("download.cancelled", {"jobId": job_id})
                return {"jobId": job_id, "cancelled": True, "success": True}

        except Exception as exc:
            if not isinstance(exc, WorkerProtocolError):
                logger.error(f"Direct stream failed for {job_id}: {exc}", exc_info=True)
                exc = WorkerProtocolError(ProtocolErrorCode.DOWNLOAD_FAILED, str(exc))

            if self.write_event_fn:
                self.write_event_fn(
                    "download.failed",
                    {
                        "jobId": job_id,
                        "code": exc.code,
                        "message": exc.message,
                        "details": exc.details,
                    },
                )
            raise exc

        finally:
            if response:
                try:
                    response.close()
                except Exception:
                    pass
            with self._lock:
                self._cancellations.pop(job_id, None)
                self._pause_flags.pop(job_id, None)
                self._last_progress_emit.pop(job_id, None)
