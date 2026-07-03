import { UserDB } from '../config/db.js';
import bcryptjs from 'bcryptjs';

export interface Bookmark {
  novelId: string;
  pageIndex: number;
  bookmarkedAt: string;
}

export interface ReadingHistoryItem {
  novelId: string;
  pageIndex: number;
  lastReadAt: string;
}

export interface User {
  _id: string;
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  avatar?: string;
  bio?: string;
  favorites: string[]; // novelIds
  bookmarks: Bookmark[];
  readingHistory: ReadingHistoryItem[];
  createdAt: string;
}

export const UserModel = {
  find: (query?: any) => UserDB.find(query),
  findOne: (query?: any) => UserDB.findOne(query),
  findById: (id: string) => UserDB.findById(id),
  
  create: async (data: Omit<User, '_id' | 'id' | 'createdAt' | 'favorites' | 'bookmarks' | 'readingHistory' | 'passwordHash'> & { password?: string; passwordHash?: string }) => {
    let passwordHash = data.passwordHash;
    if (data.password) {
      passwordHash = await bcryptjs.hash(data.password, 10);
    }
    
    return UserDB.create({
      username: data.username,
      email: data.email,
      passwordHash,
      role: data.role || 'user',
      avatar: data.avatar || '/uploads/default-avatar.png',
      bio: data.bio || '',
      favorites: [],
      bookmarks: [],
      readingHistory: []
    });
  },

  findByIdAndUpdate: (id: string, update: any) => {
    return UserDB.findByIdAndUpdate(id, update);
  },

  findByIdAndDelete: (id: string) => {
    return UserDB.findByIdAndDelete(id);
  },

  comparePassword: async (password: string, hash: string): Promise<boolean> => {
    return bcryptjs.compare(password, hash);
  },

  hashPassword: async (password: string): Promise<string> => {
    return bcryptjs.hash(password, 10);
  }
};
