# Ritningsbord — StreamBIM PDF-widget

PDF-filer hämtas **direkt från StreamBIM till webbläsarens arbetsminne**. Ingen PDF laddas upp, sparas i databasen, proxas via Sites eller läggs i Cache Storage/IndexedDB/localStorage. Ingen service worker finns. Endast annoteringar och idempotenta sparningskvitton ligger i Cloudflare D1. R2 används inte. Osparade annoteringsoperationer kan återställas från localStorage; nedladdningslänkar och token lagras endast tillfälligt i minnet.

## Adress och användning

Sites: https://streambim-pdf-ritningsbord.raskkraskk.chatgpt.site/

Öppna adressen som StreamBIM-widget. Projekt-ID hämtas med `getProjectId()` och dokumentmetadata/labels/revisioner hämtas genom `makeApiRequest()` med den inloggade StreamBIM-sessionen. Inget projekt-ID är hårdkodat. Direktöppning utanför StreamBIM visar anslutningsinstruktioner, inga fejkade dokument.

Sites-publiceringen är privat. Logga in på Sites-adressen i en egen flik först. Tillgång till Sites behöver delas med medarbetare innan de kan delta; befintlig Sites-publik har inte utökats automatiskt. StreamBIM måste tillåta widgetadressen/omdirigeringen och direkt binärhämtning via CORS.

**Integrationsgrindar som återstår att verifiera i målmiljön:**

- Signerade `downloadlink`-svar för både senaste och tidigare revision måste tillåta direkt GET från widgetens ursprung (CORS). Textsvaret från `makeApiRequest` används aldrig som PDF-binärdata.
- Samma signerade URL måste tillåta en serverstyrd `HEAD` med PDF content type för åtkomstkontroll. Sites tar aldrig emot PDF-kroppen. Om HEAD/signering inte stöds nekas annoteringsåtkomst; inga klientuppgifter används som bevis för dokumentbehörighet.
- Privata Sites-inloggningen behöver fungera i StreamBIMs iframe, inklusive webbläsarens regler för tredjepartscookies.
- Fysiska iPad/iPhone, Android och samarbete mellan två verkliga inloggningar är inte verifierade. Detta är en prototyp, inte ett intyg om produktionsberedskap.

## Dokument och revisioner

Sökning på filnamn och labels med minst en/alla valda. Label-ID:n används för filtreringen, även när två labels har samma namn. Ärvda mapp-labels inkluderas. Vid öppning hämtas dokumentets aktuella revision på nytt och öppnas som standard. Användaren kan välja äldre revisioner. Nya revisioner som upptäcks under arbete aviseras och ersätter inte den öppna PDF:en automatiskt.

Dokument och listor sparas inte i D1. Annoteringar kopplas till `(environment, project_id, document_id, page_index)`. Revisions-ID finns endast som skapandehistorik. Dokument-ID avser det logiska dokumentet, inte revisionsfilens ID. Saknade sidor återanvänds aldrig för andra sidor. Ändrad CropBox/rotation/storlek ger varning; sidordning kan inte avgöras säkert utan innehållsanalys och varnas alltid vid revisionsbyte. Ingen automatisk omplacering eller skalning görs.

## Koordinatkontrakt

- Sidindex är **nollbaserat**.
- Geometri lagras i PDF-sidans **oroterade native user space**, y uppåt, inklusive sidboxens verkliga koordinater. Origo är PDF:ens origo, inte skärmens eller CropBoxens hörn.
- En enhet är 1/72 tum gånger PDF-sidans `UserUnit`. Linjebredd lagras i samma enheter.
- PDF.js `PageViewport` är enda transform för CropBox/MediaBox-skärning, sidrotation och UserUnit. SVG-gruppen använder exakt `viewport.transform`; pekarinmatningen använder dess invers `convertToPdfPoint`. Kamera/pan/zoom är en gemensam CSS-transform på både PDF och SVG.
- Resize och enhetsrotation ändrar aldrig sparad geometri. PDF-renderingen använder separat rasterupplösning, maximalt 16 miljoner pixlar. En sida renderas åt gången och gamla sidresurser städas.
- Dokument- och sidgenerationer hindrar sena laddningssvar från att visas på fel dokument/sida.

## Annotering och synkning

Frihand, transparent överstrykning, sex färger, tre bredder per verktyg, val och flytt av streck, färg/breddredigering, radering, ångra/gör om. Två fingrar avbryter ritningen och navigerar; återstående finger är spärrat tills alla fingrar lyfts. Handläge panorerar med ett finger. Mushjul zoomar kring pekaren, mellanslag + dra panorerar tillfälligt.

Autosparning använder en återställbar operationskö. Servern uppdaterar atomiskt med förväntad version. Samtidiga ändringar ger 409 och osparad operation bevaras för export/hantering; den skrivs inte automatiskt över. Tombstones hindrar återuppståndelse efter radering. Ångrad radering skapar ett nytt annoterings-ID. Ett operations-ID kan återförsökas utan dubbletter. Synkning sker var 2,5 sekund och biblioteksmetadata var 15:e sekund när fliken är synlig. Skapare/redigerare är verifierade Sites-identiteter, inte klientens påstådda e-postadress.

## Kör lokalt

Node 22.20 eller senare:

```sh
npm ci
npm run build
npx wrangler d1 execute DB --local --file drizzle/0000_workspace.sql
npm run dev
```

Öppna `http://127.0.0.1:3000` som localhost-widget i StreamBIM. Dev-proxyn binds enbart till loopback och ger en lokal Sites-testidentitet. Denna identitet finns inte i produktions-Workern. Lokal och publicerad databas är separata.

## Tester och verifieringsläge

`npm test` testar med riktiga flersidiga PDF-fixtures som genereras i testminnet: stort format, roterad sida, beskuren sida. Koordinater rundtrippas med fel < 1e-9 PDF-enheter vid olika kameror. Databastester använder SQLite med en D1-adapter och simulerad HEAD, och verifierar återläsning, revisionoberoende geometri, authorship, idempotens, konflikter, tombstones, projektisolering och att inga filtabeller/uppladdningsendpoints finns.

Automatiska tester innebär inte att direkt GET, signerad HEAD, mobila gester eller två verkliga användarsessioner har godkänts i StreamBIM. Webbläsartestet kunde inte slutföras i den tillgängliga sessionen. Dessa punkter ska verifieras med ovanstående integrationsgrindar innan användning i skarpt arbete.

## Källor och licenser

PDF.js väljs för Apache-2.0-licens, etablerad läsare och reversibel PageViewport-transform. Penpal (MIT) sköter widgetkopplingen. PDF-lib (MIT) används endast för testfixturer. Koden använder inga externa CDN:er vid körning; PDF.js-worker och standardtypsnitt levereras med webbappen.

- Widget-API och dokumentmetadata: https://github.com/jonatanjacobsson/streambim-api-docs
- Tidigare revision: StreamBIMs publika produktionsbundle `rendrao-0ca596da2a7ee7ba9833f339461712bd.js`, undersökt 2026-11-05, `downloadUrl`: `/documents/{documentId}/downloadlink?revision={revision}`. Detta är en implementation observerad i klientkoden, inte ett fullständigt live-test av binärflödet.
- PDF.js: https://github.com/mozilla/pdf.js

Egen applikationskod: MIT. Tredjepartskomponenternas licenser gäller oförändrade, inklusive PDF.js standardtypsnitt under respektive Foxit/Liberation-licens i `node_modules/pdfjs-dist/standard_fonts`.
