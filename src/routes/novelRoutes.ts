import { Router } from 'express';
import { NovelController } from '../controllers/NovelController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Guest/Public routes
router.get('/', NovelController.getNovels);
router.get('/categories', NovelController.getCategories);
router.get('/:id', NovelController.getNovelDetails);

// Auth required routes for interactive operations
router.get('/:id/read', requireAuth, NovelController.getReadNovel);
router.post('/:id/bookmark', requireAuth, NovelController.postBookmark);
router.post('/:id/favorite', requireAuth, NovelController.postFavorite);
router.post('/:id/comment', requireAuth, NovelController.postComment);
router.post('/:id/comments', requireAuth, NovelController.postComment);
router.post('/:id/comment/:commentId/reply', requireAuth, NovelController.postCommentReply);
router.post('/:id/comment/:commentId/report', requireAuth, NovelController.postReportComment);
router.post('/:id/comments/report/:commentId', requireAuth, NovelController.postReportComment);

export default router;
