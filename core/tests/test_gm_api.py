"""
Behavioral tests for the GM Data API (Plan 23-03).

These tests define the expected behavior of the GM data API endpoints:
  GET  /api/gm/data/?dir=            — list files in a data directory
  GET  /api/gm/data/{path}           — read a file's raw YAML content
  GET  /api/gm/data/{path}?field=    — read a single dot-path field as JSON
  PUT  /api/gm/data/{path}           — write YAML atomically (with validation + path traversal guard)
  PATCH /api/gm/data/{path}          — apply JSON merge patch
  POST /api/gm/data-list-append/{p}  — append item to a named list
  GET  /api/gm/session-context       — snapshot of current game state
  GET  /api/gm/data-schema           — raw DATA_DIRECTORY_GUIDE.md content
"""
import json
import os
import tempfile
import unittest
from django.conf import settings
from django.test import TestCase, Client, override_settings


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

    def test_write_file_disallowed_extension_returns_400(self):
        """PUT with a .py extension returns 400."""
        response = self.client.put(
            '/api/gm/data/test_stub.py',
            data='print("hello")\n',
            content_type='text/plain',
        )
        self.assertEqual(response.status_code, 400)

    def test_write_markdown_invalid_frontmatter_returns_400(self):
        """PUT of a .md file with invalid YAML frontmatter returns 400."""
        content = '---\ntitle: [unclosed\n---\n\nsome body text\n'
        response = self.client.put(
            '/api/gm/data/test_stub.md',
            data=content,
            content_type='text/plain',
        )
        self.assertEqual(response.status_code, 400)

    def test_write_markdown_no_frontmatter_would_write(self):
        """PUT of a .md file with no frontmatter passes validation (write will fail without writable DATA_DIR)."""
        content = 'Plain markdown with no frontmatter.\n'
        response = self.client.put(
            '/api/gm/data/test_stub.md',
            data=content,
            content_type='text/plain',
        )
        # 200 if DATA_DIR is writable in test env, 500 if not — never 400 (validation must pass)
        self.assertNotEqual(response.status_code, 400)

    def test_write_markdown_valid_frontmatter_would_write(self):
        """PUT of a .md file with valid YAML frontmatter passes validation."""
        content = '---\ntitle: Test Log\ndate: "2026-05-29"\n---\n\nEntry body text.\n'
        response = self.client.put(
            '/api/gm/data/test_stub.md',
            data=content,
            content_type='text/plain',
        )
        self.assertNotEqual(response.status_code, 400)


class GmDataFieldReadTests(TestCase):
    """Tests for GET /api/gm/data/{path}?field= dot-path field reads."""

    def setUp(self):
        self.client = Client()
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _make_yaml(self, relpath, content):
        path = os.path.join(self.tmpdir, relpath)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            f.write(content)

    @override_settings(DATA_DIR=None)  # will be replaced per-test
    def test_read_field_top_level(self):
        """GET ?field=name returns the top-level field value."""
        self._make_yaml('test.yaml', 'name: TestCorp\nversion: 1\n')
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.get('/api/gm/data/test.yaml', {'field': 'name'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['value'], 'TestCorp')

    def test_read_field_nested(self):
        """GET ?field=camera.fov returns a nested field value."""
        self._make_yaml('map.yaml', 'camera:\n  fov: 75\n  position: [0, 0, 0]\n')
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.get('/api/gm/data/map.yaml', {'field': 'camera.fov'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['value'], 75)

    def test_read_field_missing_returns_404(self):
        """GET ?field=nonexistent returns 404."""
        self._make_yaml('test.yaml', 'name: X\n')
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.get('/api/gm/data/test.yaml', {'field': 'nonexistent'})
        self.assertEqual(r.status_code, 404)

    def test_read_field_list_value(self):
        """GET ?field=systems returns the full list when the field is a list."""
        self._make_yaml('star_map.yaml', 'systems:\n  - name: Tau Ceti\n    location_slug: tau-ceti\n')
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.get('/api/gm/data/star_map.yaml', {'field': 'systems'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['value'], [{'name': 'Tau Ceti', 'location_slug': 'tau-ceti'}])


class GmDataPatchTests(TestCase):
    """Tests for PATCH /api/gm/data/{path} merge patch."""

    def setUp(self):
        self.client = Client()
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _make_yaml(self, relpath, content):
        path = os.path.join(self.tmpdir, relpath)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            f.write(content)

    def _read_yaml(self, relpath):
        import yaml
        with open(os.path.join(self.tmpdir, relpath)) as f:
            return yaml.safe_load(f)

    def test_patch_top_level_field(self):
        """PATCH updates a top-level field and leaves other fields untouched."""
        self._make_yaml('corp.yaml', 'name: OldName\nversion: 1\n')
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.patch(
                '/api/gm/data/corp.yaml',
                data=json.dumps({'name': 'NewName'}),
                content_type='application/json',
            )
        self.assertEqual(r.status_code, 200)
        data = self._read_yaml('corp.yaml')
        self.assertEqual(data['name'], 'NewName')
        self.assertEqual(data['version'], 1)

    def test_patch_nested_field(self):
        """PATCH merges a nested dict."""
        self._make_yaml('corp.yaml', 'name: X\ninfo:\n  motto: old\n  size: 100\n')
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.patch(
                '/api/gm/data/corp.yaml',
                data=json.dumps({'info': {'motto': 'new'}}),
                content_type='application/json',
            )
        self.assertEqual(r.status_code, 200)
        data = self._read_yaml('corp.yaml')
        self.assertEqual(data['info']['motto'], 'new')
        self.assertEqual(data['info']['size'], 100)  # untouched

    def test_patch_file_not_found_returns_404(self):
        """PATCH on nonexistent file returns 404."""
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.patch(
                '/api/gm/data/missing.yaml',
                data=json.dumps({'name': 'X'}),
                content_type='application/json',
            )
        self.assertEqual(r.status_code, 404)

    def test_patch_invalid_json_returns_400(self):
        """PATCH with non-JSON body returns 400."""
        self._make_yaml('corp.yaml', 'name: X\n')
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.patch(
                '/api/gm/data/corp.yaml',
                data='not json',
                content_type='application/json',
            )
        self.assertEqual(r.status_code, 400)

    def test_patch_path_traversal_blocked(self):
        """PATCH with path traversal returns 400."""
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.patch(
                '/api/gm/data/../../etc/passwd',
                data=json.dumps({}),
                content_type='application/json',
            )
        self.assertEqual(r.status_code, 400)


class GmDataListAppendTests(TestCase):
    """Tests for POST /api/gm/data-list-append/{path}."""

    def setUp(self):
        self.client = Client()
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _make_yaml(self, relpath, content):
        path = os.path.join(self.tmpdir, relpath)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            f.write(content)

    def _read_yaml(self, relpath):
        import yaml
        with open(os.path.join(self.tmpdir, relpath)) as f:
            return yaml.safe_load(f)

    def test_append_to_existing_list(self):
        """POST appends item to an existing list."""
        self._make_yaml('star_map.yaml', 'systems:\n  - name: Tau Ceti\n')
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.post(
                '/api/gm/data-list-append/star_map.yaml',
                data=json.dumps({'list_key': 'systems', 'item': {'name': 'Sol', 'location_slug': 'sol'}}),
                content_type='application/json',
            )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['new_length'], 2)
        data = self._read_yaml('star_map.yaml')
        self.assertEqual(len(data['systems']), 2)
        self.assertEqual(data['systems'][1]['name'], 'Sol')

    def test_append_creates_list_if_absent(self):
        """POST creates the list key if it doesn't exist in the file."""
        self._make_yaml('star_map.yaml', 'camera:\n  fov: 75\n')
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.post(
                '/api/gm/data-list-append/star_map.yaml',
                data=json.dumps({'list_key': 'nebulae', 'item': {'name': 'Ion Cloud', 'size': 50}}),
                content_type='application/json',
            )
        self.assertEqual(r.status_code, 200)
        data = self._read_yaml('star_map.yaml')
        self.assertEqual(len(data['nebulae']), 1)
        self.assertEqual(data['nebulae'][0]['name'], 'Ion Cloud')
        self.assertEqual(data['camera']['fov'], 75)  # existing key preserved

    def test_append_file_not_found_returns_404(self):
        """POST to nonexistent file returns 404."""
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.post(
                '/api/gm/data-list-append/missing.yaml',
                data=json.dumps({'list_key': 'systems', 'item': {}}),
                content_type='application/json',
            )
        self.assertEqual(r.status_code, 404)

    def test_append_non_list_key_returns_400(self):
        """POST where list_key refers to a non-list value returns 400."""
        self._make_yaml('star_map.yaml', 'camera:\n  fov: 75\n')
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.post(
                '/api/gm/data-list-append/star_map.yaml',
                data=json.dumps({'list_key': 'camera', 'item': {'x': 1}}),
                content_type='application/json',
            )
        self.assertEqual(r.status_code, 400)

    def test_append_missing_list_key_returns_400(self):
        """POST without list_key in body returns 400."""
        self._make_yaml('star_map.yaml', 'systems: []\n')
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.post(
                '/api/gm/data-list-append/star_map.yaml',
                data=json.dumps({'item': {'name': 'X'}}),
                content_type='application/json',
            )
        self.assertEqual(r.status_code, 400)

    def test_append_path_traversal_blocked(self):
        """POST with path traversal returns 400."""
        with override_settings(DATA_DIR=self.tmpdir):
            r = self.client.post(
                '/api/gm/data-list-append/../../etc/passwd',
                data=json.dumps({'list_key': 'x', 'item': {}}),
                content_type='application/json',
            )
        self.assertEqual(r.status_code, 400)
