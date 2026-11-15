# FITTRACK

FITTRACK is a responsive fitness-tracking web app built with HTML, CSS, and vanilla JavaScript.

## Run locally on Windows

Open PowerShell in the project folder and start a local web server:

```powershell
py -m http.server 5500
```

Then open [http://localhost:5500](http://localhost:5500) in your browser. Press `Ctrl+C` in PowerShell to stop the server. Serving the files over HTTP is needed for the JavaScript modules to load correctly.

## Current features

- Guest dashboard with daily activity and water summaries.
- Daily activity and water goals.
- Workout sessions with exercises, sets, reps, weights in kilograms, completion tracking, and a rest timer.
- Custom gym, home, or flexible plans with weekly schedules.
- Searchable exercise library with muscle and equipment filters, local vector illustrations, form instructions, and workout integration.
- Progress tracking with body-weight check-ins, date-range charts, completed-set strength trends, and personal records.
- Nutrition logging with daily calorie, protein, carbohydrate, and fat targets.
- Email registration and sign-in with optional Supabase-backed account synchronization.
- Workout and plan history saved in the browser.

Guest data is stored in this browser for this site address. Clearing the browser's saved data for the site can remove guest entries. Supabase account sync remains off until you configure a project.

Exercise guides currently use bundled SVG illustrations and written instructions; video demonstrations are not included yet.

## Project files

- `index.html` contains the dashboard and app views.
- `css/` contains the shared theme, layout, and component styles.
- `js/app.js` handles navigation, workout sessions, plans, and page interactions.
- `js/exercises.js` contains the built-in exercise catalog and coaching instructions.
- `js/storage.js` validates and saves guest data in browser storage, including nutrition and progress logs.
- `js/auth.js` connects to Supabase Auth and the private user-data table when configured.
- `js/supabase-config.js` holds the public Supabase project URL and publishable key.
- `assets/exercise-illustrations.svg` contains the library's local exercise illustrations.
- `login.html` and `register.html` provide the account screens.
- `supabase/schema.sql` creates the user-data table and its row-level security policies.

## Enable Supabase accounts and sync

1. Create a Supabase project and enable email/password authentication.
2. In the Supabase SQL Editor, run `supabase/schema.sql`. The `user_data` table stores a private, versioned JSON document for each account; row-level security restricts every operation to `auth.uid()`.
3. Copy your project's URL and **publishable** (or legacy `anon`) key into `js/supabase-config.js`. These are public client values protected by RLS. Never put a service-role or secret key in this frontend.
4. Add your local and Vercel site URLs to Supabase Auth's allowed site/redirect URL settings.
5. Run the site over HTTP locally or deploy the static files to Vercel. When configured, the Supabase JavaScript client is loaded from jsDelivr only for account features.

Guest mode continues to work without Supabase. After signing in, FITTRACK asks before merging saved device data into an account; records are merged by ID, and routine changes are saved locally and synced while the account is connected.
