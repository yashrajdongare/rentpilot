
import { supabase } from './supabase';

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .limit(1);

  if (error) {
    console.error('Supabase connection test failed:', error.message);
    return;
  }

  console.log('Supabase connection successful!');
  console.log('Properties query result:', data);
}
