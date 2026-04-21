-- ============================================================
-- Migration 013 — Add image_url column to products if missing
-- ============================================================

alter table public.products
  add column if not exists image_url text;
