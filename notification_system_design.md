# Notification System Design

Stage 1
REST API Endpoints
Get All Notifications
GET /api/notifications
Headers: Authorization: Bearer <token>
Query Params: limit, page, notification_type
Response: { notifications: [...] }
Mark Notification as Read
PUT /api/notifications/:id/read
Headers: Authorization: Bearer <token>
Response: { message: "marked as read" }
Mark All as Read
PUT /api/notifications/read-all
Headers: Authorization: Bearer <token>
Response: { message: "all marked as read" }
Real-Time Notification Mechanism
Going with SSE (Server-Sent Events). Whenever a notification gets created, the server pushes it straight to connected clients — no polling needed. Picked SSE over WebSockets since the data only flows one way (server → client), and it's a lot less overhead to set up.

Stage 2
Database: PostgreSQL
Reasons:

ACID compliance means no data loss even if something crashes mid-write
Indexing handles large datasets without query times blowing up
Native JSON support if message formats need to vary
Battle-tested in production across many systems

Schema
sql
CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INT NOT NULL,
  type notification_type NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_student_unread 
ON notifications(student_id, is_read, created_at DESC);
Scaling Concerns
With 50k students and notifications piling up, the table grows fast. A few approaches:

Pagination — never pull the full dataset at once
Composite index on (student_id, is_read) — keeps per-student lookups fast
Archiving — move anything older than 6 months to a separate table
Read replicas — route writes to primary, reads to replica


Stage 3
The query logic is fine, but it's slow because none of the filtered columns are indexed. At 5 million rows, the DB ends up doing a full table scan for every studentId = 1042 lookup — that's O(n) for every single request.
Fix is straightforward — composite index:
sqlCREATE INDEX idx_unread_notifs ON notifications(studentId, isRead, createdAt ASC);
After this, the DB jumps directly to matching rows instead of scanning everything. Lookup cost drops to roughly O(log n).
On the "index every column" idea — that backfires. Every INSERT or UPDATE has to maintain all those indexes, so write performance degrades noticeably. Storage also climbs, and the query planner can start picking suboptimal indexes when there are too many. Index what you query on, nothing more.
Query for placement notifications in the last 7 days:
sqlSELECT DISTINCT studentId FROM notifications
WHERE notificationType = 'Placement'
AND createdAt >= NOW() - INTERVAL '7 days';

Stage 4
Right now every page load hits the DB directly. At 50k concurrent students, that becomes a serious bottleneck fast.
Three things I'd address:
1. Redis caching — cache each student's notification list with a TTL (60s works fine). Repeated requests within that window get served from cache, not the DB. Data can lag by up to a minute, which is acceptable for notifications.
2. Pagination — pull 10–20 notifications at a time rather than the full list. Lighter queries, smaller payloads. The client makes multiple requests to see everything, but that's a reasonable tradeoff.
3. SSE instead of polling — the initial load fetches existing notifications once; new ones get pushed automatically via SSE. The catch is that 50k open connections will eat server memory, so horizontal scaling becomes necessary at that point.
Realistically, pagination + Redis solves most of the load problem and is simpler to ship first.

Stage 5
A few issues with the current pseudocode:

The loop is sequential — at 100ms per email, 50k students takes roughly 5,000 seconds. That's not viable.
No retry logic — if send_email fails partway through, those students silently miss the notification with no recovery path.
DB write and email are coupled in the same flow — a mid-run failure leaves the system in an inconsistent state (some students written, some not).
push_to_app has no error handling either.

For the failed emails: a queue-based retry mechanism makes sense. Failed jobs go back into the queue, retried up to 3 times with a delay between attempts. After 3 failures, log it as fatal and flag for manual review.
DB write and email should be decoupled entirely. Write to DB first — that guarantees the in-app notification always works, even if the email service goes down. Email becomes a background async job. If the email service is unavailable for an hour, all records are already in the DB and the queue can be reprocessed when it recovers.
Revised pseudocode:
function notify_all(student_ids, message):
  for student_id in student_ids:
    save_to_db(student_id, message)         // always first
    enqueue(email_job, student_id, message) // async, non-blocking
    push_to_app(student_id, message)        // SSE push

function process_email_queue():
  while job = queue.pop():
    try:
      send_email(job.student_id, job.message)
    catch err:
      if job.retries < 3:
        queue.push(job, delay=60s, retries+1)
      else:
        log("backend", "fatal", "service", "email failed 3 times for: " + job.student_id)
Even if email fails completely, the student sees the notification in-app, and emails retry on their own.

Stage 6
Priority score is calculated as:
score = weight × (1 / hours_since_posted)
Weights:

Placement → 3
Result → 2
Event → 1

This means a Placement notification from an hour ago outscores an Event from 10 minutes ago — type importance wins over recency, but recency still factors in as scores decay over time.