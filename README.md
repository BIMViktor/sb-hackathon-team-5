# Team 5 · Ritningsbord

StreamBIM-widget för att läsa och annotera projektets PDF-dokument.

- **Källkod, lokal körning och verifieringsläge:** [pdf-widget/README.md](pdf-widget/README.md)
- **App på Sites:** https://streambim-pdf-ritningsbord.raskkraskk.chatgpt.site/
- Den befintliga widgetadressen `https://sb-hackathon-team-5.vercel.app` omdirigeras till Sites. Om StreamBIM begränsar omdirigeringar behöver Sites-domänen tillåtas som widgetursprung.

PDF-filer läses direkt från StreamBIM och sparas aldrig i appens beständiga lagring eller databas. D1 innehåller bara annoteringar, kopplade till StreamBIM-miljö, projekt-ID, dokument-ID och sidindex, samt idempotenta sparningskvitton. Senaste revisionen är standard; äldre revisioner kan väljas. Label-ID:n används för filtrering.

Publiceringen kräver ingen hårdkodad projektkoppling. Öppna appen inuti StreamBIM för att hämta den inloggade sessionens projekt och dokument. En fristående flik visar anslutningsinstruktioner.

**Återstående integrationskontroll:** direkt PDF-GET/CORS, signerad HEAD för dokumentåtkomst, privat Sites-inloggning i iframe, fysiska mobilers gester samt två verkliga användarsessioner. De automatiska geometri- och databastesterna är godkända. Dessa ersätter inte verifiering i StreamBIMs målmiljö.

Det ursprungliga Vite-startprojektet finns kvar i roten; den nya appen och dess D1-backend finns i `pdf-widget/`. `HACKATHON_GUIDE.md` beskriver det ursprungliga startprojektet. Den nya uppgiftens krav på databas, PDF.js och Sites dokumenteras i appens README.
