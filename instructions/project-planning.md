הפרומפט

אתה מהנדס תוכנה בכיר ומוביל מוצר. בנה מערכת מקומית (MVP) שתעזור לי לסחור במניות בארה״ב. הפיתוח צריך להיות פשוט, קל להרצה מקומית, עם ארכיטקטורה מודולרית שתאפשר להוסיף מקורות נתונים ואנליזות בעתיד.

0) עקרונות

ריצה מקומית בלבד כרגע (ללא ענן).

מינימום תלות בשירותים בתשלום.

מודולריות: Data Provider ניתן להחלפה, Analytics ניתנים להוספה, ו-UI יודע לצייר הכל.

שקיפות: כל גרף/תובנה חייב להראות מאיפה הנתון הגיע ומתי עודכן.

התוצאה צריכה להיות שימושית לסוחר: חלוקה לקבוצות + סיגנלים/תובנות + השוואות.

1) טכנולוגיות מוצעות (פשוטות ומקומיות)

בחר סטאק אחד, ואז תיישם.

אופציה A (מומלצת כי אתה כבר על React+TS)

Backend: Node.js + TypeScript + Express

DB מקומית: SQLite (עם Prisma או Drizzle)

Scheduler מקומי: node-cron (או פשוט “on-demand” בלבד ב-MVP)

Frontend: React + TypeScript + Vite

גרפים: Recharts (או Chart.js)

ניתוח/חישובים: ספריית technicalindicators / או חישוב ידני קל

אופציה B (אם נוח לך אנליזה בפייתון)

Backend Python (FastAPI) + pandas + ta-lib/ta

Frontend נשאר React

ב-MVP: אל תבנה משתמשים/הרשאות/ענן. רק local.

2) הגדרת מטרות מוצר (מה המשתמש עושה)

המערכת תומכת ב-3 פעולות ליבה:

חלוקה לקבוצות (Groups/Clusters)

קבוצות לפי סקטור/תעשייה (אם יש מקור נתונים חינמי שמספק זאת)

קבוצות לפי התנהגות מחיר (Correlation/Volatility/Momentum)

קבוצות ידניות שאני מגדיר (Watchlists)

פקודה שלי = Fetch → Analyze → Visualize
כשאני נותן הוראה (דרך UI או CLI):

לבחור רשימת טיקרים/קבוצה

להוריד נתוני מחיר/נפח (OHLCV) ממקור חינמי

לבצע ניתוחים

להציג תובנות בצורה גרפית + טקסט קצר ממוסגר

דשבורד תובנות

“מה זז היום בקבוצות שלי?”

“מי חריג ביחס לקבוצה?”

“איזה קבוצות מתכנסות/מתפזרות?”

3) מקורות נתונים חינמיים (תכנון אבסטרקטי)

צור שכבת MarketDataProvider עם ממשק אחיד, כדי שאפשר יהיה להחליף ספק בלי לשבור את המערכת.

Interface (דוגמה)

getDailyBars(ticker, start, end): OHLCV[]

getQuote(ticker): {price, change, volume, ...}

getMetadata(ticker): {name, exchange, sector?, industry?} (אופציונלי)

חשוב

תטפל במגבלות: rate limit, כשלי רשת, נתונים חסרים.

Cache מקומי: אם כבר הורדתי נתונים לטווח תאריכים—לא להוריד שוב.

4) מבנה נתונים (DB SQLite)

תכנן סכימה פשוטה:

tickers

symbol (PK)

name

sector (nullable)

industry (nullable)

groups

id (PK)

name

type (manual | sector | cluster)

group_members

group_id

symbol

price_bars_daily

symbol

date

open/high/low/close/volume

unique(symbol,date)

analysis_runs

id

created_at

scope (group/symbol list)

provider_used

parameters (JSON)

analysis_results

run_id

symbol

metrics (JSON)

signals (JSON)

5) אנליזות (MVP + הרחבות)

צור מודול analytics/ עם פונקציות טהורות. כל אנליזה מחזירה גם “מספרים” וגם “הסבר קצר”.

MVP Metrics (קל ויעיל)

לכל טיקר בטווח נבחר:

תשואה: 1D / 5D / 1M / 3M

תנודתיות (סטיית תקן יומית * sqrt(252))

Max Drawdown

ממוצעים נעים: SMA20, SMA50

RSI(14)

Volume Z-Score (חריגת נפח)

MVP Group Insights

לקבוצה:

“ממוצע תשואה בקבוצה” + פיזור

Top/Bottom performers

Outliers: טיקרים שסטו > 2 סטיות תקן מהקבוצה

Heatmap Correlation (אופציונלי אם קל)

Signals (פשוטים ולא “הבטחות”)

“RSI נמוך/גבוה יחסית” (למשל <30 / >70)

“Cross” (SMA20 חוצה SMA50)

“Breakout בסיסי” (Close מעל High של 20 ימים)

הדגש: להציג כ-תובנות/התראות, לא כהמלצת השקעה.

6) UI / UX (מסכים)

Frontend ב-React:

Groups

יצירת קבוצה ידנית (שם + רשימת טיקרים)

צפייה בקבוצות לפי type

כפתור “Analyze”

Analyze Wizard

בחירת קבוצה/טיקרים

טווח תאריכים (ברירת מחדל: שנה אחורה)

כפתור Run

Results Dashboard

טבלה: Symbol | 1M Return | Vol | RSI | Signal badges

גרפים:

גרף מחיר לטיקר שנבחר + SMA20/50

בר-צ׳ארט תשואות בקבוצה

Scatter: Volatility מול Return (נקודות = טיקרים)

(אופציונלי) Correlation heatmap

Data Status

מתי עודכן לאחרונה

כמה נתונים חסרים

provider בשימוש

7) CLI (אופציונלי אבל שימושי)

הוסף פקודות:

app groups list

app analyze --group "AI Watchlist" --range 1y

app fetch --symbols AAPL,MSFT --range 6m

8) אבטחה/אחריות

אין צורך לשמור מפתחות אם משתמשים בספק ללא API key.

אם צריך API key: לשמור בקובץ .env מקומי בלבד.

הצג Disclaimer קבוע: “מידע למטרות מידע בלבד”.

9) תוכנית עבודה (Roadmap)
שלב 1: Skeleton (יום 1)

ריפו מונורפו (client/server) או שני פרויקטים

DB + מודלים בסיסיים

endpoint בדיקה

שלב 2: Data Provider + Cache (יום 2)

מימוש Provider אחד עובד

שמירה ל-SQLite

ריצה על טיקר יחיד

שלב 3: Analytics MVP (יום 3)

חישוב metrics לטווח

שמירה analysis_runs + analysis_results

שלב 4: UI Results (יום 4)

מסך קבוצות

“Analyze”

טבלה + 2-3 גרפים בסיסיים

שלב 5: Group Insights + Outliers (יום 5)

ממוצעים/פיזור

Top/Bottom

חריגים + באדג׳ים

10) Deliverables מדויקים

בנה את הפרויקט כך שבסוף יהיו:

קוד מלא לריצה מקומית

README עם:

התקנה

איך מריצים

דוגמאות קבוצות

דוגמאות נתונים/סיד (tickers + group)

בדיקות בסיסיות ל-analytics (unit tests)

11) דרישות איכות

TypeScript strict

טיפול בשגיאות רשת + retries עדינים

לוגים קריאים

לא לכתוב “קסם” ב-UI: כל תובנה חייבת להיות מחושבת בשרת ולהוחזר כ-JSON

12) פורמט API מוצע (דוגמא)

POST /api/groups

GET /api/groups

POST /api/analyze

body: { symbols: string[], range: {start,end}, metrics: string[] }

GET /api/runs/:id

GET /api/runs/:id/results
