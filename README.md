# KnowledgeSync

A local team learning portal: propose a lightning talk, vote for an idea, volunteer to present, schedule a session, and keep its materials in the archives.

## Requirements

- Python 3.12+ with venv/pip
- Node.js 20.19+ or 22.12+ and npm
- Two terminals on the host computer; teammates use their browsers

The repository root is the monorepo: `backend/` contains Django, `frontend/` contains Vite/React, and SQLite lives in `backend/db.sqlite3` after migration.

## 1. Set up Django

From this directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.lock.txt
cd backend
python manage.py migrate
python manage.py seed_data
python manage.py runserver 0.0.0.0:8000
```

On Windows, activate with `.venv\Scripts\activate` instead. `requirements.txt` describes supported dependency ranges; `requirements.lock.txt` pins the verified installation.

The seed command creates five team identities, four proposals, two scheduled sessions, and two archives. It is safe to rerun and does not overwrite existing sessions. Sample meeting links are placeholders; replace them with your team’s actual links.

## 2. Run the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. Choose your name at the top, then propose a topic or vote. Both servers bind to `0.0.0.0`. Vite uses port 5173 and stops with a clear error if that port is busy. To use another port, run `npm run dev -- --port 5174` and share that port instead.

## 3. Find the host’s LAN address

On the computer running Django and Vite:

- Linux: run `hostname -I` or `ip -4 addr` and find the IPv4 address for the active Wi-Fi/Ethernet interface.
- macOS: run `ipconfig getifaddr en0` (Wi-Fi; the interface can vary), or use Network settings.
- Windows: run `ipconfig` and find the IPv4 address of the active Wi-Fi/Ethernet adapter.

Use the LAN address, for example `192.168.1.42`, rather than loopback, VPN, or container addresses.

## 4. Connect from another device

Keep both terminals running. Connect teammates’ devices to the same LAN/subnet, then open **http://192.168.1.42:5173** (replace the IP with yours).

The frontend automatically calls **http://192.168.1.42:8000/api/** using the hostname in the browser URL. You do not need to hardcode a host IP. The API allows all development hosts and CORS origins as requested.

If you need a different API address, copy `frontend/.env.example` to `frontend/.env.local`, set `VITE_API_BASE_URL=http://192.168.1.42:8000/api`, and restart Vite.

If another device cannot connect:

1. Check **http://192.168.1.42:8000/api/topics/** directly from that device.
2. Allow inbound TCP ports **8000** and **5173** through the host firewall on the trusted LAN profile.
3. Check that neither device is on an isolated guest network; Wi-Fi client isolation can block peers. VPN routing can also prevent LAN access.
4. Recheck the host IP after reconnecting Wi-Fi. Other devices must use the host’s LAN IP; `localhost` refers to their own device.

## English / فارسی

Use the **English / فارسی** switch in the header. The selection is remembered in this browser; the initial language follows the browser preference when it is Persian, otherwise English. Persian uses right-to-left layout, Persian numerals, and the Persian calendar for displayed session dates. The date/time input uses the Gregorian calendar (as labelled) and your local time zone; API timestamps and calendar downloads remain interoperable UTC dates.

Navigation, cards, forms, help text, accessibility labels, and known API errors are translated. Topic titles, descriptions, teammate names, and links retain their original text; both Persian and English content can be entered and searched. Django Admin follows its own language settings. Translation strings live in `frontend/src/i18n/messages.ts`.

Run `npm run test:i18n` from `frontend/` for bilingual rendering and form contract checks.

## Identity and workflow

This implements the requested **mock login for a trusted local team**. Choosing a name issues a DRF token stored in that browser’s local storage; no password is requested. Anyone with LAN access can choose any non-staff team identity. Do not expose this development setup to the public internet.

- Anyone can read the board. Choose an identity to create topics, vote, or volunteer.
- An **offer** automatically assigns its proposer as presenter. A **request** starts without a presenter; its first volunteer claims it.
- Votes toggle once per person per topic and are allowed for proposed topics only. Counts update after mutations; other devices’ changes are refreshed every 15 seconds.
- A presenter schedules their own proposed session with a future date, duration, and optional meeting URL. Administrators can also manage sessions.
- Dates are entered/displayed in the browser’s local time zone and stored as UTC. Upcoming sessions are chronological. Calendar buttons download an `.ics` event with the actual start time and duration.
- A presenter marks a scheduled session complete, optionally attaching a slides or recap URL. The session moves to Past archives.

Create an administrator with `python manage.py createsuperuser` from `backend/`, then visit **http://localhost:8000/admin/**. Use Django Admin’s Users screen to add real teammates as active non-staff users; they then appear in the identity switcher. Admin credentials are separate from mock team identities.

## API

All routes have a trailing slash. Read routes are public; write routes require `Authorization: Token <token>` or an authenticated Django session.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | /api/auth/users/ | Active non-staff team identities |
| POST | /api/auth/login/ | Body: `{"user_id": 1}`; returns token and user |
| GET | /api/topics/ | Includes proposer, presenter, ORM vote count, personal vote status |
| GET | /api/topics/{id}/ | Topic detail |
| POST | /api/topics/ | title, description, kind (OFFER/REQUEST), duration_minutes |
| POST | /api/topics/{id}/vote/ | Toggle; returns vote_count and has_voted |
| POST | /api/topics/{id}/claim/ | Assign the authenticated volunteer to an unclaimed request |
| PATCH | /api/topics/{id}/schedule/ | scheduled_at (ISO 8601), duration_minutes, optional meeting_link |
| PATCH | /api/topics/{id}/complete/ | Optional slides_url; archives the scheduled session |

List query parameters: `search=python`, `status=PROPOSED|SCHEDULED|COMPLETED`, `kind=OFFER|REQUEST`, and `ordering=-vote_count` (also created_at and scheduled_at). The frontend filters the small local board immediately, without waiting for a search request.

## Verify

```bash
# From backend, with the virtual environment activated:
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test

# From frontend:
npm run build
```

The backend suite covers permissions, lifecycle transitions, validation, vote uniqueness/personalization, search/filtering, CORS, and repeatable seeding. The frontend build checks TypeScript before bundling. Browser visual QA and access from a second physical LAN device must be checked locally.

Configuration references: [DRF ViewSets](https://www.django-rest-framework.org/api-guide/viewsets/), [DRF authentication](https://www.django-rest-framework.org/api-guide/authentication/), [Vite server options](https://vite.dev/config/server-options).
