"""
Behavioral tests for POST /api/gm/upload-image/ (Plan 27-01).

Tests validate:
  - Valid upload returns 200 with saved_path + original_size_bytes
  - Filename path-traversal attempts return 400
  - Unknown image_type returns 400
  - Malformed base64 returns 400
  - GET method returns 405
  - Logo type saves to correct directory (no converted_path)
"""
import base64
import unittest
from django.test import TestCase, Client


class UploadImageApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        # Valid base64 representing fake image bytes
        self.valid_b64 = base64.b64encode(b"fake image bytes").decode()

    # ------------------------------------------------------------------
    # Path traversal — must NOT be skipped (no disk writes)
    # ------------------------------------------------------------------

    def test_filename_with_slash_returns_400(self):
        """POST with filename containing '/' returns 400."""
        payload = {
            "filename": "../../etc/passwd",
            "content_base64": self.valid_b64,
            "image_type": "logo",
            "convert": False,
        }
        import json
        response = self.client.post(
            '/api/gm/upload-image/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)

    def test_filename_with_backslash_returns_400(self):
        """POST with filename containing '\\' returns 400."""
        import json
        payload = {
            "filename": "evil\\file.png",
            "content_base64": self.valid_b64,
            "image_type": "logo",
            "convert": False,
        }
        response = self.client.post(
            '/api/gm/upload-image/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)

    def test_filename_with_dotdot_returns_400(self):
        """POST with filename containing '..' returns 400."""
        import json
        payload = {
            "filename": "..dangerous.png",
            "content_base64": self.valid_b64,
            "image_type": "logo",
            "convert": False,
        }
        response = self.client.post(
            '/api/gm/upload-image/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)

    # ------------------------------------------------------------------
    # image_type validation — must NOT be skipped
    # ------------------------------------------------------------------

    def test_unknown_image_type_returns_400(self):
        """POST with image_type='unknown' returns 400."""
        import json
        payload = {
            "filename": "portrait.png",
            "content_base64": self.valid_b64,
            "image_type": "unknown",
            "convert": False,
        }
        response = self.client.post(
            '/api/gm/upload-image/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)

    def test_image_type_admin_returns_400(self):
        """POST with image_type='admin' (not in allowlist) returns 400."""
        import json
        payload = {
            "filename": "portrait.png",
            "content_base64": self.valid_b64,
            "image_type": "admin",
            "convert": False,
        }
        response = self.client.post(
            '/api/gm/upload-image/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)

    # ------------------------------------------------------------------
    # Malformed base64 — must NOT be skipped (rejected before disk write)
    # ------------------------------------------------------------------

    def test_malformed_base64_returns_400(self):
        """POST with malformed base64 returns 400."""
        import json
        payload = {
            "filename": "portrait.png",
            "content_base64": "not!valid!base64!!!",
            "image_type": "logo",
            "convert": False,
        }
        response = self.client.post(
            '/api/gm/upload-image/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)

    # ------------------------------------------------------------------
    # HTTP method guard — must NOT be skipped
    # ------------------------------------------------------------------

    def test_get_method_returns_405(self):
        """GET /api/gm/upload-image/ returns 405."""
        response = self.client.get('/api/gm/upload-image/')
        self.assertEqual(response.status_code, 405)

    # ------------------------------------------------------------------
    # Valid upload — writes to disk; must be skipped in CI
    # ------------------------------------------------------------------

    @unittest.skip("requires writable DATA_DIR")
    def test_valid_portrait_upload_returns_200(self):
        """POST with valid portrait input returns 200 with saved_path + original_size_bytes."""
        import json
        payload = {
            "filename": "test_npc.png",
            "content_base64": self.valid_b64,
            "image_type": "portrait",
            "convert": False,
        }
        response = self.client.post(
            '/api/gm/upload-image/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('saved_path', data)
        self.assertIn('original_size_bytes', data)
        self.assertEqual(data['original_size_bytes'], len(b"fake image bytes"))

    @unittest.skip("requires writable DATA_DIR")
    def test_logo_upload_no_converted_path(self):
        """POST with image_type='logo' returns 200 without converted_path."""
        import json
        payload = {
            "filename": "test_logo.png",
            "content_base64": self.valid_b64,
            "image_type": "logo",
            "convert": False,
        }
        response = self.client.post(
            '/api/gm/upload-image/',
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('saved_path', data)
        self.assertNotIn('converted_path', data)
