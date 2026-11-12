import os
import re
import sys
import json
import time
import shutil
import logging
import threading
import subprocess
from typing import Dict, Any, Optional, List, Callable
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode

logger = logging.getLogger("dropzone_worker")

# Supported Audio Codecs & Formats
AUDIO_FORMAT_SPECS: Dict[str, Dict[str, Any]] = {
    "mp3": {
        "codec": "libmp3lame",
        "ext": ".mp3",
        "mime": "audio/mpeg",
        "default_bitrate": "192k",
        "allowed_bitrates": ["128k", "192k", "256k", "320k"],
    },
    "m4a": {
        "codec": "aac",
        "ext": ".m4a",
        "mime": "audio/mp4",
        "default_bitrate": "192k",
        "allowed_bitrates": ["128k", "192k", "256k"],
    },
    "wav": {
        "codec": "pcm_s16le",
        "ext": ".wav",
        "mime": "audio/wav",
        "default_bitrate": None,
        "allowed_bitrates": [],
    },
    "flac": {
        "codec": "flac",
        "ext": ".flac",
        "mime": "audio/flac",
        "default_bitrate": None,
        "allowed_bitrates": [],
    },
    "opus": {
        "codec": "libopus",
        "ext": ".opus",
        "mime": "audio/opus",
        "default_bitrate": "128k",
        "allowed_bitrates": ["96k", "128k", "160k", "192k"],
    },
}

# Supported Video Remux Containers
CONTAINER_SPECS: Dict[str, Dict[str, Any]] = {
    "mp4": {"ext": ".mp4", "mime": "video/mp4", "default_audio_codec": "aac"},
    "mkv": {"ext": ".mkv", "mime": "video/x-matroska", "default_audio_codec": "copy"},
    "webm": {"ext": ".webm", "mime": "video/webm", "default_audio_codec": "libopus"},
    "mov": {"ext": ".mov", "mime": "video/quicktime", "default_audio_codec": "aac"},
}


def sanitize_filename(name: Optional[str]) -> str:
    """Sanitizes filename for Windows filesystem, stripping illegal characters."""
    if not name or not isinstance(name, str):
        return "processed_media"
    clean = re.sub(r'[\\/*?:"<>|\x00-\x1f]', "_", name).strip()
    clean = clean.rstrip(". ")
    if not clean:
        clean = "processed_media"
    return clean[:180]


def parse_time_to_seconds(time_str: str) -> float:
    """Parses FFmpeg time format (HH:MM:SS.micro or seconds) to float seconds."""
    try:
        if ":" in time_str:
            parts = time_str.strip().split(":")
            if len(parts) == 3:
                return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
            elif len(parts) == 2:
                return float(parts[0]) * 60 + float(parts[1])
        return float(time_str)
    except Exception:
        return 0.0


class FFmpegService:
    def __init__(self, write_event_fn: Optional[Callable[[str, Dict[str, Any]], None]] = None):
        self.write_event_fn = write_event_fn
        self._active_processes: Dict[str, subprocess.Popen] = {}
        self._cancellations: Dict[str, threading.Event] = {}
        self._lock = threading.Lock()

        self._ffmpeg_path = self._locate_executable("ffmpeg")
        self._ffprobe_path = self._locate_executable("ffprobe")
        self._version_info: Optional[str] = None
        self._init_version()

    def _locate_executable(self, name: str) -> Optional[str]:
        """Locates ffmpeg/ffprobe on system PATH or fallback directories."""
        # 1. Check environment variable override
        env_var = f"DROPZONE_{name.upper()}_PATH"
        override = os.environ.get(env_var)
        if override and os.path.isfile(override):
            return os.path.abspath(override)

        # 2. Check system PATH via shutil.which
        located = shutil.which(name)
        if located:
            return os.path.abspath(located)

        # 3. Check common Windows paths (Winget, Scoop, Chocolatey)
        if sys.platform == "win32":
            user_profile = os.environ.get("USERPROFILE", "")
            local_appdata = os.environ.get("LOCALAPPDATA", "")
            common_candidates = [
                os.path.join(local_appdata, "Microsoft", "WinGet", "Links", f"{name}.exe"),
                os.path.join("C:\\", "ProgramData", "chocolatey", "bin", f"{name}.exe"),
                os.path.join(user_profile, "scoop", "shims", f"{name}.exe"),
            ]
            for cand in common_candidates:
                if os.path.isfile(cand):
                    return cand

        return None

    def _init_version(self):
        if self._ffmpeg_path and os.path.isfile(self._ffmpeg_path):
            try:
                res = subprocess.run(
                    [self._ffmpeg_path, "-version"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=5,
                )
                first_line = res.stdout.splitlines()[0] if res.stdout else ""
                match = re.search(r"ffmpeg version (\S+)", first_line, re.IGNORECASE)
                if match:
                    self._version_info = match.group(1)
                else:
                    self._version_info = first_line[:50]
            except Exception as e:
                logger.warning(f"Could not read FFmpeg version: {e}")
                self._version_info = "unknown"

    def get_status(self) -> Dict[str, Any]:
        """Returns discovery status, version, and supported capabilities."""
        available = bool(self._ffmpeg_path and os.path.isfile(self._ffmpeg_path))
        probe_available = bool(self._ffprobe_path and os.path.isfile(self._ffprobe_path))
        return {
            "available": available,
            "version": self._version_info if available else None,
            "ffmpegPath": self._ffmpeg_path,
            "ffprobePath": self._ffprobe_path,
            "probeAvailable": probe_available,
            "supportedAudioFormats": list(AUDIO_FORMAT_SPECS.keys()),
            "supportedContainers": list(CONTAINER_SPECS.keys()),
        }

    def cancel_postprocess(self, job_id: str) -> bool:
        """Cancels an active postprocessing process for the specified job."""
        with self._lock:
            event = self._cancellations.get(job_id)
            if event:
                event.set()

            proc = self._active_processes.get(job_id)
            if not proc:
                return False

        logger.info(f"Terminating FFmpeg process for job: {job_id} (pid: {proc.pid})")
        try:
            # Graceful termination
            proc.terminate()
            # On Windows, kill process tree via psutil if available
            try:
                import psutil
                parent = psutil.Process(proc.pid)
                children = parent.children(recursive=True)
                for child in children:
                    child.terminate()
                _, alive = psutil.wait_procs(children, timeout=1.0)
                for child in alive:
                    child.kill()
                proc.wait(timeout=1.0)
            except Exception:
                pass

            if proc.poll() is None:
                proc.kill()
            return True
        except Exception as e:
            logger.warning(f"Error terminating FFmpeg process for {job_id}: {e}")
            return False

    def probe_file(self, file_path: str) -> Dict[str, Any]:
        """Probes a media file using ffprobe, returning stream and container metadata."""
        if not self._ffprobe_path:
            raise WorkerProtocolError(
                ProtocolErrorCode.FFPROBE_MISSING if hasattr(ProtocolErrorCode, "FFPROBE_MISSING") else "FFPROBE_MISSING",
                "FFprobe executable not found on host system."
            )

        if not os.path.isfile(file_path):
            raise WorkerProtocolError(
                ProtocolErrorCode.SOURCE_FILE_NOT_FOUND if hasattr(ProtocolErrorCode, "SOURCE_FILE_NOT_FOUND") else "SOURCE_FILE_NOT_FOUND",
                f"Media file to probe does not exist: {file_path}"
            )

        file_size = os.path.getsize(file_path)
        if file_size == 0:
            return {"valid": False, "error": "File is 0 bytes."}

        cmd = [
            self._ffprobe_path,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path,
        ]

        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=15)
            if res.returncode != 0:
                return {"valid": False, "error": f"FFprobe exited with code {res.returncode}: {res.stderr}"}

            data = json.loads(res.stdout)
            format_info = data.get("format", {})
            streams = data.get("streams", [])

            duration = float(format_info.get("duration") or 0.0)
            format_name = format_info.get("format_name", "")
            audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
            video_streams = [s for s in streams if s.get("codec_type") == "video"]

            return {
                "valid": len(streams) > 0,
                "filePath": file_path,
                "fileSize": file_size,
                "duration": duration,
                "formatName": format_name,
                "streamsCount": len(streams),
                "audioStreamsCount": len(audio_streams),
                "videoStreamsCount": len(video_streams),
                "audioCodecs": [s.get("codec_name") for s in audio_streams if s.get("codec_name")],
                "videoCodecs": [s.get("codec_name") for s in video_streams if s.get("codec_name")],
            }
        except Exception as e:
            logger.warning(f"FFprobe error probing '{file_path}': {e}")
            return {"valid": False, "error": str(e)}

    def execute_postprocess(
        self,
        job_id: str,
        input_path: str,
        action: str,  # "extract_audio" | "remux" | "merge"
        target_directory: str,
        audio_format: Optional[str] = "mp3",
        audio_bitrate: Optional[str] = "192k",
        remux_container: Optional[str] = "mp4",
        secondary_input_path: Optional[str] = None,  # For stream merging
        custom_filename: Optional[str] = None,
        embed_metadata: bool = True,
        metadata: Optional[Dict[str, Any]] = None,
        thumbnail_path: Optional[str] = None,
        preserve_source: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes FFmpeg post-processing in a robust subprocess with progress monitoring,
        verification, and atomic file commit.
        """
        if not self._ffmpeg_path:
            raise WorkerProtocolError(
                ProtocolErrorCode.ENGINE_UNAVAILABLE,
                "FFmpeg executable not found. Please install FFmpeg or set DROPZONE_FFMPEG_PATH."
            )

        if not os.path.isfile(input_path):
            raise WorkerProtocolError(
                ProtocolErrorCode.FILE_WRITE_ERROR,
                f"Source media file not found: {input_path}"
            )

        abs_target_dir = os.path.abspath(target_directory)
        os.makedirs(abs_target_dir, exist_ok=True)

        # 1. Determine destination filename and extension
        base_name = sanitize_filename(custom_filename) if custom_filename else os.path.splitext(os.path.basename(input_path))[0]

        if action == "extract_audio":
            norm_fmt = (audio_format or "mp3").lower()
            if norm_fmt not in AUDIO_FORMAT_SPECS:
                raise WorkerProtocolError(
                    ProtocolErrorCode.VALIDATION_ERROR,
                    f"Unsupported audio extraction format '{norm_fmt}'. Supported: {list(AUDIO_FORMAT_SPECS.keys())}"
                )
            fmt_spec = AUDIO_FORMAT_SPECS[norm_fmt]
            target_ext = fmt_spec["ext"]
            final_output_path = os.path.join(abs_target_dir, f"{base_name}{target_ext}")
        elif action in ("remux", "merge"):
            norm_container = (remux_container or "mp4").lower()
            if norm_container not in CONTAINER_SPECS:
                raise WorkerProtocolError(
                    ProtocolErrorCode.VALIDATION_ERROR,
                    f"Unsupported video container '{norm_container}'. Supported: {list(CONTAINER_SPECS.keys())}"
                )
            cont_spec = CONTAINER_SPECS[norm_container]
            target_ext = cont_spec["ext"]
            final_output_path = os.path.join(abs_target_dir, f"{base_name}{target_ext}")
        else:
            raise WorkerProtocolError(
                ProtocolErrorCode.VALIDATION_ERROR,
                f"Invalid postprocess action '{action}'. Must be 'extract_audio', 'remux', or 'merge'."
            )

        # 2. Prevent accidental overwrite if input is identical to final output
        if os.path.abspath(input_path).lower() == os.path.abspath(final_output_path).lower():
            final_output_path = os.path.join(abs_target_dir, f"{base_name}_processed{target_ext}")

        # 3. Safe temporary output path
        temp_output_path = f"{final_output_path}.tmp{target_ext}"
        if os.path.exists(temp_output_path):
            try:
                os.remove(temp_output_path)
            except Exception:
                pass

        # 4. Probe input duration for progress percentage computation
        source_probe = self.probe_file(input_path) if self._ffprobe_path else {}
        total_duration = float(source_probe.get("duration") or 0.0)

        # 5. Build secure FFmpeg argument array (never shell=True)
        cmd: List[str] = [
            self._ffmpeg_path,
            "-y",  # Overwrite temp file if needed
            "-nostats",
            "-progress", "pipe:1",
        ]

        # Add input(s)
        cmd.extend(["-i", input_path])
        if action == "merge" and secondary_input_path and os.path.isfile(secondary_input_path):
            cmd.extend(["-i", secondary_input_path])

        # Optional cover art / thumbnail input
        has_thumbnail = bool(thumbnail_path and os.path.isfile(thumbnail_path) and action == "extract_audio")
        if has_thumbnail:
            cmd.extend(["-i", thumbnail_path])

        # Action-specific arguments
        if action == "extract_audio":
            fmt_spec = AUDIO_FORMAT_SPECS[norm_fmt]
            cmd.extend(["-vn"])  # Disable video stream
            cmd.extend(["-c:a", fmt_spec["codec"]])
            bitrate = audio_bitrate or fmt_spec["default_bitrate"]
            if bitrate and bitrate in fmt_spec["allowed_bitrates"]:
                cmd.extend(["-b:a", bitrate])

            # Cover art embedding
            if has_thumbnail:
                cmd.extend(["-map", "0:a", "-map", "1:v", "-c:v", "copy"])
                if norm_fmt == "mp3":
                    cmd.extend(["-id3v2_version", "3", "-metadata:s:v", 'title="Album cover"', "-metadata:s:v", 'comment="Cover (front)"'])
                elif norm_fmt == "flac":
                    cmd.extend(["-metadata:s:v", 'title="Album cover"'])

        elif action == "remux":
            # Stream copy whenever possible to prevent quality loss
            cmd.extend(["-c", "copy"])

        elif action == "merge":
            # Merge video from input 0 and audio from input 1
            cmd.extend(["-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "copy"])

        # Metadata embedding if requested
        if embed_metadata and metadata:
            if metadata.get("title"):
                cmd.extend(["-metadata", f"title={metadata['title']}"])
            if metadata.get("uploader") or metadata.get("artist"):
                artist = metadata.get("uploader") or metadata.get("artist")
                cmd.extend(["-metadata", f"artist={artist}"])
            if metadata.get("album"):
                cmd.extend(["-metadata", f"album={metadata['album']}"])
            if metadata.get("date"):
                cmd.extend(["-metadata", f"date={metadata['date']}"])

        # Output target (temporary file first!)
        cmd.append(temp_output_path)

        # 6. Execute process
        cancel_event = threading.Event()
        with self._lock:
            self._cancellations[job_id] = cancel_event

        logger.info(f"Starting postprocess [{action}] for job {job_id} -> {temp_output_path}")
        if self.write_event_fn:
            self.write_event_fn("postprocess.started", {
                "jobId": job_id,
                "action": action,
                "inputPath": input_path,
                "targetPath": final_output_path,
            })

        proc = None
        last_emit_time = 0.0

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True,
            )
            with self._lock:
                self._active_processes[job_id] = proc

            # Read structured progress from stdout (pipe:1)
            for line in proc.stdout:
                if cancel_event.is_set():
                    self.cancel_postprocess(job_id)
                    raise WorkerProtocolError(
                        ProtocolErrorCode.DOWNLOAD_CANCELLED,
                        f"Postprocessing job {job_id} was cancelled by user.",
                        details={"jobId": job_id}
                    )

                line = line.strip()
                if not line or "=" not in line:
                    continue

                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip()

                if key == "out_time_ms":
                    try:
                        out_time_secs = int(value) / 1000000.0
                    except ValueError:
                        out_time_secs = 0.0
                    
                    progress = 0.0
                    if total_duration > 0:
                        progress = round((out_time_secs / total_duration) * 100, 1)
                        if progress > 99.0:
                            progress = 99.0  # Reserve 100% for post-verification

                    now = time.time()
                    if (now - last_emit_time) >= 0.25 and self.write_event_fn:
                        last_emit_time = now
                        self.write_event_fn("postprocess.progress", {
                            "jobId": job_id,
                            "progress": progress,
                            "stage": "processing",
                            "outTimeSeconds": out_time_secs,
                            "totalDuration": total_duration,
                        })

                elif key == "progress" and value == "end":
                    break

            proc.wait()

            if cancel_event.is_set() or proc.returncode == -15 or proc.returncode == 1:
                # Cancelled
                if os.path.exists(temp_output_path):
                    try:
                        os.remove(temp_output_path)
                    except Exception:
                        pass
                raise WorkerProtocolError(
                    ProtocolErrorCode.DOWNLOAD_CANCELLED,
                    f"Postprocessing for job {job_id} was cancelled.",
                    details={"jobId": job_id}
                )

            if proc.returncode != 0:
                stderr_output = proc.stderr.read() if proc.stderr else ""
                logger.error(f"FFmpeg failed with return code {proc.returncode}: {stderr_output[:300]}")
                # Clean temp output
                if os.path.exists(temp_output_path):
                    try:
                        os.remove(temp_output_path)
                    except Exception:
                        pass
                raise WorkerProtocolError(
                    ProtocolErrorCode.INTERNAL_ERROR,
                    f"FFmpeg postprocessing failed with exit code {proc.returncode}: {stderr_output[:200]}",
                    details={"jobId": job_id, "stderr": stderr_output[:500]}
                )

            # 7. Verification stage with FFprobe
            if self.write_event_fn:
                self.write_event_fn("postprocess.progress", {
                    "jobId": job_id,
                    "progress": 99.0,
                    "stage": "verifying",
                })

            if not os.path.isfile(temp_output_path) or os.path.getsize(temp_output_path) == 0:
                raise WorkerProtocolError(
                    ProtocolErrorCode.INTERNAL_ERROR,
                    f"FFmpeg exited 0 but generated empty temporary output file: {temp_output_path}"
                )

            if self._ffprobe_path:
                verify_result = self.probe_file(temp_output_path)
                if not verify_result.get("valid"):
                    if os.path.exists(temp_output_path):
                        try:
                            os.remove(temp_output_path)
                        except Exception:
                            pass
                    raise WorkerProtocolError(
                        ProtocolErrorCode.INTERNAL_ERROR,
                        f"Postprocess output verification failed: {verify_result.get('error')}"
                    )
                final_duration = verify_result.get("duration", total_duration)
            else:
                final_duration = total_duration

            # 8. Atomic commit: rename temp file to final output path
            if os.path.exists(final_output_path):
                try:
                    os.remove(final_output_path)
                except Exception:
                    pass
            os.replace(temp_output_path, final_output_path)
            final_size = os.path.getsize(final_output_path)

            logger.info(f"Postprocessing job {job_id} completed successfully -> {final_output_path} ({final_size} bytes)")

            # 9. Clean up source file if requested and source != final output
            if not preserve_source and os.path.abspath(input_path).lower() != os.path.abspath(final_output_path).lower():
                try:
                    os.remove(input_path)
                    logger.info(f"Cleaned up intermediate source download: {input_path}")
                except Exception as e:
                    logger.warning(f"Could not remove intermediate source file '{input_path}': {e}")

            result_payload = {
                "success": True,
                "jobId": job_id,
                "outputPath": final_output_path,
                "totalBytes": final_size,
                "duration": final_duration,
                "action": action,
            }

            if self.write_event_fn:
                self.write_event_fn("postprocess.completed", result_payload)

            return result_payload

        except WorkerProtocolError as wpe:
            if self.write_event_fn:
                self.write_event_fn("postprocess.failed", {
                    "jobId": job_id,
                    "code": wpe.code,
                    "message": wpe.message,
                    "details": wpe.details,
                })
            raise

        except Exception as exc:
            if os.path.exists(temp_output_path):
                try:
                    os.remove(temp_output_path)
                except Exception:
                    pass
            logger.error(f"Unexpected error in postprocess job {job_id}: {exc}", exc_info=True)
            if self.write_event_fn:
                self.write_event_fn("postprocess.failed", {
                    "jobId": job_id,
                    "code": ProtocolErrorCode.INTERNAL_ERROR,
                    "message": str(exc),
                })
            raise WorkerProtocolError(
                ProtocolErrorCode.INTERNAL_ERROR,
                f"Postprocessing failed unexpectedly: {exc}",
                details={"jobId": job_id}
            )

        finally:
            with self._lock:
                self._cancellations.pop(job_id, None)
                self._active_processes.pop(job_id, None)
