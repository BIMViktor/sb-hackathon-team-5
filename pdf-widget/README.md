# Ritningsbord — StreamBIM PDF-widget

Drift: https://sb-hackathon-team-5.vercel.app/ via GitHub main och Vercel. Kör alla npm-kommandon från repots rot. API:t och PostgreSQL-konfigurationen beskrivs i [repots README](../README.md). Ingen Sites- eller D1-anslutning används.

## Filer och lagring

PDF hämtas direkt från StreamBIM till webbläsarens arbetsminne med cache:no-store. Inga PDF-filer sparas i Vercel, databasen, localStorage, IndexedDB eller Cache Storage. Ingen service worker finns. Databasen innehåller annoteringar, idempotenta sparningskvitton och tekniska webbläsarsessioner. Endast osparade annoteringsoperationer får finnas i localStorage. Signerade nedladdningslänkar och token finns tillfälligt i minnet och sparas aldrig i databasen.

## Koordinatkontrakt

- Nollbaserat sidindex.
- Geometri i sidans oroterade native PDF user space, y uppåt, med PDF:ens faktiska origo. CropBoxens hörn är inte ett nytt origo.
- Enhet: 1/72 tum gånger sidans UserUnit. Linjebredd lagras i samma enhet.
- PDF.js PageViewport hanterar MediaBox/CropBox, rotation och UserUnit. SVG-gruppen använder exakt viewport.transform. Pekarinmatning använder inversen convertToPdfPoint. PDF och SVG ligger på samma CSS-transform för kamera, zoom och pan.
- Resize och enhetsrotation ändrar aldrig lagrade koordinater. Rasterupplösning är separat och begränsad till 16 miljoner pixlar. En sida renderas åt gången; tidigare sidresurser städas.
- Dokument- och sidgenerationer blockerar försenade laddningssvar från att visa fel dokument/sida.

## Dokument och revisioner

Projekt-ID kommer från getProjectId(). Metadata, labels och revisioner kommer från makeApiRequest() med användarens inloggade StreamBIM-session. Sök på filnamn och filtrera med minst en/alla valda label-ID:n. Ärvda mapp-labels inkluderas. Senaste revisionen hämtas på nytt när dokumentet öppnas. Tidigare revisioner kan väljas. En ny revision som upptäcks under arbete aviseras utan att ersätta den öppna PDF:en.

Annoteringar är gemensamma för alla revisioner, kopplade till miljö + projekt-ID + dokument-ID + sidindex. Skapanderevision sparas som historik. Saknade sidor visas aldrig på andra sidor. Ändrad storlek, CropBox eller rotation varnas. Sidordning kan inte avgöras säkert utan innehållsanalys och revisionsbyte ger alltid en kontrollvarning. Ingen automatisk omplacering eller skalning sker.

Senaste PDF använder StreamBIMs dokument-downloadlink. Tidigare revision använder downloadlink?revision=<nummer>, observerat i StreamBIMs publika produktionsbundle rendrao-0ca596da2a7ee7ba9833f339461712bd.js den 2026-11-05. Direkt GET och HEAD är ännu inte live-verifierade från Vercel. Textsvaret från makeApiRequest används aldrig som PDF-binärdata.

## Verktyg och samarbete

Frihand, transparent överstrykning, sex färger, tre bredder per verktyg, generöst streckval, flytt, färg/breddredigering, radering och ångra/gör om. Två fingrar avbryter pågående ritning och navigerar. Återstående finger spärras tills samtliga fingrar lyfts. Handläge panorerar med ett finger. Mushjul zoomar kring pekaren; mellanslag + dra ger tillfällig panorering.

Autosparning använder en återställbar operationskö. Servern skriver atomiskt med förväntad version. Samtidiga ändringar ger 409 och lämnas i den osparade kön för export/hantering. Tombstones förhindrar att raderade streck återuppstår. Ångrad radering skapar nytt annoterings-ID. Ett operations-ID kan återförsökas utan dubbletter. Synkning sker var 2,5 sekund och biblioteksmetadata var 15:e sekund när fliken är synlig.

Skapare och redigerare är serverutfärdade besökaridentiteter från en HttpOnly, Secure, SameSite=None, Partitioned-cookie, med hashad sessionstoken i databasen. De är inte verifierade StreamBIM-e-postadresser. Dokumentåtkomst kontrolleras server-side med signerad HEAD till en strikt validerad StreamBIM-adress. Ingen PDF-kropp passerar Vercel-servern.

## Källor och licenser

PDF.js väljs för Apache-2.0-licens, etablerad läsare och reversibel PageViewport. Penpal (MIT) sköter widgetkoppling. Postgres.js (Unlicense) används server-side. PDF-lib (MIT) och PGlite (Apache-2.0) används för tester. Inga externa CDN:er används vid körning; PDF.js-worker och standardtypsnitt levereras med appen.

- https://github.com/jonatanjacobsson/streambim-api-docs
- https://github.com/mozilla/pdf.js
- https://github.com/porsager/postgres

Egen applikationskod: MIT. Tredjepartskomponenternas licenser gäller oförändrade.
