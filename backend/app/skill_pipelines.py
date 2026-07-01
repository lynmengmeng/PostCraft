"""Skill pipeline configuration — aligned with PRD §13.3."""

GENERATE_ALL_STEPS = [
    "general-writing",
    "humanizer-cn",
    "wechat-converter",
    "xiaohongshu-converter",
    "douyin-converter",
]

PLATFORM_CONVERTERS = {
    "wechat": "wechat-converter",
    "xiaohongshu": "xiaohongshu-converter",
    "douyin": "douyin-converter",
}

ALL_PLATFORMS = ["wechat", "xiaohongshu", "douyin"]
