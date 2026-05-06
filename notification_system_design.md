# Notification System Design

## Stage 1

### REST API Endpoints

#### Get All Notifications
```
GET /api/notifications
Headers: Authorization: Bearer <token>
Query Params: limit, page, notification_type
Response: { notifications: [...] }
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
- ACID compliant — no data loss on crashes
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
- Solution 1: Pagination — never fetch all at once
- Solution 2: Index on (student_id, is_read) — fast per-student queries
- Solution 3: Archive old notifications (older than 6 months) to separate table
- Solution 4: Read replicas — writes go to primary DB, reads from replica