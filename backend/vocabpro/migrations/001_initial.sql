CREATE TABLE tests (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
    description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 400),
    class_label text NOT NULL DEFAULT '',
    class_key text NOT NULL DEFAULT '',
    mode text NOT NULL CHECK (mode IN ('written', 'matching', 'headings', 'mixed')),
    duration_minutes smallint NOT NULL CHECK (duration_minutes BETWEEN 1 AND 60),
    active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX active_tests_by_class ON tests (class_key, updated_at DESC, id DESC) WHERE active;

CREATE TABLE vocabulary (
    test_id bigint NOT NULL REFERENCES tests (id) ON DELETE CASCADE,
    position smallint NOT NULL CHECK (position BETWEEN 0 AND 79),
    term text NOT NULL CHECK (char_length(term) BETWEEN 1 AND 80),
    translation text NOT NULL CHECK (char_length(translation) BETWEEN 1 AND 80),
    heading text NOT NULL DEFAULT '' CHECK (char_length(heading) <= 50),
    PRIMARY KEY (test_id, position)
);

CREATE TABLE attempts (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL,
    test_id bigint NOT NULL REFERENCES tests (id),
    test_title text NOT NULL,
    student_name text NOT NULL,
    student_key text NOT NULL,
    class_label text NOT NULL,
    class_key text NOT NULL,
    questions jsonb NOT NULL,
    answers jsonb NOT NULL DEFAULT '{}',
    revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
    started_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    lease_until timestamptz NOT NULL,
    finished_at timestamptz,
    reason text CHECK (reason IN ('submitted', 'fullscreen_exit', 'time_limit', 'disconnected')),
    correct_count smallint,
    total_count smallint NOT NULL CHECK (total_count > 0),
    CHECK (correct_count BETWEEN 0 AND total_count),
    CHECK (
        (finished_at IS NULL AND reason IS NULL AND correct_count IS NULL) OR
        (finished_at IS NOT NULL AND reason IS NOT NULL AND correct_count IS NOT NULL)
    )
);

CREATE UNIQUE INDEX one_live_attempt ON attempts (session_id, test_id) WHERE finished_at IS NULL;
CREATE INDEX attempts_deadline ON attempts ((least(expires_at, lease_until))) WHERE finished_at IS NULL;
CREATE INDEX results_by_test ON attempts (test_id, finished_at DESC, id DESC) WHERE finished_at IS NOT NULL;
CREATE INDEX recent_results ON attempts (finished_at DESC, id DESC) WHERE finished_at IS NOT NULL;

CREATE TABLE login_limits (
    bucket text PRIMARY KEY,
    window_start timestamptz NOT NULL,
    failures smallint NOT NULL CHECK (failures > 0)
);

CREATE TABLE telegram_setting (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    chat_id bigint NOT NULL CHECK (chat_id <> 0)
);

CREATE TABLE telegram_outbox (
    attempt_id uuid PRIMARY KEY REFERENCES attempts (id) ON DELETE CASCADE,
    chat_id bigint NOT NULL,
    message text NOT NULL,
    retries smallint NOT NULL DEFAULT 0,
    next_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz,
    abandoned_at timestamptz
);

CREATE INDEX telegram_ready ON telegram_outbox (next_at) WHERE delivered_at IS NULL AND abandoned_at IS NULL;
