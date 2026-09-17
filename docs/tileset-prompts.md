# Specyfikacja generowania tilesetów

Dokument jest kompletny i samowystarczalny. Po jego wklejeniu wystarczy napisać:

> wygeneruj tileset dla podbiomu „katakumby"

Wszystkie palety i opisy kafli dla 50 podbiomów są w sekcji 6.

---

## 1. Zadanie

Na polecenie „wygeneruj tileset dla podbiomu X" wyprodukuj **20 kafli** według tabeli z sekcji 4, **pięć arkuszy blob47** według sekcji 4.1 — mur i woda po dwa warianty, przepaść jeden — **sześć dekali** według sekcji 4.2, **cztery przejścia** według sekcji 4.3 oraz plik `tiles.json` z sekcji 7.

Każdy obraz to pojedynczy kafel **32×32 piksele**, gotowy do wczytania przez generator map bez żadnej obróbki pośredniej. Żadnych arkuszy, żadnych tekstur do cięcia, żadnych masek.

Prompt dla każdego kafla składasz z trzech części:

```
[BLOK STYLU — sekcja 3] + [PALETA PODBIOMU — sekcja 6] + [OPIS KAFLA — sekcja 6]
```

Tileset generujemy **zawsze dla podbiomu**, nigdy dla biomu. Biom to poziom nadrzędny — definiuje zmienną mechaniczną i rdzeń palety, a podbiomy jedno i drugie dziedziczą.

---

## 2. Kontekst gry

Kooperacyjne ARPG 2D w stylu Diablo 2, dla 1–7 graczy. Perspektywa **top-down ¾** — kamera lekko pochylona, siatka prostokątna, nie izometryczna. Styl: pixel art z epoki 16-bit (SNES).

Lochy są generowane proceduralnie ze zszywanych pokoi. Pokoje zapisują **role kafli**, nie konkretną grafikę — ten sam pokój działa w każdym podbiomie po podmianie tilesetu.

Świat jest ponury, średniowieczno-fantastyczny, bez heroicznego przepychu. Bohaterowie zginęli na wojnie, na wyprawę idą wiejscy rzemieślnicy.

---

## 3. Blok stylu

Obowiązkowy, dosłowny, identyczny dla wszystkich kafli i wszystkich podbiomów. To jedyny gwarant spójności całej gry — nie modyfikować między generacjami.

```
A single 32x32 pixel art tile for a top-down three-quarter view 2D action RPG,
16-bit SNES era style, drawn on an exact 32 by 32 pixel grid.

The tile must be seamlessly tileable: it repeats edge to edge in all four
directions with no visible seams and no single dominant feature. Output the tile
alone, filling the entire image, with no border, no frame, no padding and no
drop shadow outside its bounds.

The pattern runs off all four edges. The outermost row and column of pixels
belong to the pattern itself and must be drawn exactly like the pixels beside
them: no darker rim, no outline, no inner border, no edge shading, no vignette,
nothing that follows the tile's boundary. Laid next to a copy of itself, the
tile must show no line at the join.

This tile is one of several variants of the same surface and they are laid out
in random order, so every variant must also line up with every other one. Any
line that crosses an edge - a mortar joint between stones, a crack, a plank, a
channel - crosses it at the same pixel positions in every variant, and the
pixels along each edge are the same in all of them. Only what happens inside the
tile differs between variants.

Hard-edged pixels, no anti-aliasing, no blur, no gradients, no dithering.
Limited palette of at most 16 colors. Lighting from the upper left, flat and
even, with no vignette and no single light source. Hold the brightness the tile
description asks for: tiles of different kinds must stay clearly apart in value,
so the surface they form reads at a glance rather than blending together.

Avoid: isometric view, 3D render, smooth shading, painterly style, photorealism,
grid lines, tile separators, tile outline, darker edge pixels, inner border,
sprite sheet layout, text, watermark, characters, multiple tiles in one image.
```

### Wariant z przezroczystością

Dla ról `obstacle_low`, `obstacle_high` i `hazard` obiekt nie wypełnia całego kwadratu. W tych trzech przypadkach **zamień ostatnie zdanie pierwszego akapitu** na:

```
The object sits centered on a fully transparent background, occupying most of
the tile. Alpha transparency outside the object, no background fill, no shadow
on the ground.
```

---

## 4. Zestaw kafli

| Rola | Warianty | Pliki | Przezroczystość | Czym jest |
|---|---|---|---|---|
| `floor` | 6 | `floor_01..06.png` | nie | podłoże, po którym się chodzi |
| `wall` | 3 | `wall_01..03.png` | nie | mur, blokuje ruch i wzrok |
| `obstacle_low` | 3 | `obstacle_low_01..03.png` | tak | nie przejdziesz, ale widać ponad |
| `obstacle_high` | 2 | `obstacle_high_01..02.png` | tak | blokuje ruch i wzrok |
| `pit` | 2 | `pit_01..02.png` | nie | dziura, nie da się przejść |
| `water` | 2 | `water_01..02.png` | nie | płytka woda, spowalnia |
| `hazard` | 2 | `hazard_01..02.png` | tak | podłoże raniące |

Razem 20 kafli.

Warianty tej samej roli to **odmiany tego samego motywu**, nie różne obiekty — sześć podłóg ma wyglądać jak sześć fragmentów tej samej posadzki. Generator losuje między nimi, żeby powierzchnia nie powtarzała się w widocznym rytmie.

**Warianty rzadkie.** Wśród sześciu podłóg zrób cztery spokojne i dwie wyraziste — pęknięcie, wyrwa, plama. Te wyraziste oznacz w `tiles.json` niską wagą, żeby były akcentem, a nie teksturą. Waga to liczba całkowita 1–8; brak wagi znaczy 1. Podłoga spokojna `"weight": 6`, wyrazista `"weight": 1`.

`deco` i `overlay` to warstwy edytora, nie role. Nie generować pod nie kafli.

Wszystkie pliki: **PNG 32×32 RGBA**. Wszystkie kafle w paczce dzielą **jeden zestaw kolorów** — paleta jest wspólna dla całego podbiomu, nie ustalana osobno dla każdego kafla. Kolejność wariantów pod rolą jest stała i wynika z numeracji plików.

---

## 4.1. Arkusze blob47

Dla ról `wall`, `water` i `pit` dodatkowo **arkusz autotilingu**, żeby mur, woda i krawędź przepaści miały narożniki i płynne krawędzie zamiast kwadratowych bloków. Przepaść jest tu równie ważna jak mur: dziura w podłodze o prostej, pikselowo kwadratowej krawędzi zdradza siatkę kafli mocniej niż cokolwiek innego.

| | |
|---|---|
| Pliki | `wall_blob47_a.png`, `wall_blob47_b.png`, `water_blob47_a.png`, `water_blob47_b.png`, `pit_blob47.png` |
| Rozmiar arkusza | **256×192** pikseli |
| Układ | 8 kolumn × 6 wierszy, kafle 32×32 |
| Liczba kafli | **47**, wypełniane rzędami od lewego górnego rogu; ostatnia komórka pusta |

**Mur i woda mają po dwa warianty arkusza, przepaść jeden.** Generator wybiera arkusz osobno dla każdego kafla, po jego pozycji — tak samo jak losuje między `floor_01…06`. Bez tego cała ściana w pokoju jest tym samym obrazkiem powielonym dziesiątki razy, bo przy danym układzie sąsiadów istnieje dokładnie jedna komórka arkusza. Przepaść zostaje przy jednym arkuszu: krawędź dziury widać rzadziej i na krótszych odcinkach.

Warianty `_a` i `_b` to **ten sam kamień w innym ułożeniu**, nie inny materiał: ta sama paleta, ta sama jasność, ta sama grubość fugi. Mają być nie do odróżnienia w pojedynkę, a różnica ma się ujawniać dopiero na dużej powierzchni jako brak rytmu. Oba arkusze są pocięte identycznie i mają **tę samą kolejność masek** — komórka nr 17 w obu znaczy dokładnie to samo. Generator odrzuci arkusz pocięty inaczej niż pierwszy arkusz tej roli.

Każdy kafel arkusza to ten sam materiał co kafle płaskie tej roli, pokazany przy innym układzie sąsiadów — od pojedynczego odosobnionego bloku, przez końcówki, proste odcinki i narożniki zewnętrzne, po wnętrze pełnego obszaru.

**Maska 8 sąsiadów**, wartości sumowane:

```
N=1   E=2   S=4   W=8   NE=16   SE=32   SW=64   NW=128
```

Przekątną liczymy **tylko wtedy, gdy oba przyległe kierunki proste są obecne** — NE liczy się wyłącznie przy obecnych N i E. Stąd 47 unikalnych kombinacji zamiast 256.

Kolejność masek w arkuszu podajemy w `tiles.json` w polu `masks` — tablica 47 liczb w tej samej kolejności, w jakiej kafle leżą w arkuszu.

**Wymaganie krytyczne:** kafle muszą pasować do siebie **pikselowo na krawędziach**. Krawędź kafla z sąsiadem od północy musi być identyczna w każdym kaflu, który ma N w masce. Bez tego arkusz jest bezużyteczny, choćby każdy kafel z osobna wyglądał dobrze.

**Ciemny brzeg tylko tam, gdzie materiał się kończy.** W arkuszu autotilingu maska mówi wprost, która krawędź jest granicą, a która środkiem powierzchni. Krawędź z ustawionym bitem (N, E, S lub W) przylega do kolejnego kafla tego samego materiału i musi przechodzić w niego niezauważalnie — żadnego przyciemnienia, obrysu ani zacieku wzdłuż tej krawędzi. Ciemną linię styku rysujemy wyłącznie po stronie, gdzie bit jest zerowy, bo tam mur faktycznie się urywa.

Kafel maski 255, otoczony ze wszystkich stron, jest tu przypadkiem granicznym i zarazem probierzem: to czysta powierzchnia bez ani jednej krawędzi, więc nie ma prawa mieć ciemnego piksela na żadnym boku. Wypełnia całe wnętrze muru, więc jego ramka powiela się co 32 piksele przez cały obszar i widać ją z każdej odległości.

Arkusze nie zastępują kafli płaskich — te zostają w paczce i są używane, gdy autotiling jest wyłączony.

---

## Krawędzie: każdy wariant musi pasować do każdego

Wariantów jednej roli nie kładzie się grupami — generator losuje je kafel po kaflu, więc `floor_03` ląduje obok `floor_05`, a ten obok `floor_01`. Każda para musi się schodzić, i to nie tylko „bez szwu", ale **rysunkowo**: fuga między kamieniami, pęknięcie czy deska, która dobiega do krawędzi, musi trafić na kontynuację po drugiej stronie.

W praktyce oznacza to jedno: **wszystkie warianty jednej roli dzielą ten sam brzeg**. Piksele skrajnego wiersza i skrajnej kolumny są w każdym wariancie takie same, a linie przecinają krawędź w tych samych miejscach. Różni się wyłącznie wnętrze kafla — układ kamieni, rozmieszczenie ubytków, faktura.

Najprościej to osiągnąć, projektując najpierw **brzeg wspólny dla roli**: gdzie fugi wychodzą na północ, wschód, południe i zachód, w których pikselach i jak szeroko. Ten brzeg jest wtedy kontraktem, a każdy wariant jest wypełnieniem środka.

Powód nie jest teoretyczny. W pierwszej paczce katakumb wszystkie sześć podłóg wypuszczało fugi w innych miejscach — kafel 01 na pozycjach 10, 23–25 i 29–31, kafel 02 na 7–8 i 20–23, kafel 03 na 14–15 i 24. Tego nie było widać tylko dlatego, że każdy kafel miał wypalony ciemny brzeg, który udawał fugę na każdym styku. Po zdjęciu tej ramki różnica na złączu to 26 poziomów jasności przy kafelkowaniu kafla samym ze sobą i do 36 przy dwóch różnych wariantach — czyli podłoga nie kafelkuje wcale.

---

## 4.2. Dekale

Sześć drobnych nakładek rozsiewanych po powierzchni: kości, mech, zacieki, gruz, pęknięcia, kałuże — cokolwiek pasuje do podbiomu. To one sprawiają, że pokój przestaje wyglądać jak wypełniony jedną teksturą.

| | |
|---|---|
| Pliki | `decal_01.png` … `decal_06.png` |
| Rozmiar | 32×32 px, RGBA |
| Tło | **w pełni przezroczyste**, obiekt zajmuje niewielką część kafla |

Dekal to nie kafel. Nie wypełnia kwadratu, nie musi się kafelkować i nie ma prawa mieć krawędzi stykających się z sąsiadem. Ma wyglądać jak coś, co leży na podłodze albo osiadło na murze.

Każdy dekal ma w `tiles.json` rolę, na której się pojawia, i gęstość — udział kafli tej roli, które go dostaną:

- cztery dekale na `floor`, gęstości od `0.03` do `0.10`
- jeden na `wall`, gęstość około `0.12`
- jeden na `water` albo `hazard`, gęstość około `0.10`

Gęstości trzymaj nisko. Dekal widoczny na co trzecim kaflu przestaje być akcentem i staje się wzorem.

**Rozrzut pozycji.** Dekal nie ląduje w środku kafla — generator odsuwa go o losowy, ale powtarzalny wektor, żeby rozsiew nie układał się w siatkę. Siłę rozrzutu ustawia pole `jitter`: ułamek kafla, domyślnie `0.22`, dopuszczalne `0` do `0.5`. Przy domyślnej wartości dekal odsuwa się o maksymalnie 7 px na kaflu 32 px.

To ma konsekwencję dla grafiki: **obiekt musi mieć zapas przy krawędziach**. Jeśli wypełnia kafel po brzegi, rozrzut wypchnie go na sąsiedni kafel. Trzymaj dekal w środkowych 60% kwadratu, czyli mniej więcej w polu 20×20 px.

Prompt dla dekala składasz tak samo jak dla kafla, ale z **blokiem przezroczystości** z sekcji 3 i bez wymogu kafelkowania — zdanie o bezszwowym powtarzaniu zastąp opisem pojedynczego drobnego obiektu leżącego na powierzchni.

---

## 4.3. Przejścia: drzwi i brama

Cztery grafiki, przez które gracz przechodzi. Nie są kaflami podłoża ani obiektami — rysowane są **na wierzchu** kafla, dokładnie w otworze w murze.

| Plik | Rozmiar | Co to jest |
|---|---|---|
| `door_ns.png` | 32×32 | drzwi w murze biegnącym wschód–zachód, przechodzisz z północy na południe |
| `door_ew.png` | 32×32 | drzwi w murze biegnącym północ–południe, przechodzisz ze wschodu na zachód |
| `gate_ns.png` | **64×32** | brama w murze wschód–zachód, szeroka na dwa kafle |
| `gate_ew.png` | **32×64** | brama w murze północ–południe, wysoka na dwa kafle |

**Drzwi** to wejście do **podpokoju** — komory wydzielonej wewnątrz pokoju. Otwór ma **jeden kafel** szerokości, przechodzi się pojedynczo.

Grafika wypełnia cały kafel i jest **fragmentem muru z dziurą pośrodku**, nie ozdobą postawioną na podłodze. Po obu stronach otworu zostaje **kawałek muru z tego samego kamienia co kafle `wall`** — ta sama paleta, ta sama faktura, ta sama grubość co pas muru na sąsiednich kaflach i na tej samej wysokości, tak żeby mur przechodził przez kafel drzwi bez uskoku. Otwór jest wyśrodkowany i **węższy niż kafel**: przy kaflu 32 px framuga zjada po **8–10 px z każdej strony**, na przejście zostaje 12–16 px.

Generator rysuje mur po obu stronach drzwi jako **ciągnący się w stronę drzwi** — kafel muru obok otworu nie jest zakończeniem, tylko odcinkiem biegnącym dalej. Grafika drzwi musi ten bieg podchwycić: gdyby zabrać z niej sam otwór, kafel ma wyglądać jak zwykły kawałek muru.

Przejścia **między pokojami mapy** mają dwa kafle szerokości i nie dostają żadnej grafiki — to zwykły otwór w murze.

**Brama** to wejście do całego lochu i wyjście z niego — stoi wyłącznie na pierwszym i ostatnim pokoju mapy. Otwór ma **dwa kafle** szerokości, więc grafika jest podwójna i rysowana jednym kawałkiem. Brama ma być wyraźnie okazalsza od drzwi: łuk, odrzwia, okucia, ślady po zawiasach. To pierwszy i ostatni element poziomu, jaki gracz widzi.

Ta sama zasada co przy drzwiach: skrajne **8–12 px po obu stronach** to mur ciągnący się dalej, wpisany w linię muru sąsiednich kafli. Brama ma być otworem w murze, a nie bramą stojącą w szczerym polu.

Obie wersje tego samego przejścia to **ten sam obiekt obrócony o 90 stopni**, nie dwa różne przedmioty — ale obrócony razem z kamerą, nie postawiony bokiem.

**Wariant `ew` widzimy z góry.** Mur biegnący północ–południe stoi na ekranie pionowo i patrzymy na jego **wierzch**, więc przejście w nim to przerwa w pasie muru oglądana z góry: widać górne powierzchnie obu ościeży i posadzkę w prześwicie, a z boku framugi najwyżej wąski pasek ścianki. Czego tam nie ma: łuku widzianego od frontu, framugi narysowanej w elewacji, drzwi stojących twarzą do gracza. Taki rysunek wygląda, jakby przejście leżało na ziemi obrócone o ćwierć obrotu.

Wariant `ns` jest tym, który pokazuje front: mur biegnie wschód–zachód, jego lico zwrócone jest do kamery, więc nadproże, ościeża i skrzydło widać od przodu, zgodnie z perspektywą ¾.

Tło poza framugą **przezroczyste** — pod spodem leży podłoga pokoju i to ona ma być widoczna w samym przejściu. Prompt składasz z blokiem przezroczystości z sekcji 3, bez wymogu kafelkowania.

---

## 5. Zasady palety i czytelności

### 5.1. Paleta

- maksymalnie 16 kolorów, przygaszone i zdesaturowane
- podbiomy tego samego biomu dzielą rdzeń palety i różnią się kolorami akcentowymi, żeby akt czytał się jako jedna kraina
- paleta niesie nastrój, opisy kafli niosą materiał i fakturę — nie powtarzać kolorów w opisach

### 5.2. Rozdział jasności — reguła nadrzędna

**Rola musi być rozpoznawalna po samej jasności, zanim gracz dostrzeże materiał.** Przygaszona paleta kusi, żeby wszystko trzymać w jednym wąskim paśmie szarości, i wtedy mur zlewa się z podłogą, a pokój wygląda jak jednolita plama. To najczęstszy błąd całej paczki i nie da się go naprawić na poziomie pojedynczego kafla — wynika z relacji między kaflami.

Przyjmij pięć pasm jasności, liczonych w skali 0–100 po konwersji na szarość:

| Pasmo | Jasność | Role |
|---|---|---|
| najciemniejsze | 5–15 | `pit`, wnętrza wnęk i szczelin |
| ciemne | 20–35 | `water` |
| średnie | 40–50 | **`floor`** — punkt odniesienia dla całej paczki |
| jasne | 60–75 | **`wall`**, `obstacle_high`, `obstacle_low` |
| akcent | 70–85 | `hazard`, tylko na niewielkiej części kafla |

**Twarde minimum: średnia jasność `wall` różni się od średniej jasności `floor` o co najmniej 20 punktów.** Ta różnica przechodzi przez całą paczkę — mur ma być masywny i wyraźnie odcięty od posadzki, a nie o cień jaśniejszy.

Jasność, nie barwa. Odcień może być wspólny dla całego podbiomu; rozróżnia jasność. Dwa kafle w tym samym paśmie różniące się wyłącznie odcieniem zleją się w ruchu, na małym zoomie i u gracza z zaburzeniem widzenia barw.

Kierunek pasm wolno odwrócić, jeśli podbiom tego wymaga — w jaskini lawy mur bywa ciemniejszy od rozżarzonej posadzki. Odwracasz wtedy **całą** tabelę, zachowując odstępy; nie wolno zamienić miejscami dwóch ról i zostawić reszty.

### 5.3. Sylwetka obiektów

`obstacle_low`, `obstacle_high` i `hazard` leżą na przezroczystym tle, więc czyta się je sylwetką.

- obiekt wypełnia **70–90% kafla** — mniejszy ginie na tle podłogi, większy dotyka krawędzi i zdradza siatkę
- **ciemna linia styku z podłożem** wzdłuż dolnej krawędzi obiektu; bez niej obiekt wygląda, jakby unosił się nad posadzką
- sylwetka zwarta i czytelna w 32 px: jedna bryła zamiast rozdrobnionych elementów
- `obstacle_high` ma dodatkowo pokazywać **krótkie lico od południa**, zgodnie z perspektywą ¾ — sam widok od góry spłaszcza bryłę do plamy i przestaje wyglądać na coś, co zasłania

### 5.4. Test kontroli

Przekonwertuj cały zestaw na skalę szarości i zmniejsz do 25%. Jeśli nie odróżniasz muru od podłogi albo przeszkody od podłoża, paczka jest do poprawy niezależnie od tego, jak ładnie wygląda w powiększeniu.

---

## 6. Palety i opisy podbiomów

Format wpisu: zdanie palety doklejane do **każdego** promptu tego podbiomu, linia kotwic jasności z sekcji 5.2, siedem opisów ról i sześć opisów dekali. Kolejne podbiomy dopisujemy poniżej w tym samym formacie.

Opis roli mówi trzy rzeczy: **co to jest**, **jak się to widzi z góry pod kątem ¾** i **jak jasne jest to względem podłogi**. Trzeciego nie pomijaj — to on decyduje, czy pokój się czyta, czy zlewa.

### Katakumby
*Biom: Twierdza — ciasnota, korytarze, walka w zwarciu.*

`Muted cold greys and desaturated bone-beige, cold and lightless, with faint green damp staining used only as a sparse accent.`

Kotwice jasności: `pit` 8, `water` 28, `floor` 45, `wall` 68, `obstacle_low` 62, `obstacle_high` 66, `hazard` 75.

- **floor** — Worn catacomb flagstones seen straight from above, irregular slabs of different sizes, wide mortar gaps, fine cracks and a film of dry grey dust. A quiet mid-grey surface, the reference value of the set: even and unremarkable, so that anything standing on it reads instantly.
- **wall** — A thick catacomb wall of stacked stone blocks, seen from above at a slight angle so both the top course and a short south facing front edge are visible. The stone is pale bone-grey, clearly lighter and warmer than the floor, with deep near-black shadow in the mortar joints between blocks. The whole tile reads as one solid heavy mass; no outline drawn around the tile itself.
- **obstacle_low** — A weathered stone sarcophagus lid lying low on the floor, seen from above at a slight angle: a clear rectangular block with chipped corners, a worn carved relief across its top and its short sides just visible. Pale stone against a fully transparent background, with a hard dark contact shadow along its lower edge. Low enough to see over, impossible to walk through.
- **obstacle_high** — A squat stone burial pillar standing on the floor, seen from above at a slight angle: a round stone drum filling most of the tile, one further segment stacked on top, and a short front face where a dark recessed niche holds stacked skulls. Heavy, chunky proportions, pale stone against a fully transparent background, with a hard dark contact shadow along its base. It must read as a solid mass that blocks both movement and sight, not as a flat marking on the ground.
- **pit** — A collapsed hole in the catacomb floor, seen straight from above: broken flagstones tilting inwards around the rim, the interior almost black and empty of any detail, a couple of bones caught on the edge. The rim stones read lighter than the surrounding floor so the drop is unmistakable.
- **water** — Still black water standing over catacomb stone, clearly darker and cooler than the floor, the surface flat and unbroken with a few faint pale reflection streaks and a thin film of scum.
- **hazard** — A low creeping pale mould spreading across catacomb stone, its patches distinctly brighter than the floor with a faint sickly green cast, tiny luminous spores and bone fragments half buried in it. Fully transparent background between the patches, so the floor shows through.

Dekale, po jednym na plik `decal_01..06.png`:

- **decal_01** (`floor`, 0.08) — A few small bone fragments lying loose on stone, pale against the floor, scattered and well clear of the tile edges.
- **decal_02** (`floor`, 0.06) — A thin drift of dry grey grit and dust, slightly lighter than the floor, settled in a small irregular patch.
- **decal_03** (`floor`, 0.04) — A short dark hairline crack across a flagstone with a small chip broken from its edge.
- **decal_04** (`floor`, 0.03) — A cracked clay shard and a broken urn fragment resting on the ground, pale and clearly readable.
- **decal_05** (`wall`, 0.12) — A dark damp stain seeping down pale stone, with a faint pale salt bloom at its lower edge.
- **decal_06** (`water`, 0.10) — A thin pale film of scum drifting on still black water.

Przejścia:

- **door_ns** — A narrow catacomb doorway cut into an east-west wall, seen from above at a slight angle. The left and right eighth of the tile is the wall itself, the same grey blockwork as the wall tiles, running straight through at the same height and thickness so the wall reads as continuing behind the doorway. Between them a plain stone lintel and jambs frame an opening twelve to sixteen pixels wide with a worn threshold, the floor showing through the gap.
- **door_ew** — The same doorway cut into a north-south wall, which on screen runs vertically and is seen from directly above. The top and bottom eighth of the tile is the same grey blockwork as the wall tiles, continuing the wall through the tile. Between them the wall is broken by a twelve to sixteen pixel gap: you look down on the flat tops of the two jambs to either side of it and on the worn threshold stones in the gap itself, with the floor showing through. Seen from above, not from the front - no arch in elevation, no door leaf facing the viewer, nothing drawn as if the doorway had been laid down on its side.
- **gate_ns** — A heavy catacomb gate two tiles wide in an east-west wall: a low stone arch on squat piers, rusted hinge plates, an iron-bound door standing open, floor showing through the opening. The outermost eight to twelve pixels at each end are the wall's own blockwork, at the wall's height and thickness, so the gate sits inside a continuous run of wall rather than standing free.
- **gate_ew** — The same gate in a north-south wall, two tiles tall on screen and seen from directly above: the flat tops of the two piers to either side of the opening, the iron-bound door standing open across the gap, the floor showing through. The topmost and bottommost eight to twelve pixels carry the wall's own blockwork so the run of wall passes through it. Seen from above, not in elevation.

---

## 7. Wyjście

Zwróć **jedną paczkę ZIP** zawierającą wyłącznie podbiom, o który proszono. Nic poza nim — żadnych dodatkowych podbiomów, żadnych plików pomocniczych, żadnych wariantów roboczych.

Zawartość paczki:

```
<podbiom>/
├── floor_01.png … floor_06.png
├── wall_01.png … wall_03.png
├── obstacle_low_01.png … obstacle_low_03.png
├── obstacle_high_01.png, obstacle_high_02.png
├── pit_01.png, pit_02.png
├── water_01.png, water_02.png
├── hazard_01.png, hazard_02.png
├── wall_blob47_a.png, wall_blob47_b.png
├── water_blob47_a.png, water_blob47_b.png
├── pit_blob47.png
├── decal_01.png … decal_06.png
├── door_ns.png, door_ew.png
├── gate_ns.png, gate_ew.png
└── tiles.json
```

20 kafli PNG 32×32 RGBA, pięć arkuszy blob47, sześć dekali, cztery przejścia i `tiles.json`. Razem 36 plików. Nazwa paczki to nazwa podbiomu.

`tiles.json` — struktura identyczna dla każdego podbiomu, zmieniają się tylko wagi i gęstości, jeśli podbiom tego wymaga:

```json
{
  "tileSize": 32,
  "roles": {
    "floor": [
      { "file": "floor_01.png", "weight": 6 },
      { "file": "floor_02.png", "weight": 6 },
      { "file": "floor_03.png", "weight": 6 },
      { "file": "floor_04.png", "weight": 6 },
      { "file": "floor_05.png", "weight": 1 },
      { "file": "floor_06.png", "weight": 1 }
    ],
    "wall": ["wall_01.png", "wall_02.png", "wall_03.png"],
    "obstacle_low": ["obstacle_low_01.png", "obstacle_low_02.png", "obstacle_low_03.png"],
    "obstacle_high": ["obstacle_high_01.png", "obstacle_high_02.png"],
    "pit": ["pit_01.png", "pit_02.png"],
    "water": ["water_01.png", "water_02.png"],
    "hazard": ["hazard_01.png", "hazard_02.png"]
  },
  "blob47": {
    "wall":  { "sheets": ["wall_blob47_a.png", "wall_blob47_b.png"],   "masks": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27, 31, 38, 39, 46, 47, 55, 63, 76, 77, 78, 79, 95, 110, 111, 127, 137, 139, 141, 143, 155, 159, 175, 191, 205, 207, 223, 239, 255] },
    "water": { "sheets": ["water_blob47_a.png", "water_blob47_b.png"], "masks": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27, 31, 38, 39, 46, 47, 55, 63, 76, 77, 78, 79, 95, 110, 111, 127, 137, 139, 141, 143, 155, 159, 175, 191, 205, 207, 223, 239, 255] },
    "pit":   { "sheet": "pit_blob47.png", "masks": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27, 31, 38, 39, 46, 47, 55, 63, 76, 77, 78, 79, 95, 110, 111, 127, 137, 139, 141, 143, 155, 159, 175, 191, 205, 207, 223, 239, 255] }
  },
  "decals": [
    { "file": "decal_01.png", "on": "floor", "density": 0.08 },
    { "file": "decal_02.png", "on": "floor", "density": 0.06 },
    { "file": "decal_03.png", "on": "floor", "density": 0.04 },
    { "file": "decal_04.png", "on": "floor", "density": 0.03 },
    { "file": "decal_05.png", "on": "wall",  "density": 0.12 },
    { "file": "decal_06.png", "on": "water", "density": 0.10, "jitter": 0.1 }
  ],
  "fixtures": {
    "door_ns": ["door_ns.png"],
    "door_ew": ["door_ew.png"],
    "gate_ns": ["gate_ns.png"],
    "gate_ew": ["gate_ew.png"]
  }
}
```

`jitter` można pominąć — wtedy obowiązuje domyślne `0.22`. Obniż je tylko tam, gdzie dekal ma trzymać się kafla, na przykład dla zacieku na murze.

Wariant można zapisać krótko, samą nazwą pliku, jeśli wszystkie warianty roli mają być równie częste — tak jak `wall` wyżej. Forma `{ "file": ..., "weight": ... }` służy tylko do różnicowania częstości.

Paczkę rozpakowujemy prosto do `content/tilesets/` w repozytorium gry.

## 8. Kontrola

Przed oddaniem zestawu:

**Szwy.** Powielić kafel podłogi 2×2 i sprawdzić, czy widać krawędzie. To jedyna wada niewidoczna na pojedynczym kaflu, a psująca wygląd całego poziomu.

**Przezroczystość.** `obstacle_low`, `obstacle_high` i `hazard` muszą mieć alfę wokół obiektu. Wypełnione tło wytnie dziury w podłodze.

**Spójność.** Wszystkie kafle muszą wyglądać jak jedno miejsce — ta sama paleta, ta sama faktura, ten sam stopień zniszczenia.

**Kontrast.** Zestawić kafel muru obok kafla podłogi i sprawdzić, czy granica jest natychmiast widoczna. Potem to samo w skali szarości, zmniejszone do 25% — mur ma dalej odcinać się od posadzki. Różnica średnich jasności poniżej 20 punktów to błąd do poprawienia, nie kwestia gustu.

**Sylwetka.** Położyć każdą przeszkodę na podłodze i sprawdzić, czy da się ją rozpoznać w 32 px: czy wypełnia 70–90% kafla, czy ma ciemną linię styku z podłożem i czy `obstacle_high` faktycznie wygląda na bryłę zasłaniającą widok, a nie na wzór namalowany na posadzce.

**Arkusze.** Zestawić sąsiadujące kafle blob47 i sprawdzić, czy krawędzie schodzą się pikselowo. Sprawdzić też, czy `masks` ma dokładnie 47 pozycji i odpowiada rozmieszczeniu kafli w arkuszu. Dotyczy wszystkich trzech arkuszy, także `pit`.

**Ramka.** Dla każdego kafla porównać średnią jasność skrajnego pierścienia pikseli ze średnią pierścienia leżącego jeden piksel dalej do środka. Na krawędzi, która ma przechodzić w sąsiedni kafel, różnica powyżej 8 poziomów to wypalona ramka — kafel do wygenerowania od nowa. Wzrokowo to samo widać po ułożeniu kafla 5×5: krata co 32 piksele zamiast jednolitej powierzchni.

Sprawdzian nie jest teoretyczny. W pierwszej paczce katakumb ramkę miały 34 z 47 kafli arkusza muru, średnio o 10.7 poziomu ciemniejsze od wnętrza, mimo że blok stylu już wtedy zakazywał ramek — model rozumie „no border" jako brak marginesu wokół obrazka, nie jako zakaz przyciemniania skrajnych pikseli. Stąd osobny, liczbowy sprawdzian.

**Kierunek patrzenia.** Zestawić `door_ns` z `door_ew` obok siebie. Pierwsze pokazuje lico muru od przodu, drugie wierzch muru z góry. Jeśli `door_ew` wygląda jak `door_ns` położony na boku — czyli widać łuk albo skrzydło w elewacji, obrócone o ćwierć obrotu — kafel jest do wygenerowania od nowa. To samo dla pary bram.

**Przejścia w murze.** Położyć każde drzwi i każdą bramę między dwa kafle muru i sprawdzić trzy rzeczy: czy pas muru na grafice przejścia leży na tej samej wysokości co na kaflach obok, czy ma tę samą grubość, i czy kamień jest ten sam. Zasłonić sam otwór — to, co zostaje, ma wyglądać jak kawałek muru, a nie jak rama obrazu. Generator rysuje sąsiednie kafle muru jako biegnące **w stronę** przejścia, więc każdy uskok na styku widać od razu.

**Złącza wariantów.** Ułożyć planszę 4×4 z **losowo pomieszanych** wariantów jednej roli i przejść wzrokiem po każdym styku: fugi mają przechodzić z kafla na kafel. Mechanicznie: dla każdej pary wariantów porównać skrajną kolumnę jednego z pierwszą kolumną drugiego, i tak samo wiersze. Średnia różnica jasności powyżej 8 poziomów to brak wspólnego brzegu — do poprawienia w całej roli naraz, nie w pojedynczym kaflu. Sprawdzian wykonać **po** sprawdzianie ramki, bo wypalony ciemny brzeg zafałszowuje wynik: zrówna wszystkie krawędzie i pokaże zgodność, której nie ma.

**Warianty arkuszy.** Zestawić `_a` i `_b` tej samej roli komórka po komórce: ta sama maska, ta sama sylwetka krawędzi, ta sama jasność. Różnica ma siedzieć w układzie kamieni, nie w materiale. Potem wypełnić oboma arkuszami pole 8×8 na przemian i sprawdzić, czy ściana przestała mieć rytm, a nie czy widać, gdzie kończy się jeden arkusz.

**Dekale.** Położyć każdy dekal na podłożu, na którym ma się pojawiać, i sprawdzić dwie rzeczy: czy tło jest faktycznie przezroczyste i czy obiekt nie dotyka krawędzi kafla. Dekal dotykający krawędzi zdradza siatkę dokładnie tak samo jak szew w teksturze.

**Wagi.** Obejrzeć planszę 8×8 z wariantami w proponowanych proporcjach. Wariant wyrazisty ma się pojawiać rzadko na tyle, żeby przyciągał oko, a nie budował rytm.

Kafel, który nie przechodzi kontroli, generujemy od nowa zamiast poprawiać.

---

## 9. Kontrakt importu do generatora map

Paczka trafia do generatora pokoi przez wskazanie **katalogu**. Ta sekcja opisuje, co dokładnie ten katalog musi zawierać. Wszystko poniżej jest wymogiem twardym — plik, który się nie zgadza, albo nie wczyta się wcale, albo wczyta się po cichu bez części grafiki.

### 9.1. Struktura katalogu

Dokładnie 36 plików, **płasko**, bez podkatalogów:

```
<podbiom>/
├── floor_01.png … floor_06.png
├── wall_01.png … wall_03.png
├── obstacle_low_01.png … obstacle_low_03.png
├── obstacle_high_01.png obstacle_high_02.png
├── pit_01.png    pit_02.png
├── water_01.png  water_02.png
├── hazard_01.png hazard_02.png
├── wall_blob47_a.png  wall_blob47_b.png
├── water_blob47_a.png water_blob47_b.png
├── pit_blob47.png
├── decal_01.png … decal_06.png
├── door_ns.png  door_ew.png
├── gate_ns.png  gate_ew.png
└── tiles.json
```

- Nazwy plików **dosłownie takie jak wyżej**: małe litery, podkreślenia, numeracja dwucyfrowa od `01`, rozszerzenie `.png`. Bez spacji, polskich znaków, nawiasów, sufiksów typu `_v2` czy `_final`.
- Nazwa katalogu to nazwa podbiomu, małymi literami, bez spacji.
- ZIP zawiera **tylko ten jeden katalog i tylko te 36 plików**. Bez `README`, bez `palette.gpl`, bez podglądów, bez arkuszy roboczych i bez masek pomocniczych. Bez zagnieżdżenia typu `<podbiom>/<podbiom>/`.

### 9.2. Parametry plików graficznych

| | |
|---|---|
| 20 kafli | PNG, dokładnie **32×32** px, **RGBA 8-bit** |
| 3 arkusze | PNG, dokładnie **256×192** px, **RGBA 8-bit** |
| 6 dekali | PNG, dokładnie **32×32** px, **RGBA 8-bit**, przezroczyste tło |
| 2 drzwi | PNG, dokładnie **32×32** px, **RGBA 8-bit**, przezroczyste tło |
| 2 bramy | PNG, **64×32** (`gate_ns`) i **32×64** (`gate_ew`), **RGBA 8-bit**, przezroczyste tło |

Kanał alfa obowiązkowy w każdym pliku, także tam, gdzie obraz jest w pełni nieprzezroczysty. Bez palety indeksowanej, bez skali szarości, bez 16 bitów na kanał. Rozmiar musi się zgadzać co do piksela — 31×32 albo 33×33 to błąd, nie zaokrąglenie.

### 9.3. `tiles.json`

Kodowanie **UTF-8 bez BOM**, końce linii LF, bez komentarzy i bez przecinków na końcu list. Dokładnie pięć kluczy najwyższego poziomu: `tileSize`, `roles`, `blob47`, `decals`, `fixtures`.

```json
{
  "tileSize": 32,
  "roles": {
    "floor": [
      { "file": "floor_01.png", "weight": 6 },
      { "file": "floor_02.png", "weight": 6 },
      { "file": "floor_03.png", "weight": 6 },
      { "file": "floor_04.png", "weight": 6 },
      { "file": "floor_05.png", "weight": 1 },
      { "file": "floor_06.png", "weight": 1 }
    ],
    "wall": ["wall_01.png", "wall_02.png", "wall_03.png"],
    "obstacle_low": ["obstacle_low_01.png", "obstacle_low_02.png", "obstacle_low_03.png"],
    "obstacle_high": ["obstacle_high_01.png", "obstacle_high_02.png"],
    "pit": ["pit_01.png", "pit_02.png"],
    "water": ["water_01.png", "water_02.png"],
    "hazard": ["hazard_01.png", "hazard_02.png"]
  },
  "blob47": {
    "wall":  { "sheets": ["wall_blob47_a.png", "wall_blob47_b.png"],   "masks": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27, 31, 38, 39, 46, 47, 55, 63, 76, 77, 78, 79, 95, 110, 111, 127, 137, 139, 141, 143, 155, 159, 175, 191, 205, 207, 223, 239, 255] },
    "water": { "sheets": ["water_blob47_a.png", "water_blob47_b.png"], "masks": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27, 31, 38, 39, 46, 47, 55, 63, 76, 77, 78, 79, 95, 110, 111, 127, 137, 139, 141, 143, 155, 159, 175, 191, 205, 207, 223, 239, 255] },
    "pit":   { "sheet": "pit_blob47.png", "masks": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27, 31, 38, 39, 46, 47, 55, 63, 76, 77, 78, 79, 95, 110, 111, 127, 137, 139, 141, 143, 155, 159, 175, 191, 205, 207, 223, 239, 255] }
  },
  "decals": [
    { "file": "decal_01.png", "on": "floor", "density": 0.08 },
    { "file": "decal_02.png", "on": "floor", "density": 0.06 },
    { "file": "decal_03.png", "on": "floor", "density": 0.04 },
    { "file": "decal_04.png", "on": "floor", "density": 0.03 },
    { "file": "decal_05.png", "on": "wall",  "density": 0.12 },
    { "file": "decal_06.png", "on": "water", "density": 0.10 }
  ]
}
```

Struktura jest **identyczna dla każdego podbiomu** — skopiuj plik i zmieniaj wyłącznie wagi i gęstości, jeśli materiał podbiomu tego wymaga. Nie przestawiaj kolejności i nie wymyślaj własnych kluczy.

Zasady, których nie wolno naruszyć:

- `tileSize` pisane **camelCase**. Nie `tile_size`, nie `size`, nie `tile`.
- Klucze w `roles` to **wyłącznie siedem ról kafli**: `floor`, `wall`, `obstacle_low`, `obstacle_high`, `pit`, `water`, `hazard`. Wszystkie siedem obowiązkowo, każda z pełnym kompletem wariantów z sekcji 4.
- **Zakazane klucze i wartości:** `deco`, `overlay`, `ground`, `blocking`, `void` jako role; `textures`, `objects`, `weight`, `light`, `palette`, `blob`, `neighbor_bits`, `wall_face_height` jako klucze. Nazwy warstw edytora nie są rolami kafli.
- Wartości w `roles` to **tablice wariantów**, w kolejności numeracji. Wariant to nazwa pliku albo obiekt `{ "file": "...", "weight": n }`, gdzie `weight` jest liczbą całkowitą 1–8. Obie formy można mieszać w jednej tablicy. Ścieżki względne do katalogu paczki, bez `./`, bez podkatalogów, bez ukośników.
- Każdy plik wymieniony w `tiles.json` musi istnieć w katalogu, i odwrotnie — każdy PNG w katalogu musi być wymieniony w `tiles.json`.
- W `blob47` dozwolone są wyłącznie klucze `wall`, `water` i `pit`. Każdy ma pole `masks` z dokładnie 47 pozycjami oraz arkusze: `sheets` z tablicą nazw przy `wall` i `water`, `sheet` z jedną nazwą przy `pit`. Obie formy czyta ten sam kod, więc `sheet` dalej działa w starszych paczkach — nowe generujemy według powyższego.
- `decals` to tablica obiektów `{ "file", "on", "density" }` z opcjonalnym `jitter`. `on` musi być rolą kafla, `density` liczbą z przedziału (0, 1]. Gęstości powyżej `0.15` traktuj jako błąd projektowy, nie jako mocniejszy efekt.
- `fixtures` ma dokładnie cztery klucze: `door_ns`, `door_ew`, `gate_ns`, `gate_ew`, każdy z nazwą pliku albo tablicą wariantów. Inne klucze są pomijane z notatką.
- `jitter` to ułamek kafla, o jaki dekal może odsunąć się od środka: domyślnie `0.22`, przycinane do przedziału 0–0,5. `0` przykleja dekale do siatki i zwykle jest błędem; wartości powyżej `0.3` wypychają je na sąsiednie kafle.

### 9.4. Kolejność kafli w arkuszu

Tablica `masks` jest kontraktem między obrazem a kodem: **pozycja w tablicy to numer komórki w arkuszu**, liczony wierszami od lewego górnego rogu.

```
indeks = pozycja w masks (0..46)
x = (indeks mod 8) * 32
y = floor(indeks / 8) * 32
```

Czyli maska `0` leży w komórce (0,0), maska `15` w (224,0) — koniec pierwszego wiersza, maska `255` w (192,160) — ostatnia zajęta komórka. Komórka 47, czyli (224,160), zostaje **w pełni przezroczysta**.

Znaczenie skrajnych przypadków, żeby nie było wątpliwości przy rysowaniu:

- maska `0` — blok odosobniony, ze wszystkich stron sąsiaduje z czymś innym, widoczne cztery krawędzie i cztery narożniki zewnętrzne
- maska `15` — sąsiedzi na N, E, S, W, ale żadnej przekątnej; cztery narożniki wklęsłe
- maska `255` — wnętrze zwartego obszaru, pełna faktura bez żadnej krawędzi

Kolejność w tablicy jest **rosnąca** i podana wyżej dosłownie. Nie sortuj inaczej, nie skracaj, nie generuj własnej listy — ta lista to jedyne 47 kombinacji, jakie przetrwają redukcję przekątnych z sekcji 4.1.

### 9.5. Lista kontrolna przed spakowaniem

Każdy punkt jest sprawdzalny mechanicznie. Sprawdź wszystkie, zanim oddasz paczkę.

1. W katalogu jest dokładnie 36 plików i zero podkatalogów.
2. Nazwy plików zgadzają się co do znaku z listą z 9.1.
3. Każdy z 20 kafli i każdy z 6 dekali ma 32×32 px, wszystkie pięć arkuszy 256×192 px, wszystko w RGBA.
4. `tiles.json` parsuje się jako poprawny JSON i nie zaczyna się od BOM-u.
5. `tiles.json` ma klucze `tileSize`, `roles`, `blob47`, `decals`, `fixtures` i żadnych innych.
6. `roles` ma wszystkie siedem ról, z liczbą wariantów 6/3/3/2/2/2/2.
7. Zbiór nazw plików wymienionych w `tiles.json` — razem z arkuszami i dekalami — jest równy zbiorowi PNG-ów w katalogu.
8. Wszystkie trzy tablice `masks` mają po 47 pozycji i są identyczne z listą z 9.3. Oba arkusze `wall` i oba `water` dzielą tablicę swojej roli — jedna tablica na rolę, nie na plik.
9. `obstacle_low`, `obstacle_high`, `hazard` i wszystkie dekale mają rzeczywistą przezroczystość wokół obiektu — nie biały, nie czarny, nie różowy prostokąt tła.
10. Ostatnia komórka każdego z pięciu arkuszy, czyli (224,160), jest w pełni przezroczysta.
11. Żaden dekal nie dotyka krawędzi kafla i mieści się w środkowych 60% kwadratu, a jego `density` mieści się w 0,03–0,15.
12. Suma gęstości dekali przypisanych do jednej roli nie przekracza `0.25`.
13. Przejścia mają właściwe rozmiary: drzwi 32×32, `gate_ns` 64×32, `gate_ew` 32×64, wszystkie z przezroczystym tłem poza framugą.
14. Średnia jasność kafli `wall` różni się od średniej jasności kafli `floor` o co najmniej 20 punktów w skali 0–100, a każda rola mieści się w swoim paśmie z sekcji 5.2.
15. W żadnym kaflu skrajny pierścień pikseli nie jest ciemniejszy od pierścienia obok o więcej niż 8 poziomów — poza krawędziami arkusza blob47, po których materiał się urywa.
16. Wszystkie warianty jednej roli mają identyczne piksele na każdej z czterech krawędzi, więc dowolne dwa dają się położyć obok siebie bez przerwanej fugi.
17. `wall_blob47_a` i `wall_blob47_b` — i tak samo para wodna — są pocięte tak samo i trzymają maski w tej samej kolejności.

### 9.6. Co się dzieje, gdy coś się nie zgadza

Dla przypomnienia, jak wygląda awaria po stronie generatora, gdy któryś punkt jest złamany:

| Naruszenie | Skutek |
|---|---|
| BOM w `tiles.json`, przecinek końcowy | tileset nie wczyta się w ogóle |
| `tile_size` zamiast `tileSize` | kafle rysowane w złej skali przy cięciu arkuszy |
| Rola spoza listy, `deco` lub `overlay` | wpis pominięty, powód wypisany w panelu |
| Plik wymieniony w `tiles.json`, ale nieobecny | ta rola wraca do kolorowego kwadratu |
| PNG obecny, ale niewymieniony | plik zignorowany w całości |
| Kafel inny niż 32×32 | wpasowany w kafel i dosunięty do dolnej krawędzi, czyli zwykle źle |
| `masks` krótsze lub dłuższe niż liczba komórek | autotiling wyłączony dla tej roli |
| Brak `blob47` | ściany, woda i przepaść rysowane pojedynczym kaflem, bez narożników |
| Brak `fixtures` | drzwi i bramy rysowane jako kolorowa poprzeczka w otworze |
| Brama w rozmiarze 32×32 | rozciągnięta na dwa kafle, czyli zniekształcona |
| `weight` spoza 1–8 | przycięte do zakresu, proporcje inne niż zamierzone |
| Dekal bez przezroczystego tła | kwadratowe łaty na podłodze |
| Dekal z rolą spoza listy | wpis pominięty, powód wypisany w panelu |
| `density` zbyt wysokie | dekal przestaje być akcentem i buduje wzór |
| `jitter` zbyt wysokie albo dekal bez zapasu przy krawędzi | dekal wychodzi na sąsiedni kafel |
