import express from 'express';
import cors from 'cors';
import session from 'express-session';
import authRoutes from './routes/auth.js';
import rulesRoutes from './routes/rules.js';

const app = express();

// Trust proxy is required for secure cookies on Render
app.set('trust proxy', true);


app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

const isProd = process.env.NODE_ENV === 'production' || 
               (process.env.SF_CALLBACK_URL && process.env.SF_CALLBACK_URL.includes('onrender.com'));

app.use(session({

  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd, // Must be true on HTTPS (Render)
    sameSite: isProd ? 'none' : 'lax', // 'none' is required for cross-domain Vercel <-> Render cookies
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 2, // 2 hours
  },
}));


app.use('/api/auth', authRoutes);
app.use('/api/rules', rulesRoutes);

// catch-all error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

export default app;
