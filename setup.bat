@echo off
if exist .env (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        set %%a=%%b
    )
) else (
    echo .env file not found. Please create it based on example.env
    exit /b 1
)

set MYSQL_USER=%DB_USER:root=%
if "%MYSQL_USER%"=="" set MYSQL_USER=root
set MYSQL_PASSWORD=%DB_PASSWORD%
if "%MYSQL_PASSWORD%"=="" set MYSQL_PASSWORD=
set MYSQL_HOST=%DB_HOST:127.0.0.1=%
if "%MYSQL_HOST%"=="" set MYSQL_HOST=127.0.0.1

mysql -u %MYSQL_USER% -p%MYSQL_PASSWORD% -h %MYSQL_HOST% < schema.sql
mysql -u %MYSQL_USER% -p%MYSQL_PASSWORD% -h %MYSQL_HOST% < data.sql
node setup.js
npm install -g nodemon