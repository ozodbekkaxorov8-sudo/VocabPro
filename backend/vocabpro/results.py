from typing import Annotated

from fastapi import APIRouter, Query

from .auth import TeacherSession
from .core import DB

router = APIRouter(prefix="/teacher/results", tags=["results"], dependencies=[TeacherSession])
PAGE_SIZE = 25


@router.get("")
async def results(db: DB, test_id: int | None = None, page: Annotated[int, Query(ge=1, le=10000)] = 1):
    scope = "WHERE finished_at IS NOT NULL"
    params = ()
    if test_id is not None:
        scope += " AND test_id = %s"
        params = (test_id,)
    # Use one snapshot for the totals and the page, even when submissions arrive concurrently.
    row = await (await db.execute(
        f"""SELECT
              (SELECT jsonb_build_object('attempts', count(*),
                                         'students', count(DISTINCT (student_key, class_key)),
                                         'average', coalesce(round(avg(100.0 * correct_count / total_count), 1), 0))
               FROM attempts {scope}) AS stats,
              coalesce((SELECT jsonb_agg(to_jsonb(recent) ORDER BY finished_at DESC, id DESC)
                        FROM (SELECT id, test_id, test_title, student_name, class_label, finished_at,
                                     reason, correct_count, total_count
                              FROM attempts {scope} ORDER BY finished_at DESC, id DESC
                              LIMIT %s OFFSET %s) recent), '[]'::jsonb) AS rows""",
        (*params, *params, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    )).fetchone()
    return {**row, "page_size": PAGE_SIZE}
