import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

TOKENS = [
    ["灵码", "LingBuilder。", "中文写代码，", "生成", "真实", "C++。"],
    ["从菜单", "到诊断，", "从项目模板", "到错误提示，", "全中文", "贯穿", "开发流程。"],
    ["中文代码", "经过", "本地确定性规则，", "生成", "可阅读、", "可复制、", "可迁移的", "真实", "C++ 工程。"],
    ["拖入控件、", "调整属性、", "绑定事件，", "可视化完成", "原生", "Win32 窗口。"],
    ["按下 F5，", "完成", "真实编译、", "调试", "与 EXE 运行。"],
    ["AI 能写、", "能修，", "也会先给出 Diff，", "由你", "审查确认后", "再应用。"],
    ["原生 C++ 能力", "可以封装成", "lbmod 模块，", "安装、", "启用、", "复用", "更简单。"],
    ["Monaco、", "Git、", "终端、", "调试和测试，", "汇聚成", "一套完整的", "中文开发工作台。"],
    ["想用中文", "开发 Windows 软件？", "访问 Gitee，", "体验灵码", "LingBuilder。"],
]

LATIN_WEIGHT = {
    "lingbuilder": 3.2,
    "c++": 2.0,
    "win32": 2.0,
    "f5": 1.4,
    "exe": 1.8,
    "ai": 1.2,
    "diff": 1.6,
    "lbmod": 2.4,
    "monaco": 2.6,
    "git": 1.3,
    "windows": 2.4,
    "gitee": 2.0,
}


def token_weight(token: str) -> float:
    weight = len(re.findall(r"[\u4e00-\u9fff]", token))
    for latin in re.findall(r"[A-Za-z0-9+]+", token):
        weight += LATIN_WEIGHT.get(latin.lower(), max(1.0, len(latin) * 0.35))
    return max(1.0, float(weight))


def active_time(intervals, progress: float) -> float:
    progress = max(0.0, min(1.0, progress))
    total = sum(end - start for start, end in intervals)
    target = progress * total
    walked = 0.0
    for start, end in intervals:
        span = end - start
        if walked + span >= target:
            return start + max(0.0, target - walked)
        walked += span
    return intervals[-1][1]


def main() -> None:
    alignment = json.loads((ROOT / ".hyperframes" / "whisper-alignment.json").read_text(encoding="utf-8"))
    audio_path = ROOT / "audio_meta.json"
    audio = json.loads(audio_path.read_text(encoding="utf-8"))

    for frame_data, voice, tokens in zip(alignment["frames"], audio["voices"], TOKENS, strict=True):
        raw_words = frame_data["words"]
        intervals = [
            (float(word["start"]), float(word["end"]))
            for word in raw_words
            if float(word["end"]) > float(word["start"])
        ]
        if not intervals:
            raise RuntimeError(f"Frame {voice['frame']} has no usable alignment intervals")

        weights = [token_weight(token) for token in tokens]
        total_weight = sum(weights)
        cumulative = 0.0
        timed = []
        for token, weight in zip(tokens, weights, strict=True):
            start = active_time(intervals, cumulative / total_weight)
            cumulative += weight
            end = active_time(intervals, cumulative / total_weight)
            timed.append({"text": token, "start": round(start, 3), "end": round(max(start + 0.08, end), 3)})
        voice["words"] = timed

    audio_path.write_text(json.dumps(audio, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "audio_engine_meta.json").write_text(
        json.dumps(
            {
                **json.loads((ROOT / "audio_engine_meta.json").read_text(encoding="utf-8")),
                "voices": [
                    {
                        "id": f"{voice['frame']:02d}",
                        "path": voice["path"],
                        "duration_s": voice["duration_s"],
                        "words": voice["words"],
                    }
                    for voice in audio["voices"]
                ],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Applied exact-script timings to {len(audio['voices'])} voice tracks.")


if __name__ == "__main__":
    main()
