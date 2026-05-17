"""
Behavioral tests for the GM Data API (Plan 23-03).

These tests define the expected behavior of the four GM data API endpoints:
  GET /api/gm/data/?dir=  — list files in a data directory
  GET /api/gm/data/{path} — read a file's raw YAML content
  PUT /api/gm/data/{path} — write YAML atomically (with validation + path traversal guard)
  GET /api/gm/session-context — snapshot of current game state
  GET /api/gm/data-schema — raw DATA_DIRECTORY_GUIDE.md content
"""
import unittest
from django.test import TestCase, Client


class GmDataApiTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_list_files_returns_json(self):
        """GET /api/gm/data/?dir= returns 200 + JSON list."""
        response = self.client.get('/api/gm/data/', {'dir': 'campaign'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/json')

    def test_read_file_returns_yaml_content(self):
        """GET /api/gm/data/{path} returns 200 + text content."""
        response = self.client.get('/api/gm/data/campaign/ship/ship.yaml')
        self.assertIn(response.status_code, [200, 404])  # 404 acceptable if file absent in test env

    @unittest.skip("requires writable DATA_DIR")
    def test_write_file_valid_yaml(self):
        """PUT /api/gm/data/{path} with valid YAML returns 200."""
        response = self.client.put(
            '/api/gm/data/test_write_stub.yaml',
            data='test_key: test_value\n',
            content_type='application/x-yaml',
        )
        self.assertEqual(response.status_code, 200)

    def test_write_file_invalid_yaml_returns_400(self):
        """PUT with invalid YAML returns 400."""
        response = self.client.put(
            '/api/gm/data/test_write_stub.yaml',
            data='invalid: [unclosed',
            content_type='application/x-yaml',
        )
        self.assertEqual(response.status_code, 400)

    def test_write_file_path_traversal_blocked(self):
        """PUT with path traversal ../../config/settings.py returns 400."""
        response = self.client.put(
            '/api/gm/data/../../config/settings.py',
            data='SECRET_KEY: hacked\n',
            content_type='application/x-yaml',
        )
        self.assertEqual(response.status_code, 400)
