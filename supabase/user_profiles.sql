-- Run this in your Supabase SQL editor
-- Table: user_profiles
-- Stores wallet avatar (base64 data URL) and display name per wallet address.

CREATE TABLE IF NOT EXISTS user_profiles (
  wallet_address TEXT PRIMARY KEY,
  avatar_data    TEXT,         -- base64 JPEG data URL, ~30–80 KB after client resize
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow anyone to read profiles (avatars are public)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read"
  ON user_profiles FOR SELECT
  USING (true);

-- Anyone can upsert their own row (no auth — identified by wallet address)
CREATE POLICY "public upsert"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "public update"
  ON user_profiles FOR UPDATE
  USING (true);
