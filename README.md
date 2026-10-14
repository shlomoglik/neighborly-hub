# Neighborly Hub

אפליקציה לניהול ספר שכנים ופרטי קשר של דיירים בפרויקט עירוני וקהילתי.

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

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a85152c7-9edb-4e1b-b5c8-3120d4145538).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
