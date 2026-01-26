# Docker Setup Guide

This guide will help you set up PostgreSQL with TimescaleDB using Docker.

## Quick Start

1. **Start the database:**
   ```bash
   docker-compose up -d
   ```

2. **Create your `.env` file:**
   ```bash
   cp env.sample .env
   ```
   
   The `.env` file should have these database settings (already configured for Docker):
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=seismic_db
   DB_USER=postgres
   DB_PASSWORD=postgres
   ```

3. **Wait for the database to be ready** (about 10-15 seconds), then run migrations:
   ```bash
   npm run migrate
   ```

4. **Start your application:**
   ```bash
   npm run dev
   ```

## Docker Commands

### Start Database
```bash
docker-compose up -d
```

### Stop Database
```bash
docker-compose down
```

### View Database Logs
```bash
docker-compose logs -f postgres
```

### Stop and Remove All Data
```bash
docker-compose down -v
```
⚠️ **Warning:** This will delete all database data!

### Restart Database
```bash
docker-compose restart
```

### Check Database Status
```bash
docker-compose ps
```

## Connecting to the Database

### From your application (Node.js)
Use the connection settings in your `.env` file:
- Host: `localhost`
- Port: `5432`
- Database: `seismic_db`
- User: `postgres`
- Password: `postgres`

### Using psql (PostgreSQL client)
```bash
psql -h localhost -U postgres -d seismic_db
```
Password: `postgres`

### Using Docker exec
```bash
docker exec -it seismic-postgres psql -U postgres -d seismic_db
```

## Troubleshooting

### Database won't start
1. Check if port 5432 is already in use:
   ```bash
   netstat -ano | findstr :5432
   ```
2. Change the port in `docker-compose.yml` if needed:
   ```yaml
   ports:
     - "5433:5432"  # Use 5433 on host instead
   ```

### Connection refused
1. Make sure the container is running:
   ```bash
   docker-compose ps
   ```
2. Check the logs:
   ```bash
   docker-compose logs postgres
   ```

### Reset everything
If you need to start fresh:
```bash
docker-compose down -v
docker-compose up -d
npm run migrate
```

## Production Considerations

For production, you should:

1. **Change the default password** in `docker-compose.yml`:
   ```yaml
   environment:
     POSTGRES_PASSWORD: your_secure_password_here
   ```

2. **Update your `.env` file** with the new password

3. **Use environment variables** for sensitive data instead of hardcoding

4. **Set up proper backups** for the `postgres_data` volume

5. **Use a managed database service** (like AWS RDS with TimescaleDB) for production

## Data Persistence

Database data is stored in a Docker volume named `postgres_data`. This means:
- Data persists even if you stop the container
- Data is removed only if you use `docker-compose down -v`
- To backup: `docker run --rm -v seismic-postgres_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data`



