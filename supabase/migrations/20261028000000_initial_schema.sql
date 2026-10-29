-- ==============================================================================
-- LabLoop: Campus Resource-Sharing Platform Database Migration
-- Initial Schema: Tables, Enums, Constraints, Indexes, Triggers, RLS & Storage
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. ENUMS (created idempotently)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'owner', 'manager', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE resource_category AS ENUM ('lab', 'room', 'equipment', 'computing', 'media');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE priority_tier AS ENUM ('coursework', 'research', 'personal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM (
        'pending_review',
        'approved',
        'rejected',
        'waitlisted',
        'cancelled',
        'checked_out',
        'returned'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE credential_status AS ENUM ('pending', 'verified', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE incident_type AS ENUM ('damage', 'delay', 'conflict', 'safety', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM ('open', 'under_review', 'resolved', 'disputed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE condition_grade AS ENUM ('excellent', 'good', 'fair', 'damaged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABLES

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    role user_role NOT NULL DEFAULT 'user',
    department TEXT,
    owner_verified BOOLEAN NOT NULL DEFAULT false,
    strikes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CREDENTIALS
CREATE TABLE IF NOT EXISTS public.credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL,
    file_path TEXT,
    status credential_status NOT NULL DEFAULT 'pending',
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    expires_at DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RESOURCES
CREATE TABLE IF NOT EXISTS public.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category resource_category NOT NULL,
    location TEXT,
    image_path TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    requires_supervision BOOLEAN NOT NULL DEFAULT false,
    max_duration_hours INT NOT NULL DEFAULT 4,
    buffer_minutes INT NOT NULL DEFAULT 15,
    usage_rules TEXT,
    deposit_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RESOURCE MANAGERS (co-managers / lab techs)
CREATE TABLE IF NOT EXISTS public.resource_managers (
    resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (resource_id, user_id)
);

-- RESOURCE REQUIREMENTS
CREATE TABLE IF NOT EXISTS public.resource_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AVAILABILITY WINDOWS
CREATE TABLE IF NOT EXISTS public.availability_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday...
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    purpose TEXT,
    priority_tier priority_tier NOT NULL DEFAULT 'coursework',
    status booking_status NOT NULL DEFAULT 'pending_review',
    decision_reason TEXT,
    decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    system_check JSONB NOT NULL DEFAULT '{}'::jsonb,
    rules_acknowledged BOOLEAN NOT NULL DEFAULT false,
    waitlist_rank NUMERIC,
    checked_out_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    ext_requested_end_at TIMESTAMPTZ,
    ext_status TEXT CHECK (ext_status IS NULL OR ext_status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT check_booking_dates CHECK (end_at > start_at)
);

-- Overlap exclusion constraint on bookings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap_approved_checked_out'
    ) THEN
        ALTER TABLE public.bookings
            ADD CONSTRAINT bookings_no_overlap_approved_checked_out
            EXCLUDE USING gist (
                resource_id WITH =,
                tstzrange(start_at, end_at) WITH &&
            )
            WHERE (status IN ('approved', 'checked_out'));
    END IF;
END $$;

-- CONDITION REPORTS
CREATE TABLE IF NOT EXISTS public.condition_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('checkout', 'return')),
    grade condition_grade NOT NULL,
    notes TEXT,
    checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
    photo_paths TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INCIDENTS
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    incident_type incident_type NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    description TEXT NOT NULL,
    ai_summary TEXT,
    status incident_status NOT NULL DEFAULT 'open',
    resolution TEXT,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    strike_applied BOOLEAN NOT NULL DEFAULT false,
    dispute_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id UUID,
    actor_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    booking_id UUID,
    resource_id UUID,
    reason TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FAIRNESS SETTINGS (Singleton configuration row)
CREATE TABLE IF NOT EXISTS public.fairness_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    max_active_bookings INT NOT NULL DEFAULT 3,
    max_hours_per_week_per_category INT NOT NULL DEFAULT 8,
    strike_threshold INT NOT NULL DEFAULT 3,
    reminder_minutes_before INT NOT NULL DEFAULT 60
);

-- Insert the default fairness settings singleton
INSERT INTO public.fairness_settings (id, max_active_bookings, max_hours_per_week_per_category, strike_threshold, reminder_minutes_before)
VALUES (1, 3, 8, 3, 60)
ON CONFLICT (id) DO NOTHING;

-- 4. PERFORMANCE & LOOKUP INDEXES
CREATE INDEX IF NOT EXISTS idx_resources_owner ON public.resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_active ON public.resources(is_active);

CREATE INDEX IF NOT EXISTS idx_requirements_resource ON public.resource_requirements(resource_id);
CREATE INDEX IF NOT EXISTS idx_availability_resource ON public.availability_windows(resource_id);

CREATE INDEX IF NOT EXISTS idx_bookings_resource ON public.bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_time_range ON public.bookings(start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_credentials_user ON public.credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_status ON public.credentials(status);

CREATE INDEX IF NOT EXISTS idx_condition_reports_booking ON public.condition_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_incidents_resource ON public.incidents(resource_id);
CREATE INDEX IF NOT EXISTS idx_incidents_booking ON public.incidents(booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_log_booking ON public.audit_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON public.audit_log(resource_id);

-- 5. TRIGGERS & FUNCTIONS

-- Trigger to make audit_log append-only
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log table is append-only. UPDATE or DELETE operations are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_append_only ON public.audit_log;
CREATE TRIGGER trg_audit_log_append_only
    BEFORE UPDATE OR DELETE ON public.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Trigger on auth.users insert to create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role public.user_role := 'user';
    v_dept TEXT := NULL;
    v_full_name TEXT;
    v_verified BOOLEAN := false;
BEGIN
    v_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );

    IF new.raw_user_meta_data->>'role' IN ('user', 'owner', 'manager', 'admin') THEN
        v_role := (new.raw_user_meta_data->>'role')::public.user_role;
    END IF;

    IF new.raw_user_meta_data->>'department' IS NOT NULL THEN
        v_dept := new.raw_user_meta_data->>'department';
    END IF;

    IF (new.raw_user_meta_data->>'owner_verified')::boolean IS TRUE THEN
        v_verified := true;
    END IF;

    INSERT INTO public.profiles (id, full_name, email, role, department, owner_verified)
    VALUES (new.id, v_full_name, new.email, v_role, v_dept, v_verified)
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        email = COALESCE(EXCLUDED.email, public.profiles.email),
        role = CASE WHEN public.profiles.role = 'user' AND EXCLUDED.role != 'user' THEN EXCLUDED.role ELSE public.profiles.role END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Helper Security Functions for RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_resource_owner_or_manager(res_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.resources r WHERE r.id = res_id AND r.owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.resource_managers rm WHERE rm.resource_id = res_id AND rm.user_id = auth.uid()
    ) OR public.is_admin();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6. ROW LEVEL SECURITY (RLS)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condition_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fairness_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Resources readable by all authenticated" ON public.resources;
DROP POLICY IF EXISTS "Requirements readable by all authenticated" ON public.resource_requirements;
DROP POLICY IF EXISTS "Availability readable by all authenticated" ON public.availability_windows;
DROP POLICY IF EXISTS "Managers readable by all authenticated" ON public.resource_managers;
DROP POLICY IF EXISTS "Fairness settings readable by all authenticated" ON public.fairness_settings;
DROP POLICY IF EXISTS "Credentials read access" ON public.credentials;
DROP POLICY IF EXISTS "Bookings read access" ON public.bookings;
DROP POLICY IF EXISTS "Condition reports read access" ON public.condition_reports;
DROP POLICY IF EXISTS "Incidents read access" ON public.incidents;
DROP POLICY IF EXISTS "Notifications read access" ON public.notifications;
DROP POLICY IF EXISTS "Notifications update own" ON public.notifications;
DROP POLICY IF EXISTS "Audit log read access" ON public.audit_log;

-- PROFILES: readable by authenticated users
CREATE POLICY "Profiles readable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- RESOURCES: readable by all authenticated
CREATE POLICY "Resources readable by all authenticated"
    ON public.resources FOR SELECT
    TO authenticated
    USING (true);

-- RESOURCE REQUIREMENTS: readable by all authenticated
CREATE POLICY "Requirements readable by all authenticated"
    ON public.resource_requirements FOR SELECT
    TO authenticated
    USING (true);

-- AVAILABILITY WINDOWS: readable by all authenticated
CREATE POLICY "Availability readable by all authenticated"
    ON public.availability_windows FOR SELECT
    TO authenticated
    USING (true);

-- RESOURCE MANAGERS: readable by all authenticated
CREATE POLICY "Managers readable by all authenticated"
    ON public.resource_managers FOR SELECT
    TO authenticated
    USING (true);

-- FAIRNESS SETTINGS: readable by all authenticated
CREATE POLICY "Fairness settings readable by all authenticated"
    ON public.fairness_settings FOR SELECT
    TO authenticated
    USING (true);

-- CREDENTIALS: readable by owner, managers/owners or admins
CREATE POLICY "Credentials read access"
    ON public.credentials FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager', 'admin')
        )
    );

-- BOOKINGS: readable by booker, resource owner/manager, or admin
CREATE POLICY "Bookings read access"
    ON public.bookings FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_resource_owner_or_manager(resource_id)
    );

-- CONDITION REPORTS: readable by related booker, resource owner/manager, or admin
CREATE POLICY "Condition reports read access"
    ON public.condition_reports FOR SELECT
    TO authenticated
    USING (
        recorded_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = condition_reports.booking_id
            AND (b.user_id = auth.uid() OR public.is_resource_owner_or_manager(b.resource_id))
        )
    );

-- INCIDENTS: readable by reporter, involved booker, resource owner/manager, or admin
CREATE POLICY "Incidents read access"
    ON public.incidents FOR SELECT
    TO authenticated
    USING (
        reported_by = auth.uid()
        OR public.is_resource_owner_or_manager(resource_id)
        OR (
            booking_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.id = incidents.booking_id AND b.user_id = auth.uid()
            )
        )
    );

-- NOTIFICATIONS: readable by recipient or admin, updatable by recipient to mark read
CREATE POLICY "Notifications read access"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR public.is_admin()
    );

CREATE POLICY "Notifications update own"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- AUDIT LOG: readable by admins and participants of related booking
CREATE POLICY "Audit log read access"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR actor_id = auth.uid()
        OR (
            booking_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.id = audit_log.booking_id
                AND (b.user_id = auth.uid() OR public.is_resource_owner_or_manager(b.resource_id))
            )
        )
    );

-- 7. STORAGE BUCKETS AND STORAGE POLICIES

-- Insert Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('credentials', 'credentials', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('condition-photos', 'condition-photos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-images', 'resource-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Resource images: Public read, authenticated insert
DROP POLICY IF EXISTS "Public can view resource images" ON storage.objects;
CREATE POLICY "Public can view resource images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'resource-images');

DROP POLICY IF EXISTS "Authenticated can upload resource images" ON storage.objects;
CREATE POLICY "Authenticated can upload resource images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'resource-images');

-- Credentials: Users can view own or owners/managers/admins can view; authenticated users can upload
DROP POLICY IF EXISTS "Credentials viewable by authorized users" ON storage.objects;
CREATE POLICY "Credentials viewable by authorized users"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'credentials'
        AND (
            auth.uid()::text = (storage.foldername(name))[1]
            OR public.is_admin()
            OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager', 'admin')
            )
        )
    );

DROP POLICY IF EXISTS "Users can upload credentials" ON storage.objects;
CREATE POLICY "Users can upload credentials"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'credentials'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Condition photos: Authenticated can view and upload
DROP POLICY IF EXISTS "Condition photos viewable by authenticated users" ON storage.objects;
CREATE POLICY "Condition photos viewable by authenticated users"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'condition-photos');

DROP POLICY IF EXISTS "Condition photos uploadable by authenticated users" ON storage.objects;
CREATE POLICY "Condition photos uploadable by authenticated users"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'condition-photos');

-- 8. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- End of Migration Script
-- ==============================================================================

