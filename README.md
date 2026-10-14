# Neighborly Hub

אפליקציה קהילתית לניהול ספר שכנים, פרטי קשר וימי הולדת של דיירים בבניינים ובמתחמים.

## Current status

This migration branch runs an independent **Next.js 15 App Router UI preview**. The UI uses mock data only; authentication, authorization, persistence and a backend are **not yet implemented**. Do not deploy it as a production neighbors directory. The legacy Lovable/TanStack source is retained for reference but is not used by the Next.js runtime.

## Getting started

Requires Node.js 24 (see `.nvmrc`) and pnpm 10.18.3.

```bash
nvm install
nvm use
corepack enable
pnpm install
pnpm dev
```

Open http://localhost:3000/directory

## Routes

- `/` — landing page
- `/directory` — searchable neighbors directory and building filter
- `/household/1` — example household details
- `/join` — demo registration form (no persistence)
- `/manage` — demo management interface
- `/auth` and `/reset-password` — visual-only authentication forms

## Development and code quality

ESLint 9 checks code quality, and Prettier 3 handles formatting independently. Configurations: `eslint.config.js`, `.prettierrc`, and `.prettierignore`.

```bash
pnpm typecheck       # TypeScript
pnpm lint            # ESLint
pnpm format:check    # Check formatting
pnpm format          # Apply formatting
pnpm build           # Production build
```

CI runs installation, typecheck, lint and build. Formatting is not yet enforced in CI pending formatting of migrated files.

## Localization

Hebrew (RTL), English (LTR), and Russian (LTR) are supported. Both client-side UI and server-generated metadata use `src/lib/i18n/dictionary.ts`. Language preference is saved in the `neighborly_lang` cookie and controls document `lang` and `dir`. Hebrew is the default.

## Product requirements

דרישות המערכת והאפיון:
1. מובייל פירסט (Mobile-first) בעיצוב חם, קהילתי וידידותי, עם תמיכה מלאה בשלוש שפות: עברית (RTL), אנגלית (LTR), ורוסית (LTR).
2. הוספת פרויקט ובניינים: הגדרת בניין עם מספר קומות ומספר דירות בכל קומה, עם מחולל אוטומטי של דירות.
3. כרטיס דירה ותא משפחתי:
   - הבחנה ברורה בין סוגי החזקה: בעלים ומתגורר (גם וגם), שוכר (דייר בפועל), או בעל דירה שאינו מתגורר.
   - תמונת פרופיל/אוואטר למשפחה או לדייר.
   - איש קשר ראשי + ניהול רשומת בני משפחה (תתי אנשי קשר). בני משפחה (כמו ילדים) לא חייבים מספר טלפון.
   - תאריכי לידה/גיל לכל בן משפחה, ווידג'ט לחגיגות ימי הולדת קרובים בבניין/במתחם.
   - ריבוי מספרי טלפון ואימיילים לאיש קשר.
   - כפתורי פעולה מהירה ונוחה במובייל: חיוג ישיר (tel:), וואטסאפ ישיר (wa.me), ושליחת מייל (mailto:) ישירות מהכרטיס.
4. מודל הרשאות:
   - מנהל מערכת (יצירת פרויקטים).
   - מנהל פרויקט (ניהול מתחם של מספר בניינים, כגון בלוק של 8 בניינים כמו "המושבה העירונית שדרות").
   - מנהל בניין / ועד בית.
   - דייר.
5. תהליך רישום ואישור דיירים:
   - קישור/טופס הצטרפות ידידותי במובייל (בחירת בניין ודירה, הזנת שמות ופרטי קשר).
   - בקשות הצטרפות ממתינות לאישור מנהל הבניין/פרויקט, ומוצגות בספר השכנים רק לאחר אישור.
6. הגדרות נראות ופרטיות:
   - מנהל הפרויקט יכול להגדיר האם ספר השכנים ולוח ימי ההולדת גלויים לכלל הבניינים במתחם (נראות קהילתית פתוחה) או מוגבלים לכל בניין בנפרד.
   - אפשרות לדייר לקבוע לכל מספר טלפון האם הוא גלוי לכלל המתחם, לשכנים בבניין בלבד, או למנהלים בלבד (פרטי). מספרי טלפון של ילדים מוגנים כברירת מחדל למנהלים בלבד.

## Next steps

Implement PostgreSQL + Drizzle, an authentication provider, server-side authorization, and privacy enforcement before enabling real resident data. Review the previous Supabase RLS approach rather than assuming its rules apply unchanged.
