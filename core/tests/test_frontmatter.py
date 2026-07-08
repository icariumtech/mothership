"""
Tests for core.data_loader._split_frontmatter — the shared YAML-frontmatter
splitter used by parse_message_file, parse_session_file, load_campaign_docs,
and load_campaign_doc (previously four copies of the same split/parse logic).
"""
from django.test import TestCase

from core.data_loader import _split_frontmatter


class SplitFrontmatterTests(TestCase):
    def test_no_frontmatter_returns_content_unchanged(self):
        frontmatter, body = _split_frontmatter('just plain body text')
        self.assertEqual(frontmatter, {})
        self.assertEqual(body, 'just plain body text')

    def test_parses_frontmatter_and_strips_body(self):
        content = "---\ntitle: Hello\nauthor: GM\n---\nBody text here.\n"
        frontmatter, body = _split_frontmatter(content)
        self.assertEqual(frontmatter, {'title': 'Hello', 'author': 'GM'})
        self.assertEqual(body, 'Body text here.')

    def test_malformed_frontmatter_delimiter_falls_back_to_whole_content(self):
        # Starts with '---' but never closes it — only one '---' in the file
        content = "---\ntitle: Hello\nno closing delimiter"
        frontmatter, body = _split_frontmatter(content)
        self.assertEqual(frontmatter, {})
        self.assertEqual(body, content)

    def test_empty_frontmatter_block_returns_empty_dict(self):
        content = "---\n---\nBody only.\n"
        frontmatter, body = _split_frontmatter(content)
        self.assertEqual(frontmatter, {})
        self.assertEqual(body, 'Body only.')
