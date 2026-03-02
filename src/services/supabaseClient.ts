import { createClient } from '@supabase/supabase-js';

const getEnvVar = (name: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name] as string;
  }
  // @ts-ignore - Vite specific
  if (import.meta.env && import.meta.env[`VITE_${name}`]) {
    // @ts-ignore
    return import.meta.env[`VITE_${name}`] as string;
  }
  return '';
};

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY');

// Initialize with placeholders if missing to prevent crash on module load
// The app will show an error state instead of a white screen
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

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
