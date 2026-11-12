import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional, Callable
from urllib.parse import urlparse

from ..protocol.models import (
    ProtocolMessage,
    create_response,
    create_error,
    create_event,
    PROTOCOL_VERSION,
)
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode
from ..__init__ import __version__
from .health import WorkerHealthMonitor
from .lifecycle import WorkerLifecycle
from ..services.url_validator import validate_url
from ..services.media_analyzer import MediaAnalyzerService
from ..services.download_service import DownloadService
from ..services.direct_http_service import DirectHttpService
from ..services.direct_stream_engine import DirectStreamEngine
from ..services.gallery_service import GalleryService
from ..services.playlist_service import PlaylistService
from ..services.ffmpeg_service import FFmpegService

logger = logging.getLogger("dropzone_worker")

class CommandDispatcher:
    def __init__(
        self,
        health: WorkerHealthMonitor,
        lifecycle: WorkerLifecycle,
        analyzer: Optional[MediaAnalyzerService] = None,
        download_service: Optional[DownloadService] = None,
        http_service: Optional[DirectHttpService] = None,
        direct_stream_engine: Optional[DirectStreamEngine] = None,
        gallery_service: Optional[GalleryService] = None,
        playlist_service: Optional[PlaylistService] = None,
        ffmpeg_service: Optional[FFmpegService] = None,
        write_message_fn: Optional[Callable[[ProtocolMessage], None]] = None,
        max_workers: int = 4,
    ):
        self.health = health
        self.lifecycle = lifecycle
        self.analyzer = analyzer or MediaAnalyzerService()
        self.write_message_fn = write_message_fn
        self.download_service = download_service or DownloadService(write_event_fn=self._write_event)
        self.http_service = http_service or DirectHttpService()
        self.direct_stream_engine = direct_stream_engine or DirectStreamEngine(
            write_event_fn=self._write_event,
            http_service=self.http_service,
        )
        self.gallery_service = gallery_service or GalleryService(http_service=self.http_service)
        self.playlist_service = playlist_service or PlaylistService()
        self.ffmpeg_service = ffmpeg_service or FFmpegService(write_event_fn=self._write_event)
        self.executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="worker_task")

        self._handlers = {
            "hello": self._handle_hello,
            "ping": self._handle_ping,
            "get_status": self._handle_get_status,
            "shutdown": self._handle_shutdown,
            "analyze_url": self._handle_analyze_url,
            "inspect_direct_url": self._handle_inspect_direct_url,
            "inspect_gallery": self._handle_inspect_gallery,
            "inspect_playlist": self._handle_inspect_playlist,
            "inspect_batch": self._handle_inspect_batch,
            "start_download": self._handle_start_download,
            "cancel_download": self._handle_cancel_download,
            "pause_download": self._handle_pause_download,
            "get_ffmpeg_info": self._handle_get_ffmpeg_info,
            "postprocess_media": self._handle_postprocess_media,
            "cancel_postprocess": self._handle_cancel_postprocess,
        }

    def _write_event(self, event_name: str, payload: Dict[str, Any]):
        self._safe_write(create_event(event_name, payload))

    def dispatch(self, request: ProtocolMessage) -> Optional[ProtocolMessage]:
        self.health.record_request()
        cmd = request.command.lower()

        handler = self._handlers.get(cmd)
        if not handler:
            self.health.record_error()
            raise WorkerProtocolError(
                ProtocolErrorCode.UNKNOWN_COMMAND,
                f"Command '{request.command}' is not supported by worker"
            )

        if cmd in ("analyze_url", "inspect_gallery", "inspect_direct_url", "inspect_playlist") and self.write_message_fn:
            self._dispatch_async_analyze(request)
            return None

        if cmd == "start_download" and self.write_message_fn:
            self._dispatch_async_download(request)
            return None

        if cmd == "postprocess_media" and self.write_message_fn:
            self._dispatch_async_postprocess(request)
            return None

        # Synchronous dispatch
        payload = handler(request.payload)
        return create_response(request.id, request.command, payload)

    def _analyze_unified(self, url: str) -> Dict[str, Any]:
        """Unified inspection trying direct image, gallery, playlist, yt-dlp media, or direct file."""
        validate_url(url)

        # 1. Direct image check
        if self.gallery_service.is_image_url(url):
            try:
                res = self.gallery_service.extract_gallery_or_image(url)
                res["downloadType"] = "image"
                return res
            except Exception:
                pass

        # 2. Supported gallery site check
        if self.gallery_service.is_gallery_supported(url):
            try:
                res = self.gallery_service.extract_gallery_or_image(url)
                res["downloadType"] = "gallery"
                return res
            except Exception:
                pass

        # 3. Playlist check
        if self.playlist_service.is_playlist_url(url):
            try:
                res = self.playlist_service.extract_playlist(url)
                res["downloadType"] = "playlist"
                return res
            except Exception:
                pass

        # 4. Media analysis with yt-dlp
        media_error = None
        try:
            res = self.analyzer.analyze(url)
            res["downloadType"] = "media"
            return res
        except Exception as exc:
            media_error = exc

        # 4. Direct HTTP fallback (e.g., zip, pdf, exe, iso, direct stream)
        try:
            direct_res = self.http_service.inspect_url(url)
            if direct_res.get("category") == "image":
                img_res = self.gallery_service.extract_gallery_or_image(url)
                img_res["downloadType"] = "image"
                return img_res

            if not direct_res.get("isWebpage"):
                return {
                    "url": url,
                    "title": direct_res["filename"],
                    "source": urlparse(url).netloc,
                    "downloadType": "file",
                    "fileInfo": direct_res,
                    "metadata": {
                        "id": "direct_file",
                        "title": direct_res["filename"],
                        "extractor": "direct-http",
                        "extractorKey": "DirectHttp",
                    },
                    "formats": [],
                }
        except Exception:
            pass

        # If everything failed, raise original media error or unsupported error
        if media_error:
            raise media_error

        raise WorkerProtocolError(
            ProtocolErrorCode.UNSUPPORTED_URL,
            f"No downloadable media, gallery, or direct file found at '{url}'."
        )

    def _dispatch_async_analyze(self, request: ProtocolMessage):
        url = request.payload.get("url")
        cmd = request.command.lower()

        def _worker_task():
            self._safe_write(
                create_event("analysis.started", {"url": url, "requestId": request.id})
            )

            try:
                if cmd == "inspect_direct_url":
                    result = self.http_service.inspect_url(url)
                    result["downloadType"] = "file"
                elif cmd == "inspect_gallery":
                    result = self.gallery_service.extract_gallery_or_image(url)
                elif cmd == "inspect_playlist":
                    result = self.playlist_service.extract_playlist(
                        url,
                        max_entries=request.payload.get("maxEntries"),
                    )
                    result["downloadType"] = "playlist"
                else:
                    result = self._analyze_unified(url)

                self._safe_write(
                    create_response(request.id, request.command, result)
                )
                self._safe_write(
                    create_event(
                        "analysis.completed",
                        {
                            "url": url,
                            "requestId": request.id,
                            "downloadType": result.get("downloadType", "media"),
                            "title": result.get("title") or (result.get("metadata") or {}).get("title"),
                        },
                    )
                )
            except WorkerProtocolError as err:
                self.health.record_error()
                self._safe_write(
                    create_error(
                        request.id,
                        err.code,
                        err.message,
                        err.details,
                        command=request.command,
                    )
                )
                self._safe_write(
                    create_event(
                        "analysis.failed",
                        {"url": url, "requestId": request.id, "error": err.message, "code": err.code},
                    )
                )
            except Exception as unhandled_err:
                self.health.record_error()
                logger.error(f"Unexpected error analyzing URL '{url}': {unhandled_err}", exc_info=True)
                self._safe_write(
                    create_error(
                        request.id,
                        code=ProtocolErrorCode.INTERNAL_ERROR,
                        message=f"Analysis failed: {unhandled_err}",
                        command=request.command,
                    )
                )
                self._safe_write(
                    create_event(
                        "analysis.failed",
                        {"url": url, "requestId": request.id, "error": str(unhandled_err), "code": ProtocolErrorCode.INTERNAL_ERROR},
                    )
                )

        self.executor.submit(_worker_task)

    def _dispatch_async_download(self, request: ProtocolMessage):
        payload = request.payload or {}
        job_id = payload.get("jobId")
        url = payload.get("url")
        target_dir = payload.get("targetDirectory")
        format_id = payload.get("formatId")
        custom_filename = payload.get("customFilename")
        extract_audio = bool(payload.get("extractAudio", False))
        audio_format = payload.get("audioFormat", "mp3")
        engine = payload.get("engine", "yt-dlp")

        def _download_task():
            try:
                if engine in ("direct-http", "image"):
                    res = self.direct_stream_engine.execute_download(
                        job_id=job_id,
                        url=url,
                        target_directory=target_dir,
                        custom_filename=custom_filename,
                    )
                else:
                    res = self.download_service.execute_download(
                        job_id=job_id,
                        url=url,
                        target_directory=target_dir,
                        format_id=format_id,
                        custom_filename=custom_filename,
                        extract_audio=extract_audio,
                        audio_format=audio_format,
                    )
                self._safe_write(create_response(request.id, request.command, res))
            except WorkerProtocolError as err:
                self.health.record_error()
                self._safe_write(
                    create_error(request.id, err.code, err.message, err.details, command=request.command)
                )
            except Exception as exc:
                self.health.record_error()
                logger.error(f"Unexpected error in async download for {job_id}: {exc}", exc_info=True)
                self._safe_write(
                    create_error(request.id, ProtocolErrorCode.INTERNAL_ERROR, str(exc), command=request.command)
                )

        self.executor.submit(_download_task)

    def _dispatch_async_postprocess(self, request: ProtocolMessage):
        payload = request.payload or {}
        job_id = payload.get("jobId")
        input_path = payload.get("inputPath")
        action = payload.get("action", "extract_audio")
        target_dir = payload.get("targetDirectory")
        audio_format = payload.get("audioFormat", "mp3")
        audio_bitrate = payload.get("audioBitrate", "192k")
        remux_container = payload.get("remuxContainer", "mp4")
        secondary_input = payload.get("secondaryInputPath")
        custom_filename = payload.get("customFilename")
        embed_metadata = bool(payload.get("embedMetadata", True))
        metadata = payload.get("metadata")
        thumbnail_path = payload.get("thumbnailPath")
        preserve_source = bool(payload.get("preserveSource", False))

        def _postprocess_task():
            try:
                res = self.ffmpeg_service.execute_postprocess(
                    job_id=job_id,
                    input_path=input_path,
                    action=action,
                    target_directory=target_dir,
                    audio_format=audio_format,
                    audio_bitrate=audio_bitrate,
                    remux_container=remux_container,
                    secondary_input_path=secondary_input,
                    custom_filename=custom_filename,
                    embed_metadata=embed_metadata,
                    metadata=metadata,
                    thumbnail_path=thumbnail_path,
                    preserve_source=preserve_source,
                )
                self._safe_write(create_response(request.id, request.command, res))
            except WorkerProtocolError as err:
                self.health.record_error()
                self._safe_write(
                    create_error(request.id, err.code, err.message, err.details, command=request.command)
                )
            except Exception as exc:
                self.health.record_error()
                logger.error(f"Unexpected error in async postprocess for {job_id}: {exc}", exc_info=True)
                self._safe_write(
                    create_error(request.id, ProtocolErrorCode.INTERNAL_ERROR, str(exc), command=request.command)
                )

        self.executor.submit(_postprocess_task)

    def _safe_write(self, msg: ProtocolMessage):
        if self.write_message_fn:
            try:
                self.write_message_fn(msg)
            except Exception as exc:
                logger.error(f"Failed to write async message: {exc}")

    def _handle_hello(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        client_name = payload.get("client", "Unknown Client")
        client_version = payload.get("version", "1.0.0")
        logger.info(f"Received handshake from client: {client_name} (v{client_version})")

        return {
            "workerVersion": __version__,
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": [
                "ping",
                "hello",
                "get_status",
                "shutdown",
                "analyze_url",
                "inspect_direct_url",
                "inspect_gallery",
                "inspect_playlist",
                "inspect_batch",
                "start_download",
                "cancel_download",
                "pause_download",
                "get_ffmpeg_info",
                "postprocess_media",
                "cancel_postprocess",
            ],
            "pid": self.health.get_status_payload()["pid"],
            "ytdlpVersion": self.analyzer.engine.version,
            "ffmpeg": self.ffmpeg_service.get_status(),
        }

    def _handle_ping(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        self.health.record_heartbeat()
        return {
            "pong": True,
            "uptimeSeconds": self.health.get_uptime_seconds(),
        }

    def _handle_get_status(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        status_info = self.health.get_status_payload()
        status_info["ytdlpVersion"] = self.analyzer.engine.version
        status_info["ffmpeg"] = self.ffmpeg_service.get_status()
        for cap in [
            "analyze_url",
            "inspect_direct_url",
            "inspect_gallery",
            "inspect_playlist",
            "inspect_batch",
            "start_download",
            "cancel_download",
            "pause_download",
            "get_ffmpeg_info",
            "postprocess_media",
            "cancel_postprocess",
        ]:
            if cap not in status_info["capabilities"]:
                status_info["capabilities"].append(cap)
        return status_info

    def _handle_shutdown(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("Graceful shutdown requested via protocol.")
        self.executor.shutdown(wait=False, cancel_futures=True)
        self.lifecycle.trigger_shutdown()
        return {
            "shuttingDown": True,
            "reason": payload.get("reason", "requested_by_host"),
        }

    def _handle_analyze_url(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = payload.get("url")
        return self._analyze_unified(url)

    def _handle_inspect_direct_url(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = payload.get("url")
        return self.http_service.inspect_url(url)

    def _handle_inspect_gallery(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = payload.get("url")
        return self.gallery_service.extract_gallery_or_image(url)

    def _handle_inspect_playlist(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = payload.get("url")
        if not url:
            raise WorkerProtocolError(ProtocolErrorCode.INVALID_REQUEST, "Missing 'url' parameter")
        return self.playlist_service.extract_playlist(
            url,
            max_entries=payload.get("maxEntries"),
        )

    def _handle_inspect_batch(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        urls = payload.get("urls") or []
        if not isinstance(urls, list):
            raise WorkerProtocolError(ProtocolErrorCode.INVALID_REQUEST, "'urls' must be a list of strings")

        results = []
        for idx, u in enumerate(urls):
            u_str = str(u).strip()
            if not u_str:
                continue
            item_id = f"batch_{idx}_{abs(hash(u_str)) % 10000}"
            try:
                res = self._analyze_unified(u_str)
                download_type = res.get("downloadType", "media")
                title = res.get("title") or (res.get("metadata", {}).get("title") if isinstance(res.get("metadata"), dict) else None) or u_str.split("/")[-1]
                source = res.get("source") or (res.get("extractor", {}).get("name") if isinstance(res.get("extractor"), dict) else None) or "Web"
                file_size = None
                if res.get("fileInfo") and isinstance(res["fileInfo"], dict):
                    file_size = res["fileInfo"].get("fileSizeBytes")
                elif res.get("formats") and isinstance(res["formats"], list) and len(res["formats"]) > 0:
                    file_size = res["formats"][0].get("fileSizeBytes")

                duration = None
                thumb = None
                if isinstance(res.get("metadata"), dict):
                    duration = res["metadata"].get("durationSeconds")
                    thumb = res["metadata"].get("thumbnailUrl")
                if not thumb and res.get("assets") and isinstance(res["assets"], list) and len(res["assets"]) > 0:
                    thumb = res["assets"][0].get("thumbnail")

                results.append({
                    "id": item_id,
                    "url": u_str,
                    "status": "ready",
                    "downloadType": download_type,
                    "title": title,
                    "source": source,
                    "fileSizeBytes": file_size,
                    "duration": duration,
                    "thumbnail": thumb,
                    "selected": True,
                    "analysisResult": res,
                })
            except Exception as exc:
                results.append({
                    "id": item_id,
                    "url": u_str,
                    "status": "failed",
                    "error": str(exc),
                    "selected": False,
                })

        return {
            "success": True,
            "results": results,
            "errorsCount": len([r for r in results if r["status"] != "ready"]),
        }

    def _handle_start_download(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        engine = payload.get("engine", "yt-dlp")
        if engine in ("direct-http", "image"):
            return self.direct_stream_engine.execute_download(
                job_id=payload.get("jobId"),
                url=payload.get("url"),
                target_directory=payload.get("targetDirectory"),
                custom_filename=payload.get("customFilename"),
            )
        return self.download_service.execute_download(
            job_id=payload.get("jobId"),
            url=payload.get("url"),
            target_directory=payload.get("targetDirectory"),
            format_id=payload.get("formatId"),
            custom_filename=payload.get("customFilename"),
            extract_audio=bool(payload.get("extractAudio", False)),
            audio_format=payload.get("audioFormat", "mp3"),
        )

    def _handle_cancel_download(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        job_id = payload.get("jobId")
        if not job_id:
            raise WorkerProtocolError(ProtocolErrorCode.VALIDATION_ERROR, "Missing 'jobId' in cancel_download request")
        cancelled = (
            self.direct_stream_engine.cancel_download(job_id)
            or self.download_service.cancel_download(job_id)
            or self.ffmpeg_service.cancel_postprocess(job_id)
        )
        return {"jobId": job_id, "cancelled": cancelled, "success": cancelled}

    def _handle_pause_download(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        job_id = payload.get("jobId")
        if not job_id:
            raise WorkerProtocolError(ProtocolErrorCode.VALIDATION_ERROR, "Missing 'jobId' in pause_download request")
        paused = self.direct_stream_engine.pause_download(job_id) or self.download_service.pause_download(job_id)
        return {"jobId": job_id, "paused": paused, "success": paused}

    def _handle_get_ffmpeg_info(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.ffmpeg_service.get_status()

    def _handle_postprocess_media(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        job_id = payload.get("jobId")
        input_path = payload.get("inputPath")
        if not job_id or not input_path:
            raise WorkerProtocolError(
                ProtocolErrorCode.VALIDATION_ERROR,
                "Missing 'jobId' or 'inputPath' in postprocess_media request"
            )
        return self.ffmpeg_service.execute_postprocess(
            job_id=job_id,
            input_path=input_path,
            action=payload.get("action", "extract_audio"),
            target_directory=payload.get("targetDirectory"),
            audio_format=payload.get("audioFormat", "mp3"),
            audio_bitrate=payload.get("audioBitrate", "192k"),
            remux_container=payload.get("remuxContainer", "mp4"),
            secondary_input_path=payload.get("secondaryInputPath"),
            custom_filename=payload.get("customFilename"),
            embed_metadata=bool(payload.get("embedMetadata", True)),
            metadata=payload.get("metadata"),
            thumbnail_path=payload.get("thumbnailPath"),
            preserve_source=bool(payload.get("preserveSource", False)),
        )

    def _handle_cancel_postprocess(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        job_id = payload.get("jobId")
        if not job_id:
            raise WorkerProtocolError(ProtocolErrorCode.VALIDATION_ERROR, "Missing 'jobId' in cancel_postprocess request")
        cancelled = self.ffmpeg_service.cancel_postprocess(job_id)
        return {"jobId": job_id, "cancelled": cancelled, "success": cancelled}
