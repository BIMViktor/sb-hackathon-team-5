# Ritningsbord — tillfälliga PDF-annoteringar

Drift: https://sb-hackathon-team-5.vercel.app/ via GitHub main. Kör npm-kommandon från repots rot.

Mockupen använder ingen databas och ingen beständig webbläsarlagring. PDF hämtas direkt från StreamBIM till arbetsminnet. Annoteringar finns i SessionAnnotations tills fliken laddas om. Ingen synkning med andra flikar eller användare görs. API:t accepterar inga sparningsanrop.

Endast dokument med PDF-filändelse och en icke-tom document-alignments-relation visas. Labels filtreras med sina ID:n, inklusive ärvda mapp-labels. Senaste revisionen väljs vid öppning; tidigare revisioner kan väljas. Annoteringarnas minnesnyckel är miljö + projekt-ID + dokument-ID, utan revisions-ID.

## Koordinatkontrakt

- Nollbaserat sidindex.
- Geometri i sidans oroterade native PDF user space, y uppåt, med PDF:ens faktiska origo.
- Enhet: 1/72 tum gånger sidans UserUnit. Linjebredd lagras i samma enhet.
- PDF.js PageViewport hanterar MediaBox/CropBox, rotation och UserUnit. SVG använder exakt viewport.transform. Pekarinmatningen använder inversen convertToPdfPoint. PDF och SVG delar samma CSS-transform för pan/zoom.
- Resize och enhetsrotation ändrar inte geometri. Raster begränsas till 16 miljoner pixlar; en sida renderas åt gången. Dokument- och sidgenerationer blockerar sena laddningssvar.
- Annoteringar på saknade sidor visas inte på andra sidor. Ändrad sidstorlek, CropBox och rotation varnas. Sidordning kan inte automatiskt avgöras och revisionsbyte ger alltid kontrollvarning. Ingen automatisk omplacering sker.

## Verktyg

Frihand, transparent överstrykning, sex färger, tre bredder per verktyg, streckval med generös träffyta, flytt, färg/breddredigering, radering och ångra/gör om. Två fingrar avbryter ritningen och navigerar. Återstående finger spärras tills samtliga fingrar lyfts. Handläge panorerar med ett finger. Mushjul zoomar kring pekaren; mellanslag + dra ger tillfällig panorering.

## Integration och källor

Projekt-ID kommer från getProjectId(). Bibliotek, labels, mappar och revisioner hämtas via makeApiRequest() med användarens inloggade session. PDF-binära data hämtas direkt med fetch från den returnerade dokumentlänken. Textsvaret från makeApiRequest används aldrig som PDF.

Dokumentets tidigare revision: /documents/{documentId}/downloadlink?revision={number}. Token för osignerad relativ länk: /microtoken med response.microtoken. Dessa flöden och kalibreringsrelationen observerades i StreamBIMs publika rendrao-0ca596da2a7ee7ba9833f339461712bd.js den 2026-11-05.

- https://github.com/jonatanjacobsson/streambim-api-docs
- https://github.com/mozilla/pdf.js

PDF.js: Apache-2.0. Penpal: MIT. PDF-lib och PGlite används endast i tester. Egen applikationskod: MIT. Tredjepartskomponenters licenser gäller oförändrade.
