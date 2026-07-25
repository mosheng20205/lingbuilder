import json
from pathlib import Path

from faster_whisper import WhisperModel


ROOT = Path(__file__).resolve().parents[1]
MODEL_NAME = "small"


def main() -> None:
    model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
    results = []

    for index in range(1, 10):
        audio_path = ROOT / "assets" / "voice" / f"{index:02d}.wav"
        segments, info = model.transcribe(
            str(audio_path),
            language="zh",
            beam_size=5,
            vad_filter=True,
            word_timestamps=True,
            condition_on_previous_text=False,
        )
        words = []
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())
            for word in segment.words or []:
                token = word.word.strip()
                if token:
                    words.append(
                        {
                            "text": token,
                            "start": round(float(word.start), 3),
                            "end": round(float(word.end), 3),
                            "probability": round(float(word.probability), 4),
                        }
                    )
        results.append(
            {
                "frame": index,
                "language": info.language,
                "text": "".join(text_parts),
                "words": words,
            }
        )
        print(f"frame {index}: {len(words)} words — {''.join(text_parts)}", flush=True)

    output = ROOT / ".hyperframes" / "whisper-alignment.json"
    output.write_text(json.dumps({"model": MODEL_NAME, "frames": results}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}", flush=True)


if __name__ == "__main__":
    main()
