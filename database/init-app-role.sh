#!/bin/sh
set -eu

psql --set=ON_ERROR_STOP=1 --username postgres --dbname vocabpro <<'SQL'
\getenv app_password VOCABPRO_DB_PASSWORD
CREATE ROLE vocabpro LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER DATABASE vocabpro OWNER TO vocabpro;
SQL
