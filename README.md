# Grand Tour 1900

*Eine Reise durch den Jugendstil Europas.* Digitales Lernspiel der Studiengruppe Baugeschichte (Studienarbeit 2026/27).

Die Spieler sind Architekturstudenten um 1900 und reisen von München aus durch acht Jugendstil-Zentren: Glasgow, Riga, Brüssel, Darmstadt, Paris, München, Wien und Barcelona. Wer als Erstes aus jeder Stadt eine Postkarte erspielt hat, gewinnt.

## Spielen

1. Unter **[Releases](../../releases/latest)** die Datei `Grand-Tour-1900-Setup-x.y.z.exe` herunterladen und starten.
2. Windows zeigt eventuell „Der Computer wurde durch Windows geschützt“ an, weil das Spiel nicht kostenpflichtig signiert ist. Dann auf **Weitere Informationen → Trotzdem ausführen** klicken.
3. Bei jedem Start sucht das Spiel nach Updates und installiert sie automatisch.

**Spielmodi**
- **An einem Bildschirm:** 2–4 Spieler oder Teams spielen abwechselnd an einem PC oder Beamer.
- **Online:** Eine Person erstellt ein Spiel und gibt den 5-stelligen Raum-Code weiter. Die anderen treten mit dem Code bei. Die Verbindung läuft direkt zwischen den Rechnern (PeerJS). In sehr strengen Schul- oder Firmennetzen kann die Verbindung blockiert sein.

## Für die Gruppe: Inhalte bearbeiten

| Was | Datei |
|---|---|
| Fragen, Antworten, Gebäude, Ereigniskarten | `src/data/content.js` |
| Städte, Strecken, Ereignisfelder | `src/data/board.js` |
| Spielregeln (Logik) | `src/js/engine.js` |
| Aussehen | `src/styles.css`, `src/js/boardview.js` |
| Fotos | `src/assets/img/` + `tools/image-overrides.json` |

Jede Frage besteht aus Frage, richtiger Antwort, 3 falschen Antworten und einem kurzen Erklärtext. Jede Stadt braucht genau 12 Fragen.

## Entwickeln

Voraussetzung: [Node.js](https://nodejs.org) (Version 22 oder neuer).

```bash
npm install
npm start                    # Spiel im Entwicklungsmodus starten
node tools/simulate.mjs      # 300 Testpartien durchspielen, prüft auch die Fragen
npm run fetch:images         # fehlende Fotos von Wikimedia Commons laden
npm run build:map            # Europakarte neu erzeugen
npm run dist                 # Installer lokal bauen (Ordner dist/)
```

## Neue Version veröffentlichen

```bash
npm version patch            # erhöht die Version, z. B. 0.1.0 → 0.1.1, und setzt einen Tag
git push --follow-tags
```

GitHub Actions baut dann automatisch den Installer und veröffentlicht ihn unter *Releases*. Alle installierten Spiele laden das Update beim nächsten Start.

## Quellen und Lizenzen

- Fotos: Wikimedia Commons, freie Lizenzen (CC BY, CC BY-SA, CC0, gemeinfrei). Einzelnachweise im Spiel unter **Bildnachweise** und in `src/data/credits.json`.
- Kartenbasis: [Natural Earth](https://www.naturalearthdata.com) (gemeinfrei).
- Schriften: Cormorant Garamond und Inter (SIL Open Font License).
- Baujahre sind Richtwerte und sollten vor der Abgabe mit Quellen abgeglichen werden.
