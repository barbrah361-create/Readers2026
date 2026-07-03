import fs from 'fs';
import path from 'path';
import bcryptjs from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Utility to read JSON file safely
function readJSON(filename: string): any[] {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading database file ${filename}:`, error);
    return [];
  }
}

// Utility to write JSON file safely
function writeJSON(filename: string, data: any[]): void {
  const filepath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing database file ${filename}:`, error);
  }
}

export class QueryChain<T> {
  private data: T[];

  constructor(data: T[]) {
    this.data = [...data];
  }

  filter(query: any): QueryChain<T> {
    if (!query || Object.keys(query).length === 0) return this;
    
    this.data = this.data.filter((item: any) => {
      for (const key in query) {
        if (Object.prototype.hasOwnProperty.call(query, key)) {
          const val = query[key];
          
          if (val && typeof val === 'object' && '$regex' in val) {
            // Regex query support
            const regex = new RegExp(val.$regex, val.$options || 'i');
            if (!regex.test(String(item[key] || ''))) return false;
          } else if (Array.isArray(item[key])) {
            // Array inclusion support
            if (Array.isArray(val)) {
              if (!val.every(v => item[key].includes(v))) return false;
            } else {
              if (!item[key].includes(val)) return false;
            }
          } else {
            // Direct comparison
            if (String(item[key]) !== String(val)) return false;
          }
        }
      }
      return true;
    });
    
    return this;
  }

  sort(sortOption: any): QueryChain<T> {
    if (!sortOption) return this;
    
    const keys = Object.keys(sortOption);
    if (keys.length === 0) return this;
    
    const key = keys[0];
    const order = sortOption[key] === -1 ? -1 : 1;
    
    this.data.sort((a: any, b: any) => {
      if (a[key] < b[key]) return -1 * order;
      if (a[key] > b[key]) return 1 * order;
      return 0;
    });
    
    return this;
  }

  skip(n: number): QueryChain<T> {
    this.data = this.data.slice(n);
    return this;
  }

  limit(n: number): QueryChain<T> {
    this.data = this.data.slice(0, n);
    return this;
  }

  populate(field: string, collectionName: string): QueryChain<T> {
    const relatedData = readJSON(`${collectionName}.json`);
    this.data = this.data.map((item: any) => {
      const copy = { ...item };
      const foreignId = copy[field];
      if (foreignId) {
        const relatedItem = relatedData.find((r: any) => String(r._id || r.id) === String(foreignId));
        if (relatedItem) {
          // Populate as an object instead of ID
          copy[field.replace('Id', '')] = relatedItem;
        }
      }
      return copy;
    });
    return this;
  }

  exec(): T[] {
    return this.data;
  }
}

export class DBModel<T extends { _id?: string; id?: string; [key: string]: any }> {
  private filename: string;
  private collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
    this.filename = `${collectionName}.json`;
  }

  private getAll(): T[] {
    return readJSON(this.filename);
  }

  private saveAll(data: T[]): void {
    writeJSON(this.filename, data);
  }

  find(query: any = {}): QueryChain<T> {
    return new QueryChain<T>(this.getAll()).filter(query);
  }

  findOne(query: any = {}): T | null {
    const items = this.find(query).exec();
    return items.length > 0 ? items[0] : null;
  }

  findById(id: string): T | null {
    return this.findOne({ _id: id });
  }

  create(data: Partial<T>): T {
    const items = this.getAll();
    const _id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const newItem = {
      _id,
      id: _id,
      createdAt: new Date().toISOString(),
      ...data
    } as unknown as T;
    
    items.push(newItem);
    this.saveAll(items);
    return newItem;
  }

  findByIdAndUpdate(id: string, update: Partial<T>, options: any = {}): T | null {
    const items = this.getAll();
    const index = items.findIndex(item => String(item._id || item.id) === String(id));
    if (index === -1) return null;
    
    const existing = items[index];
    const updated = {
      ...existing,
      ...update,
      updatedAt: new Date().toISOString()
    } as T;
    
    items[index] = updated;
    this.saveAll(items);
    return updated;
  }

  findByIdAndDelete(id: string): T | null {
    const items = this.getAll();
    const index = items.findIndex(item => String(item._id || item.id) === String(id));
    if (index === -1) return null;
    
    const removed = items[index];
    items.splice(index, 1);
    this.saveAll(items);
    return removed;
  }

  countDocuments(query: any = {}): number {
    return this.find(query).exec().length;
  }
}

// Instantiate core DB collections
export const UserDB = new DBModel<any>('users');
export const NovelDB = new DBModel<any>('novels');
export const AuthorDB = new DBModel<any>('authors');
export const CommentDB = new DBModel<any>('comments');

// Initialize database with premium pre-seeded data if empty
export function initDB() {
  // 1. Seed Authors if empty
  const currentAuthors = AuthorDB.find().exec();
  if (currentAuthors.length === 0) {
    const seedAuthors = [
      {
        _id: 'auth_shakespeare',
        id: 'auth_shakespeare',
        name: 'William Shakespeare',
        photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80',
        bio: 'William Shakespeare was an English playwright, poet, and actor. He is widely regarded as the greatest writer in the English language and the world\'s pre-eminent dramatist.',
        nationality: 'English',
        literaryAchievements: 'Often called England\'s national poet and the "Bard of Avon". His works consist of some 39 plays, 154 sonnets, and three long narrative poems.',
        famousNovels: 'Hamlet, Romeo and Juliet, Macbeth, Othello',
        novelCount: 4
      },
      {
        _id: 'auth_austen',
        id: 'auth_austen',
        name: 'Jane Austen',
        photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&auto=format&fit=crop&q=80',
        bio: 'Jane Austen was an English novelist known primarily for her six major novels, which interpret, critique, and comment upon the British landed gentry at the end of the 18th century.',
        nationality: 'English',
        literaryAchievements: 'Austen\'s plots often explore the dependence of women on marriage in the pursuit of favorable social standing and economic security.',
        famousNovels: 'Pride and Prejudice, Sense and Sensibility, Emma',
        novelCount: 3
      },
      {
        _id: 'auth_achebe',
        id: 'auth_achebe',
        name: 'Chinua Achebe',
        photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
        bio: 'Chinua Achebe was a Nigerian novelist, poet, and critic who is regarded as the dominant figure in modern African literature. His first novel, Things Fall Apart, occupies a pivotal place.',
        nationality: 'Nigerian',
        literaryAchievements: 'Man Booker International Prize (2007). He is often referred to as the "father of modern African literature".',
        famousNovels: 'Things Fall Apart, No Longer at Ease, Arrow of God',
        novelCount: 3
      },
      {
        _id: 'auth_adichie',
        id: 'auth_adichie',
        name: 'Chimamanda Ngozi Adichie',
        photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
        bio: 'Chimamanda Ngozi Adichie is a Nigerian writer whose works range from novels to short stories to nonfiction. She has been described in The Times Literary Supplement as the most prominent of a procession of critically acclaimed young anglophone authors.',
        nationality: 'Nigerian',
        literaryAchievements: 'MacArthur Fellowship (2008), National Book Critics Circle Award (2013).',
        famousNovels: 'Half of a Yellow Sun, Purple Hibiscus, Americanah',
        novelCount: 3
      },
      {
        _id: 'auth_orwell',
        id: 'auth_orwell',
        name: 'George Orwell',
        photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
        bio: 'Eric Arthur Blair, better known by his pen name George Orwell, was an English novelist, essayist, journalist, and critic. His work is characterized by lucid prose, biting social criticism, and opposition to totalitarianism.',
        nationality: 'English',
        literaryAchievements: 'Considered one of the 20th century\'s most influential writers. The term "Orwellian" has entered the language to describe authoritarian social practices.',
        famousNovels: 'Nineteen Eighty-Four, Animal Farm',
        novelCount: 2
      },
      {
        _id: 'auth_coelho',
        id: 'auth_coelho',
        name: 'Paulo Coelho',
        photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
        bio: 'Paulo Coelho de Souza is a Brazilian lyricist and novelist, best known for his novel The Alchemist. In 2014, he uploaded his personal papers online to create a virtual Paulo Coelho Foundation.',
        nationality: 'Brazilian',
        literaryAchievements: 'The Alchemist is an international bestseller and holds the Guinness World Record for the most translated book by a living author.',
        famousNovels: 'The Alchemist, Veronika Decides to Die, Eleven Minutes',
        novelCount: 3
      }
    ];
    for (const auth of seedAuthors) {
      AuthorDB.create(auth);
    }
  }

  // 2. Seed Novels if empty
  const currentNovels = NovelDB.find().exec();
  if (currentNovels.length === 0) {
    const seedNovels = [
      {
        _id: 'novel_pride_prejudice',
        id: 'novel_pride_prejudice',
        title: 'Pride and Prejudice',
        authorId: 'auth_austen',
        authorName: 'Jane Austen',
        genre: 'Romance',
        publicationYear: 1813,
        description: 'A romantic masterpiece exploring the turbulent relationship between Elizabeth Bennet and Fitzwilliam Darcy, set in early 19th-century England.',
        synopsis: 'Pride and Prejudice is an 1813 romantic novel of manners written by Jane Austen. The novel follows the character development of Elizabeth Bennet, the dynamic protagonist of the book who learns about the repercussions of hasty judgments and comes to appreciate the difference between superficial goodness and actual goodness. Its humor lies in its honest depiction of manners, education, marriage, and money during the Regency era in Great Britain.',
        coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&auto=format&fit=crop&q=80',
        rating: 4.8,
        ratingCount: 154,
        readerCount: 1420,
        contentPages: [
          "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\nHowever little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.\n\n'My dear Mr. Bennet,' said his lady to him one day, 'have you heard that Netherfield Park is let at last?'",
          "Mr. Bennet replied that he had not.\n\n'But it is,' returned she; 'for Mrs. Long has just been here, and she told me all about it.'\n\nMr. Bennet made no answer.\n\n'Do you not want to know who has taken it?' cried his wife impatiently.\n\n'You want to tell me, and I have no objection to hearing it.'",
          "This was invitation enough.\n\n'Why, my dear, you must know, Mrs. Long says that Netherfield is taken by a young man of large fortune from the north of England; that he came down on Monday in a chaise and four to see the place, and was so much delighted with it, that he agreed with Mr. Morris immediately; that he is to take possession before Michaelmas, and some of his servants are to be in the house by the end of next week.'\n\n'What is his name?'\n\n'Bingley.'"
        ]
      },
      {
        _id: 'novel_things_fall_apart',
        id: 'novel_things_fall_apart',
        title: 'Things Fall Apart',
        authorId: 'auth_achebe',
        authorName: 'Chinua Achebe',
        genre: 'African Literature',
        publicationYear: 1958,
        description: 'A profound chronicle of the clash between traditional Igbo culture and British colonial administration in late 19th-century Nigeria.',
        synopsis: 'Things Fall Apart is the debut novel by Nigerian author Chinua Achebe, first published in 1958. It depicts pre-colonial life in the southeastern part of Nigeria and the arrival of Europeans during the late 19th century. It is seen as the archetypal modern African novel in English, and one of the first to receive global critical acclaim.',
        coverImage: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600&auto=format&fit=crop&q=80',
        rating: 4.9,
        ratingCount: 210,
        readerCount: 1890,
        contentPages: [
          "Okonkwo was well known throughout the nine villages and even beyond. His fame rested on solid personal achievements. As a young man of eighteen he had brought honor to his village by throwing Amalinze the Cat. Amalinze was the great wrestler who for seven years was unbeaten, from Umuofia to Mbaino. He was called the Cat because his back would never touch the earth.",
          "It was this man that Okonkwo threw in a fight which the old men agreed was one of the fiercest since the founder of their town engaged a spirit of the wild for seven days and seven nights.\n\nThe drums beat and the flutes sang and the spectators held their breath. Amalinze was a wily craftsman, but Okonkwo was as slippery as a fish in water.",
          "Okonkwo's fame had grown like a bush-fire in the harmattan. He was tall and huge, and his bushy eyebrows and wide nose gave him a very severe look. He breathed heavily, and it was said that, when he slept, his wives and children in their houses could hear him breathe."
        ]
      },
      {
        _id: 'novel_1984',
        id: 'novel_1984',
        title: 'Nineteen Eighty-Four',
        authorId: 'auth_orwell',
        authorName: 'George Orwell',
        genre: 'Science Fiction',
        publicationYear: 1949,
        description: 'A dystopian vision of a totalitarian state under the omnipresent gaze of Big Brother, where thought is crime and truth is fluid.',
        synopsis: 'Nineteen Eighty-Four is a dystopian social science fiction novel by English novelist George Orwell. It was published in 1949 as Orwell\'s ninth and final book completed in his lifetime. Thematically, it centres on the consequences of totalitarianism, mass surveillance, and repressive regimentation of persons and behaviours within society.',
        coverImage: 'https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?w=600&auto=format&fit=crop&q=80',
        rating: 4.7,
        ratingCount: 320,
        readerCount: 2540,
        contentPages: [
          "It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass doors of Victory Mansions, though not quickly enough to prevent a swirl of gritty dust from entering along with him.",
          "The hallway smelt of boiled cabbage and old rag mats. At one end of it a coloured poster, too large for indoor display, had been tacked to the wall. It depicted simply an enormous face, more than a metre wide: the face of a man of about forty-five, with a heavy black moustache and ruggedly handsome features.",
          "Winston made for the stairs. It was no use trying the lift. Even at the best of times it was seldom working, and at present the electric current was cut off during the daylight hours. It was part of the economy drive in preparation for Hate Week."
        ]
      },
      {
        _id: 'novel_alchemist',
        id: 'novel_alchemist',
        title: 'The Alchemist',
        authorId: 'auth_coelho',
        authorName: 'Paulo Coelho',
        genre: 'Adventure',
        publicationYear: 1988,
        description: 'An allegorical novel about Santiago, an Andalusian shepherd boy, who journeys to Egypt in search of a worldly treasure.',
        synopsis: 'The Alchemist is a novel by Brazilian author Paulo Coelho that was first published in 1988. Originally written in Portuguese, it became a widely translated international bestseller. An allegorical novel, The Alchemist follows a young Andalusian shepherd in his journey to the pyramids of Egypt, after having a recurring dream of finding a treasure there.',
        coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&auto=format&fit=crop&q=80',
        rating: 4.6,
        ratingCount: 185,
        readerCount: 1980,
        contentPages: [
          "The boy's name was Santiago. It was starting to get dark as he arrived with his herd at an abandoned church. The roof had fallen in long ago, and an enormous sycamore had grown on the spot where the sacristy had once stood.\n\nHe decided to spend the night there. He saw to it that all the sheep entered through the ruined gate, and then laid some planks across it to prevent the flock from wandering away during the night.",
          "There were no wolves in the region, but once an animal had strayed during the night, and the boy had had to spend the entire next day searching for it.\n\nHe swept the floor with his jacket and lay down, using the book he had just finished reading as a pillow. He told himself that he would have to start reading thicker books: they lasted longer and made more comfortable pillows.",
          "When he awoke, it was still dark, and, looking up, he could see the stars through the half-destroyed roof.\n\n'I wanted to sleep a little longer,' he thought. He had had the same dream that he had had the week before, and once again he had awakened before it ended."
        ]
      },
      {
        _id: 'novel_half_yellow_sun',
        id: 'novel_half_yellow_sun',
        title: 'Half of a Yellow Sun',
        authorId: 'auth_adichie',
        authorName: 'Chimamanda Ngozi Adichie',
        genre: 'Historical Fiction',
        publicationYear: 2006,
        description: 'A gripping epic about the Biafran War, told through the intertwined lives of five characters swept up in political turbulence.',
        synopsis: 'Half of a Yellow Sun is a novel by Nigerian author Chimamanda Ngozi Adichie. Published in 2006, the novel tells the story of the Biafran War through the perspective of five characters: Olanna, Kainene, Richard, Ugwu, and Odenigbo. It received critical acclaim and won the Orange Prize for Fiction in 2007.',
        coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80',
        rating: 4.9,
        ratingCount: 175,
        readerCount: 1540,
        contentPages: [
          "Master was a little crazy; he had spent too many years in English schools, writing papers that nobody would ever read. Ugwu kept his head low and swept. He liked the smell of the house, ofbooks and floor wax, and the heavy drapes that kept out the afternoon sun.",
          "Odenigbo came home early, bringing three other lecturers. Their voices filled the living room with the heat of arguments. They drank beer and talked about the future of Nigeria, about pan-Africanism, about the white men who still pulled the strings.",
          "Ugwu brought them pepper soup. He was glad Odenigbo always thanked him. He was a good master, even if he talked to himself while reading. Ugwu would stay here. Umuahia was far away, and there was no meat there."
        ]
      }
    ];
    for (const novel of seedNovels) {
      NovelDB.create(novel);
    }
  }

  // 3. Seed Users if empty
  const currentUsers = UserDB.find().exec();
  if (currentUsers.length === 0) {
    const adminPasswordHash = bcryptjs.hashSync('admin', 10);
    const readerPasswordHash = bcryptjs.hashSync('reader', 10);
    
    UserDB.create({
      _id: 'user_admin',
      id: 'user_admin',
      username: 'admin',
      email: 'admin@library.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      bio: 'System Administrator of the Premium Online Novel Library.',
      favorites: [],
      bookmarks: [],
      readingHistory: []
    });

    UserDB.create({
      _id: 'user_reader',
      id: 'user_reader',
      username: 'reader',
      email: 'reader@library.com',
      passwordHash: readerPasswordHash,
      role: 'user',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      bio: 'An avid novel reader and book lover.',
      favorites: [],
      bookmarks: [],
      readingHistory: []
    });
  }
}
