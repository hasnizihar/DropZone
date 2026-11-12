import os
import re
import time
import logging
import threading
from typing import Dict, Any, Optional, Callable
from ..engines.ytdlp_engine import YtDlpStderrLogger, re_clean_error
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode

logger = logging.getLogger("dropzone_worker")

class DownloadCancelledException(Exception):
    """Raised when an active download is interrupted by user cancellation or pause."""
    pass

def sanitize_filename(name: Optional[str]) -> str:
    """Sanitizes filename for Windows filesystem, stripping illegal characters."""
    if not name or not isinstance(name, str):
        return "download"
    # Remove Windows reserved characters: \ / : * ? " < > | \0
    clean = re.sub(r'[\\/*?:"<>|\x00-\x1f]', "_", name).strip()
    # Strip trailing periods and spaces (Windows restriction)
    clean = clean.rstrip(". ")
    if not clean:
        clean = "download"
    # Bound to safe length (max 180 chars)
    return clean[:180]

class DownloadService:
    def __init__(self, write_event_fn: Optional[Callable[[str, Dict[str, Any]], None]] = None):
        self.write_event_fn = write_event_fn
        self._cancellations: Dict[str, threading.Event] = {}
        self._last_progress_emit: Dict[str, float] = {}
        self._current_filenames: Dict[str, str] = {}
        self._lock = threading.Lock()

    def cancel_download(self, job_id: str) -> bool:
        """Signals active download for job_id to abort."""
        with self._lock:
            event = self._cancellations.get(job_id)
            if event:
                event.set()
                logger.info(f"Cancellation signaled for download job: {job_id}")
                return True
            return False

    def pause_download(self, job_id: str) -> bool:
        """Signals active download to pause (cooperatively stops yt-dlp while preserving .part file)."""
        return self.cancel_download(job_id)

    def execute_download(
        self,
        job_id: str,
        url: str,
        target_directory: str,
        format_id: Optional[str] = None,
        custom_filename: Optional[str] = None,
        extract_audio: bool = False,
        audio_format: Optional[str] = "mp3",
    ) -> Dict[str, Any]:
        """
        Executes a real download using yt-dlp, reporting progress events over stdout.
        Runs inside a worker thread to keep the protocol loop and keepalives non-blocking.
        """
        import yt_dlp

        # 1. Target directory validation and creation
        try:
            abs_target_dir = os.path.abspath(target_directory)
            os.makedirs(abs_target_dir, exist_ok=True)
        except Exception as exc:
            raise WorkerProtocolError(
                ProtocolErrorCode.FILE_WRITE_ERROR,
                f"Failed to access or create destination directory '{target_directory}': {exc}"
            )

        # 2. Setup cancellation token
        cancel_event = threading.Event()
        with self._lock:
            self._cancellations[job_id] = cancel_event
            self._last_progress_emit[job_id] = 0.0

        # 3. Output template
        clean_name = sanitize_filename(custom_filename) if custom_filename else None
        if clean_name:
            outtmpl = os.path.join(abs_target_dir, f"{clean_name}.%(ext)s")
        else:
            outtmpl = os.path.join(abs_target_dir, "%(title)s [%(id)s].%(ext)s")

        # 4. Format selector
        if extract_audio:
            format_spec = "bestaudio/best"
        elif format_id and format_id != "best":
            # For video-only formats, try merging bestaudio if ffmpeg is available
            format_spec = f"{format_id}+bestaudio/best" if format_id.isdigit() else format_id
        else:
            format_spec = "bestvideo+bestaudio/best"

        # 5. Progress hook with cooperative cancellation check & throttled event emission
        def progress_hook(d: Dict[str, Any]):
            if cancel_event.is_set():
                raise DownloadCancelledException(f"Job {job_id} cancelled by user")

            status = d.get("status")
            filename = d.get("filename")
            if filename:
                with self._lock:
                    self._current_filenames[job_id] = filename

            if status == "downloading":
                downloaded = int(d.get("downloaded_bytes") or 0)
                total = int(d.get("total_bytes") or d.get("total_bytes_estimate") or 0)
                speed = float(d.get("speed") or 0.0)
                eta = d.get("eta")
                eta_secs = int(eta) if eta is not None else None

                progress = 0.0
                if total > 0:
                    progress = round((downloaded / total) * 100, 2)
                    if progress > 100.0:
                        progress = 100.0

                now = time.time()
                with self._lock:
                    last_emit = self._last_progress_emit.get(job_id, 0.0)
                    # Throttle to max 4 events per second (250ms) to preserve stdout protocol purity
                    should_emit = (now - last_emit) >= 0.25 or progress >= 100.0
                    if should_emit:
                        self._last_progress_emit[job_id] = now

                if should_emit and self.write_event_fn:
                    self.write_event_fn(
                        "download.progress",
                        {
                            "jobId": job_id,
                            "progress": progress,
                            "downloadedBytes": downloaded,
                            "totalBytes": total,
                            "speedBytesPerSec": int(speed),
                            "etaSeconds": eta_secs,
                            "filename": os.path.basename(filename) if filename else None,
                        },
                    )

            elif status == "finished":
                total = int(d.get("total_bytes") or d.get("downloaded_bytes") or 0)
                if self.write_event_fn:
                    self.write_event_fn(
                        "download.progress",
                        {
                            "jobId": job_id,
                            "progress": 100.0,
                            "downloadedBytes": total,
                            "totalBytes": total,
                            "speedBytesPerSec": 0,
                            "etaSeconds": 0,
                            "filename": os.path.basename(filename) if filename else None,
                        },
                    )

        # 6. yt-dlp options
        ydl_opts: Dict[str, Any] = {
            "format": format_spec,
            "outtmpl": outtmpl,
            "logger": YtDlpStderrLogger(),
            "progress_hooks": [progress_hook],
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "continuedl": True,
            "overwrites": True,
            "no_color": True,
            "socket_timeout": 30,
            "retries": 3,
        }

        if extract_audio:
            ydl_opts["postprocessors"] = [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": audio_format or "mp3",
                    "preferredquality": "192",
                }
            ]

        # 7. Execute download
        try:
            logger.info(f"Starting download job {job_id} for URL: {url} (format: {format_spec})")
            if self.write_event_fn:
                self.write_event_fn("download.started", {"jobId": job_id, "url": url})

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(url, download=True)

            final_path = None
            with self._lock:
                final_path = self._current_filenames.get(job_id)

            # Fallback to output filename from info_dict if hook didn't capture final postprocessed file
            if not final_path or not os.path.exists(final_path):
                if info_dict:
                    cand = ydl.prepare_filename(info_dict)
                    if extract_audio and cand:
                        cand_base = os.path.splitext(cand)[0]
                        cand = f"{cand_base}.{audio_format or 'mp3'}"
                    if cand and os.path.exists(cand):
                        final_path = cand

            # Resolve actual size on disk
            final_size = 0
            if final_path and os.path.exists(final_path):
                final_size = os.path.getsize(final_path)

            logger.info(f"Download job {job_id} completed successfully -> {final_path} ({final_size} bytes)")
            
            result_payload = {
                "success": True,
                "jobId": job_id,
                "outputPath": final_path or outtmpl,
                "totalBytes": final_size,
            }

            if self.write_event_fn:
                self.write_event_fn("download.completed", result_payload)

            return result_payload

        except DownloadCancelledException:
            logger.info(f"Download job {job_id} was aborted via cancellation token.")
            if self.write_event_fn:
                self.write_event_fn("download.cancelled", {"jobId": job_id})
            raise WorkerProtocolError(
                ProtocolErrorCode.DOWNLOAD_CANCELLED,
                f"Download job {job_id} was cancelled.",
                details={"jobId": job_id}
            )

        except yt_dlp.utils.DownloadError as exc:
            msg = str(exc)
            cleaned = re_clean_error(msg)
            logger.warning(f"Download failed for job {job_id}: {cleaned}")
            
            err_details = {"jobId": job_id, "originalError": cleaned}
            if self.write_event_fn:
                self.write_event_fn(
                    "download.failed",
                    {"jobId": job_id, "code": ProtocolErrorCode.DOWNLOAD_FAILED, "message": cleaned}
                )
            raise WorkerProtocolError(
                ProtocolErrorCode.DOWNLOAD_FAILED,
                f"Download failed: {cleaned}",
                details=err_details
            )

        except WorkerProtocolError:
            raise

        except Exception as exc:
            logger.error(f"Unexpected error executing download for job {job_id}: {exc}", exc_info=True)
            if self.write_event_fn:
                self.write_event_fn(
                    "download.failed",
                    {"jobId": job_id, "code": ProtocolErrorCode.INTERNAL_ERROR, "message": str(exc)}
                )
            raise WorkerProtocolError(
                ProtocolErrorCode.INTERNAL_ERROR,
                f"Download failed unexpectedly: {exc}",
                details={"jobId": job_id}
            )

        finally:
            with self._lock:
                self._cancellations.pop(job_id, None)
                self._last_progress_emit.pop(job_id, None)
                self._current_filenames.pop(job_id, None)

