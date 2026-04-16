/* ============================================
   SUPABASE CONFIGURATION
   Pet Paws Journey — Pet Transport Tracking
   ============================================ */

const SUPABASE_URL = 'https://ykskxipkqlkcuxaooxvc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrc2t4aXBrcWxrY3V4YW9veHZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNzcxNzAsImV4cCI6MjA5MTg1MzE3MH0.BxP1AnGakpZoNtfUKbWWX0YHVO8-2enodB2k7JOscBI';

// Initialize the Supabase client
// The CDN exposes createClient on window.supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Also expose as 'supabase' for convenience (overrides the CDN namespace)
// This allows other scripts to reference either supabase or supabaseClient
var supabase = supabaseClient;
