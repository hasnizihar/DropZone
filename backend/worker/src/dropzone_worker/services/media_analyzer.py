import time
import logging
from typing import Dict, Any
from .url_validator import validate_url
from .metadata_normalizer import normalize_metadata
from .format_normalizer import normalize_formats
from ..engines.ytdlp_engine import YtDlpEngine

logger = logging.getLogger("dropzone_worker")

class MediaAnalyzerService:
    def __init__(self, engine: YtDlpEngine = None):
        self.engine = engine or YtDlpEngine()

    def analyze(self, raw_url: str) -> Dict[str, Any]:
        """
        Validates URL, extracts metadata using yt-dlp, and returns normalized metadata and formats.
        """
        t0 = time.time()
        # 1. Security & Scheme validation
        valid_url = validate_url(raw_url)
        logger.info(f"Initiating extraction for validated URL: {valid_url}")

        # 2. yt-dlp extraction (download=False)
        raw_info = self.engine.extract_info(valid_url)

        # 3. Normalization
        metadata = normalize_metadata(raw_info, valid_url)
        formats = normalize_formats(raw_info)
        duration_ms = int((time.time() - t0) * 1000)

        logger.info(
            f"Extraction completed in {duration_ms}ms: '{metadata['title']}' "
            f"({len(formats)} formats found via {metadata['platform']})"
        )

        return {
            "success": True,
            "metadata": metadata,
            "formats": formats,
            "extractor": {
                "name": metadata["platform"],
                "key": metadata["extractor"],
            },
            "analysisDurationMs": duration_ms,
        }
