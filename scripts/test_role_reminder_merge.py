from dataclasses import dataclass
import unittest

from role_reminder_merge import (
    normalize_reminder_label,
    preferred_reminders,
    redundant_automated_reminders,
)


@dataclass
class Reminder:
    id: int
    label_zh_tw: str
    source: str
    scope: str = "role"
    sort_order: int = 0


class RoleReminderMergeTests(unittest.TestCase):
    def test_normalizes_width_and_whitespace(self):
        self.assertEqual(normalize_reminder_label(" 下 回 死 亡 "), normalize_reminder_label("下回死亡"))
        self.assertEqual(normalize_reminder_label("ＡＢＣ"), normalize_reminder_label("ABC"))

    def test_gstone_wins_over_pocket(self):
        pocket = Reminder(1, "中毒", "pocket_grimoire")
        gstone = Reminder(2, "中 毒", "gstone_official_wiki")
        self.assertEqual(preferred_reminders([pocket, gstone]), [gstone])
        self.assertEqual(redundant_automated_reminders([pocket, gstone]), [pocket])

    def test_gstone_wins_over_manual_for_the_same_label(self):
        pocket = Reminder(1, "已選擇", "pocket_grimoire")
        gstone = Reminder(2, "已選擇", "gstone_official_wiki")
        manual = Reminder(3, "已選擇", "manual")
        self.assertEqual(preferred_reminders([pocket, gstone, manual]), [gstone])
        self.assertEqual(redundant_automated_reminders([pocket, gstone, manual]), [pocket])

    def test_pocket_is_never_visible(self):
        pocket = Reminder(1, "下回死亡", "pocket_grimoire")
        self.assertEqual(preferred_reminders([pocket]), [])

    def test_manual_remains_a_fallback_when_gstone_is_absent(self):
        manual = Reminder(1, "店內裁定", "manual")
        self.assertEqual(preferred_reminders([manual]), [manual])


if __name__ == "__main__":
    unittest.main()
