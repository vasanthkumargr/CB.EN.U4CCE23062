# Notification System Design

## Stage 1

### REST API Endpoints

#### Get All Notifications
```
GET /api/notifications
Headers: Authorization: Bearer <token>
Query Params: limit, page, notification_type
Response: { notifications: [] }
```

#### Mark Notification as Read
```
PUT /api/notifications/:id/read
Headers: Authorization: Bearer <token>
Response: { message: "marked as read" }
```

#### Mark All as Read
```
PUT /api/notifications/read-all
Headers: Authorization: Bearer <token>
Response: { message: "all marked as read" }
```

### Real-Time Notification Mechanism
Using Server-Sent Events (SSE). When a new notification is created,
the server pushes it to all connected clients instantly without polling.
SSE is chosen over WebSockets because notifications are one-directional
(server to client only) and SSE is simpler to implement.

---

## Stage 2

### Database Choice: PostgreSQL
Chosen because:
- ACID compliant ,no data loss on crashes
- Supports indexing for fast queries on large datasets
- JSON support for flexible message formats
- Strong community and production proven

### DB Schema
```sql
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
```

### Problems at Scale & Solutions
- **50,000 students x millions of notifications** → Table gets huge
- Solution 1: Pagination, never fetch all at once
- Solution 2: Index on (student_id, is_read)  fast per-student queries
- Solution 3: Archive old notifications (older than 6 months) to separate table
- Solution 4: Read replicas , writes go to primary DB, reads from replica

## Stage 3

the query looks correct to me. but it's slow bcz there's no index on the columns being filtered. with 5 million rows the db has to scan every single row to find matches for studentId=1042 ,thats a full table scan which is obv gonna be slow.

to fix this we can add a composite index:

```sql
CREATE INDEX idx_unread_notifs ON notifications(studentId, isRead, createdAt ASC);
```

after this the db can directly jump to the rows for that student instead of scanning everything. cost goes from O(n) to roughly O(log n).

abt the suggestion to index every col — thats not a good idea. every time we do an INSERT or UPDATE, all those indexes need to be updated too. so writes become slower and storage also increases a lot. the query planner might also get confused and pick the wrong index. better to only index what we actually query on.

query for placement notifs in last 7 days:

```sql
SELECT DISTINCT studentId FROM notifications
WHERE notificationType = 'Placement'
AND createdAt >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

the issue is every page load hits the db directly — with 50k students thats a lot of unnecessary load.

few things i'd do:

**1. caching with redis**
cache each students notif list with a TTL (say 60s). if the same student refreshes within 60s, serve from cache not db. tradeoff is data can be slightly stale but thats acceptable for notifs.

**2. pagination**
instead of fetching all notifs at once just fetch 10-20 at a time. reduces query cost and response size. tradeoff — client needs multiple requests to see everything but thats fine.

**3. SSE for real time**
instead of polling on every page load use SSE to push new notifs to client as they arrive. this way the initial load fetches existing notifs once and new ones come in automatically. tradeoff — each connected user keeps an open connection, so at scale (50k users) memory usage on server goes up. can handle with horizontal scaling.

personally i'd go with pagination + redis first since theyre simpler to impl and already solve most of the load problem.

---

## Stage 5

looking at the pseudocode a few things stand out:

**problems:**
- the for loop is sequential — sending email to 50k students one by one is super slow. if each email call takes even 100ms thats 5000 seconds
- no retry logic — if send_email fails for 200 students midway those students just dont get notified, no way to recover
- db write and email are in the same flow — if email fails halfway we have some students in db and some not, inconsistent state
- push_to_app also has no error handling

**abt the 200 failed emails:**
we need a retry mechanism. ideally with a queue — failed jobs go back into the queue and get retried upto 3 times with some delay. after 3 failures log it as fatal and flag for manual review.

**should db write and email happen together?**
no they shouldnt. db write should happen first and independently — that way the in-app notif always works even if email is down. email should be a background async job decoupled from the main flow. if email service is down for an hour, db still has all the records and we can re-process the email queue later.

**revised pseudocode:**

```
function notify_all(student_ids, message):
  for student_id in student_ids:
    save_to_db(student_id, message)        // do this first, always reliable
    enqueue(email_job, student_id, message) // async, dont block
    push_to_app(student_id, message)       // SSE push

function process_email_queue():
  while job = queue.pop():
    try:
      send_email(job.student_id, job.message)
    catch err:
      if job.retries < 3:
        queue.push(job, delay=60s, retries+1)
      else:
        log("backend", "fatal", "service", "email failed 3 times for: " + job.student_id)
```

this way even if email fails the student still sees the notif in app, and emails get retried automatically.

## Stage 6

priority is decided using a score formula:

  score = weight * (1 / hours_since_posted)

weights assigned:
- Placement = 3
- Result = 2  
- Event = 1

so a placement notif from 1hr ago scores higher than an event from 10mins ago bcz placement is more important overall. recency also matters — older notifs get lower scores automatically.

for keeping top 10 updated as new notifs come in — instead of re-sorting the entire list every time, we can use a min-heap of size n. when a new notif arrives we compute its score and compare with the smallest score in the heap. if its higher we replace the min and re-heapify. this keeps it O(log n) per insertion instead of O(n log n) full sort each time.


getTopNotifications(10);
code is in notification_app_be/prio.js, output screenshot in notification_app_be/output/priority_output.png
