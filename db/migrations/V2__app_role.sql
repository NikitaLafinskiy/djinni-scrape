CREATE ROLE djinni_app WITH LOGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON users, user_urls, user_ignore_words, applications TO djinni_app;

{{IAM_GRANTS}}
