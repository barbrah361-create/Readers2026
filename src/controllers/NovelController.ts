import { Request, Response } from 'express';
import { NovelModel } from '../models/Novel.js';
import { AuthorModel } from '../models/Author.js';
import { CommentModel } from '../models/Comment.js';
import { UserModel } from '../models/User.js';
import { generateQRCode } from '../utils/qrcode.js';
import { CATEGORIES } from '../types/common.js';
import { sanitizeText } from '../utils/sanitize.js';
import { featuredArticles } from '../config/articles.js';
import { getLocalAuthorPhoto } from '../utils/authorPhoto.js';


export const NovelController = {
  // 1. Landing Page
  getHome: async (req: Request, res: Response) => {
    try {
      const novels = NovelModel.findPublic().sort({ readerCount: -1 }).limit(3).exec();
      const authors = AuthorModel.findPublic().sort({ novelCount: -1 }).limit(4).exec();
      
      const hostUrl = req.protocol + '://' + req.get('host');
      const shareQRCode = await generateQRCode(hostUrl);

      const categories = [...CATEGORIES];

      res.render('home', {
        title: 'Home',
        featuredNovels: novels,
        featuredAuthors: authors,
        featuredArticles,
        categories,
        shareQRCode
      });
    } catch (error) {
      console.error('Home page error:', error);
      res.status(500).render('error', { statusCode: 500, message: 'Internal Server Error' });
    }
  },

  // 2. Discover / Novels Directory (with search, pagination, filter)
  getNovels: async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = 6;
      const skip = (page - 1) * limit;

      const search = (req.query.search as string) || '';
      const genre = (req.query.genre as string) || '';
      const authorId = (req.query.authorId as string) || '';
      const sort = (req.query.sort as string) || 'latest';

      const query: any = { approvalStatus: 'approved' };
      if (search) {
        query.title = { $regex: search, $options: 'i' };
      }
      if (genre) {
        query.genre = genre;
      }
      if (authorId) {
        query.authorId = authorId;
      }

      // Build chain
      let queryChain = NovelModel.find(query);

      // Sort logic
      if (sort === 'rating') {
        queryChain = queryChain.sort({ rating: -1 });
      } else if (sort === 'popular') {
        queryChain = queryChain.sort({ readerCount: -1 });
      } else {
        queryChain = queryChain.sort({ createdAt: -1 });
      }

      // Pagination
      const totalNovels = NovelModel.countDocuments(query);
      const novels = queryChain.skip(skip).limit(limit).exec();
      const totalPages = Math.ceil(totalNovels / limit);

      const authors = AuthorModel.findPublic().exec();
      const categories = [...CATEGORIES];

      res.render('novels', {
        title: 'Discover Novels',
        novels,
        authors,
        categories,
        filters: { search, genre, authorId, sort },
        pagination: {
          currentPage: page,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error('Discover novels error:', error);
      res.status(500).render('error', { statusCode: 500, message: 'Could not load novels directory.' });
    }
  },

  // 3. Novel Details Page
  getNovelDetails: async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const novel = NovelModel.findById(id);
      if (!novel || (novel.approvalStatus !== 'approved' && !UserModel.isAdmin(res.locals.user))) {
        return res.status(404).render('error', { statusCode: 404, message: 'Novel not found.' });
      }

      const author = AuthorModel.findById(novel.authorId);
      const comments = CommentModel.find({ novelId: id }).sort({ createdAt: -1 }).exec();
      const relatedNovels = NovelModel.findPublic({ genre: novel.genre })
        .sort({ readerCount: -1 }).limit(6).exec()
        .filter((n: any) => n._id !== id);
      const authorNovels = NovelModel.findPublic({ authorId: novel.authorId })
        .sort({ createdAt: -1 }).limit(6).exec()
        .filter((n: any) => n._id !== id);

      // Generate Reading QR Code
      const hostUrl = req.protocol + '://' + req.get('host');
      const readUrl = `${hostUrl}/novels/${id}/read`;
      const qrCode = await generateQRCode(readUrl);

      // Increment reader count slightly on page view (simulated traffic)
      NovelModel.findByIdAndUpdate(id, { readerCount: novel.readerCount + 1 });

      res.render('novel-details', {
        title: novel.title,
        novel,
        author,
        comments,
        qrCode,
        relatedNovels,
        authorNovels
      });
    } catch (error) {
      console.error('Novel details error:', error);
      res.status(500).render('error', { statusCode: 500, message: 'Could not load novel details.' });
    }
  },

  // 4. Read Novel Page (Login required)
  getReadNovel: async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = res.locals.user;
    if (!user) {
      req.flash('error', 'You must be logged in to read novels online.');
      return res.redirect('/auth/login');
    }

    try {
      const novel = NovelModel.findById(id);
      if (!novel) {
        return res.status(404).render('error', { statusCode: 404, message: 'Novel not found.' });
      }

      // Page pagination
      let pageIndex = parseInt(req.query.page as string) || 0;
      if (pageIndex < 0) pageIndex = 0;
      if (pageIndex >= novel.contentPages.length) pageIndex = novel.contentPages.length - 1;

      // Update User Reading History & Continue Reading tracker
      const updatedHistory = [...user.readingHistory];
      const existingHistoryIndex = updatedHistory.findIndex((h: any) => String(h.novelId) === String(id));
      
      const historyItem = {
        novelId: id,
        pageIndex,
        lastReadAt: new Date().toISOString()
      };

      if (existingHistoryIndex > -1) {
        updatedHistory[existingHistoryIndex] = historyItem;
      } else {
        updatedHistory.push(historyItem);
      }

      // Update UserModel
      UserModel.findByIdAndUpdate(user._id, { readingHistory: updatedHistory });

      // Calculate progress percentage
      const totalPages = novel.contentPages.length;
      const progressPercent = Math.round(((pageIndex + 1) / totalPages) * 100);

      // Check if bookmarked
      const isBookmarked = user.bookmarks.some((b: any) => String(b.novelId) === String(id) && b.pageIndex === pageIndex);

      res.render('read-novel', {
        title: `Reading - ${novel.title}`,
        novel,
        currentPageContent: novel.contentPages[pageIndex],
        pageIndex,
        totalPages,
        progressPercent,
        isBookmarked
      });
    } catch (error) {
      console.error('Read novel error:', error);
      res.status(500).render('error', { statusCode: 500, message: 'Could not open reading platform.' });
    }
  },

  // 5. Bookmark Page
  postBookmark: (req: Request, res: Response) => {
    const { id } = req.params;
    const pageIndex = parseInt(req.body.pageIndex) || 0;
    const user = res.locals.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    try {
      const updatedBookmarks = [...user.bookmarks];
      const existingIdx = updatedBookmarks.findIndex((b: any) => String(b.novelId) === String(id));

      if (existingIdx > -1) {
        // If bookmark for this novel already exists, update the page index or remove if same page
        if (updatedBookmarks[existingIdx].pageIndex === pageIndex) {
          updatedBookmarks.splice(existingIdx, 1);
          UserModel.findByIdAndUpdate(user._id, { bookmarks: updatedBookmarks });
          req.flash('success', 'Bookmark removed.');
          return res.redirect(`/novels/${id}/read?page=${pageIndex}`);
        } else {
          updatedBookmarks[existingIdx].pageIndex = pageIndex;
          updatedBookmarks[existingIdx].bookmarkedAt = new Date().toISOString();
        }
      } else {
        updatedBookmarks.push({
          novelId: id,
          pageIndex,
          bookmarkedAt: new Date().toISOString()
        });
      }

      UserModel.findByIdAndUpdate(user._id, { bookmarks: updatedBookmarks });
      req.flash('success', 'Page bookmarked successfully.');
      res.redirect(`/novels/${id}/read?page=${pageIndex}`);
    } catch (error) {
      console.error('Bookmark error:', error);
      req.flash('error', 'Could not save bookmark.');
      res.redirect(`/novels/${id}/read?page=${pageIndex}`);
    }
  },

  // 6. Toggle Favorites
  postFavorite: (req: Request, res: Response) => {
    const { id } = req.params;
    const user = res.locals.user;
    if (!user) {
      req.flash('error', 'You must be logged in to save favorites.');
      return res.redirect('/auth/login');
    }

    try {
      const favorites = [...user.favorites];
      const idx = favorites.indexOf(id);
      let isFavorite = false;

      if (idx > -1) {
        favorites.splice(idx, 1);
        req.flash('success', 'Removed from favorites.');
      } else {
        favorites.push(id);
        isFavorite = true;
        req.flash('success', 'Added to favorites!');
      }

      UserModel.findByIdAndUpdate(user._id, { favorites });
      res.redirect(`/novels/${id}`);
    } catch (error) {
      console.error('Favorite error:', error);
      req.flash('error', 'Could not update favorites.');
      res.redirect(`/novels/${id}`);
    }
  },

  // 7. Add Comment / Review
  postComment: (req: Request, res: Response) => {
    const { id } = req.params;
    const { content, rating } = req.body;
    const user = res.locals.user;
    if (!user) {
      req.flash('error', 'You must be logged in to submit reviews.');
      return res.redirect('/auth/login');
    }

    if (!content) {
      req.flash('error', 'Comment content cannot be empty.');
      return res.redirect(`/novels/${id}`);
    }

    try {
      const starRating = rating ? parseInt(rating) : undefined;
      CommentModel.create({
        novelId: id,
        userId: user._id,
        username: user.username,
        userAvatar: user.avatar || '/uploads/default-avatar.png',
        content: sanitizeText(content, 2000),
        rating: starRating
      });

      // Recalculate average rating of the novel
      const novel = NovelModel.findById(id);
      if (novel && starRating) {
        const totalRatings = novel.ratingCount + 1;
        const newRating = parseFloat(((novel.rating * novel.ratingCount + starRating) / totalRatings).toFixed(1));
        NovelModel.findByIdAndUpdate(id, {
          rating: newRating,
          ratingCount: totalRatings
        });
      }

      req.flash('success', 'Review submitted successfully.');
      res.redirect(`/novels/${id}`);
    } catch (error) {
      console.error('Comment submit error:', error);
      req.flash('error', 'Could not post comment.');
      res.redirect(`/novels/${id}`);
    }
  },

  // 8. Reply to comment
  postCommentReply: (req: Request, res: Response) => {
    const { id, commentId } = req.params;
    const { replyContent } = req.body;
    const user = res.locals.user;
    if (!user) {
      req.flash('error', 'You must be logged in to reply.');
      return res.redirect('/auth/login');
    }

    if (!replyContent) {
      req.flash('error', 'Reply content cannot be empty.');
      return res.redirect(`/novels/${id}`);
    }

    try {
      const comment = CommentModel.findById(commentId);
      if (comment) {
        const replies = comment.replies || [];
        replies.push({
          username: user.username,
          userAvatar: user.avatar || '/uploads/default-avatar.png',
          content: sanitizeText(replyContent, 1000),
          createdAt: new Date().toISOString()
        });
        CommentModel.findByIdAndUpdate(commentId, { replies });
        req.flash('success', 'Reply posted successfully.');
      } else {
        req.flash('error', 'Comment not found.');
      }
      res.redirect(`/novels/${id}`);
    } catch (error) {
      console.error('Reply submit error:', error);
      req.flash('error', 'Could not post reply.');
      res.redirect(`/novels/${id}`);
    }
  },

  // 9. Report Comment
  postReportComment: (req: Request, res: Response) => {
    const { id, commentId } = req.params;
    try {
      CommentModel.findByIdAndUpdate(commentId, { isReported: true });
      req.flash('success', 'Thank you. Comment has been reported for review.');
      res.redirect(`/novels/${id}`);
    } catch (error) {
      console.error('Report comment error:', error);
      req.flash('error', 'Could not report comment.');
      res.redirect(`/novels/${id}`);
    }
  },

  // 10. Authors List
  getAuthors: (req: Request, res: Response) => {
    try {
      const authors = AuthorModel.findPublic().exec().map((a: any) => ({
        ...a,
        photo: getLocalAuthorPhoto(a)
      }));
      res.render('authors', { title: 'Meet Our Authors', authors });
    } catch (error) {
      console.error('Load authors error:', error);
      res.status(500).render('error', { statusCode: 500, message: 'Could not load authors.' });
    }
  },


  // 11. Author Profile Page
  getAuthorProfile: (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const author = AuthorModel.findById(id);
      if (author) {
        (author as any).photo = getLocalAuthorPhoto(author);
      }

      if (!author || (author.approvalStatus !== 'approved' && !UserModel.isAdmin(res.locals.user))) {
        return res.status(404).render('error', { statusCode: 404, message: 'Author not found.' });
      }

      const novels = NovelModel.findPublic({ authorId: id }).sort({ readerCount: -1 }).exec();

      res.render('author-profile', {
        title: author.name,
        author,
        novels
      });
    } catch (error) {
      console.error('Author profile error:', error);
      res.status(500).render('error', { statusCode: 500, message: 'Could not load author profile.' });
    }
  },

  // 12. Categories Page
  getCategories: (req: Request, res: Response) => {
    const category = (req.query.category as string) || '';
    const categories = [...CATEGORIES];

    let categoryNovels: any[] = [];
    if (category) {
      const exact = NovelModel.findPublic({ genre: category }).sort({ readerCount: -1 }).limit(12).exec();
      const similar = NovelModel.findPublic().sort({ readerCount: -1 }).limit(50).exec()
        .filter((n: any) => n.genre !== category && (
          n.tags?.includes(category) ||
          n.genre?.toLowerCase().includes(category.toLowerCase().split(' ')[0])
        )).slice(0, 12);
      const recent = NovelModel.findPublic().sort({ createdAt: -1 }).limit(12).exec();
      const seen = new Set<string>();
      categoryNovels = [...exact, ...similar, ...recent].filter(n => {
        if (seen.has(n._id)) return false;
        seen.add(n._id);
        return true;
      }).slice(0, 24);
    }

    res.render('categories', { title: category || 'Explore Genres', categories, category, categoryNovels });
  }
};
