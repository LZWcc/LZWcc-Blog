"""Convert this site's Umami Cloud CSV export to transactional PostgreSQL SQL.

Keeps original IDs, timestamps and analytics fields. Re-importing an overlapping
export is safe. Fails rather than silently dropping nonempty property tables.
Run against Umami 3.4.1 after creating the website with its original website ID.
"""

import csv
import io
import json
import sys
import uuid
import zipfile
from datetime import datetime
from pathlib import Path


SESSION_COLUMNS = [
    "session_id", "website_id", "browser", "os", "device", "screen",
    "language", "country", "region", "city", "distinct_id", "created_at",
]
EVENT_COLUMNS = [
    "event_id", "website_id", "session_id", "visit_id", "created_at",
    "url_path", "url_query", "utm_source", "utm_medium", "utm_campaign",
    "utm_content", "utm_term", "referrer_path", "referrer_query",
    "referrer_domain", "page_title", "gclid", "fbclid", "msclkid", "ttclid",
    "li_fat_id", "twclid", "event_type", "event_name", "tag", "hostname",
    "lcp", "inp", "cls", "fcp", "ttfb",
]


def literal(value):
    if value is None or value == "":
        return "NULL"
    if "\x00" in value:
        raise ValueError("NUL in export")
    return "'" + value.replace("'", "''") + "'"


def insert(table, columns, rows, conflict):
    if not rows:
        return ""
    values = ",\n".join(
        "(" + ",".join(literal(row.get(column)) for column in columns) + ")"
        for row in rows
    )
    names = ",".join('"' + column + '"' for column in columns)
    return f'INSERT INTO "{table}" ({names}) VALUES\n{values}\nON CONFLICT ({conflict}) DO NOTHING;\n'


def convert(archive_path, output_path):
    with zipfile.ZipFile(archive_path) as archive:
        def read(name):
            reader = csv.DictReader(io.StringIO(archive.read(name).decode("utf-8-sig")))
            return [{key: None if value == r"\N" else value for key, value in row.items()} for row in reader]

        events = read("website_event.csv")
        if read("event_data.csv") or read("session_data.csv"):
            raise ValueError("Nonempty property tables need a separate importer; refusing partial import")

    if not events:
        raise ValueError("Empty export")
    expected_columns = set(EVENT_COLUMNS + ["browser", "os", "device", "screen", "language", "country", "region", "city", "distinct_id", "job_id"])
    if set(events[0]) - expected_columns:
        raise ValueError("Unrecognized analytics fields in export")
    if len({row["website_id"] for row in events}) != 1:
        raise ValueError("Expected one website")
    if len({row["event_id"] for row in events}) != len(events):
        raise ValueError("Duplicate event IDs in export")

    sessions = {}
    links = {}
    for row in sorted(events, key=lambda item: item["created_at"]):
        for key in ["website_id", "session_id", "visit_id", "event_id"]:
            uuid.UUID(row[key])
        datetime.strptime(row["created_at"], "%Y-%m-%d %H:%M:%S")
        int(row["event_type"])
        row["created_at"] += "+00:00"
        row["url_path"] = row["url_path"] or "/"
        sessions.setdefault(row["session_id"], row)
        if row.get("distinct_id"):
            key = (row["website_id"], row["session_id"], row["distinct_id"])
            links.setdefault(key, row)

    sql = "BEGIN;\nSET LOCAL TIME ZONE 'UTC';\nSET LOCAL standard_conforming_strings = on;\n"
    sql += insert("session", SESSION_COLUMNS, sessions.values(), "session_id")
    sql += insert("website_event", EVENT_COLUMNS, events, "event_id")
    sql += insert("session_link", ["website_id", "session_id", "distinct_id", "created_at"], links.values(), "website_id,distinct_id,session_id")
    sql += "COMMIT;\n"
    output = Path(output_path)
    output.write_text(sql)
    output.chmod(0o600)
    print(json.dumps({"events": len(events), "sessions": len(sessions), "visits": len({r["visit_id"] for r in events}), "sql": str(output)}))


if __name__ == "__main__":
    convert(*sys.argv[1:])
