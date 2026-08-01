import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "link_roles_to_knowledge.py"
WORKFLOW = ROOT / ".github" / "workflows" / "link-role-knowledge.yml"


def test_default_link_flow_does_not_import_archived_community_seed():
    source = SCRIPT.read_text(encoding="utf-8")
    tree = ast.parse(source)
    imported_names = {
        alias.name
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom)
        for alias in node.names
    }
    called_functions = {
        node.func.id
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
    }

    assert "ARCHIVED_ROLES" not in imported_names
    assert "seed_archived_deleted_roles" not in imported_names
    assert "seed_archived_deleted_roles" not in called_functions
    assert '"source_policy": "gstone_only"' in source


def test_default_workflow_only_invokes_gstone_link_script():
    workflow = WORKFLOW.read_text(encoding="utf-8")

    assert "scripts/link_roles_to_knowledge.py" in workflow
    assert "seed_archived_deleted_roles.py" not in workflow
    assert "GStone-only" in workflow
