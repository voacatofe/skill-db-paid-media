import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "validate_dlt_project.py"
SPEC = importlib.util.spec_from_file_location("validate_dlt_project", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ValidateDltProjectTests(unittest.TestCase):
    def test_complete_project_passes_critical_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "requirements.txt").write_text("dlt[postgres]>=1.28,<2\n", encoding="utf-8")
            (root / "pipeline.py").write_text(
                """import dlt
from datetime import timedelta

pipeline = dlt.pipeline(pipeline_name='meta_account', dataset_name='raw_meta')
dlt.resource(data_from_api, primary_key=['account_id', 'date'], write_disposition='merge')
sql = 'SELECT pg_advisory_lock(42)'
lookback = timedelta(days=28)
run_id = 'example'
watermark = 'date'
""",
                encoding="utf-8",
            )
            tests = root / "tests"
            tests.mkdir()
            (tests / "test_pipeline.py").write_text("def test_pipeline(): assert True\n", encoding="utf-8")

            results = MODULE.audit(root)
            failures = [item.id for item in results if item.level == "critical" and not item.passed]
            self.assertEqual([], failures)

    def test_empty_project_fails_critical_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            results = MODULE.audit(Path(directory))
            failures = {item.id for item in results if item.level == "critical" and not item.passed}
            self.assertIn("dlt-dependency", failures)
            self.assertIn("dlt-pipeline", failures)
            self.assertIn("merge-idempotency", failures)
            self.assertIn("state-strategy", failures)
            self.assertIn("concurrency-lock", failures)

    def test_pyairbyte_import_is_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "legacy.py").write_text("import pyairbyte\n", encoding="utf-8")
            results = {item.id: item for item in MODULE.audit(root)}
            self.assertFalse(results["no-airbyte"].passed)


if __name__ == "__main__":
    unittest.main()
