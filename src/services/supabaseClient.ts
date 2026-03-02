import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SavedBook {
  id?: string;
  google_book_id: string;
  title: string;
  author: string;
  thumbnail: string;
  description: string;
  created_at?: string;
}

export async function saveBookToLibrary(book: SavedBook) {
  const { data, error } = await supabase
    .from('library')
    .upsert([book], { onConflict: 'google_book_id' });

  if (error) throw error;
  return data;
}

export async function getLibraryBooks() {
  const { data, error } = await supabase
    .from('library')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as SavedBook[];
}

export async function removeBookFromLibrary(googleBookId: string) {
  const { error } = await supabase
    .from('library')
    .delete()
    .eq('google_book_id', googleBookId);

  if (error) throw error;
}
