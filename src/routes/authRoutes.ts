import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = Router();

// Guest routes
router.get('/register', AuthController.getRegister);
router.post('/register', AuthController.postRegister);

router.get('/login', AuthController.getLogin);
router.post('/login', AuthController.postLogin);

// Auth required routes
router.get('/logout', requireAuth, AuthController.logout);
router.get('/profile', requireAuth, AuthController.getProfile);
router.post('/profile/update', requireAuth, AuthController.updateProfile);
router.post('/profile/avatar', requireAuth, upload.single('avatar'), AuthController.updateAvatar);
router.post('/profile/password', requireAuth, AuthController.updatePassword);

export default router;
