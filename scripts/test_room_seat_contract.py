from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_deploy_preserves_existing_cloud_run_configuration():
    workflow = (ROOT / ".github/workflows/deploy-cloud-run.yml").read_text(encoding="utf-8")

    assert '--update-secrets "DATABASE_URL=botc-database-url:latest"' in workflow
    assert '--update-env-vars "GCS_BUCKET=' in workflow
    assert '--set-secrets "DATABASE_URL=botc-database-url:latest"' not in workflow
    assert '--set-env-vars "GCS_BUCKET=' not in workflow


def test_room_seat_identity_uses_the_logged_in_account_id():
    main_source = (ROOT / "main.py").read_text(encoding="utf-8")
    mobile_source = (ROOT / "static/js/rooms-mobile-layout-patch.js").read_text(
        encoding="utf-8"
    )
    self_seat_source = (ROOT / "static/js/rooms-self-seat-patch.js").read_text(
        encoding="utf-8"
    )

    assert '"user": {"id": account.id' in main_source
    assert "Number(player.account_id) === accountId" in mobile_source
    assert "Number(player.account_id) === Number(ctx.account.id)" in self_seat_source


def test_room_permissions_distinguish_expired_login_from_non_owner():
    backend = (ROOT / "player_seat_routes.py").read_text(encoding="utf-8")
    frontend = (ROOT / "static/js/rooms-permission-patch.js").read_text(
        encoding="utf-8"
    )

    assert '"authenticated": bool(account)' in backend
    assert '"current_account_display_name": account.display_name' in backend
    assert "else if (!permissions.authenticated)" in frontend
    assert "重新 LINE 登入" in frontend
    assert "切換 LINE 帳號" in frontend


def test_line_login_can_disable_auto_login_for_account_switching():
    override = (ROOT / "line_login_override_routes.py").read_text(encoding="utf-8")
    main_source = (ROOT / "main.py").read_text(encoding="utf-8")
    room_ui = (ROOT / "static/js/rooms-ui-patch.js").read_text(encoding="utf-8")

    assert 'params["disable_auto_login"] = "true"' in override
    assert 'params["disable_auto_login"] = "true"' in main_source
    assert "switch_account=1" in room_ui
