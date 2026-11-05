# Team 5 · Ritningsbord mockup

App: https://sb-hackathon-team-5.vercel.app/

GitHub main publiceras direkt på Vercel. Detta är nu en mockup utan databas, autosparning eller samarbete. Annoteringar finns endast i den aktuella flikens JavaScript-minne och försvinner vid omladdning. Inga annoteringar eller PDF-filer skrivs till localStorage, sessionStorage, IndexedDB, Vercel eller en databas.

## StreamBIM

Öppna Team 5-widgeten i StreamBIM. Projekt-ID och användarsession hämtas från förälderns widget-API; projekt-ID är inte hårdkodat. Penpal laddas före PDF.js för att ansluta inom värdens korta tidsgräns. PDF.js laddas först när ett dokument ska visas.

Biblioteket visar endast PDF-filer med minst en document-alignment i StreamBIM. Enbart ett scale-värde räknas inte som kalibrering. Detta följer StreamBIMs documentAlignments-modell och calibratedFloorplansForFloor i den publika produktionsklienten, undersökt 2026-11-05.

Filnamnssökning och label-ID-filter (minst en/alla valda) finns kvar. Senaste aktiva revision hämtas vid öppning. Tidigare revisioner kan väljas. Markeringar delas mellan revisioner endast i den aktuella flikens minne och använder exakt samma PDF-koordinater. Byter du dokument finns dess markeringar kvar tills fliken laddas om.

PDF-binärdata hämtas direkt från StreamBIM med dess downloadlink. Om länken saknar token används det observerade /microtoken-flödet. Tidigare revision använder downloadlink?revision=<nummer>. Inga PDF-data passerar Vercels API och ingen serverproxy används. Vercel-ursprunget behöver tillåtas av StreamBIMs CORS-regler för direkt binärhämtning.

## Körning och verifiering

Node 22.20 eller senare:

```sh
npm ci
npm run build
npm test
npm run dev
```

Databasvariabler behövs inte och bygget kör inga migreringar. /api/status rapporterar mock/storage:none; /api/annotations nekar skrivning med 410. Tidigare databasimplementation och dess tester finns kvar som vilande utvecklingskod och anropas inte av mockupen.

Tester omfattar PDF-koordinater och crop/rotation, kalibreringsfilter, label-ID:n, revisionslänkar, microtoken och minnesbaserade annoteringar som inte kan återläsas i en ny session. Backendens tidigare tester finns kvar, men innebär inte att mockupen sparar något. Fysiska iOS/Android-gester måste fortfarande testas separat.

Se pdf-widget/README.md för koordinatkontrakt och licenser.

## Lager i mockupen

Dokumentbiblioteket ligger till vänster och lagerpanelen till höger. Skapa exempelvis KANALER_DRAGNING med plusknappen; det nya lagret aktiveras direkt. Nya streck får aktivt lager-ID redan när ritgesten börjar. Befintliga streck flyttas inte när du byter aktivt lager. Ett lagerbyte avbryter en pågående gest för att undvika streck på fel lager.

Lagerdefinitioner, namn, synlighet och aktivt lager ligger i flikens arbetsminne och behålls när du byter dokument eller revision. Geometri är fortsatt separat per dokument. Ögonknappen döljer/visar ett lager; dolda streck kan inte väljas på ritningen. Pennknappen byter namn. Under Markeringar på ritningen kan ett valt streck flyttas till ett annat lager, med ångra/gör om. Allt försvinner vid omladdning, enligt mockupens lagringsmodell.

På smala skärmar öppnas biblioteket och lagerpanelen som sidopaneler via respektive knapp i dokumenthuvudet. Aktivt lager kan även bytas i verktygsradens rullista.
