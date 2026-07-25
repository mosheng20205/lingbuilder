import asyncio
import json
import re
import shutil
import subprocess
import wave
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
VOICE = "zh-CN-XiaoxiaoNeural"
RATE = "+3%"
PITCH = "-2Hz"

LINES = [
    {
        "display": ["灵码", "LingBuilder。", "中文写代码，", "生成", "真实", "C++。"],
        "spoken": ["灵码，", "Ling Builder。", "中文写代码，", "生成", "真实的", "C 加加工程。"],
    },
    {
        "display": ["从菜单", "到诊断，", "从项目模板", "到错误提示，", "全中文", "贯穿", "开发流程。"],
        "spoken": ["从菜单", "到诊断，", "从项目模板", "到错误提示，", "全中文", "贯穿", "开发流程。"],
    },
    {
        "display": ["中文代码", "经过", "本地确定性规则，", "生成", "可阅读、", "可复制、", "可迁移的", "真实", "C++ 工程。"],
        "spoken": ["中文代码", "经过", "本地确定性规则，", "生成", "可阅读、", "可复制、", "可迁移的", "真实", "C 加加工程。"],
    },
    {
        "display": ["拖入控件、", "调整属性、", "绑定事件，", "可视化完成", "原生", "Win32 窗口。"],
        "spoken": ["拖入控件、", "调整属性、", "绑定事件，", "可视化完成", "原生", "Win 三十二窗口。"],
    },
    {
        "display": ["按下 F5，", "完成", "真实编译、", "调试", "与 EXE 运行。"],
        "spoken": ["按下 F 五，", "完成", "真实编译、", "调试", "与可执行程序运行。"],
    },
    {
        "display": ["AI 能写、", "能修，", "也会先给出 Diff，", "由你", "审查确认后", "再应用。"],
        "spoken": ["A I 能写、", "能修，", "也会先给出差异对比，", "由你", "审查确认后", "再应用。"],
    },
    {
        "display": ["原生 C++ 能力", "可以封装成", "lbmod 模块，", "安装、", "启用、", "复用", "更简单。"],
        "spoken": ["原生 C 加加能力", "可以封装成", "L B Mod 模块，", "安装、", "启用、", "复用", "更简单。"],
    },
    {
        "display": ["Monaco、", "Git、", "终端、", "调试和测试，", "汇聚成", "一套完整的", "中文开发工作台。"],
        "spoken": ["Monaco、", "Git、", "终端、", "调试和测试，", "汇聚成", "一套完整的", "中文开发工作台。"],
    },
    {
        "display": ["想用中文", "开发 Windows 软件？", "访问 Gitee，", "体验灵码", "LingBuilder。"],
        "spoken": ["想用中文", "开发 Windows 软件？", "访问 Gitee，", "体验灵码", "Ling Builder。"],
    },
]


def token_weight(text: str) -> float:
    chinese = len(re.findall(r"[\u4e00-\u9fff]", text))
    latin = sum(max(1.0, len(part) * 0.45) for part in re.findall(r"[A-Za-z0-9]+", text))
    return max(1.0, chinese + latin)


def active_time(intervals: list[tuple[float, float]], progress: float) -> float:
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


async def synthesize(index: int, line: dict, work_dir: Path) -> dict:
    text = "".join(line["spoken"])
    mp3_path = work_dir / f"{index:02d}.mp3"
    wav_path = work_dir / f"{index:02d}.wav"
    boundaries = []

    communicator = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    with mp3_path.open("wb") as audio_file:
        async for chunk in communicator.stream():
            if chunk["type"] == "audio":
                audio_file.write(chunk["data"])
            elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                start = float(chunk["offset"]) / 10_000_000
                end = float(chunk["offset"] + chunk["duration"]) / 10_000_000
                if end > start:
                    boundaries.append((start, end))

    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-i",
            str(mp3_path),
            "-ac",
            "1",
            "-ar",
            "48000",
            "-af",
            "loudnorm=I=-17:TP=-1.5:LRA=11",
            str(wav_path),
        ],
        check=True,
    )

    with wave.open(str(wav_path), "rb") as wav_file:
        duration = wav_file.getnframes() / wav_file.getframerate()

    if not boundaries:
        boundaries = [(0.1, max(0.2, duration - 0.1))]

    weights = [token_weight(token) for token in line["spoken"]]
    total_weight = sum(weights)
    cumulative = 0.0
    timed_words = []
    for display, weight in zip(line["display"], weights, strict=True):
        start = active_time(boundaries, cumulative / total_weight)
        cumulative += weight
        end = active_time(boundaries, cumulative / total_weight)
        timed_words.append(
            {
                "text": display,
                "start": round(start, 3),
                "end": round(max(start + 0.08, end), 3),
            }
        )

    return {
        "frame": index,
        "path": f"assets/voice/{index:02d}.wav",
        "duration_s": round(duration, 3),
        "words": timed_words,
        "spoken_text": text,
        "boundary_count": len(boundaries),
        "wav_path": wav_path,
    }


async def main() -> None:
    work_dir = ROOT / ".media" / "audio" / "voice-edge-xiaoxiao"
    work_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for index, line in enumerate(LINES, start=1):
        results.append(await synthesize(index, line, work_dir))

    voice_dir = ROOT / "assets" / "voice"
    backup_dir = ROOT / ".media" / "audio" / "voice-backup-kokoro"
    backup_dir.mkdir(parents=True, exist_ok=True)
    for index in range(1, 10):
        current = voice_dir / f"{index:02d}.wav"
        backup = backup_dir / current.name
        if current.exists() and not backup.exists():
            shutil.copy2(current, backup)

    voices = []
    for result in results:
        target = voice_dir / f"{result['frame']:02d}.wav"
        shutil.copy2(result.pop("wav_path"), target)
        voices.append(
            {
                "frame": result["frame"],
                "path": result["path"],
                "duration_s": result["duration_s"],
                "words": result["words"],
            }
        )

    audio_path = ROOT / "audio_meta.json"
    audio = json.loads(audio_path.read_text(encoding="utf-8"))
    audio["voices"] = voices
    audio_path.write_text(json.dumps(audio, ensure_ascii=False, indent=2), encoding="utf-8")

    total_duration = round(sum(voice["duration_s"] for voice in voices), 3)
    engine_path = ROOT / "audio_engine_meta.json"
    engine = json.loads(engine_path.read_text(encoding="utf-8"))
    engine.update(
        {
            "tts_provider": "edge-tts",
            "voice_id": VOICE,
            "voice_rate": RATE,
            "voice_pitch": PITCH,
            "voices": [
                {
                    "id": f"{voice['frame']:02d}",
                    "path": voice["path"],
                    "duration_s": voice["duration_s"],
                    "words": voice["words"],
                }
                for voice in voices
            ],
            "total_duration_s": total_duration,
        }
    )
    engine_path.write_text(json.dumps(engine, ensure_ascii=False, indent=2), encoding="utf-8")

    report = {
        "provider": "edge-tts",
        "voice": VOICE,
        "rate": RATE,
        "pitch": PITCH,
        "total_duration_s": total_duration,
        "lines": [
            {
                "frame": result["frame"],
                "spoken_text": result["spoken_text"],
                "duration_s": result["duration_s"],
                "boundary_count": result["boundary_count"],
            }
            for result in results
        ],
    }
    (ROOT / ".hyperframes" / "edge-voice-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
