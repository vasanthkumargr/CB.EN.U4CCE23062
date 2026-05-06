'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Container, Typography, Box, Chip, CircularProgress,
  Alert, Select, MenuItem, FormControl, InputLabel,
  Pagination, Button, Card, CardContent, Divider, AppBar, Toolbar
} from '@mui/material';
import { useRouter } from 'next/navigation';

const BACKEND = 'http://localhost:5000';

export default function Home() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [read, setRead] = useState({});
  const limit = 10;

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit, page };
      if (filter) params.notification_type = filter;
      const res = await axios.get(`${BACKEND}/api/notifications`, { params });
      setNotifications(res.data.notifications || []);
      setTotal(res.data.total || res.data.notifications?.length || 0);
    } catch (err) {
      setError('Failed to fetch notifications. Make sure backend is running.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [page, filter]);

  const markRead = (id) => {
    setRead(prev => ({ ...prev, [id]: true }));
  };

  const markAllRead = () => {
    const all = {};
    notifications.forEach(n => { all[n.ID] = true; });
    setRead(prev => ({ ...prev, ...all }));
  };

  const typeColor = (type) => {
    if (type === 'Placement') return 'success';
    if (type === 'Result') return 'warning';
    return 'info';
  };

  return (
    <>
      <AppBar position="static" color="primary">
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight="bold">Campus Notifications</Typography>
          <Button color="inherit" onClick={() => router.push('/priority')}>
            Priority Inbox
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h5" fontWeight="bold">All Notifications</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Filter by Type</InputLabel>
              <Select value={filter} label="Filter by Type" onChange={e => { setFilter(e.target.value); setPage(1); }}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Placement">Placement</MenuItem>
                <MenuItem value="Result">Result</MenuItem>
                <MenuItem value="Event">Event</MenuItem>
              </Select>
            </FormControl>
            <Button variant="outlined" size="small" onClick={markAllRead}>Mark All Read</Button>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
          <Alert severity="info">No notifications found.</Alert>
        ) : (
          <>
            {notifications.map((n, i) => (
              <Card
                key={n.ID}
                sx={{
                  mb: 1.5,
                  opacity: read[n.ID] ? 0.6 : 1,
                  borderLeft: read[n.ID] ? '4px solid #ccc' : '4px solid #1976d2',
                  cursor: 'pointer'
                }}
                onClick={() => markRead(n.ID)}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={n.Type} color={typeColor(n.Type)} size="small" />
                      <Typography variant="body1" fontWeight={read[n.ID] ? 'normal' : 'bold'}>
                        {n.Message}
                      </Typography>
                      {!read[n.ID] && (
                        <Chip label="New" size="small" color="error" variant="outlined" />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(n.Timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ))}

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={Math.ceil(total / limit) || 1}
                page={page}
                onChange={(e, val) => setPage(val)}
                color="primary"
              />
            </Box>
          </>
        )}
      </Container>
    </>
  );
}