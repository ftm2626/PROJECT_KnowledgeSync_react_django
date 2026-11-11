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
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

On Windows, activate with `.venv\Scripts\activate` instead. `requirements.txt` describes supported dependency ranges; `requirements.lock.txt` pins the verified installation.

The seed command creates five demo accounts, four proposals, two scheduled sessions, and two archives. New demo accounts have no usable passwords; set a password in Django Admin or with `python manage.py changepassword alex` before using one to sign in. It is safe to rerun and does not overwrite existing sessions. Sample meeting links are placeholders; replace them with your team’s actual links.

## 2. Run the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. Sign in with your administrator-created username and password, then propose a topic or vote. The superuser created above can also sign into the application. Both servers bind to `0.0.0.0`. Vite uses port 5173 and stops with a clear error if that port is busy. To use another port, run `npm run dev -- --port 5174` and share that port instead.

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

1. Check **http://192.168.1.42:8000/api/topics/** directly from that device. An authentication-required response confirms that Django is reachable; topic data is available only after signing in.
2. Allow inbound TCP ports **8000** and **5173** through the host firewall on the trusted LAN profile.
3. Check that neither device is on an isolated guest network; Wi-Fi client isolation can block peers. VPN routing can also prevent LAN access.
4. Recheck the host IP after reconnecting Wi-Fi. Other devices must use the host’s LAN IP; `localhost` refers to their own device.

## English / فارسی

Use the **English / فارسی** switch in the header. The selection is remembered in this browser; the initial language follows the browser preference when it is Persian, otherwise English. Persian uses right-to-left layout, Persian numerals, and the Persian calendar for displayed session dates. The date/time input uses the Gregorian calendar (as labelled) and your local time zone; API timestamps and calendar downloads remain interoperable UTC dates.

Navigation, cards, forms, help text, accessibility labels, and known API errors are translated. Topic titles, descriptions, teammate names, and links retain their original text; both Persian and English content can be entered and searched. Django Admin follows its own language settings. Translation strings live in `frontend/src/i18n/messages.ts`.

Run `npm run test:i18n` from `frontend/` for bilingual rendering and form contract checks.

## Accounts and sign-in

Sign-in is required to view the board and to use the topic API. Accounts are created by an administrator; public signup and self-service password reset are not available.

From `backend/` with the virtual environment active:

```bash
# Create the first administrator if you do not already have one:
python manage.py createsuperuser
# Set or reset a demo or existing teammate's password interactively:
python manage.py changepassword alex
```

Visit **http://localhost:8000/admin/** and use **Users → Add user** to create teammates with usernames and passwords. Keep their accounts active. Staff access is only necessary for administrators. Existing active staff/superuser accounts can also sign into the learning application.

The application stores its DRF authentication token in browser local storage; passwords are never stored. Saved sign-ins are verified against the server before the board is shown. Sign out revokes the token on the server and clears browser identity and query data. DRF uses one token per user, so signing out also invalidates other browsers using that token. If the server cannot be reached during logout, the application keeps the sign-in and offers a retry.

Upgrading from mock login: run `python manage.py migrate` before starting the updated servers. Migration `0002_revoke_mock_tokens` signs out old mock identities once, without changing passwords, users, topics, or votes. Existing demo accounts with unusable passwords need administrator-set passwords. Running `seed_data` again preserves any passwords you have set.

This remains a local development setup; do not expose the development servers to the public internet. Django Admin uses its own session sign-in. Admin session cookies do not authenticate application API requests.

## Learning workflow

- Sign in with your username and password to view sessions, propose topics, vote, or volunteer.
- An **offer** automatically assigns its proposer as presenter. A **request** starts without a presenter; its first volunteer claims it.
- Votes toggle once per person per topic and are allowed for proposed topics only. Counts update after mutations; other devices’ changes are refreshed every 15 seconds.
- A presenter schedules their own proposed session with a future date, duration, and optional meeting URL. Administrators can also manage sessions.
- Dates are entered/displayed in the browser’s local time zone and stored as UTC. Upcoming sessions are chronological. Calendar buttons download an `.ics` event with the actual start time and duration.
- A presenter marks a scheduled session complete, optionally attaching a slides or recap URL. The session moves to Past archives.
- The person who created an idea sees **Edit** and **Delete** on its card in every tab. **Edit** opens a prefilled form for title, description, duration, and topic type. Votes, session status, meeting date/link, and materials are preserved. Switching between Offer and Request is allowed only before scheduling and before another teammate volunteers; switching to Offer assigns the creator as presenter, while switching to Request clears that assignment.
- **Delete** asks for confirmation and permanently removes the idea and its votes. Other users, including presenters and staff, cannot edit or delete someone else's idea through the application API. Authorized administrators can still manage records in Django Admin.

## API

All routes have a trailing slash. Every application API endpoint except login requires `Authorization: Token <token>`. Login accepts username/password without an existing token.

| Method | Route | Behavior |
| --- | --- | --- |
| POST | /api/auth/login/ | Body: `{"username": "alex", "password": "your password"}`; returns token and user |
| GET | /api/auth/me/ | Validate token and return the current user |
| POST | /api/auth/logout/ | Revoke token; returns HTTP 204 |
| GET | /api/topics/ | Includes proposer, presenter, ORM vote count, personal vote status |
| GET | /api/topics/{id}/ | Topic detail |
| POST | /api/topics/ | title, description, kind (OFFER/REQUEST), duration_minutes |
| PATCH / PUT | /api/topics/{id}/ | Creator only; edit title, description, kind, duration_minutes |
| DELETE | /api/topics/{id}/ | Creator only; permanently delete idea and its votes |
| POST | /api/topics/{id}/vote/ | Toggle; returns vote_count and has_voted |
| POST | /api/topics/{id}/claim/ | Assign the authenticated volunteer to an unclaimed request |
| PATCH | /api/topics/{id}/schedule/ | scheduled_at (ISO 8601), duration_minutes, optional meeting_link |
| PATCH | /api/topics/{id}/complete/ | Optional slides_url; archives the scheduled session |

The old `/api/auth/users/` identity-list route has been removed. Invalid credentials return HTTP 401 with a generic error; malformed login fields return HTTP 400. Anonymous topic requests return HTTP 401.

List query parameters: `search=python`, `status=PROPOSED|SCHEDULED|COMPLETED`, `kind=OFFER|REQUEST`, and `ordering=-vote_count` (also created_at and scheduled_at). The frontend filters the small local board immediately, without waiting for a search request.

## Verify

```bash
# From backend, with the virtual environment activated:
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test

# From frontend:
npm run build
npm run test:i18n
```

The backend suite covers creator-only editing/deletion, type-change rules, vote preservation, password login, logout, token revocation, protected reads, permissions, lifecycle transitions, validation, vote uniqueness/personalization, search/filtering, CORS, and repeatable seeding. The frontend build checks TypeScript before bundling. Browser visual QA and access from a second physical LAN device must be checked locally.

Configuration references: [DRF ViewSets](https://www.django-rest-framework.org/api-guide/viewsets/), [DRF authentication](https://www.django-rest-framework.org/api-guide/authentication/), [Vite server options](https://vite.dev/config/server-options).
