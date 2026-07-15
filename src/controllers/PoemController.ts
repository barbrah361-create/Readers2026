import { Request, Response } from 'express';
import { PoemModel } from '../models/Poem.js';
import { PaymentModel } from '../models/Payment.js';
import { UserModel } from '../models/User.js';
import { NotificationModel } from '../models/Notification.js';
import { EmailService } from '../services/emailService.js';
import { MpesaService } from '../services/mpesaService.js';
import { sanitizeText } from '../utils/sanitize.js';

export const PoemController = {
  getPoems: (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;
    const sort = (req.query.sort as string) || 'latest';

    let chain = PoemModel.findPublic();
    if (sort === 'popular') chain = chain.sort({ viewCount: -1 });
    else if (sort === 'liked') chain = chain.sort({ likes: -1 });
    else chain = chain.sort({ createdAt: -1 });

    const total = PoemModel.countDocuments({ approvalStatus: 'approved' });
    const poems = chain.skip(skip).limit(limit).exec();

    res.render('poems', {
      title: 'Poetry Community',
      poems,
      page,
      totalPages: Math.ceil(total / limit),
      sort
    });
  },

  getPoemDetails: (req: Request, res: Response) => {
    const poem = PoemModel.findById(req.params.id);
    if (!poem || (poem.approvalStatus !== 'approved' && !UserModel.isAdmin(res.locals.user))) {
      return res.status(404).render('error', { status: 404, message: 'Poem not found.' });
    }
    PoemModel.findByIdAndUpdate(poem._id, { viewCount: (poem.viewCount || 0) + 1 });
    res.render('poem-details', { title: poem.title, poem });
  },

  getSubmitPoem: (req: Request, res: Response) => {
    res.render('submit-poem', { title: 'Publish a Poem', fee: MpesaService.SUBMISSION_FEE });
  },

  postSubmitPoem: async (req: Request, res: Response) => {
    const user = res.locals.user;
    const { title, content, genre, tags, phoneNumber } = req.body;

    if (!title || !content || !phoneNumber) {
      req.flash('error', 'Title, content, and M-Pesa phone number are required.');
      return res.redirect('/poems/submit');
    }

    const payment = PaymentModel.create({
      userId: user._id,
      contentType: 'poem',
      contentTitle: sanitizeText(title, 200),
      amount: MpesaService.SUBMISSION_FEE,
      phoneNumber: phoneNumber.replace(/\D/g, '')
    });

    const stk = await MpesaService.initiateStkPush(
      phoneNumber,
      payment.invoiceNumber,
      'Poem submission'
    );

    if (!stk.success) {
      req.flash('error', stk.error || 'Payment initiation failed.');
      return res.redirect('/poems/submit');
    }

    PaymentModel.findByIdAndUpdate(payment._id, {
      checkoutRequestId: stk.checkoutRequestId,
      merchantRequestId: stk.merchantRequestId,
      status: process.env.MPESA_CONSUMER_KEY ? 'pending' : 'completed',
      completedAt: process.env.MPESA_CONSUMER_KEY ? undefined : new Date().toISOString(),
      mpesaReceiptNumber: process.env.MPESA_CONSUMER_KEY ? undefined : `DEV-${payment.invoiceNumber}`
    });

    const isDevMode = !process.env.MPESA_CONSUMER_KEY;
    if (isDevMode) {
      const poem = PoemModel.create({
        title: sanitizeText(title, 200),
        content: sanitizeText(content, 10000),
        authorId: user._id,
        authorName: user.username,
        genre: genre || 'Poetry',
        tags: (tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
        submittedBy: user._id,
        paymentId: payment._id,
        approvalStatus: 'pending'
      });

      PaymentModel.findByIdAndUpdate(payment._id, { contentId: poem._id });
      await EmailService.sendUploadReceived(user.email, user.username, 'poem', poem.title);
      await EmailService.sendPaymentReceived(user.email, user.username, MpesaService.SUBMISSION_FEE, payment.invoiceNumber);
      req.flash('success', 'Poem submitted! It will be reviewed by our team after payment confirmation.');
      return res.redirect('/dashboard/submissions');
    }

    req.flash('success', 'STK Push sent! Complete payment on your phone, then your poem will be submitted.');
    res.redirect('/dashboard/submissions');
  },

  postLike: (req: Request, res: Response) => {
    const user = res.locals.user;
    const poem = PoemModel.findById(req.params.id);
    if (!poem) return res.redirect('/poems');

    const likes = poem.likes || [];
    const idx = likes.indexOf(user._id);
    if (idx >= 0) likes.splice(idx, 1);
    else likes.push(user._id);

    PoemModel.findByIdAndUpdate(poem._id, { likes });
    res.redirect(`/poems/${poem._id}`);
  },

  postComment: (req: Request, res: Response) => {
    const user = res.locals.user;
    const poem = PoemModel.findById(req.params.id);
    if (!poem) return res.redirect('/poems');

    const content = sanitizeText(req.body.content || '', 2000);
    if (!content) {
      req.flash('error', 'Comment cannot be empty.');
      return res.redirect(`/poems/${poem._id}`);
    }

    const comment = {
      _id: Math.random().toString(36).substring(2, 15),
      userId: user._id,
      username: user.username,
      userAvatar: user.avatar,
      content,
      replies: [],
      createdAt: new Date().toISOString()
    };

    PoemModel.findByIdAndUpdate(poem._id, { comments: [...(poem.comments || []), comment] });

    if (poem.submittedBy !== user._id) {
      const author = UserModel.findById(poem.submittedBy);
      if (author) {
        NotificationModel.notify(author._id, 'comment', 'New comment on your poem', `${user.username} commented on "${poem.title}"`, `/poems/${poem._id}`);
        EmailService.sendCommentNotification(author.email, author.username, user.username, poem.title, `/poems/${poem._id}`);
      }
    }

    req.flash('success', 'Comment added.');
    res.redirect(`/poems/${poem._id}`);
  }
};
