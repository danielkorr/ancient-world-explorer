-- Local-only, synthetic fixtures for integration testing.
-- Never replace these with a production dump or real user data.

insert into public.journeys (id, name, era, hero_text, color, waypoints, curator, visible)
values
  (
    'alexander',
    'Alexander''s Campaign',
    '334–323 BCE',
    'A synthetic local fixture for testing the campaign experience against Supabase.',
    '#d4a853',
    array['491687', '491689', '491690', '491691'],
    'VIA local integration fixture',
    true
  ),
  (
    'roman',
    'Roman World',
    '1st century BCE–2nd century CE',
    'A synthetic local fixture for testing the Roman map and return paths.',
    '#8fb7c9',
    array['423025', '432782', '438601', '491687'],
    'VIA local integration fixture',
    true
  )
on conflict (id) do update set
  name = excluded.name,
  era = excluded.era,
  hero_text = excluded.hero_text,
  color = excluded.color,
  waypoints = excluded.waypoints,
  curator = excluded.curator,
  visible = excluded.visible;
