'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Container, Typography, Box, Chip, CircularProgress,
  Alert, Select, MenuItem, FormControl, InputLabel,
  Card, CardContent, AppBar, Toolbar, Button, TextField
} from '@mui/material';
import { useRouter } from 'next/navigation';

const BACKEND = 'http://localhost:5000';
const WEIGHTS = { Placement: 3, Result: 2, Event: 1 };

export default function Priority() {
    const router = useRouter();
    const [notifications, setNotifications] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [topN, setTopN] = useState(10);
    const [read, setRead] = useState({});
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
    setMounted(true);
    }, []);

    const fetchAndScore = async () => {
        setLoading(true);
        setError('');
        try {
        const res = await axios.get(`${BACKEND}/api/notifications`, { params: { limit: 10 } });
        const notifs = res.data.notifications || [];
        const now = new Date();

        const scored = notifs.map(n => {
            const w = WEIGHTS[n.Type] ?? 1;
            const hoursAgo = (now - new Date(n.Timestamp)) / (1000 * 60 * 60);
            const score = w * (1 / (hoursAgo + 0.01));
            return { ...n, score: parseFloat(score.toFixed(4)) };
        });

        scored.sort((a, b) => b.score - a.score);
        setNotifications(scored);
        } catch (err) {
        setError('Failed to fetch. Make sure backend is running.');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAndScore();
    }, []);

    useEffect(() => {
        let result = [...notifications];
        if (typeFilter) result = result.filter(n => n.Type === typeFilter);
        setFiltered(result.slice(0, topN));
    }, [notifications, typeFilter, topN]);

    const markRead = (id) => setRead(prev => ({ ...prev, [id]: true }));

    const typeColor = (type) => {
        if (type === 'Placement') return 'success';
        if (type === 'Result') return 'warning';
        return 'info';
    };
    if (!mounted) return null;

    return (
        <>
        <AppBar position="static" color="secondary">
            <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Typography variant="h6" fontWeight="bold">Priority Inbox</Typography>
            <Button color="inherit" onClick={() => router.push('/')}>
                All Notifications
            </Button>
            </Toolbar>
        </AppBar>

        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h5" fontWeight="bold">Top Priority Notifications</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                    label="Top N"
                    type="number"
                    size="small"
                    value={topN}
                    onChange={e => setTopN(parseInt(e.target.value) || 10)}
                    sx={{ width: 90 }}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Filter by Type</InputLabel>
                <Select value={typeFilter} label="Filter by Type" onChange={e => setTypeFilter(e.target.value)}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="Placement">Placement</MenuItem>
                    <MenuItem value="Result">Result</MenuItem>
                    <MenuItem value="Event">Event</MenuItem>
                </Select>
                </FormControl>
            </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                <CircularProgress />
            </Box>
            ) : filtered.length === 0 ? (
            <Alert severity="info">No notifications found.</Alert>
            ) : (
            filtered.map((n, i) => (
                <Card
                key={n.ID}
                sx={{
                    mb: 1.5,
                    opacity: read[n.ID] ? 0.6 : 1,
                    borderLeft: read[n.ID] ? '4px solid #ccc' : '4px solid #9c27b0',
                    cursor: 'pointer'
                }}
                onClick={() => markRead(n.ID)}
                >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={`#${i + 1}`} size="small" variant="outlined" />
                        <Chip label={n.Type} color={typeColor(n.Type)} size="small" />
                        <Typography variant="body1" fontWeight={read[n.ID] ? 'normal' : 'bold'}>
                        {n.Message}
                        </Typography>
                        {!read[n.ID] && <Chip label="Unread" size="small" color="error" variant="outlined" />}
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                        Score: {n.score}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                        {new Date(n.Timestamp).toLocaleString()}
                        </Typography>
                    </Box>
                    </Box>
                </CardContent>
                </Card>
            ))
            )}
        </Container>
        </>
    );
    }