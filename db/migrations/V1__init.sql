CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    djinni_email text NOT NULL,
    djinni_password text,
    apply_message text,
    skip_ukraine_only boolean NOT NULL DEFAULT true,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_urls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    url text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ASYNC user_urls_user_id_idx ON user_urls (user_id);

CREATE TABLE user_ignore_words (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    word text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ASYNC user_ignore_words_user_id_idx ON user_ignore_words (user_id);

CREATE TABLE applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    user_url_id uuid NOT NULL,
    source_url text NOT NULL,
    job_url text NOT NULL,
    djinni_job_id text NOT NULL,
    title text,
    company_name text,
    status text NOT NULL,
    easy_apply boolean,
    suitable boolean,
    matched_word text,
    error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ASYNC applications_user_job_idx ON applications (user_id, djinni_job_id);

CREATE INDEX ASYNC applications_user_status_idx ON applications (user_id, status);

CREATE INDEX ASYNC applications_created_at_idx ON applications (created_at);
