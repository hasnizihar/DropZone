import os
import json
import time
import logging
import threading
from typing import Dict, Any, Optional, Callable, Tuple
import requests

from .url_validator import validate_url, validate_redirect
from .direct_http_service import (
    DirectHttpService,
    sanitize_filename,
    parse_content_disposition_filename,
    parse_retry_after,
    parse_content_range,
)
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode

logger = logging.getLogger("dropzone_worker")

CHUNK_SIZE = 64 * 1024  # 64 KB

def split_base_and_ext(filename: str) -> Tuple[str, str]:
    clean = filename.strip()
    compound_exts = [".tar.gz", ".tar.bz2", ".tar.xz", ".tar.zst", ".part.meta.json"]
    lower = clean.lower()
    for c_ext in compound_exts:
        if lower.endswith(c_ext):
            base = clean[:-len(c_ext)]
            return base or "download", clean[-len(c_ext):]
    base, ext = os.path.splitext(clean)
    return base or "download", ext

def resolve_unique_filename(target_dir: str, desired_filename: str) -> str:
    """Finds a collision-free filename in target_dir for completed or in-progress files."""
    base, ext = split_base_and_ext(desired_filename)
    candidate = f"{base}{ext}"
    counter = 1
    while (
        os.path.exists(os.path.join(target_dir, candidate))
        or os.path.exists(os.path.join(target_dir, f"{candidate}.part"))
        or os.path.exists(os.path.join(target_dir, f"{candidate}.part.meta.json"))
    ):
        candidate = f"{base} ({counter}){ext}"
        counter += 1
    return candidate

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

        # 1. Check for existing partial file and sidecar metadata first (to avoid redundant HEAD/GET requests)
        has_valid_resume_meta = False
        final_filename = sanitize_filename(custom_filename) if custom_filename else None
        part_path = None
        meta_path = None
        expected_total_bytes = None
        etag = None
        last_modified = None
        current_req_url = url
        supports_resume = True

        candidate_meta_file = None
        if final_filename:
            candidate_part = os.path.abspath(os.path.join(target_dir, f"{final_filename}.part"))
            candidate_meta = os.path.abspath(os.path.join(target_dir, f"{final_filename}.part.meta.json"))
            if os.path.exists(candidate_part) and os.path.exists(candidate_meta):
                candidate_meta_file = candidate_meta
                part_path = candidate_part
                meta_path = candidate_meta
        else:
            # ONLY scan directory for partials if NO custom_filename was specified!
            try:
                for fname in os.listdir(target_dir):
                    if fname.endswith(".part.meta.json"):
                        cm = os.path.join(target_dir, fname)
                        cp = cm[:-10]  # strip .meta.json -> .part
                        if os.path.exists(cp):
                            try:
                                with open(cm, "r", encoding="utf-8") as mf:
                                    m_data = json.load(mf)
                                if m_data.get("url") == url:
                                    candidate_meta_file = cm
                                    part_path = cp
                                    meta_path = cm
                                    break
                            except Exception:
                                pass
            except Exception:
                pass

        if candidate_meta_file and part_path:
            try:
                with open(candidate_meta_file, "r", encoding="utf-8") as mf:
                    saved_meta = json.load(mf)
                if saved_meta.get("url") == url:
                    # Do not let saved_meta override an explicitly given custom_filename
                    if not final_filename:
                        final_filename = saved_meta.get("finalFilename") or "download"
                    expected_total_bytes = saved_meta.get("expectedBytes")
                    etag = saved_meta.get("etag")
                    last_modified = saved_meta.get("lastModified")
                    current_req_url = saved_meta.get("finalUrl") or url
                    supports_resume = saved_meta.get("supportsResume", True)
                    has_valid_resume_meta = True
                    logger.info(f"Resuming download for {job_id} from existing sidecar metadata: {final_filename}")
            except Exception as e:
                logger.debug(f"Failed to read existing metadata: {e}")

        # If we could not load valid sidecar metadata, inspect URL
        if not has_valid_resume_meta:
            inspect_res = self.http_service.inspect_url(url, check_dns=check_dns, allow_loopback=allow_loopback)
            remote_filename = inspect_res.get("filename") or "download"
            raw_filename = sanitize_filename(custom_filename or remote_filename)
            if not custom_filename:
                # If custom_filename was not provided, ensure unique destination on disk
                final_filename = resolve_unique_filename(target_dir, raw_filename)
            else:
                final_filename = raw_filename
            expected_total_bytes = inspect_res.get("fileSizeBytes")
            etag = inspect_res.get("etag")
            last_modified = inspect_res.get("lastModified")
            current_req_url = inspect_res.get("finalUrl") or url
            supports_resume = inspect_res.get("supportsResume", True)

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

        # 3. Stream from network with bounded 429 backoff
        session = requests.Session()
        session.headers.update(headers)

        redirect_count = 0
        response = None
        downloaded_bytes = existing_bytes

        MAX_429_RETRIES = 3
        MAX_RETRY_AFTER_WAIT = 15.0
        DEFAULT_BACKOFF_BASE = 2.0
        retry_429_count = 0

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

                # Fallback User-Agent if 401/403
                if resp.status_code in (401, 403):
                    for alt_ua in getattr(self.http_service, "FALLBACK_USER_AGENTS", []):
                        if alt_ua == session.headers.get("User-Agent"):
                            continue
                        try:
                            headers_alt = dict(headers)
                            headers_alt["User-Agent"] = alt_ua
                            alt_resp = session.get(
                                current_req_url,
                                headers=headers_alt,
                                stream=True,
                                timeout=20,
                                allow_redirects=False,
                            )
                            if alt_resp.status_code < 400:
                                resp = alt_resp
                                session.headers["User-Agent"] = alt_ua
                                break
                        except Exception:
                            pass

                # Handle HTTP 429 Rate Limiting with Bounded Backoff and Retry-After
                if resp.status_code == 429:
                    retry_after_val = resp.headers.get("Retry-After")
                    wait_seconds = parse_retry_after(retry_after_val)
                    if wait_seconds is None:
                        wait_seconds = min(DEFAULT_BACKOFF_BASE ** (retry_429_count + 1), MAX_RETRY_AFTER_WAIT)

                    if retry_429_count < MAX_429_RETRIES and wait_seconds <= MAX_RETRY_AFTER_WAIT:
                        resp.close()
                        logger.warning(
                            f"HTTP 429 rate limit encountered for '{current_req_url}'. "
                            f"Backing off for {wait_seconds:.1f}s (retry {retry_429_count + 1}/{MAX_429_RETRIES})."
                        )
                        # Interruptible wait respecting cancellation/pause
                        cancelled = cancel_event.wait(timeout=wait_seconds)
                        if cancelled:
                            raise DirectDownloadCancelled()
                        retry_429_count += 1
                        continue
                    else:
                        resp.close()
                        msg = (
                            f"Rate limited by server (HTTP 429) for '{current_req_url}'. "
                            f"{f'Server requested {int(wait_seconds)}s cooldown.' if wait_seconds else 'Retries exhausted.'} "
                            "Partial download preserved; please retry after cooldown."
                        )
                        raise WorkerProtocolError(ProtocolErrorCode.RATE_LIMITED, msg)

                response = resp
                break

            if response is None:
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
                    # Partial file corrupted or stale, restart cleanly from 0
                    existing_bytes = 0
                    headers.pop("Range", None)
                    headers.pop("If-Range", None)
                    session.headers.update(headers)
                    response = session.get(current_req_url, stream=True, timeout=20, allow_redirects=False)
                    status_code = response.status_code

            # Handle 412 Precondition Failed (If-Range failed because remote entity changed)
            if status_code == 412:
                response.close()
                existing_bytes = 0
                headers.pop("Range", None)
                headers.pop("If-Range", None)
                session.headers.update(headers)
                response = session.get(current_req_url, stream=True, timeout=20, allow_redirects=False)
                status_code = response.status_code

            if status_code not in (200, 206):
                if status_code == 429:
                    raise WorkerProtocolError(
                        ProtocolErrorCode.RATE_LIMITED,
                        f"Rate limited by server (HTTP 429) for '{current_req_url}'."
                    )
                elif status_code in (401, 403):
                    raise WorkerProtocolError(
                        ProtocolErrorCode.AUTH_REQUIRED,
                        f"Access forbidden or authentication required (HTTP {status_code}) for '{current_req_url}'."
                    )
                elif status_code in (500, 502, 503, 504):
                    raise WorkerProtocolError(
                        ProtocolErrorCode.NETWORK_ERROR,
                        f"Remote server error (HTTP {status_code}) for '{current_req_url}'."
                    )
                else:
                    raise WorkerProtocolError(
                        ProtocolErrorCode.DOWNLOAD_FAILED,
                        f"HTTP error {status_code} during download stream."
                    )

            total_bytes = expected_total_bytes or 0

            # Determine mode and verify Content-Range
            if status_code == 206:
                content_range = response.headers.get("Content-Range")
                range_info = parse_content_range(content_range)
                if range_info:
                    range_start, range_end, range_total = range_info
                    if range_start == existing_bytes:
                        mode = "ab"
                        downloaded_bytes = existing_bytes
                        if range_total:
                            total_bytes = range_total
                    elif range_start == 0:
                        # Server sent entire content from offset 0
                        mode = "wb"
                        downloaded_bytes = 0
                        if range_total:
                            total_bytes = range_total
                    else:
                        # Mismatched range offset; restart from 0 to prevent byte corruption
                        logger.warning(
                            f"Content-Range start {range_start} != existing bytes {existing_bytes}; restarting from 0."
                        )
                        mode = "wb"
                        downloaded_bytes = 0
                        if range_total:
                            total_bytes = range_total
                else:
                    mode = "ab"
                    downloaded_bytes = existing_bytes
            else:
                # Status code 200: Server ignored Range or does not support Range requests.
                # Cleanly truncate and write from byte 0 to prevent byte duplication or corruption.
                mode = "wb"
                downloaded_bytes = 0
                if "Content-Length" in response.headers:
                    try:
                        total_bytes = int(response.headers["Content-Length"])
                    except Exception:
                        pass

            # Write / update sidecar metadata with comprehensive fields
            try:
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(
                        {
                            "url": url,
                            "finalUrl": current_req_url,
                            "etag": etag or response.headers.get("ETag"),
                            "lastModified": last_modified or response.headers.get("Last-Modified"),
                            "expectedBytes": total_bytes,
                            "finalFilename": final_filename,
                            "supportsResume": status_code == 206 or ("bytes" in response.headers.get("Accept-Ranges", "").lower()),
                        },
                        f,
                    )
            except Exception as exc:
                logger.debug(f"Could not write sidecar metadata: {exc}")

            start_time = time.time()
            last_speed_calc_time = start_time
            bytes_since_last_calc = 0
            current_speed = 0.0

            with open(part_path, mode) as part_file:
                for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                    if cancel_event.is_set():
                        raise DirectDownloadCancelled()

                    if not chunk:
                        continue

                    part_file.write(chunk)
                    part_file.flush()
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

            # Ensure we never overwrite an existing completed file on disk
            if os.path.exists(final_output_path):
                safe_name = resolve_unique_filename(target_dir, final_filename)
                final_filename = safe_name
                final_output_path = os.path.abspath(os.path.join(target_dir, final_filename))

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
                if isinstance(exc, OSError):
                    exc = WorkerProtocolError(ProtocolErrorCode.FILE_WRITE_ERROR, f"Filesystem write error: {exc}")
                else:
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
