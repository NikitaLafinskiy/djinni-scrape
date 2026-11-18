ALTER TABLE users ALTER COLUMN djinni_email DROP NOT NULL;

ALTER TABLE users ADD COLUMN nfj_email text;

ALTER TABLE users ADD COLUMN nfj_password text;

ALTER TABLE users ADD COLUMN nfj_phone text;

ALTER TABLE users ADD COLUMN nfj_apply_message text;

ALTER TABLE users ADD COLUMN nfj_locations text;

ALTER TABLE users ADD COLUMN nfj_languages text;

ALTER TABLE users ADD COLUMN nfj_require_english boolean;

ALTER TABLE user_urls ADD COLUMN platform text;

UPDATE user_urls SET platform = 'djinni' WHERE platform IS NULL;

ALTER TABLE applications ADD COLUMN platform text;

UPDATE applications SET platform = 'djinni' WHERE platform IS NULL;

ALTER TABLE applications RENAME COLUMN djinni_job_id TO job_id;

CREATE UNIQUE INDEX ASYNC applications_user_platform_job_idx ON applications (user_id, platform, job_id);

DROP INDEX applications_user_job_idx;
