CREATE TABLE class_aliases (
    alias_key text PRIMARY KEY CHECK (alias_key <> ''),
    class_key text NOT NULL CHECK (class_key <> '' AND class_key <> alias_key)
);

-- The school uses both its section code and the class's full name.
INSERT INTO class_aliases (alias_key, class_key) VALUES
    ('7-abdullaavloniy', '7-a'),
    ('7abdullaavloniy', '7-a'),
    ('7a', '7-a');

CREATE FUNCTION resolve_class_key(input_key text) RETURNS text
LANGUAGE sql STABLE STRICT AS $$
    SELECT coalesce((SELECT class_key FROM class_aliases WHERE alias_key = input_key), input_key)
$$;

UPDATE tests t SET class_key = a.class_key FROM class_aliases a WHERE t.class_key = a.alias_key;
UPDATE attempts t SET class_key = a.class_key FROM class_aliases a WHERE t.class_key = a.alias_key;
