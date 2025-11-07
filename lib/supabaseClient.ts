// lib/supabaseClient.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createBrowserClient } from '@supabase/ssr'
export const supabaseBrowser = createClientComponentClient()

