# Home Medication Tracker

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/the-data-sherpa/home_medication_tracker/releases/tag/v1.0.0)

A mobile-friendly web application for tracking home medications for family members. Built with FastAPI, SQLite, and vanilla JavaScript, containerized with Docker for easy deployment.

> **Current Version**: 1.0.0 - See [CHANGELOG.md](CHANGELOG.md) for release notes and version history.

## 🎯 Overview

Home Medication Tracker helps families manage medications with features like:
- **Smart timing reminders** - Know exactly when medications can be given again
- **Multi-user support** - Track which caregiver administered each dose
- **Flexible scheduling** - Support for fixed frequencies (every 4 hours) and ranges (every 4-6 hours)
- **Complete history** - Full administration history with filtering and editing capabilities
- **Mobile-first design** - Responsive interface with hamburger menu for easy mobile use

## ✨ Features

### Core Functionality
- **Family Member Management** - Add and manage family members who need medications
- **Medication Library** - Create reusable medications with default doses and frequencies
- **Medication Assignment** - Assign medications to family members with custom doses and frequency overrides
- **Administration Tracking** - Record when medications are given with precise timestamps
- **Time-Based Status** - Visual indicators showing medication status:
  - 🟢 **Green (Ready)** - Can be given now
  - 🟡 **Yellow (Soon)** - Available within 1 hour
  - 🔴 **Red (Overdue)** - Past the maximum time window

### Advanced Features
- **Caregiver Tracking** - Record which caregiver administered each dose
- **Frequency Ranges** - Support for flexible timing (e.g., "every 4-6 hours")
- **Recurring Schedules** - Set up daily or weekly medication schedules
- **Medication History** - Complete administration history with:
  - Filtering by family member, medication, and date range
  - Edit administration times for delayed logging
  - View caregiver information for each administration
- **Inventory Management** - Track medication quantities with low-stock alerts
- **Export/Backup** - Export data as JSON or CSV, import from JSON backups
- **Medication Notes** - Add notes to administrations for tracking side effects or observations

### User Experience
- **Mobile-Friendly** - Responsive design with hamburger menu navigation
- **Touch-Optimized** - All buttons and controls meet mobile touch target guidelines
- **Real-Time Updates** - Status timers update automatically
- **Intuitive Interface** - Clean, modern design that's easy to use
- **Dark Mode** - Full dark theme support with toggle in settings
- **Accessibility** - ARIA labels, keyboard navigation, and screen reader support
- **Error Recovery** - Automatic retry for failed requests with network status indicator
- **Form Validation** - Inline validation with helpful error messages
- **Quick Give** - One-click medication administration for routine doses

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
  - [Install Docker](https://docs.docker.com/get-docker/)
  - [Install Docker Compose](https://docs.docker.com/compose/install/)

### Installation & Running

1. **Clone the repository:**
   ```bash
   git clone git@github.com:the-data-sherpa/home_medication_tracker.git
   cd home_medication_tracker
   ```

2. **Start the application:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

4. **First-time setup:**
   - The database will be created automatically on first run
   - Start by adding family members, then medications, then assign medications to family members

### Stopping the Application

```bash
docker-compose down
```

To stop and remove all data (including database):
```bash
docker-compose down -v
```

## 📁 Project Structure

```
home_medication_tracker/
├── backend/                    # FastAPI backend application
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── database.py        # Database configuration
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── schemas.py         # Pydantic schemas
│   │   └── routers/           # API route handlers
│   │       ├── administrations.py
│   │       ├── assignments.py
│   │       ├── caregivers.py
│   │       ├── export.py
│   │       ├── family_members.py
│   │       ├── inventory.py
│   │       └── medications.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # Frontend static files
│   ├── index.html
│   ├── css/
│   │   └── style.css          # Mobile-first responsive styles
│   └── js/                     # ES6 modules
│       ├── api.js             # API client
│       ├── app.js             # Main application controller
│       ├── dashboard.js       # Dashboard view
│       ├── administrations.js # Administration tracking
│       ├── assignments.js     # Assignment management
│       ├── caregivers.js      # Caregiver management
│       ├── export.js          # Export/import functionality
│       ├── family-members.js  # Family member management
│       ├── inventory.js       # Inventory management
│       └── medications.js     # Medication management
├── data/                       # Database storage (created automatically)
│   └── medications.db         # SQLite database
├── docker-compose.yml
└── README.md
```

## 💾 Data Persistence

The SQLite database is stored in the `./data` directory, which is mounted as a Docker volume. This ensures:
- ✅ Data persists across container restarts
- ✅ Data persists when updating the application
- ✅ Easy backup by copying the `./data` directory

### Backup Options

1. **Using the Export Feature** (Recommended):
   - Navigate to Settings → Export as JSON or CSV
   - This exports all data in a portable format

2. **Direct Database Backup**:
   ```bash
   cp -r data/ data_backup/
   ```

3. **Restore from Backup**:
   - Use the Import feature in Settings → Import from JSON
   - Or replace the `data/medications.db` file and restart the container

## 🔧 Configuration

### Environment Variables

The application can be configured via environment variables in `docker-compose.yml`:

- `DATABASE_PATH` - Path to SQLite database file (default: `/app/data/medications.db`)

### Port Configuration

To change the port, modify `docker-compose.yml`:
```yaml
ports:
  - "YOUR_PORT:8000"  # Change YOUR_PORT to desired port
```

## 📖 Usage Guide

### Getting Started

1. **Add Family Members**
   - Click "Family" in the navigation
   - Click "Add Family Member"
   - Enter the name and save

2. **Create Medications**
   - Click "Medications" in the navigation
   - Click "Add Medication"
   - Enter medication name, default dose, and frequency
   - Choose between fixed frequency (e.g., every 4 hours) or range (e.g., every 4-6 hours)

3. **Assign Medications**
   - Click "Dashboard" or use the "Assign Medication" button
   - Select family member and medication
   - Optionally override dose and frequency for this specific assignment
   - Set up recurring schedules if needed

4. **Record Administrations**
   - On the Dashboard, click "Give Medication" when ready
   - Select caregiver (optional)
   - Confirm dose and add notes if needed
   - The system will track the time and update status

5. **View History**
   - Click "History" in the navigation
   - Use filters to find specific administrations
   - Click "Edit" on any administration to correct the time if logging was delayed

### Understanding Status Indicators

- **🟢 Ready (Green)** - Medication can be given now
- **🟡 Soon (Yellow)** - Medication will be available within 1 hour
- **🔴 Overdue (Red)** - Past the maximum time window (for range frequencies)

### Frequency Types

- **Fixed Frequency**: "Every 4 hours" - Can give exactly 4 hours after last dose
- **Range Frequency**: "Every 4-6 hours" - Can give after 4 hours, but should give before 6 hours

## 🔌 API Documentation

The application provides a REST API at `/api`. When running locally, interactive API documentation is available at:
- Swagger UI: `http://localhost:8080/docs`
- ReDoc: `http://localhost:8080/redoc`

### Main Endpoints

- `GET/POST /api/family-members` - Family member management
- `GET/POST /api/medications` - Medication management
- `GET/POST /api/assignments` - Medication assignments
- `GET/POST /api/administrations` - Administration tracking
- `GET/POST /api/caregivers` - Caregiver management
- `GET/POST /api/inventory` - Inventory management
- `GET /api/export/json` - Export data as JSON
- `GET /api/export/csv` - Export data as CSV
- `POST /api/export/import/json` - Import data from JSON

## 🛠️ Development

### Running Locally (Without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
The frontend is served by FastAPI at `/static` when running the backend, or you can use any static file server.

### Building the Docker Image

```bash
docker-compose build
```

### Viewing Logs

```bash
docker-compose logs -f
```

## 🐛 Troubleshooting

### Database Issues

If you encounter database errors:
1. Stop the container: `docker-compose down`
2. Remove the database: `rm -rf data/medications.db`
3. Restart: `docker-compose up -d`

### Port Already in Use

If port 8080 is already in use:
1. Edit `docker-compose.yml`
2. Change the port mapping: `"8080:8000"` to `"YOUR_PORT:8000"`

### Container Won't Start

1. Check logs: `docker-compose logs`
2. Ensure Docker is running
3. Verify `docker-compose.yml` syntax is correct

## 🔒 Security Notes

- This application is designed for **local/home network use**
- No authentication is implemented - do not expose to the internet without proper security
- For production deployment, consider adding:
  - Authentication/authorization
  - HTTPS/TLS encryption
  - Rate limiting
  - Input validation hardening

## 📝 License

This project is for personal/home use.

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed list of changes, features, and version history.

## 🤝 Contributing

This is a personal project, but suggestions and improvements are welcome!

## 📧 Support

For issues or questions, please open an issue in the repository.

## 🔗 Additional Documentation

- [CHANGELOG.md](CHANGELOG.md) - Version history and release notes
- [docs/recommendations.md](docs/recommendations.md) - Feature recommendations and roadmap
- [docs/README.md](docs/README.md) - Documentation index

---

**Made with ❤️ for families managing medications at home**
