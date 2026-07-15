import path from 'path';

// Map known author _id/name -> local image file under /public/uploads
// Add/adjust entries to match actual filenames in public/uploads.
const AUTHOR_PHOTO_MAP: Record<string, string> = {
  auth_achebe: 'chinu achebe.jpg',
  'Chinua Achebe': 'chinu achebe.jpg',

  auth_adichie: 'Chimamanda Ngozi Adichie.jpg',
  'Chimamanda Ngozi Adichie': 'Chimamanda Ngozi Adichie.jpg',

  auth_austen: 'jane austen.webp',
  'Jane Austen': 'jane austen.webp',

  auth_orwell: 'George Orwell.jpg',
  'George Orwell': 'George Orwell.jpg',

  auth_coelho: 'Paulo Coelho.webp',
  'Paulo Coelho': 'Paulo Coelho.webp',

  auth_mandela: 'Nelson Mandela.webp',
  'Nelson Mandela': 'Nelson Mandela.webp',

  auth_angelou: 'maya-angelou-4.jpg',
  'Maya Angelou': 'maya-angelou-4.jpg',

  auth_rowling: 'j.k rawling.webp',
  'J.K. Rowling': 'j.k rawling.webp',

  auth_ngugi: 'Ngugi wa thiongo.jpeg',
  "Ngũgĩ wa Thiong'o": 'Ngugi wa thiongo.jpeg',
  "Ngũgĩ wa Thiongo": 'Ngugi wa thiongo.jpeg',

  auth_soyinka: 'Wole-Soyinka.jpg',
  'Wole Soyinka': 'Wole-Soyinka.jpg',

  auth_gorman: 'Amanda Gorman.jpg',
  'Amanda Gorman': 'Amanda Gorman.jpg',

  auth_obama: 'Barack Obama.webp',
  'Barack Obama': 'Barack Obama.webp',

  auth_king: 'Stephen King.jpg',
  'Stephen King': 'Stephen King.jpg',

  auth_christie: 'Agattha christie.webp',
  'Agatha Christie': 'Agattha christie.webp',

  auth_dickens: 'Charles Dickens.jpg',
  'Charles Dickens': 'Charles Dickens.jpg',

  auth_atwood: 'Margaret-Atwood.webp',
  'Margaret Atwood': 'Margaret-Atwood.webp',

  auth_tolkien: 'J.R.R. Tolkien.webp',
  'J.R.R. Tolkien': 'J.R.R. Tolkien.webp',

  auth_lewis: 'C.S. Lewis.jpeg',
  'C.S. Lewis': 'C.S. Lewis.jpeg',

  auth_hemingway: 'Ernest Hemingway.webp',
  'Ernest Hemingway': 'Ernest Hemingway.webp'
};

export function getLocalAuthorPhoto(author: { _id?: string; name?: string; photo?: string } | any): string {
  const id = author?._id ? String(author._id) : '';
  const name = author?.name ? String(author.name) : '';

  const filename = AUTHOR_PHOTO_MAP[id] || AUTHOR_PHOTO_MAP[name];
  if (filename) {
    // Use public URL path
    return `/uploads/${encodeURIComponent(filename).replace(/%2F/g, '/')}`;
  }

  // Fallback to whatever is stored
  return author?.photo || '/uploads/default-avatar.png';
}

