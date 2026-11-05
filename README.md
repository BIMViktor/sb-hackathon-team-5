# Team 5 · Ritningsbord på Vercel

App: https://sb-hackathon-team-5.vercel.app/

GitHub main är kopplad till Vercel. Appens statiska läsare byggs av scripts/build.mjs till dist/. API:t körs som Vercel Node Functions i api/. Ingen omdirigering, autentisering eller databas från Sites används.

PDF-filer hämtas direkt från StreamBIM till webbläsarens arbetsminne. PDF-filer lagras aldrig i appens beständiga lagring, Vercel eller databasen. Endast annoteringar, sparningskvitton och tekniska sessionsmetadata lagras i PostgreSQL. Kopplingen är StreamBIM-miljö + projekt-ID + dokument-ID + sidindex; revisions-ID används bara som skapandehistorik.

## Databas

Använd befintlig PostgreSQL-anslutning i Vercels servermiljö: DATABASE_URL eller POSTGRES_URL. Inga nycklar skickas till klienten. Bygget kör migrationen migrations/0001_annotations.sql i en transaktion. Endast egna rb_-tabeller skapas; andra tabeller i en befintlig databas ändras inte.

Om anslutning saknas publiceras läsaren med tydligt läsläge. Ritverktygen är då spärrade. Ingen lokal fil eller serverdisk används som låtsasdatabas. Efter att projektägaren har anslutit PostgreSQL måste en ny deployment göras. GET /api/status visar databasens verifierade status utan att exponera anslutningssträngen.

## Körning

Node 22.20 eller senare:

```sh
npm ci
npm run build
npm test
npm run dev
```

Sätt DATABASE_URL i servermiljön för lokal gemensam sparning. Utan databas fungerar läsläge. Öppna appen i StreamBIMs widgetram för att använda den inloggade StreamBIM-sessionen. Projekt-ID läses från widget-API:t och är inte hårdkodat.

## Verifierat och kvarvarande

Nio tester är godkända: PDF-koordinater, zoom/pan, rotation/beskärning, återläsning, idempotens, konflikter, raderingsskydd, projektisolering samt PostgreSQL-transaktioner och serverutfärdade webbläsarsessioner. PostgreSQL-testet kör den riktiga PostgreSQL-motorn i PGlite, inte en simulerad SQL-parser.

Direkt PDF-GET/CORS och signerad HEAD för dokumentåtkomst behöver verifieras i StreamBIM. Två verkliga användare och fysiska iOS/Android-enheter är ännu inte verifierade. API:t nekar åtkomst om dokumentets signerade länk inte kan kontrolleras. Ritverktyg aktiveras först efter verifierad databas- och dokumentåtkomst.

Skapare/redigerare registreras som serverutfärdade webbläsarsessioner, inte som verifierad StreamBIM-e-post. Behörighet till annoteringar kontrolleras separat med en sessionsutfärdad, dokumentbunden StreamBIM-länk. En utgången eller borttagen webbläsarcookie ger en ny besökaridentitet.

Se pdf-widget/README.md för koordinatkontrakt, revisioner och verktyg. Ursprungliga startfiler ligger kvar i src/ och starter-index.html men används inte i produktionsbygget.
