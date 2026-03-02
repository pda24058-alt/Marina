/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Book as BookIcon, Sparkles, ArrowRight, Loader2, X, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getBookRecommendations, type BookRecommendation } from './services/geminiService';
import { supabase, saveBookToLibrary, getLibraryBooks, removeBookFromLibrary, type SavedBook } from './services/supabaseClient';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GoogleBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    imageLinks?: {
      thumbnail?: string;
    };
    categories?: string[];
    publishedDate?: string;
  };
}

export default function App() {
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<GoogleBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<GoogleBook | null>(null);
  const [recommendations, setRecommendations] = useState<BookRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [supabaseMissing, setSupabaseMissing] = useState(false);
  const [library, setLibrary] = useState<SavedBook[]>([]);
  const [view, setView] = useState<'discover' | 'library'>('discover');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkKeys = () => {
      const gKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : (import.meta.env?.VITE_GEMINI_API_KEY as string);
      if (!gKey || gKey === 'undefined' || gKey === '') {
        setApiKeyMissing(true);
      }

      const sUrl = typeof process !== 'undefined' ? process.env.SUPABASE_URL : (import.meta.env?.VITE_SUPABASE_URL as string);
      const sKey = typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : (import.meta.env?.VITE_SUPABASE_ANON_KEY as string);
      
      if (!sUrl || sUrl === 'undefined' || sUrl === '' || !sKey || sKey === 'undefined' || sKey === '') {
        setSupabaseMissing(true);
      }
    };

    checkKeys();
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    try {
      const data = await getLibraryBooks();
      setLibrary(data || []);
    } catch (err) {
      console.error("Failed to fetch library", err);
    }
  };

  const handleSaveToLibrary = async (book: GoogleBook) => {
    setSaving(true);
    try {
      await saveBookToLibrary({
        google_book_id: book.id,
        title: book.volumeInfo.title,
        author: book.volumeInfo.authors?.join(', ') || 'Unknown Author',
        thumbnail: book.volumeInfo.imageLinks?.thumbnail || '',
        description: book.volumeInfo.description || ''
      });
      await fetchLibrary();
    } catch (err) {
      console.error("Failed to save book", err);
      alert("Failed to save book. Make sure you have a 'library' table in Supabase.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromLibrary = async (id: string) => {
    try {
      await removeBookFromLibrary(id);
      await fetchLibrary();
    } catch (err) {
      console.error("Failed to remove book", err);
    }
  };

  const isBookSaved = (id: string) => library.some(b => b.google_book_id === id);

  const searchBooks = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12`);
      const data = await res.json();
      setBooks(data.items || []);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBook = async (book: GoogleBook) => {
    setSelectedBook(book);
    setRecommendations([]);
    setLoadingRecs(true);
    
    try {
      const recs = await getBookRecommendations(
        book.volumeInfo.title,
        book.volumeInfo.authors?.join(', ') || 'Unknown Author',
        book.volumeInfo.description || 'No description available'
      );
      setRecommendations(recs);
    } catch (err) {
      console.error("Failed to get recommendations", err);
    } finally {
      setLoadingRecs(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FDFCFB]/80 backdrop-blur-md border-b border-black/5">
        {apiKeyMissing && (
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-center">
            <p className="text-xs font-medium text-amber-800 flex items-center justify-center gap-2">
              <Sparkles className="w-3 h-3" />
              AI Recommendations are disabled. Please set GEMINI_API_KEY in your environment variables.
            </p>
          </div>
        )}
        {supabaseMissing && (
          <div className="bg-red-50 border-b border-red-100 px-4 py-2 text-center">
            <p className="text-xs font-medium text-red-800 flex items-center justify-center gap-2">
              <Bookmark className="w-3 h-3" />
              Library features are disabled. Please set SUPABASE_URL and SUPABASE_ANON_KEY.
            </p>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <BookIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif text-xl font-bold tracking-tight">Lumina</span>
          </div>
          
          <form onSubmit={searchBooks} className="flex-1 max-w-md mx-8 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
            <input
              type="text"
              placeholder="Search for any book..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-black/5 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-black/10 transition-all outline-none"
            />
          </form>

          <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-black/60">
            <button 
              onClick={() => setView('discover')}
              className={cn("hover:text-black transition-colors", view === 'discover' && "text-black underline underline-offset-4")}
            >
              Discover
            </button>
            <button 
              onClick={() => setView('library')}
              className={cn("hover:text-black transition-colors", view === 'library' && "text-black underline underline-offset-4")}
            >
              My Library ({library.length})
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {view === 'library' ? (
          <div>
            <div className="mb-8">
              <h2 className="text-4xl font-serif font-bold mb-2">My Library</h2>
              <p className="text-black/40">Books you've saved for later.</p>
            </div>
            {library.length === 0 ? (
              <div className="h-[40vh] flex flex-col items-center justify-center text-center">
                <Bookmark className="w-12 h-12 text-black/10 mb-4" />
                <p className="text-black/40">Your library is empty. Start searching and saving books!</p>
                <button 
                  onClick={() => setView('discover')}
                  className="mt-4 px-6 py-2 bg-black text-white rounded-full text-sm font-medium"
                >
                  Go Discover
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {library.map((book) => (
                  <motion.div
                    key={book.google_book_id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group bg-white p-4 rounded-2xl border border-black/5 book-card-shadow"
                  >
                    <div className="aspect-[3/4] mb-4 overflow-hidden rounded-lg bg-black/5 relative">
                      {book.thumbnail ? (
                        <img
                          src={book.thumbnail.replace('http:', 'https:')}
                          alt={book.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-black/20">
                          <BookIcon className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <button 
                          onClick={() => handleRemoveFromLibrary(book.google_book_id)}
                          className="p-2 bg-white/80 backdrop-blur-md rounded-full text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-serif font-bold text-lg line-clamp-1">{book.title}</h3>
                    <p className="text-sm text-black/50 font-medium">{book.author}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {!books.length && !loading && !selectedBook && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl"
            >
              <h1 className="text-5xl sm:text-6xl font-serif font-bold mb-6 leading-tight">
                Find your next <span className="italic text-black/40 underline decoration-black/10 underline-offset-8">great read.</span>
              </h1>
              <p className="text-lg text-black/60 mb-8">
                Search for a book you love, and our AI will suggest similar titles based on its themes, topics, and atmosphere.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {['Sci-Fi', 'Philosophy', 'History', 'Mystery', 'Poetry'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setQuery(tag); searchBooks(); }}
                    className="px-4 py-2 rounded-full border border-black/10 hover:bg-black hover:text-white transition-all text-sm font-medium"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-black/20" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {books.map((book, idx) => (
              <motion.div
                key={book.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => handleSelectBook(book)}
                className="group cursor-pointer bg-white p-4 rounded-2xl border border-black/5 hover:border-black/20 transition-all book-card-shadow"
              >
                <div className="aspect-[3/4] mb-4 overflow-hidden rounded-lg bg-black/5 relative">
                  {book.volumeInfo.imageLinks?.thumbnail ? (
                    <img
                      src={book.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:')}
                      alt={book.volumeInfo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-black/20">
                      <BookIcon className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium px-4 py-2 bg-black/20 backdrop-blur-md rounded-full border border-white/20">
                      View Details
                    </span>
                  </div>
                </div>
                <h3 className="font-serif font-bold text-lg line-clamp-1 group-hover:text-black/70 transition-colors">
                  {book.volumeInfo.title}
                </h3>
                <p className="text-sm text-black/50 font-medium">
                  {book.volumeInfo.authors?.join(', ') || 'Unknown Author'}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </>
    )}
  </main>

      {/* Book Detail Overlay */}
      <AnimatePresence>
        {selectedBook && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedBook(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-[#FDFCFB] w-full max-w-4xl h-[90vh] sm:h-auto sm:max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-[#FDFCFB]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-black/5">
                <h2 className="font-serif font-bold text-xl truncate pr-4">{selectedBook.volumeInfo.title}</h2>
                <button
                  onClick={() => setSelectedBook(null)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 sm:p-8">
                <div className="flex flex-col md:flex-row gap-8 mb-12">
                  <div className="w-full md:w-1/3 shrink-0">
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-black/5 shadow-xl">
                      {selectedBook.volumeInfo.imageLinks?.thumbnail ? (
                        <img
                          src={selectedBook.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:')}
                          alt={selectedBook.volumeInfo.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-black/10">
                          <BookIcon className="w-20 h-20" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedBook.volumeInfo.categories?.map(cat => (
                        <span key={cat} className="px-3 py-1 bg-black/5 rounded-full text-[10px] uppercase tracking-wider font-bold text-black/60">
                          {cat}
                        </span>
                      ))}
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-2 leading-tight">
                      {selectedBook.volumeInfo.title}
                    </h1>
                    <p className="text-xl text-black/60 font-medium mb-6">
                      by {selectedBook.volumeInfo.authors?.join(', ') || 'Unknown Author'}
                    </p>
                    <div className="prose prose-sm max-w-none text-black/70 leading-relaxed line-clamp-6 sm:line-clamp-none">
                      {selectedBook.volumeInfo.description?.replace(/<[^>]*>?/gm, '') || 'No description available.'}
                    </div>
                    
                    <div className="mt-8 flex gap-3">
                      <button 
                        onClick={() => handleSaveToLibrary(selectedBook)}
                        disabled={saving || isBookSaved(selectedBook.id)}
                        className={cn(
                          "flex-1 sm:flex-none px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all",
                          isBookSaved(selectedBook.id) 
                            ? "bg-green-50 text-green-600 border border-green-100 cursor-default"
                            : "bg-black text-white hover:bg-black/80"
                        )}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isBookSaved(selectedBook.id) ? (
                          <>
                            <Bookmark className="w-4 h-4 fill-current" />
                            Saved
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-4 h-4" />
                            Save to Library
                          </>
                        )}
                      </button>
                      <button className="flex-1 sm:flex-none px-6 py-3 border border-black/10 rounded-xl font-medium hover:bg-black/5 transition-all">
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recommendations Section */}
                <div className="border-t border-black/5 pt-12">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-2xl">AI Recommendations</h3>
                        <p className="text-sm text-black/40">Based on the themes of this book</p>
                      </div>
                    </div>
                  </div>

                  {loadingRecs ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                      <p className="text-sm font-medium text-black/40 animate-pulse">Analyzing themes and finding matches...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {recommendations.map((rec, i) => (
                        <motion.div
                          key={rec.title}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 hover:bg-indigo-50 transition-colors group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-serif font-bold text-lg">{rec.title}</h4>
                              <p className="text-sm text-black/60 font-medium">by {rec.author}</p>
                            </div>
                            <span className="px-2 py-1 bg-white border border-indigo-100 rounded-md text-[9px] uppercase tracking-widest font-black text-indigo-600">
                              {rec.topic}
                            </span>
                          </div>
                          <p className="text-sm text-black/70 leading-relaxed mb-4">
                            {rec.reason}
                          </p>
                          <button 
                            onClick={() => {
                              setQuery(rec.title);
                              searchBooks();
                              setSelectedBook(null);
                            }}
                            className="text-xs font-bold text-indigo-600 flex items-center gap-1 group-hover:gap-2 transition-all"
                          >
                            Find this book <ArrowRight className="w-3 h-3" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="py-12 border-t border-black/5 bg-white">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
              <BookIcon className="w-3 h-3 text-white" />
            </div>
            <span className="font-serif font-bold tracking-tight">Lumina</span>
          </div>
          <p className="text-sm text-black/40">
            Powered by Google Books API & Gemini AI
          </p>
          <div className="flex gap-6 text-sm font-medium text-black/60">
            <a href="#" className="hover:text-black transition-colors">Privacy</a>
            <a href="#" className="hover:text-black transition-colors">Terms</a>
            <a href="#" className="hover:text-black transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
