import { Request, Response } from 'express';
import { UserModel } from '../models/User.js';

export const AuthController = {
  // Show Register Form
  getRegister: (req: Request, res: Response) => {
    if (req.session.userId) {
      return res.redirect('/dashboard');
    }
    res.render('register', { title: 'Create Account' });
  },

  // Handle Registration
  postRegister: async (req: Request, res: Response) => {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      req.flash('error', 'All fields are required.');
      return res.redirect('/auth/register');
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/auth/register');
    }

    try {
      // Check if user already exists
      const existingUser = UserModel.findOne({ email });
      if (existingUser) {
        req.flash('error', 'An account with this email already exists.');
        return res.redirect('/auth/register');
      }

      const existingUsername = UserModel.findOne({ username });
      if (existingUsername) {
        req.flash('error', 'Username is already taken.');
        return res.redirect('/auth/register');
      }

      // Create User
      const user = await UserModel.create({
        username,
        email,
        password,
        role: 'user' // Default role
      });

      req.session.userId = user._id;
      req.flash('success', 'Welcome! Your account has been created successfully.');
      res.redirect('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      req.flash('error', 'An error occurred during registration. Please try again.');
      res.redirect('/auth/register');
    }
  },

  // Show Login Form
  getLogin: (req: Request, res: Response) => {
    if (req.session.userId) {
      return res.redirect('/dashboard');
    }
    res.render('login', { title: 'Sign In' });
  },

  // Handle Login
  postLogin: async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      req.flash('error', 'Please enter your email and password.');
      return res.redirect('/auth/login');
    }

    try {
      const user = UserModel.findOne({ email });
      if (!user) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect('/auth/login');
      }

      const isMatch = await UserModel.comparePassword(password, user.passwordHash);
      if (!isMatch) {
        req.flash('error', 'Invalid email or password.');
        return res.redirect('/auth/login');
      }

      req.session.userId = user._id;
      req.flash('success', `Welcome back, ${user.username}!`);
      
      if (user.role === 'admin') {
        res.redirect('/admin');
      } else {
        res.redirect('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      req.flash('error', 'An error occurred during sign in. Please try again.');
      res.redirect('/auth/login');
    }
  },

  // Logout
  logout: (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.redirect('/');
    });
  },

  // Show Profile page
  getProfile: (req: Request, res: Response) => {
    const user = res.locals.user;
    if (!user) {
      req.flash('error', 'You must be logged in to view your profile.');
      return res.redirect('/auth/login');
    }
    res.render('profile', { title: 'My Profile', profileUser: user });
  },

  // Update Profile details
  updateProfile: (req: Request, res: Response) => {
    const user = res.locals.user;
    if (!user) return res.redirect('/auth/login');

    const { username, bio } = req.body;

    if (!username) {
      req.flash('error', 'Username is required.');
      return res.redirect('/profile');
    }

    // Check if username taken by someone else
    const existing = UserModel.findOne({ username });
    if (existing && String(existing._id) !== String(user._id)) {
      req.flash('error', 'Username is already taken.');
      return res.redirect('/profile');
    }

    try {
      UserModel.findByIdAndUpdate(user._id, { username, bio });
      req.flash('success', 'Profile details updated successfully.');
      res.redirect('/profile');
    } catch (error) {
      console.error('Update profile error:', error);
      req.flash('error', 'Could not update profile details.');
      res.redirect('/profile');
    }
  },

  // Update Profile picture (Avatar)
  updateAvatar: (req: Request, res: Response) => {
    const user = res.locals.user;
    if (!user) return res.redirect('/auth/login');

    if (!req.file) {
      req.flash('error', 'Please upload a valid image file.');
      return res.redirect('/profile');
    }

    try {
      const avatarUrl = `/uploads/${req.file.filename}`;
      UserModel.findByIdAndUpdate(user._id, { avatar: avatarUrl });
      req.flash('success', 'Profile picture updated successfully.');
      res.redirect('/profile');
    } catch (error) {
      console.error('Update avatar error:', error);
      req.flash('error', 'Could not update profile picture.');
      res.redirect('/profile');
    }
  },

  // Update Password
  updatePassword: async (req: Request, res: Response) => {
    const user = res.locals.user;
    if (!user) return res.redirect('/auth/login');

    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      req.flash('error', 'All password fields are required.');
      return res.redirect('/profile');
    }

    if (newPassword !== confirmNewPassword) {
      req.flash('error', 'New passwords do not match.');
      return res.redirect('/profile');
    }

    try {
      const isMatch = await UserModel.comparePassword(currentPassword, user.passwordHash);
      if (!isMatch) {
        req.flash('error', 'Current password is incorrect.');
        return res.redirect('/profile');
      }

      const passwordHash = await UserModel.hashPassword(newPassword);
      UserModel.findByIdAndUpdate(user._id, { passwordHash });
      
      req.flash('success', 'Password updated successfully.');
      res.redirect('/profile');
    } catch (error) {
      console.error('Update password error:', error);
      req.flash('error', 'Could not update password.');
      res.redirect('/profile');
    }
  }
};
