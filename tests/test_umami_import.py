import csv
import importlib.util
import io
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "umami_import", Path(__file__).parents[1] / "preset/scripts/importUmamiCloud.py"
)
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class CloudExportTest(unittest.TestCase):
    def export(self, path, properties=False):
        row = {
            "website_id": "11111111-1111-1111-1111-111111111111",
            "session_id": "22222222-2222-2222-2222-222222222222",
            "visit_id": "33333333-3333-3333-3333-333333333333",
            "event_id": "44444444-4444-4444-4444-444444444444",
            "created_at": "2026-10-29 10:00:00",
            "url_path": "/blog/example/",
            "event_type": "1",
            "distinct_id": r"\N",
            "lcp": r"\N",
            "page_title": "Bob's blog",
        }
        text = io.StringIO()
        writer = csv.DictWriter(text, fieldnames=row.keys())
        writer.writeheader()
        writer.writerow(row)
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("website_event.csv", text.getvalue())
            archive.writestr("event_data.csv", "data_key\nexample\n" if properties else "data_key\n")
            archive.writestr("session_data.csv", "data_key\n")

    def test_cloud_null_marker_becomes_sql_null_without_fake_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            archive, output = Path(directory) / "export.zip", Path(directory) / "import.sql"
            self.export(archive)
            importer.convert(archive, output)
            sql = output.read_text()
            self.assertNotIn("'\\N'", sql)
            self.assertNotIn('INSERT INTO "session_link"', sql)
            self.assertIn("Bob''s blog", sql)
            self.assertIn("2026-10-29 10:00:00+00:00", sql)

    def test_nonempty_properties_refuse_partial_migration(self):
        with tempfile.TemporaryDirectory() as directory:
            archive, output = Path(directory) / "export.zip", Path(directory) / "import.sql"
            self.export(archive, properties=True)
            with self.assertRaisesRegex(ValueError, "refusing partial import"):
                importer.convert(archive, output)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
