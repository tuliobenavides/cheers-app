import { createClient } from '@supabase/supabase-js'

// Lovable's native Supabase integration handles the configuration
export const supabase = createClient(
  'https://placeholder-url.supabase.co',
  'placeholder-anon-key'
)

// Types for our database schema
export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  birthday: string | null
  created_at: string
  updated_at: string
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  updated_at: string
}

export interface WishListItem {
  id: string
  user_id: string
  title: string
  description: string | null
  price_tier: 'under_25' | '25_to_50' | 'over_50'
  affiliate_link: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  creator_id: string
  title: string
  description: string | null
  date: string
  location: string | null
  is_private: boolean
  created_at: string
  updated_at: string
}

export interface EventInvitation {
  id: string
  event_id: string
  user_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  updated_at: string
}