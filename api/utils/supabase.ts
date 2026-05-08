import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing in process.env');
}

const finalSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co';

// Ensure it doesn't crash during build if env vars are missing
export const supabase = createClient(finalSupabaseUrl, supabaseAnonKey || 'placeholder', {
  global: {
    fetch: (url, options) => {
      if (finalSupabaseUrl === 'https://placeholder.supabase.co') {
        return Promise.reject(new Error('Supabase URL not configured in environment variables'));
      }
      // Add a 4-second timeout to prevent exhausting Vercel's 10s limit
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      return fetch(url, { ...options, signal: controller.signal as any })
        .catch(err => {
            if (err.name === 'AbortError') {
                throw new Error('Supabase request timed out after 4000ms');
            }
            throw err;
        })
        .finally(() => clearTimeout(id));
    }
  }
});

/**
 * Helper to fetch all rows from a Supabase table handling the 1000-row limit.
 */
export const fetchAll = async (table: string, select: string = '*', queryModifier?: (query: any) => any) => {
    // Get total count first for parallel fetching
    let countQuery = supabase.from(table).select('*', { count: 'exact', head: true });
    if (queryModifier) countQuery = queryModifier(countQuery);
    
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    if (!count || count === 0) return [];

    const step = 1000;
    const promises = [];
    
    for (let from = 0; from < count; from += step) {
        let query = supabase.from(table).select(select).range(from, from + step - 1);
        if (queryModifier) query = queryModifier(query);
        promises.push(query);
    }
    
    const results = await Promise.all(promises);
    let allData: any[] = [];
    
    for (const res of results) {
        if (res.error) throw res.error;
        if (res.data) allData = allData.concat(res.data);
    }
    
    return allData;
};
