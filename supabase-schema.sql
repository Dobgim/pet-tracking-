-- =============================================
-- Pet Paws Journey — Full Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- Project: ykskxipkqlkcuxaooxvc
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE: pet_shipments
-- =============================================
CREATE TABLE IF NOT EXISTS pet_shipments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_code       TEXT UNIQUE NOT NULL,

  -- Client info
  client_name         TEXT NOT NULL,
  client_email        TEXT NOT NULL,
  client_phone        TEXT,

  -- Shipper info
  shipper_name        TEXT NOT NULL,
  shipper_email       TEXT NOT NULL,
  shipper_phone       TEXT,

  -- Pet info
  pet_name            TEXT NOT NULL,
  pet_type            TEXT NOT NULL,
  pet_breed           TEXT,
  pet_image_url       TEXT,

  -- Route
  origin_address      TEXT NOT NULL,
  origin_lat          NUMERIC,
  origin_lng          NUMERIC,
  destination_address TEXT NOT NULL,
  destination_lat     NUMERIC,
  destination_lng     NUMERIC,

  -- Current position
  current_lat         NUMERIC,
  current_lng         NUMERIC,

  -- Status & metadata
  current_status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (current_status IN ('pending','order_created','picked_up','in_transit','on_hold','out_for_delivery','delivered')),
  packaging_type      TEXT,
  package_weight      NUMERIC,
  estimated_delivery  DATE,
  special_notes       TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TABLE: pet_tracking_updates
-- =============================================
CREATE TABLE IF NOT EXISTS pet_tracking_updates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id      UUID NOT NULL REFERENCES pet_shipments(id) ON DELETE CASCADE,
  status           TEXT NOT NULL
    CHECK (status IN ('pending','order_created','picked_up','in_transit','on_hold','out_for_delivery','delivered')),
  location_address TEXT,
  lat              NUMERIC,
  lng              NUMERIC,
  description      TEXT,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TABLE: contact_messages
-- =============================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE pet_shipments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_tracking_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages     ENABLE ROW LEVEL SECURITY;

-- pet_shipments: public read (tracking page), auth write (admin)
CREATE POLICY "Public can read shipments"
  ON pet_shipments FOR SELECT USING (true);

CREATE POLICY "Auth users can insert shipments"
  ON pet_shipments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update shipments"
  ON pet_shipments FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete shipments"
  ON pet_shipments FOR DELETE USING (auth.role() = 'authenticated');

-- pet_tracking_updates: public read, auth write
CREATE POLICY "Public can read tracking updates"
  ON pet_tracking_updates FOR SELECT USING (true);

CREATE POLICY "Auth users can insert tracking updates"
  ON pet_tracking_updates FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete tracking updates"
  ON pet_tracking_updates FOR DELETE USING (auth.role() = 'authenticated');

-- contact_messages: anyone can submit, only auth users read/update
CREATE POLICY "Anyone can submit contact messages"
  ON contact_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Auth users can read messages"
  ON contact_messages FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update messages"
  ON contact_messages FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_pet_shipments_tracking_code
  ON pet_shipments (tracking_code);

CREATE INDEX IF NOT EXISTS idx_pet_tracking_updates_shipment_id
  ON pet_tracking_updates (shipment_id);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created
  ON contact_messages (created_at DESC);
