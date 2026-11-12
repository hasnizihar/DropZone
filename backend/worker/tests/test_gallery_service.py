import pytest
from unittest.mock import MagicMock, patch
from dropzone_worker.services.gallery_service import GalleryService
from dropzone_worker.protocol.errors import WorkerProtocolError, ProtocolErrorCode

def test_is_image_url():
    svc = GalleryService()
    assert svc.is_image_url("https://example.com/photo.jpg") is True
    assert svc.is_image_url("https://example.com/image.png?size=large") is True
    assert svc.is_image_url("https://example.com/vector.svg") is True
    assert svc.is_image_url("https://example.com/document.pdf") is False
    assert svc.is_image_url("https://example.com/video.mp4") is False

def test_extract_direct_image_metadata():
    mock_http = MagicMock()
    mock_http.inspect_url.return_value = {
        "filename": "sunset.jpg",
        "category": "image",
        "fileSizeBytes": 512000,
        "mimeType": "image/jpeg",
    }

    svc = GalleryService(http_service=mock_http)
    res = svc.extract_gallery_or_image("https://example.com/sunset.jpg", check_dns=False)

    assert res["downloadType"] == "image"
    assert res["isGallery"] is False
    assert res["assetCount"] == 1
    assert res["assets"][0]["filename"] == "sunset.jpg"
    assert res["assets"][0]["fileSizeBytes"] == 512000

def test_extract_gallery_items_mocked():
    from gallery_dl.extractor.message import Message

    mock_ext = MagicMock()
    mock_ext.category = "mock_gallery"
    mock_ext.items.return_value = [
        (Message.Directory, {"gallery_title": "Summer Holiday 2026"}),
        (Message.Url, "https://cdn.example.com/img1.jpg", {"filename": "img1.jpg", "filesize": 102400, "thumbnail": "https://cdn.example.com/thumb1.jpg"}),
        (Message.Url, "https://cdn.example.com/img2.jpg", {"filename": "img2.jpg", "filesize": 204800, "thumbnail": "https://cdn.example.com/thumb2.jpg"}),
        (Message.Url, "https://cdn.example.com/img3.jpg", {"filename": "img3.jpg", "filesize": 307200, "thumbnail": "https://cdn.example.com/thumb3.jpg"}),
    ]

    with patch("gallery_dl.extractor.find", return_value=mock_ext):
        svc = GalleryService()
        res = svc.extract_gallery_or_image("https://example.com/gallery/123", max_items=2, check_dns=False)

        assert res["downloadType"] == "gallery"
        assert res["isGallery"] is True
        assert res["title"] == "Summer Holiday 2026"
        assert res["assetCount"] == 2  # Bounded to max_items=2
        assert len(res["assets"]) == 2
        assert res["assets"][0]["filename"] == "img1.jpg"
        assert res["assets"][1]["filename"] == "img2.jpg"

def test_extract_gallery_unsupported_url():
    with patch("gallery_dl.extractor.find", return_value=None):
        mock_http = MagicMock()
        mock_http.inspect_url.return_value = {
            "category": "file",
            "isWebpage": True,
        }
        svc = GalleryService(http_service=mock_http)
        with pytest.raises(WorkerProtocolError) as exc_info:
            svc.extract_gallery_or_image("https://unsupported.com/gallery", check_dns=False)
        assert exc_info.value.code == ProtocolErrorCode.UNSUPPORTED_URL

