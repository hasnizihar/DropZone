import os
import re
import logging
from urllib.parse import urlparse, unquote
from typing import Dict, Any, List, Optional

from .url_validator import validate_url
from .direct_http_service import DirectHttpService, IMAGE_EXTENSIONS, sanitize_filename
from ..protocol.errors import WorkerProtocolError, ProtocolErrorCode

logger = logging.getLogger("dropzone_worker")

class GalleryService:
    def __init__(self, http_service: Optional[DirectHttpService] = None):
        self.http_service = http_service or DirectHttpService()

    def is_image_url(self, url: str) -> bool:
        """Checks if URL path has a common image extension."""
        try:
            parsed = urlparse(url)
            ext = os.path.splitext(parsed.path.lower())[1]
            return ext in IMAGE_EXTENSIONS
        except Exception:
            return False

    def is_gallery_supported(self, url: str) -> bool:
        """Checks if gallery-dl has an extractor registered for this URL."""
        try:
            from gallery_dl import extractor
            return extractor.find(url) is not None
        except Exception:
            return False

    def extract_gallery_or_image(
        self,
        url: str,
        max_items: int = 50,
        check_dns: bool = True
    ) -> Dict[str, Any]:
        """
        Extracts image assets from a gallery URL using gallery-dl,
        or inspects a single direct image URL.
        Enforces bounded item count (max_items) and SSRF validation.
        """
        validated_url = validate_url(url, check_dns=check_dns)

        # 1. Check if direct image URL
        if self.is_image_url(validated_url):
            try:
                inspect_info = self.http_service.inspect_url(validated_url, check_dns=check_dns)
                if inspect_info.get("category") == "image":
                    filename = inspect_info.get("filename") or "image.jpg"
                    return {
                        "url": validated_url,
                        "title": filename,
                        "source": urlparse(validated_url).netloc,
                        "downloadType": "image",
                        "isGallery": False,
                        "assetCount": 1,
                        "assets": [
                            {
                                "id": "asset_0",
                                "index": 0,
                                "url": validated_url,
                                "filename": filename,
                                "thumbnail": validated_url,
                                "fileSizeBytes": inspect_info.get("fileSizeBytes"),
                                "mimeType": inspect_info.get("mimeType"),
                                "selected": True,
                            }
                        ],
                    }
            except Exception as exc:
                logger.debug(f"Direct image inspect fallback: {exc}")

        # 2. Check gallery-dl extractor
        try:
            from gallery_dl import extractor
            from gallery_dl.extractor.message import Message
            from gallery_dl.exception import StopExtraction, NoExtractorError
        except ImportError:
            raise WorkerProtocolError(
                ProtocolErrorCode.INTERNAL_ERROR,
                "gallery-dl package is not installed or unavailable."
            )

        ext = extractor.find(validated_url)
        if not ext:
            # Fall back to inspecting via direct HTTP service
            direct_res = self.http_service.inspect_url(validated_url, check_dns=check_dns)
            if direct_res.get("category") == "image":
                filename = direct_res.get("filename") or "image.jpg"
                return {
                    "url": validated_url,
                    "title": filename,
                    "source": urlparse(validated_url).netloc,
                    "downloadType": "image",
                    "isGallery": False,
                    "assetCount": 1,
                    "assets": [
                        {
                            "id": "asset_0",
                            "index": 0,
                            "url": validated_url,
                            "filename": filename,
                            "thumbnail": validated_url,
                            "fileSizeBytes": direct_res.get("fileSizeBytes"),
                            "mimeType": direct_res.get("mimeType"),
                            "selected": True,
                        }
                    ],
                }
            raise WorkerProtocolError(
                ProtocolErrorCode.UNSUPPORTED_URL,
                f"No image gallery extractor found for URL '{url}'."
            )

        # 3. Extract items from gallery-dl
        assets: List[Dict[str, Any]] = []
        gallery_title = getattr(ext, "category", "Gallery")
        source_name = getattr(ext, "category", urlparse(validated_url).netloc)

        try:
            for msg in ext.items():
                if len(assets) >= max_items:
                    break

                # Message.Directory (category info)
                if msg[0] == Message.Directory and len(msg) > 1 and isinstance(msg[1], dict):
                    gallery_title = msg[1].get("gallery_title") or msg[1].get("title") or gallery_title

                # Message.Url (individual media asset)
                elif msg[0] == Message.Url and len(msg) > 1:
                    item_url = msg[1]
                    meta = msg[2] if len(msg) > 2 and isinstance(msg[2], dict) else {}

                    fname = meta.get("filename") or os.path.basename(urlparse(item_url).path)
                    if not fname or "." not in fname:
                        fname = f"asset_{len(assets) + 1}.jpg"

                    assets.append(
                        {
                            "id": f"asset_{len(assets)}",
                            "index": len(assets),
                            "url": item_url,
                            "filename": sanitize_filename(fname),
                            "thumbnail": meta.get("thumbnail") or item_url,
                            "fileSizeBytes": meta.get("filesize"),
                            "width": meta.get("width"),
                            "height": meta.get("height"),
                            "selected": True,
                        }
                    )
        except StopExtraction:
            pass
        except Exception as exc:
            logger.warning(f"Error while extracting gallery items: {exc}")
            if not assets:
                raise WorkerProtocolError(
                    ProtocolErrorCode.EXTRACTOR_ERROR,
                    f"Gallery extraction failed: {exc}"
                )

        if not assets:
            raise WorkerProtocolError(
                ProtocolErrorCode.EXTRACTOR_ERROR,
                f"No downloadable image assets found in gallery '{url}'."
            )

        return {
            "url": validated_url,
            "title": gallery_title,
            "source": source_name,
            "downloadType": "gallery",
            "isGallery": True,
            "assetCount": len(assets),
            "assets": assets,
        }
