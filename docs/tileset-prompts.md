# Specyfikacja generowania tilesetów

Dokument jest kompletny i samowystarczalny. Po jego wklejeniu wystarczy napisać:

> wygeneruj tileset dla podbiomu „katakumby"

Wszystkie palety i opisy kafli dla 50 podbiomów są w sekcji 6.

---

## 1. Zadanie

Na polecenie „wygeneruj tileset dla podbiomu X" wyprodukuj **20 kafli** według tabeli z sekcji 4, **pięć arkuszy blob47** według sekcji 4.1 — mur i woda po dwa warianty, przepaść jeden — **sześć dekali** według sekcji 4.2, **osiem przejść** według sekcji 4.3 oraz plik `tiles.json` z sekcji 7.

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

**Krata (`grate`) jest ósmą rolą kafla, ale nie ma kafla płaskiego.** Jej wygląd zależy od tego, którędy biegnie mur, czego płaska lista wariantów nie umie powiedzieć — więc kraty rysujemy jak drzwi, w sekcji 4.3, i w `tiles.json` siedzą w `fixtures`, nie w `roles`. W `roles` krata nie występuje w ogóle.

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

## 4.3. Przejścia: drzwi, brama i krata

Osiem grafik stojących w przerwie w murze. Nie są kaflami podłoża ani obiektami — rysowane są **na wierzchu** kafla, dokładnie w otworze w murze. Pod spodem leży podłoga pokoju i to ona ma być widoczna w prześwicie.

| Plik | Rozmiar | Co to jest |
|---|---|---|
| `door_ns.png` | 32×32 | drzwi w murze biegnącym wschód–zachód, przechodzisz z północy na południe |
| `door_ew.png` | 32×32 | drzwi w murze biegnącym północ–południe, przechodzisz ze wschodu na zachód |
| `door_ns_grate.png` | 32×32 | te same drzwi, ale mur po obu stronach otworu zastąpiony kratą |
| `door_ew_grate.png` | 32×32 | to samo dla muru północ–południe |
| `gate_ns.png` | **64×32** | brama w murze wschód–zachód, szeroka na dwa kafle |
| `gate_ew.png` | **32×64** | brama w murze północ–południe, wysoka na dwa kafle |
| `grate_ns.png` | 32×32 | krata w murze biegnącym wschód–zachód |
| `grate_ew.png` | 32×32 | krata w murze biegnącym północ–południe |

### Dwie perspektywy: `ns` i `ew`

Tę regułę przeczytaj **przed każdą z ośmiu grafik**, bo rozstrzyga o wszystkich naraz. Wariant `ns` i wariant `ew` tego samego przejścia to **ten sam obiekt obrócony razem z kamerą**, a nie ten sam obrazek położony na boku — i wychodzą z tego dwa rysunki, które nie są do siebie podobne.

**Mur zawsze biegnie na wylot przez kafel, a przejście jest przerwą w tym biegu.** Cała różnica bierze się z tego, w którą stronę mur biegnie:

| | `ns` | `ew` |
|---|---|---|
| Mur biegnie | wschód–zachód, poziomo na ekranie | północ–południe, pionowo na ekranie |
| Patrzymy na | **lico** muru, od przodu | **wierzch** muru, z góry |
| Kamień zostaje przy krawędzi | **lewej i prawej** | **górnej i dolnej** |
| Przechodzisz | z góry na dół kafla | z lewej na prawą kafla |
| Przejście jest otwarte ku | górze i dołowi | lewej i prawej |

Kraty są tu jedynym wyjątkiem i to tylko w jedną stronę: krata jest cienka, więc **nie ma kamienia przy żadnej krawędzi** — ma go mniej, niż mówi tabela, nigdy więcej. Szczegóły w podrozdziale o kracie.

Ostatni wiersz tabeli jest tym, o który się to najczęściej rozbija. **Kamień stoi tylko przy tych dwóch krawędziach, którymi mur wybiega z kafla — przy pozostałych dwóch są komnaty i tam ma być przezroczystość.** W wariancie `ew` znaczy to, że **lewa i prawa krawędź kafla nie może mieć ani jednego piksela kamienia w paśmie przejścia**: przejście biegnie na wylot od lewej krawędzi do prawej.

#### Czego w wariantach `ew` być nie może

Kamień dorysowany przy lewej i prawej krawędzi zamyka framugę w pierścień i z przejścia robi się **właz albo klapa w podłodze** — płyta z dziurą, leżąca płasko na ziemi. Kafel zrobiony w ten sposób jest do wygenerowania od nowa, choćby sam w sobie wyglądał dobrze. Gracz odczyta go jako coś, po czym się chodzi albo do czego się schodzi, a nie jako przejście w ścianie.

W `door_ew`, `door_ew_grate`, `gate_ew` i `grate_ew` **nie wolno**:

- **zamykać framugi dookoła** — kamień przy lewej i prawej krawędzi kafla w paśmie przejścia jest zakazany; przez otwór ma dać się przeciągnąć poziomą linię od krawędzi do krawędzi, nie trafiając w ani jeden piksel w jasności muru,
- rysować otworu jako **ciemnej wnęki, dziury ani zapadliny** — przez przejście widać posadzkę sąsiedniej komnaty, oświetloną tak samo jak reszta podłogi; otwór ciemniejszy od podłogi czyta się jako przepaść, a nie jako droga,
- rysować **łuku, nadproża, skrzydła ani kraty w elewacji** i kłaść tego płasko — to jest dokładnie ten obrót o ćwierć, który zamienia przejście w przedmiot leżący na ziemi.

To samo dotyczy wariantów `ns`, tylko z zamienionymi osiami: tam zakazany jest kamień przy górnej i dolnej krawędzi w paśmie przejścia.

### Drzwi

**Drzwi** to wejście do **podpokoju** — komory wydzielonej wewnątrz pokoju. Otwór ma **jeden kafel** szerokości, przechodzi się pojedynczo.

Grafika wypełnia cały kafel i jest **fragmentem muru z dziurą pośrodku**, nie ozdobą postawioną na podłodze. Przy tych dwóch krawędziach, którymi mur wybiega z kafla — patrz tabela wyżej — zostaje **kawałek muru z tego samego kamienia co kafle `wall`**: ta sama paleta, ta sama faktura, ta sama grubość i ta sama wysokość co pas muru na sąsiednich kaflach, tak żeby mur przechodził przez kafel drzwi bez uskoku. Otwór jest wyśrodkowany i **węższy niż kafel**: przy kaflu 32 px framuga zjada po **8–10 px z każdej z tych dwóch stron**, na przejście zostaje 12–16 px.

Generator rysuje mur po obu stronach drzwi jako **ciągnący się w stronę drzwi** — kafel muru obok otworu nie jest zakończeniem, tylko odcinkiem biegnącym dalej. Grafika drzwi musi ten bieg podchwycić: gdyby zabrać z niej sam otwór, kafel ma wyglądać jak zwykły kawałek muru.

#### `door_ns` — mur wschód–zachód, widok od frontu

Mur biegnie poziomo i patrzymy na jego lico, więc widać je tak, jak stoi: **lewa i prawa ósma część kafla to kamień**, a między nimi nadproże, ościeża i otwór 12–16 px z wydeptanym progiem u dołu. Górna i dolna krawędź kafla należą do otworu i do posadzki, nie do kamienia.

#### `door_ew` — mur północ–południe, widok z góry

Mur biegnie na ekranie pionowo i patrzymy na jego **wierzch**, więc kafel czyta się zupełnie inaczej niż `door_ns` i tak ma być.

- **Górne 8–10 px i dolne 8–10 px** to wierzch muru: kamień na całą szerokość kafla, ten sam co na sąsiednich kaflach `wall`, bo to tamtędy mur biegnie dalej na północ i na południe.
- **Między nimi, na 12–16 px, jest przejście** — i biegnie ono **na wylot, od lewej krawędzi kafla do prawej**. Widać w nim wydeptane kamienie progu i posadzkę, w jasności podłogi, a nie ciemną wnękę.
- Tuż przy kamieniu, od strony otworu, może leżeć **wąski ciemniejszy pasek** — to zacieniony bok ościeża, czyli grubość muru widziana z góry. Pasek biegnie poziomo, wzdłuż kamienia, i ma najwyżej 2–3 px.
- **Lewa i prawa krawędź kafla, w paśmie przejścia, są w pełni przezroczyste.** Tam są posadzki obu komnat i mają wpływać w przejście bez przerwy.

Skrzydło drzwi, jeśli je rysujesz, jest z góry **cienką płytą stojącą otworem** — wąskim prostokątem odchylonym i dostawionym do jednego ościeża, z własnym cieniem styku. Nigdy płytą leżącą płasko w otworze ani panelem drzwi widzianym od frontu.

Przejścia **między pokojami mapy** mają dwa kafle szerokości i nie dostają żadnej grafiki — to zwykły otwór w murze.

### Krata

**Krata** to odcinek muru zastąpiony kratą: **widać przez nią i lecą przez nią pociski, ale nie da się przez nią przejść**. Generator stawia ją w murze między dwoma podpokojami albo między podpokojem a korytarzem, nigdy w skorupie pokoju i nigdy tam, gdzie za nią jest lita skała — po obu stronach kraty zawsze jest miejsce, na którym można stanąć. Kraty kładzione są **odcinkami po 2–5 kafli**, nie pojedynczo.

**Prześwity między prętami muszą być faktycznie przezroczyste.** To wymóg twardy i jedyny, którego nie da się naprawić później: to przez nie widać podłogę i przeciwnika po drugiej stronie. Krata narysowana jako pełna płaszczyzna z namalowaną kratką jest kafel do wygenerowania od nowa — z daleka wygląda tak samo, a w grze znaczy coś dokładnie odwrotnego.

Metal jest jednym wspólnym materiałem dla całej paczki — kute, matowe, przygaszone żelazo z rdzą albo śniedzią zależnie od podbiomu. Jasność prętów trzymaj **w paśmie muru** z sekcji 5.2.

#### Zdanie, z którego wynika cała reszta

**Krata jest cienka, a mur jest gruby.** Mur ma grubość całego kafla — 32 px. Krata to szereg prętów po 2–3 px. Kiedy generator zamienia kafel muru na kratę, nie zostaje tam żaden kamień: **zostaje sam szereg prętów, a cała reszta kafla to podłoga, którą widać**. Z tego jednego faktu wynikają obie orientacje, i dlatego wyglądają zupełnie inaczej — tak samo jak `door_ns` i `door_ew`.

Pręty są **pionowe w świecie gry**, jak w celi więziennej: stoją od podłogi do sufitu. Zmienia się tylko to, pod jakim kątem na nie patrzymy.

#### `grate_ns` — mur wschód–zachód, widok od frontu

Mur biegnie poziomo, jego lico jest zwrócone do kamery, więc pręty widzimy **w elewacji, z boku, na całą ich wysokość**: pionowe, wysokie na niemal cały kafel, a między nimi pionowe przezroczyste szpary, przez które widać posadzkę.

Proporcje: pręt szeroki na **2–3 px**, szpara **4–6 px**, czyli 4–6 prętów na kafel. Węższe szpary zlewają się w powierzchnię przy oddaleniu kamery, szersze przestają wyglądać na przeszkodę. U góry i u dołu zostaje po **4–6 px** poziomej oprawy — nadproże i próg, w które pręty są osadzone.

#### `grate_ew` — mur północ–południe, widok z góry

Mur biegnie na ekranie pionowo i patrzymy na jego **wierzch**. Pręty stoją pionowo w świecie, więc z góry widzimy **ich czubki**, a czubek pręta to punkt, nie szczebel.

Pręty są rozstawione **wzdłuż muru**, czyli z północy na południe. Z góry układają się zatem w **jeden pionowy szereg drobnych znaczków biegnący środkiem kafla, z góry na dół**: 4–5 czubków na kafel, każdy owalny, szeroki na **3–4 px** i wysoki na **5–6 px** — czubek plus wąski skrawek południowego boku, zgodnie z perspektywą ¾ — rozstawione co **4–6 px**, każdy z twardym ciemnym cieniem styku od dołu, żeby czytał się jako pręt sterczący w górę, a nie jako kropka namalowana na posadzce.

**Cała reszta kafla — cały pas po lewej i cały pas po prawej od tego szeregu — jest w pełni przezroczysta.** Tam jest podłoga sąsiednich komnat i to ona ma być widoczna. Szereg czubków trzymaj w środkowych 12 px kafla, czyli **co najmniej 10 px od lewej i od prawej krawędzi**.

Ten wariant jest **w większości przezroczysty** i tak ma być. To nie jest usterka do naprawienia dorysowaniem kamienia: krata jest cienka, więc zajmuje wąski pasek, a przez resztę kafla naprawdę widać podłogę.

#### Czego w `grate_ew` być nie może

Najczęstszy i najgorszy błąd to narysowanie kraty jak **drabiny położonej płasko na podłodze**: dwie ciągłe jasne szyny wzdłuż lewej i prawej krawędzi kafla, a między nimi poprzeczne szczeble na całą szerokość. Kafel zrobiony w ten sposób jest do wygenerowania od nowa. Wychodzi z tego drabina leżąca na ziemi, a nie krata stojąca w murze — i gracz odczyta go jako coś, po czym się chodzi, a nie jako ścianę, przez którą się strzela.

Konkretnie, w `grate_ew` **nie wolno**:

- rysować żadnego **ciągłego pasa** biegnącego z góry na dół wzdłuż lewej ani prawej krawędzi — ani kamiennego, ani metalowego, ani jako oprawy, ani jako progu; te dwa pasy to właśnie szyny drabiny,
- rysować prętów jako **poprzecznych belek dotykających lewej i prawej krawędzi** kafla; czubek pręta jest drobny i ze wszystkich czterech stron otacza go przezroczystość,
- kłaść tam kraty **w elewacji obróconej o ćwierć obrotu**, czyli `grate_ns` położonej na boku.

#### Kafelkowanie

Odcinek kraty ma się kafelkować **sam ze sobą wzdłuż muru** — `grate_ns` w poziomie, `grate_ew` w pionie — dając jeden ciągły szereg o równym rytmie, bez zgęszczenia ani przerwy na styku. Rozstaw prętów musi więc wychodzić na krawędzi kafla tak, żeby kontynuacja się zgadzała.

### Drzwi w kracie

Krata **może sąsiadować z drzwiami**, ale generator pilnuje, żeby robiła to **z obu stron naraz**: albo oba kafle przylegające do otworu są kratą, albo żaden. Drzwi z kratą po jednej stronie i murem po drugiej nie powstaną, bo nie ma grafiki, która połączyłaby oprawę kraty z licem muru w poprzek framugi.

Stąd `door_ns_grate` i `door_ew_grate`. Są to **te same drzwi co `door_ns` i `door_ew`** — ten sam otwór tej samej szerokości, w tym samym miejscu kafla, ta sama framuga i ten sam próg. Zmienia się wyłącznie to, co jest po obu stronach otworu: zamiast skrajnej ósmej części kafla wypełnionej kamieniem muru stoją tam **pręty tej samej kraty co w `grate_ns` / `grate_ew`**, w tym samym rytmie i z tymi samymi przezroczystymi prześwitami.

Innymi słowy: `door_ns_grate` ma pasować do `grate_ns` położonej obok tak samo, jak `door_ns` pasuje do kafla `wall`. Rozstaw prętów przechodzi przez styk bez zgęszczenia, oprawa kraty leży na tej samej wysokości.

Ościeże drzwi zostaje kamienne — otwór musi mieć oprawę, do której krata jest przymocowana. Na 32 px kafla wychodzi więc: **kilka pikseli kraty, wąska kamienna framuga, otwór 12–16 px, framuga, krata**.

Każdy wariant bierze kratę w swojej własnej perspektywie. W `door_ns_grate` skrajne pasy to **pionowe pręty w elewacji**, jak w `grate_ns`. W `door_ew_grate` skrajne pasy to **czubki prętów widziane z góry**, jak w `grate_ew` — czyli po jednym, najwyżej dwóch drobnych owalnych znaczkach na osi kafla, przy górnej i przy dolnej krawędzi. Nie poprzeczna belka i nie ciągły pas przy lewej ani prawej krawędzi.

### Brama

**Brama** to wejście do całego lochu i wyjście z niego — stoi wyłącznie na pierwszym i ostatnim pokoju mapy. Otwór ma **dwa kafle** szerokości, więc grafika jest podwójna i rysowana jednym kawałkiem. Brama ma być wyraźnie okazalsza od drzwi: łuk, odrzwia, okucia, ślady po zawiasach. To pierwszy i ostatni element poziomu, jaki gracz widzi.

Ta sama zasada co przy drzwiach: skrajne **8–12 px** przy tych dwóch krawędziach, którymi mur wybiega z kafla, to mur ciągnący się dalej, wpisany w linię muru sąsiednich kafli. Brama ma być otworem w murze, a nie bramą stojącą w szczerym polu.

`gate_ns` jest szerokie na 64 px i mur zostaje przy **lewej i prawej** krawędzi; łuk, odrzwia i skrzydła widać od frontu.

`gate_ew` jest wysokie na 64 px i mur zostaje przy **górnej i dolnej** krawędzi; patrzymy z góry na wierzchy dwóch filarów, a między nimi na posadzkę bramy biegnącą **na wylot od lewej krawędzi do prawej**. Skrzydła są z góry cienkimi płytami stojącymi otworem, dostawionymi do filarów. Nie ma tam łuku w elewacji ani ciemnej wnęki, a przy lewej i prawej krawędzi w paśmie przejścia nie ma kamienia.

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
| jasne | 60–75 | **`wall`**, `obstacle_high`, `obstacle_low`, pręty kraty |
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

Format wpisu: zdanie palety doklejane do **każdego** promptu tego podbiomu, linia kotwic jasności z sekcji 5.2, siedem opisów ról, sześć opisów dekali i osiem opisów przejść. Kolejne podbiomy dopisujemy poniżej w tym samym formacie.

Opis roli mówi trzy rzeczy: **co to jest**, **jak się to widzi z góry pod kątem ¾** i **jak jasne jest to względem podłogi**. Trzeciego nie pomijaj — to on decyduje, czy pokój się czyta, czy zlewa.

### Katakumby
*Biom: Twierdza — ciasnota, korytarze, walka w zwarciu.*

`Muted cold greys and desaturated bone-beige, cold and lightless, with faint green damp staining used only as a sparse accent.`

Kotwice jasności: `pit` 8, `water` 28, `floor` 45, `wall` 68, `obstacle_low` 62, `obstacle_high` 66, `hazard` 75, pręty kraty 64.

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
- **door_ew** — The same doorway cut into a north-south wall, which on screen runs vertically and is seen from directly above. Only the top eight to ten pixels and the bottom eight to ten pixels are stone: the same grey blockwork as the wall tiles, spanning the full width of the tile, because that is where the wall carries on north and south. Between them runs the passage, twelve to sixteen pixels of worn threshold stones and catacomb floor at the floor's own brightness, and it runs clear from the left edge of the tile to the right edge - the chambers on either side are open and their floor flows straight into it. A two to three pixel darker line along the inner face of each stone band is the thickness of the wall seen from above. The left and right edges of the passage are fully transparent: no stone, no kerb, no sill and no frame closes it off there. A doorway framed with stone on all four sides is a hatch lying in the floor, which is the one thing this tile must not look like. Seen from above, not from the front - no arch in elevation, no door leaf facing the viewer, no dark recessed hole, nothing drawn as if the doorway had been laid down on its side.
- **gate_ns** — A heavy catacomb gate two tiles wide in an east-west wall: a low stone arch on squat piers, rusted hinge plates, an iron-bound door standing open, floor showing through the opening. The outermost eight to twelve pixels at each end are the wall's own blockwork, at the wall's height and thickness, so the gate sits inside a continuous run of wall rather than standing free.
- **gate_ew** — The same gate in a north-south wall, two tiles tall on screen and seen from directly above. The topmost and bottommost eight to twelve pixels carry the wall's own blockwork across the full width, so the run of wall passes through. Between them you look down on the flat tops of the two squat piers and on the catacomb floor of the gateway, which runs clear from the left edge of the image to the right edge at the floor's own brightness. The iron-bound doors stand open as thin slabs seen edge-on, swung back against the piers, each with a hard contact shadow. The left and right edges of the gateway are fully transparent - no stone, kerb or sill closes the opening off there, and no arch is drawn in elevation. Seen from above, not laid on its side.
- **grate_ns** — A row of forged iron bars closing a gap in an east-west catacomb wall, seen from the front: the wall runs horizontally and its face is turned to the camera, so the bars are seen in elevation at their full height. Five upright bars two to three pixels wide standing the height of the tile, evenly spaced with four to six pixels of fully transparent gap between them, so the catacomb floor beyond shows through and the tile reads as something you can see and shoot through but not walk through. The topmost and bottommost five pixels are a stone and iron mounting band, a lintel above and a sill below, that the bars are set into. Pitted dark iron with rust bloom where it meets the stone, held at the pale stone's own brightness. The bar spacing runs off the left and right edges so two of these tiles side by side give one unbroken rhythm.
- **grate_ew** — The same iron grating closing a gap in a north-south wall, which on screen runs vertically and is seen from directly above, so you are looking down on the tops of the bars. The bars are spaced along the wall, north to south, so from above they form a single vertical line of small marks running down the centre of the tile: four or five bar tops, each a rounded oval three to four pixels wide and five to six pixels tall, spaced four to six pixels apart, each with a hard dark contact shadow below it so it reads as an upright bar seen end-on. Everything else in the tile is fully transparent - the whole strip to the left of that line and the whole strip to the right of it - because the catacomb floor of the chambers on either side is what shows there. The bar tops stay in the middle twelve pixels, at least ten pixels clear of the left and right edges. Do not draw a continuous rail, band, kerb or sill of any kind running down the left or right edge, do not draw the bars as crosswise rungs reaching the left and right edges, and do not draw the grating in elevation laid on its side. Two continuous rails with rungs between them is a ladder lying flat on the floor, which is the one thing this tile must not look like.
- **door_ns_grate** — The `door_ns` doorway with the wall to either side of it replaced by iron bars: the same opening in the same place, the same stone lintel, jambs and worn threshold, but beyond the narrow stone frame stand the upright bars of `grate_ns` in elevation, in the same rhythm and with the same transparent gaps, so the grating carries straight on through the doorway.
- **door_ew_grate** — The same for `door_ew`, seen from above: the passage running clear from the left edge to the right edge with its worn threshold stones, the flat tops of the two stone jambs above and below it, and then, at the very top and bottom edge of the tile where `door_ew` would carry the wall's blockwork, one or two of the small rounded bar tops of `grate_ew` sitting on the tile's centre line instead, with everything to their left and right fully transparent. No crosswise rung, no rail down either edge, no stone closing the passage off at the left or right.

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
├── door_ns_grate.png, door_ew_grate.png
├── gate_ns.png, gate_ew.png
├── grate_ns.png, grate_ew.png
└── tiles.json
```

20 kafli PNG 32×32 RGBA, pięć arkuszy blob47, sześć dekali, osiem przejść i `tiles.json`. Razem 40 plików. Nazwa paczki to nazwa podbiomu.

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
    "door_ns_grate": ["door_ns_grate.png"],
    "door_ew_grate": ["door_ew_grate.png"],
    "gate_ns": ["gate_ns.png"],
    "gate_ew": ["gate_ew.png"],
    "grate_ns": ["grate_ns.png"],
    "grate_ew": ["grate_ew.png"]
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

**Kierunek patrzenia.** Zestawić `door_ns` z `door_ew` obok siebie. Pierwsze pokazuje lico muru od przodu, drugie wierzch muru z góry. Jeśli `door_ew` wygląda jak `door_ns` położony na boku — czyli widać łuk albo skrzydło w elewacji, obrócone o ćwierć obrotu — kafel jest do wygenerowania od nowa. To samo dla pary bram i dla pary krat.

**Przejście na wylot.** Dla `door_ew`, `door_ew_grate` i `gate_ew` poprowadzić poziomą linię przez środek otworu, od lewej krawędzi obrazu do prawej. Linia nie ma prawa trafić w ani jeden piksel w jasności muru. Jeśli trafia, framuga jest zamknięta w pierścień i kafel jest włazem leżącym w podłodze, a nie przejściem w ścianie — do wygenerowania od nowa. Ten sam sprawdzian dla wariantów `ns`, tylko linią pionową, od górnej krawędzi do dolnej.

Sprawdzian jest mechaniczny, bo właz narysowany porządnie wygląda porządnie: kamień dookoła otworu jest ładny i w pierwszej chwili czyta się jak framuga. Dopiero na mapie widać, że przejście stoi w poprzek muru i donikąd nie prowadzi.

**Jasność otworu.** Zmierzyć średnią jasność pikseli w samym prześwicie każdego przejścia i porównać ją ze średnią kafli `floor`. Otwór **nie może być ciemniejszy od podłogi o więcej niż 10 punktów**. Ciemny prostokąt w środku framugi czyta się jako dziura, do której się spada, a nie jako droga, którą się idzie — i tym mocniej, im bardziej `door_ew` przypomina właz.

**Prześwit kraty.** Policzyć piksele o zerowej alfie. Próg jest inny dla każdej orientacji i to jest zamierzone:

| Plik | Przezroczystość | Dlaczego tyle |
|---|---|---|
| `grate_ns`, `door_ns_grate` | **35–55%** | widok od frontu: pręty na całą wysokość kafla, szpary między nimi |
| `grate_ew`, `door_ew_grate` | **75–92%** | widok z góry: same czubki prętów, reszta kafla to podłoga |

Poniżej progu krata jest ścianą z namalowaną kratką i nie widać przez nią nic. Sprawdzian jest liczbowy, bo na oko ciemny prześwit i ciemny metal wyglądają tak samo, a znaczą coś przeciwnego: przez kratę ma być widać podłogę i przeciwnika po drugiej stronie.

**Kolumny kraty `ew`.** Dla `grate_ew` i `door_ew_grate` sprawdzić dziesięć skrajnych kolumn pikseli z lewej i dziesięć z prawej: **wszystkie muszą być w pełni przezroczyste**. Jeden nieprzezroczysty piksel w tym pasie znaczy, że kafel ma szynę i jest drabiną — do wygenerowania od nowa. To jedyny sprawdzian, który łapie ten błąd mechanicznie, bo drabina narysowana ładnie wygląda ładnie.

**Rytm prętów.** Położyć dwa `grate_ns` obok siebie w poziomie, potem dwa `grate_ew` jeden pod drugim w pionie, i sprawdzić, czy rozstaw prętów przechodzi przez styk bez zgęszczenia i bez przerwy. Potem to samo z `door_ns_grate` między dwoma `grate_ns` i z `door_ew_grate` między dwoma `grate_ew`: pręty mają biec przez cały odcinek jednym rytmem, a kamienna framuga drzwi ma być jedyną przerwą.

**Perspektywa kraty.** Zestawić `grate_ns` z `grate_ew` obok siebie, tak samo jak parę drzwi. Pierwsza pokazuje pręty z boku, na całą wysokość. Druga pokazuje ich czubki z góry, jako szereg drobnych znaczków biegnący z góry na dół. Jeśli obie wyglądają podobnie — jeśli w `grate_ew` widać pręty na całą długość, poprzeczne belki albo cokolwiek ciągłego wzdłuż boków — kafel jest do wygenerowania od nowa.

**Krata w murze.** Dla `grate_ns` zasłonić szpary i sprawdzić, co zostaje: pas oprawy u góry i u dołu ma leżeć na tej samej wysokości i mieć tę samą grubość co pas muru na sąsiednich kaflach `wall`. Krata, która wisi wyżej albo niżej niż mur, robi uskok na każdym styku. Dla `grate_ew` tego sprawdzianu nie ma i nie wolno go sobie dorabiać: tam kamienia nie ma wcale.

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

Dokładnie 40 plików, **płasko**, bez podkatalogów:

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
├── door_ns_grate.png  door_ew_grate.png
├── gate_ns.png  gate_ew.png
├── grate_ns.png  grate_ew.png
└── tiles.json
```

- Nazwy plików **dosłownie takie jak wyżej**: małe litery, podkreślenia, numeracja dwucyfrowa od `01`, rozszerzenie `.png`. Bez spacji, polskich znaków, nawiasów, sufiksów typu `_v2` czy `_final`.
- Nazwa katalogu to nazwa podbiomu, małymi literami, bez spacji.
- ZIP zawiera **tylko ten jeden katalog i tylko te 40 plików**. Bez `README`, bez `palette.gpl`, bez podglądów, bez arkuszy roboczych i bez masek pomocniczych. Bez zagnieżdżenia typu `<podbiom>/<podbiom>/`.

### 9.2. Parametry plików graficznych

| | |
|---|---|
| 20 kafli | PNG, dokładnie **32×32** px, **RGBA 8-bit** |
| 3 arkusze | PNG, dokładnie **256×192** px, **RGBA 8-bit** |
| 6 dekali | PNG, dokładnie **32×32** px, **RGBA 8-bit**, przezroczyste tło |
| 4 drzwi | PNG, dokładnie **32×32** px, **RGBA 8-bit**, przezroczyste tło |
| 2 bramy | PNG, **64×32** (`gate_ns`) i **32×64** (`gate_ew`), **RGBA 8-bit**, przezroczyste tło |
| 2 kraty | PNG, dokładnie **32×32** px, **RGBA 8-bit**, przezroczyste prześwity między prętami |

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
  ],
  "fixtures": {
    "door_ns": ["door_ns.png"],
    "door_ew": ["door_ew.png"],
    "door_ns_grate": ["door_ns_grate.png"],
    "door_ew_grate": ["door_ew_grate.png"],
    "gate_ns": ["gate_ns.png"],
    "gate_ew": ["gate_ew.png"],
    "grate_ns": ["grate_ns.png"],
    "grate_ew": ["grate_ew.png"]
  }
}
```

Struktura jest **identyczna dla każdego podbiomu** — skopiuj plik i zmieniaj wyłącznie wagi i gęstości, jeśli materiał podbiomu tego wymaga. Nie przestawiaj kolejności i nie wymyślaj własnych kluczy.

Zasady, których nie wolno naruszyć:

- `tileSize` pisane **camelCase**. Nie `tile_size`, nie `size`, nie `tile`.
- Klucze w `roles` to **wyłącznie siedem ról kafli**: `floor`, `wall`, `obstacle_low`, `obstacle_high`, `pit`, `water`, `hazard`. Wszystkie siedem obowiązkowo, każda z pełnym kompletem wariantów z sekcji 4. `grate` jest ósmą rolą kafla, ale nie ma kafli płaskich i w `roles` się **nie pojawia** — jej grafiki siedzą w `fixtures`.
- **Zakazane klucze i wartości:** `deco`, `overlay`, `ground`, `blocking`, `void` jako role; `textures`, `objects`, `weight`, `light`, `palette`, `blob`, `neighbor_bits`, `wall_face_height` jako klucze. Nazwy warstw edytora nie są rolami kafli.
- Wartości w `roles` to **tablice wariantów**, w kolejności numeracji. Wariant to nazwa pliku albo obiekt `{ "file": "...", "weight": n }`, gdzie `weight` jest liczbą całkowitą 1–8. Obie formy można mieszać w jednej tablicy. Ścieżki względne do katalogu paczki, bez `./`, bez podkatalogów, bez ukośników.
- Każdy plik wymieniony w `tiles.json` musi istnieć w katalogu, i odwrotnie — każdy PNG w katalogu musi być wymieniony w `tiles.json`.
- W `blob47` dozwolone są wyłącznie klucze `wall`, `water` i `pit`. Każdy ma pole `masks` z dokładnie 47 pozycjami oraz arkusze: `sheets` z tablicą nazw przy `wall` i `water`, `sheet` z jedną nazwą przy `pit`. Obie formy czyta ten sam kod, więc `sheet` dalej działa w starszych paczkach — nowe generujemy według powyższego.
- `decals` to tablica obiektów `{ "file", "on", "density" }` z opcjonalnym `jitter`. `on` musi być rolą kafla, `density` liczbą z przedziału (0, 1]. Gęstości powyżej `0.15` traktuj jako błąd projektowy, nie jako mocniejszy efekt.
- `fixtures` ma dokładnie osiem kluczy: `door_ns`, `door_ew`, `door_ns_grate`, `door_ew_grate`, `gate_ns`, `gate_ew`, `grate_ns`, `grate_ew`, każdy z nazwą pliku albo tablicą wariantów. Inne klucze są pomijane z notatką. Brak `grate_ns` / `grate_ew` nie psuje wczytania — kraty rysują się wtedy jednolitym szarym paskiem, czyli tak samo nieprzezroczyście jak wygląda źle zrobiona krata, i tego właśnie nie wolno pomylić przy kontroli.
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

1. W katalogu jest dokładnie 40 plików i zero podkatalogów.
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
13. Przejścia mają właściwe rozmiary: cztery drzwi i dwie kraty 32×32, `gate_ns` 64×32, `gate_ew` 32×64, wszystkie z przezroczystym tłem poza framugą.
14. `grate_ns` i `door_ns_grate` mają 35–55% powierzchni kafla o zerowej alfie, a `grate_ew` i `door_ew_grate` 75–92%. Te przezroczyste piksele układają się w równo rozstawione prześwity między prętami, a nie w tło dookoła obiektu.
15. W `grate_ew` i `door_ew_grate` dziesięć skrajnych kolumn pikseli z lewej i dziesięć z prawej jest w pełni przezroczystych — żadnej szyny, oprawy ani progu wzdłuż boków, żadnego pręta dotykającego bocznej krawędzi. Kafel z szynami jest drabiną, nie kratą.
16. W `door_ew`, `door_ew_grate` i `gate_ew` pozioma linia poprowadzona przez środek otworu dochodzi od lewej krawędzi do prawej, nie trafiając w żaden piksel w jasności muru, a sam otwór nie jest ciemniejszy od kafli `floor` o więcej niż 10 punktów. Framuga zamknięta z czterech stron albo ciemna wnęka w środku znaczy właz w podłodze, nie przejście w ścianie.
17. Rozstaw prętów przechodzi przez krawędź kafla: dwie kraty tej samej orientacji położone wzdłuż muru — `ns` w poziomie, `ew` w pionie — dają jeden rytm, a `door_*_grate` wstawione między nie nie zgęszcza go ani nie rozrywa.
18. Średnia jasność kafli `wall` różni się od średniej jasności kafli `floor` o co najmniej 20 punktów w skali 0–100, a każda rola mieści się w swoim paśmie z sekcji 5.2.
19. W żadnym kaflu skrajny pierścień pikseli nie jest ciemniejszy od pierścienia obok o więcej niż 8 poziomów — poza krawędziami arkusza blob47, po których materiał się urywa, i poza kratami, których brzeg jest przezroczysty.
20. Wszystkie warianty jednej roli mają identyczne piksele na każdej z czterech krawędzi, więc dowolne dwa dają się położyć obok siebie bez przerwanej fugi.
21. `wall_blob47_a` i `wall_blob47_b` — i tak samo para wodna — są pocięte tak samo i trzymają maski w tej samej kolejności.

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
| Brak `fixtures` | drzwi, bramy i kraty rysowane jako kolorowa poprzeczka w otworze |
| Krata bez przezroczystych prześwitów | wczyta się i wygląda poprawnie, ale zasłania to, co gracz ma przez nią widzieć |
| `grate_ew` narysowana jako drabina | wczyta się bez słowa skargi; w grze pionowe kraty wyglądają jak drabina leżąca na podłodze |
| `door_ew` albo `gate_ew` z kamieniem dookoła otworu | wczyta się bez słowa skargi; w grze pionowe przejścia wyglądają jak właz albo klapa w podłodze |
| Brama w rozmiarze 32×32 | rozciągnięta na dwa kafle, czyli zniekształcona |
| `weight` spoza 1–8 | przycięte do zakresu, proporcje inne niż zamierzone |
| Dekal bez przezroczystego tła | kwadratowe łaty na podłodze |
| Dekal z rolą spoza listy | wpis pominięty, powód wypisany w panelu |
| `density` zbyt wysokie | dekal przestaje być akcentem i buduje wzór |
| `jitter` zbyt wysokie albo dekal bez zapasu przy krawędzi | dekal wychodzi na sąsiedni kafel |
