import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy-placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-placeholder-key'

<<<<<<< HEAD
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
=======
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
>>>>>>> 5083ca225879db7459fa53cf53da2dace2f19f07
