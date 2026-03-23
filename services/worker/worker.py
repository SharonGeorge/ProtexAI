import os
import time
import json
from datetime import datetime, timezone
from urllib import request
from urllib.error import URLError

import psycopg


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:Post123%23@localhost:5432/moderation")
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "10"))
INTERNAL_API_URL = os.getenv("INTERNAL_API_URL", "http://localhost:3000/internal/assignments/expired")
INTERNAL_API_TOKEN = os.getenv("INTERNAL_API_TOKEN", "dev-internal-token")


def expire_stale_assignments(conn: psycopg.Connection) -> list[dict[str, str]]:
    with conn.cursor() as cur:
        cur.execute(
            '''
                        WITH expired AS (
                                UPDATE assignments
                                SET status = 'EXPIRED'
                                WHERE status = 'ACTIVE'
                                    AND "expiresAt" <= NOW()
                                RETURNING "eventId"
                        )
                        UPDATE events
                        SET status = 'AVAILABLE'
                        WHERE id IN (SELECT DISTINCT "eventId" FROM expired)
                        RETURNING id, region
            '''
        )
        rows = cur.fetchall()
        return [{"eventId": str(row[0]), "region": str(row[1])} for row in rows]


def notify_api(expired_events: list[dict[str, str]]) -> None:
    payload = json.dumps(
        {
            "token": INTERNAL_API_TOKEN,
            "expiredEvents": expired_events,
        }
    ).encode("utf-8")
    req = request.Request(
        INTERNAL_API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=5) as response:
        response.read()


def run() -> None:
    while True:
        try:
            with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
                expired_events = expire_stale_assignments(conn)
                expired_count = len(expired_events)
                now = datetime.now(timezone.utc).isoformat()
                print(f"[{now}] expired_assignments={expired_count}")

                if expired_count > 0:
                    try:
                        notify_api(expired_events)
                        print(f"[{now}] notified_api_expired={expired_count}")
                    except URLError as notify_exc:
                        print(f"[{now}] worker_notify_error={notify_exc}")
        except Exception as exc:
            now = datetime.now(timezone.utc).isoformat()
            print(f"[{now}] worker_error={exc}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run()
