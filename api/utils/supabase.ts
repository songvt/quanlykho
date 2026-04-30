import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper to fetch all rows from a Supabase table handling the 1000-row limit.
 */
export const fetchAll = async (table: string, select: string = '*', queryModifier?: (query: any) => any) => {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        let query = supabase.from(table).select(select).range(from, from + step - 1);
        if (queryModifier) query = queryModifier(query);
        
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            allData = [...allData, ...data];
            if (data.length < step) {
                hasMore = false;
            } else {
                from += step;
            }
        }
    }
    return allData;
};
