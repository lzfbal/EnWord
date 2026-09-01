import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE_TXT = ROOT / "source" / "bbdc_YSCHLXB_YQj6 (1).txt"
OUT_JSON = ROOT / "words.json"

SKIP_LINE_PATTERNS = [
    r"^雅思词汇",
    r"^共\s+\d+\s+词",
    r"^扫码听单词",
    r"^纸上默写",
    r"^$",
]


def should_skip(line: str) -> bool:
    line = line.strip()
    for p in SKIP_LINE_PATTERNS:
        if re.search(p, line):
            return True
    return False


def clean_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def parse_segment_english(segment: str) -> list[str]:
    result: list[str] = []
    current_parts: list[str] = []
    has_current = False

    for raw in segment.splitlines():
        line = raw.strip()
        if should_skip(line):
            continue

        m = re.match(r"^(\d+)\s+(.+)$", line)
        if m:
            if has_current:
                result.append(clean_spaces(" ".join(current_parts)))
            current_parts = [m.group(2).strip()]
            has_current = True
            continue

        if has_current:
            current_parts.append(line)

    if has_current:
        result.append(clean_spaces(" ".join(current_parts)))

    return result


def parse_segment_chinese(segment: str) -> list[str]:
    result: list[str] = []
    current_parts: list[str] = []
    has_current = False

    for raw in segment.splitlines():
        line = raw.strip()
        if should_skip(line):
            continue

        m = re.match(r"^(\d+)\s*(.*)$", line)
        if m:
            if has_current:
                result.append(clean_spaces(" ".join(current_parts)))
            first = m.group(2).strip()
            current_parts = [first] if first else []
            has_current = True
            continue

        if has_current:
            current_parts.append(line)

    if has_current:
        result.append(clean_spaces(" ".join(current_parts)))

    return result


def main() -> None:
    text = SOURCE_TXT.read_text(encoding="utf-8", errors="ignore")
    parts = text.split("Word Meaning")

    english_all: list[str] = []
    chinese_all: list[str] = []

    # After split, odd index blocks are English, even index blocks are Chinese.
    for i, part in enumerate(parts[1:], start=1):
        if i % 2 == 1:
            english_all.extend(parse_segment_english(part))
        else:
            chinese_all.extend(parse_segment_chinese(part))

    pair_count = min(len(english_all), len(chinese_all))
    data = []
    for i in range(pair_count):
        en = clean_spaces(english_all[i])
        zh = clean_spaces(chinese_all[i])
        if not en or not zh:
            continue
        data.append({"id": i + 1, "en": en, "zh": zh})

    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"English parsed: {len(english_all)}")
    print(f"Chinese parsed: {len(chinese_all)}")
    print(f"Paired items: {len(data)}")
    print(f"Output: {OUT_JSON}")


if __name__ == "__main__":
    main()
