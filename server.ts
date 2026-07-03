import express from 'express';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load environment config
dotenv.config();

// Imports
import { setupLocals } from './src/middleware/authMiddleware.js';
import { NovelController } from './src/controllers/NovelController.js';

// Route Imports
import authRoutes from './src/routes/authRoutes.js';
import novelRoutes from './src/routes/novelRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import authorRoutes from './src/routes/authorRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';

async function bootstrap() {
  const app = express();
  const PORT = 3000;

  // Set EJS Engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(process.cwd(), 'views'));

  // Core middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Static Asset Directories
  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

  // Cookie parser helper middleware
  app.use((req: any, res, next) => {
    const list: { [key: string]: string } = {};
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie: string) => {
        let [parts, ...rest] = cookie.split('=');
        const name = parts.trim();
        const value = rest.join('=').trim();
        if (name) {
          list[name] = decodeURIComponent(value);
        }
      });
    }
    req.cookies = list;
    next();
  });

  // Configure Session Middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'premium_novel_secret_hash_key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        secure: false // Run on HTTP in container
      }
    })
  );

  // Setup custom flash messages and locals mapping
  app.use(setupLocals);

  // 1. Core Landing Page & Info Pages
  app.get('/', NovelController.getHome);

  app.get('/about', (req, res) => {
    res.render('about', { title: 'Our Story & Legacy' });
  });

  app.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact Our Librarians' });
  });

  app.post('/contact', (req, res) => {
    req.flash('success', 'Your catalog query has been dispatched to our desk. A librarian will follow up shortly.');
    res.redirect('/contact');
  });

  // 2. Main Route Groups
  app.use('/auth', authRoutes);
  app.use('/novels', novelRoutes);
  app.use('/admin', adminRoutes);
  app.use('/authors', authorRoutes);
  app.use('/', dashboardRoutes); // handles /dashboard, /history, /favorites directly

  // Dark Mode Toggle Endpoint
  app.post('/toggle-dark-mode', (req, res) => {
    const isDarkMode = req.body.darkMode === 'true';
    res.cookie('darkMode', isDarkMode ? 'true' : 'false', { maxAge: 1000 * 60 * 60 * 24 * 365, httpOnly: false });
    res.json({ success: true, darkMode: isDarkMode });
  });

  // 3. Custom Error Pages (403, 404, 500)
  app.get('/403', (req, res) => {
    res.status(403).render('error', { 
      status: 403, 
      title: 'Access Denied', 
      message: 'You do not possess the required credentials to access this section of our archives.' 
    });
  });

  // Integration with Vite Dev Server in Development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  // 404 Handler (Fallback)
  app.use((req, res) => {
    res.status(404).render('error', { 
      status: 404, 
      title: 'Manuscript Not Found', 
      message: 'The chapter or page you are looking for does not exist in our library archives.' 
    });
  });

  // Global 500 Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled internal server error:', err);
    res.status(500).render('error', { 
      status: 500, 
      title: 'Archival System Failure', 
      message: 'An unexpected crash occurred inside our book index server. Our engineers have been alerted.' 
    });
  });

  // Boot Server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Premium Novel Library] Server online at http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
});
