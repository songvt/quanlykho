import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    fetch: (url, options) => {
      if (!supabaseUrl || supabaseUrl === 'https://placeholder-url.supabase.co') {
        return Promise.reject(new Error('Supabase URL not configured in environment variables'));
      }
      // Add a 60-second timeout to prevent failures during large batch inserts
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 60000);
      return fetch(url, { ...options, signal: controller.signal as any })
        .catch(err => {
            if (err.name === 'AbortError') {
                throw new Error('Supabase request timed out after 60s - likely due to large batch insert.');
            }
            throw err;
        })
        .finally(() => clearTimeout(id));
    }
  }
});

export const fetchAll = async (table: string, select: string = '*', queryModifier?: (query: any) => any) => {
    // Fetch first 1000 rows directly
    let query = supabase.from(table).select(select).range(0, 999);
    if (queryModifier) query = queryModifier(query);
    
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length < 1000) return data || [];

    // If we hit exactly 1000 rows, there might be more. Now get total count to fetch the rest.
    let countQuery = supabase.from(table).select('*', { count: 'exact', head: true });
    if (queryModifier) countQuery = queryModifier(countQuery);
    
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    if (!count) return data;

    const step = 1000;
    let allData: any[] = [...data];
    
    // Fetch remaining data concurrently
    const promises = [];
    for (let from = 1000; from < count; from += step) {
        let nextQuery = supabase.from(table).select(select).range(from, from + step - 1);
        if (queryModifier) nextQuery = queryModifier(nextQuery);
        promises.push(nextQuery);
    }
    
    const results = await Promise.all(promises);
    for (const res of results) {
        if (res.error) throw res.error;
        if (res.data) allData = allData.concat(res.data);
    }
    
    return allData;
};
