# PlayStation Club Management System

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Mode (Web + API)**:
   ```bash
   npm run dev
   ```

3. **Run Electron App (Local Desktop)**:
   ```bash
   npm run electron
   ```

4. **Build for Windows**:
   ```bash
   npm run build:electron
   ```

## Project Structure
- `server.ts`: Express backend + SQLite database logic.
- `main.ts`: Electron main process configuration.
- `src/`: React frontend application.
- `database.db`: Local SQLite database (created on first run).

## Features
- **Real-time Timers**: Fixed time countdowns and open session count-ups.
- **Product Management**: Inventory tracking and session billing.
- **Reporting**: Daily, monthly, and total revenue analytics.
- **Multi-language**: Support for Azerbaijani, English, and Russian.
- **Offline First**: Works completely without internet connection.
