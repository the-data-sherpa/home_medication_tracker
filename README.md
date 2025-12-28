# Home Medication Tracker

A mobile-friendly web application for tracking home medications for family members. Built with FastAPI, SQLite, and vanilla JavaScript, containerized with Docker.

## Features

- **Family Member Management** - Add and manage family members
- **Medication Library** - Create and reuse medications with default doses and frequencies
- **Medication Assignment** - Assign medications to family members with custom doses/frequencies
- **Administration Tracking** - Record when medications are given with timestamps
- **Time-Based Reminders** - Visual indicators showing when medications can be given again
- **Medication History Dashboard** - View all past administrations with filtering
- **Inventory Tracking** - Track medication quantities with low-stock alerts
- **Recurring Schedules** - Set up daily or weekly medication schedules
- **Export/Backup** - Export data as JSON or CSV, import from JSON backups
- **Medication Notes** - Add notes to administrations
- **Visual Status Indicators** - Color-coded status (green=ready, yellow=soon, red=overdue)

## Quick Start

### Prerequisites

- Docker and Docker Compose installed

### Running the Application

1. Clone or navigate to the project directory:
   ```bash
   cd home_medication_tracker
   ```

2. Start the application with Docker Compose:
   ```bash
   docker-compose up -d
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

4. The application will automatically create the database on first run.

### Stopping the Application

```bash
docker-compose down
```

## Data Persistence

The SQLite database is stored in the `./data` directory, which is mounted as a volume in Docker. This ensures all your medication data persists across container restarts and updates.

To backup your data:
- Copy the `./data` directory
- Or use the Export feature in the Settings view

## Project Structure

```
home_medication_tracker/
├── backend/           # FastAPI backend
│   ├── app/          # Application code
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/         # Frontend static files
│   ├── index.html
│   ├── css/
│   └── js/
├── data/            # Database storage (created automatically)
├── docker-compose.yml
└── README.md
```

## API Endpoints

The application provides a REST API at `/api`:

- `/api/family-members` - Family member management
- `/api/medications` - Medication management
- `/api/assignments` - Medication assignments
- `/api/administrations` - Administration tracking
- `/api/inventory` - Inventory management
- `/api/export` - Export/import functionality

## Development

To run the backend locally (without Docker):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The frontend can be served from any static file server or accessed via the FastAPI static file serving at `/static`.

## License

This project is for personal/home use.

