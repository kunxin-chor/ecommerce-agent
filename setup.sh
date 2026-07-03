if [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
else
  echo ".env file not found. Please create it based on example.env"
  exit 1
fi

MYSQL_USER="${DB_USER:-root}"
MYSQL_PASSWORD="${DB_PASSWORD:-}"
MYSQL_HOST="${DB_HOST:-127.0.0.1}"

mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -h "$MYSQL_HOST" < schema.sql
mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -h "$MYSQL_HOST" < data.sql
node setup.js
npm install -g nodemon