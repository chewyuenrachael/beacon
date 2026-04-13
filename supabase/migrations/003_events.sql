-- Feature 6: events + event_attendees (Event Operations Toolkit)
-- ambassador_id: no FK until ambassadors table exists; add REFERENCES later.

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  institution_id text NOT NULL REFERENCES institutions (id) ON DELETE RESTRICT,
  ambassador_id uuid,
  event_type text NOT NULL,
  title text NOT NULL,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  tracking_code text NOT NULL UNIQUE,
  attendee_count int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_institution_id_idx ON events (institution_id);

CREATE INDEX events_scheduled_at_idx ON events (scheduled_at DESC);

CREATE INDEX events_status_idx ON events (status);

CREATE TABLE event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  attended_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);

CREATE INDEX event_attendees_event_id_idx ON event_attendees (event_id);

-- Keep events.attendee_count in sync for anon RSVP inserts and API inserts
CREATE OR REPLACE FUNCTION bump_event_attendee_count ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE events
  SET
    attendee_count = attendee_count + 1
  WHERE
    id = NEW.event_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER event_attendees_bump_count
AFTER INSERT ON event_attendees
FOR EACH ROW
EXECUTE PROCEDURE bump_event_attendee_count ();

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- events: read for dashboard (anon); writes via service_role API only
CREATE POLICY events_anon_select ON events FOR SELECT TO anon USING (true);

CREATE POLICY events_service_role_all ON events FOR ALL TO service_role USING (true)
WITH
  CHECK (true);

-- event_attendees: dashboard/API via service_role; public RSVP: anon INSERT only (no SELECT)
CREATE POLICY event_attendees_service_role_all ON event_attendees FOR ALL TO service_role USING (true)
WITH
  CHECK (true);

CREATE POLICY event_attendees_anon_insert ON event_attendees FOR INSERT TO anon
WITH
  CHECK (
    length(trim(email)) > 0
    AND EXISTS (
      SELECT
        1
      FROM
        events e
      WHERE
        e.id = event_id
    )
  );

GRANT SELECT ON events TO anon;

GRANT INSERT ON event_attendees TO anon;

GRANT ALL ON events TO service_role;

GRANT ALL ON event_attendees TO service_role;
