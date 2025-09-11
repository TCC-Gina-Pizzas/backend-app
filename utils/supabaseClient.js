// utils/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Cria a instância do cliente Supabase e a exporta
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { supabase };