import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/User.js';

// Extend Express Session type
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    flash?: { [key: string]: string[] };
  }
}

// Custom request properties can be declared or we can just access session
export function setupLocals(req: Request, res: Response, next: NextFunction) {
  // Flash messages helper
  req.flash = (type: string, message: string) => {
    if (!req.session) return;
    if (!req.session.flash) {
      req.session.flash = {};
    }
    if (!req.session.flash[type]) {
      req.session.flash[type] = [];
    }
    req.session.flash[type].push(message);
  };

  // Consume flash messages into locals
  res.locals.flash = {};
  if (req.session && req.session.flash) {
    res.locals.flash = { ...req.session.flash };
    req.session.flash = {}; // Clear flash
  }

  // Set current path
  res.locals.currentPath = req.path;

  // Set default dark mode state (Elegant Dark is true by default if no cookie is set)
  res.locals.darkMode = req.cookies?.darkMode !== 'false';

  // Load user if logged in
  if (req.session && req.session.userId) {
    const user = UserModel.findById(req.session.userId);
    if (user) {
      res.locals.user = user;
      return next();
    }
  }

  res.locals.user = null;
  next();
}

// Require user authentication
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    req.flash('error', 'You must be logged in to view this page.');
    return res.redirect('/auth/login');
  }
  next();
}

// Require admin authentication
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    req.flash('error', 'You must be logged in to access the admin portal.');
    return res.redirect('/auth/login');
  }
  
  const user = UserModel.findById(req.session.userId);
  if (!user || user.role !== 'admin') {
    req.flash('error', 'Access denied. Administrator privileges required.');
    return res.redirect('/403');
  }
  next();
}

// Add custom flash method to Request interface
declare global {
  namespace Express {
    interface Request {
      flash(type: string, message: string): void;
    }
  }
}
