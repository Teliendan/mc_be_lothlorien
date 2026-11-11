"""Shared writers for the Python generators: UTF-8, LF line endings, one JSON layout.

`write_json` is `json.dumps(data, indent=2) + "\n"`, the layout of the committed pack files.
Python's default text mode writes CRLF on Windows, so every generator writes through here.
"""
import json
from pathlib import Path


def write_text(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def write_json(path, data):
    write_text(path, json.dumps(data, indent=2) + "\n")
