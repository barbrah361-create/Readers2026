import { AuthorDB } from '../config/db.js';

export interface Author {
  _id: string;
  id: string;
  name: string;
  photo: string;
  bio: string;
  nationality: string;
  literaryAchievements: string;
  famousNovels: string;
  novelCount: number;
  externalLink?: string;
  createdAt: string;
}

export const AuthorModel = {
  find: (query?: any) => AuthorDB.find(query),
  findOne: (query?: any) => AuthorDB.findOne(query),
  findById: (id: string) => AuthorDB.findById(id),
  create: (data: Partial<Author>) => AuthorDB.create(data),
  findByIdAndUpdate: (id: string, update: Partial<Author>) => AuthorDB.findByIdAndUpdate(id, update),
  findByIdAndDelete: (id: string) => AuthorDB.findByIdAndDelete(id),
  countDocuments: (query?: any) => AuthorDB.countDocuments(query)
};
