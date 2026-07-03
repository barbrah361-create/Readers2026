import { NovelDB } from '../config/db.js';

export interface Novel {
  _id: string;
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  genre: string;
  description: string;
  coverImage: string;
  publicationYear: number;
  synopsis: string;
  rating: number;
  ratingCount: number;
  readerCount: number;
  contentPages: string[];
  qrCode?: string;
  createdAt: string;
}

export const NovelModel = {
  find: (query?: any) => NovelDB.find(query),
  findOne: (query?: any) => NovelDB.findOne(query),
  findById: (id: string) => NovelDB.findById(id),
  create: (data: Partial<Novel>) => NovelDB.create(data),
  findByIdAndUpdate: (id: string, update: Partial<Novel>) => NovelDB.findByIdAndUpdate(id, update),
  findByIdAndDelete: (id: string) => NovelDB.findByIdAndDelete(id),
  countDocuments: (query?: any) => NovelDB.countDocuments(query)
};
