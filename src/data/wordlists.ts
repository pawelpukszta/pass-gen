/**
 * Polish word lists used by the memorable generators.
 *
 * Words keep their Polish spelling here; generators transliterate them to ASCII
 * (see deburr in lib/text.ts) and keep the original for the memory hint.
 *
 * Sentence template: [ADJ] SUBJECT [ADVERB] VERB [ADJ] OBJECT [PLACE] NUMBER
 * The grammatical categories are chosen so any random combination stays correct.
 *
 * When editing: avoid words that appear in the weak password list (they would be
 * rejected by the policy anyway), and
 * keep each list free of duplicates (tests enforce it after transliteration).
 */

/** Masculine adjectives in the nominative case. Used for the subject and the object of a sentence (205) */
export const ADJECTIVES: readonly string[] = [
  'rudy', 'zielony', 'niebieski', 'żółty', 'czerwony', 'fioletowy', 'różowy', 'srebrny', 'złoty',
  'brązowy', 'szary', 'biały', 'czarny', 'pomarańczowy', 'turkusowy', 'błękitny', 'granatowy',
  'stary', 'młody', 'mały', 'wielki', 'ogromny', 'malutki', 'gruby', 'chudy', 'wysoki', 'niski',
  'szybki', 'leniwy', 'pracowity', 'wesoły', 'smutny', 'dobry', 'sprytny', 'mądry', 'odważny',
  'nieśmiały', 'dumny', 'skromny', 'głośny', 'cichy', 'senny', 'głodny', 'syty', 'zmęczony',
  'radosny', 'ponury', 'zabawny', 'poważny', 'dziki', 'łagodny', 'groźny', 'puszysty', 'kudłaty',
  'łysy', 'brodaty', 'wąsaty', 'kolczasty', 'pręgowany', 'łaciaty', 'cętkowany', 'kosmaty',
  'lśniący', 'błyszczący', 'matowy', 'kwadratowy', 'okrągły', 'krzywy', 'płaski', 'kanciasty',
  'miękki', 'twardy', 'ciepły', 'zimny', 'gorący', 'mroźny', 'lodowy', 'ognisty', 'leśny', 'górski',
  'morski', 'polny', 'nocny', 'poranny', 'wieczorny', 'zimowy', 'jesienny', 'wiosenny',
  'tajemniczy', 'magiczny', 'kosmiczny', 'królewski', 'rycerski', 'piracki', 'elegancki', 'modny',
  'staroświecki', 'nowoczesny', 'drewniany', 'kamienny', 'żelazny', 'szklany', 'papierowy',
  'gumowy', 'plastikowy', 'wełniany', 'jedwabny', 'skórzany', 'aksamitny', 'porcelanowy',
  'miedziany', 'mosiężny', 'stalowy', 'ceglany', 'słomkowy', 'kryształowy', 'perłowy',
  'bursztynowy', 'cytrynowy', 'malinowy', 'miętowy', 'czekoladowy', 'waniliowy', 'kawowy',
  'pieprzny', 'słodki', 'kwaśny', 'gorzki', 'słony', 'pachnący', 'hałaśliwy', 'roztargniony',
  'uparty', 'ciekawski', 'gadatliwy', 'punktualny', 'spóźniony', 'elektryczny', 'mechaniczny',
  'latający', 'pływający', 'skaczący', 'śpiący', 'tańczący', 'śpiewający', 'uśmiechnięty',
  'zaspany', 'rozczochrany', 'pogodny', 'burzowy', 'mglisty', 'deszczowy', 'słoneczny',
  'księżycowy', 'gwiezdny', 'tęczowy', 'niewidzialny', 'sławny', 'uczony', 'zuchwały', 'dzielny',
  'waleczny', 'marmurowy', 'cynowy', 'ołowiany', 'lniany', 'bawełniany', 'zardzewiały',
  'wypolerowany', 'połatany', 'dziurawy', 'pognieciony', 'pasiasty', 'kraciasty', 'kropkowany',
  'włochaty', 'gładki', 'szorstki', 'lepki', 'śliski', 'chrupiący', 'puchaty', 'skrzydlaty',
  'rogaty', 'ogoniasty', 'zębaty', 'trzygłowy', 'dwugłowy', 'jednooki', 'stuletni', 'tysiącletni',
  'antyczny', 'barokowy', 'gotycki', 'cyfrowy', 'atomowy', 'turbo', 'parowy', 'nakręcany',
  'składany', 'nadmuchiwany', 'zaczarowany', 'przeklęty', 'szczęśliwy', 'pechowy',
];

/** Masculine animate nouns (nominative). Sentence subjects (213) */
export const SUBJECTS: readonly string[] = [
  'kot', 'pies', 'lis', 'wilk', 'borsuk', 'jeż', 'żółw', 'bóbr', 'dzik', 'łoś', 'żubr',
  'niedźwiedź', 'zając', 'chomik', 'królik', 'szczur', 'kret', 'słoń', 'tygrys', 'lew', 'gepard',
  'jaguar', 'nosorożec', 'hipopotam', 'krokodyl', 'wąż', 'smok', 'jednorożec', 'gryf', 'pingwin',
  'kruk', 'orzeł', 'sokół', 'jastrząb', 'bocian', 'wróbel', 'dzięcioł', 'puchacz', 'łabędź', 'paw',
  'indyk', 'kogut', 'osioł', 'koń', 'kucyk', 'wielbłąd', 'delfin', 'wieloryb', 'rekin', 'karp',
  'szczupak', 'pstrąg', 'homar', 'krab', 'ślimak', 'pająk', 'motyl', 'chrząszcz', 'komar',
  'trzmiel', 'świerszcz', 'pirat', 'rycerz', 'czarodziej', 'król', 'książę', 'smakosz', 'kowal',
  'piekarz', 'kucharz', 'ogrodnik', 'rybak', 'górnik', 'strażak', 'listonosz', 'malarz',
  'rzeźbiarz', 'poeta', 'pisarz', 'aktor', 'tancerz', 'żongler', 'klaun', 'magik', 'detektyw',
  'kapitan', 'marynarz', 'astronauta', 'kosmita', 'robot', 'cyborg', 'wampir', 'wilkołak',
  'krasnal', 'skrzat', 'olbrzym', 'troll', 'goblin', 'mnich', 'pustelnik', 'profesor', 'inżynier',
  'architekt', 'bibliotekarz', 'zegarmistrz', 'szewc', 'krawiec', 'cukiernik', 'barman', 'kelner',
  'pasterz', 'drwal', 'wędkarz', 'żeglarz', 'alpinista', 'narciarz', 'kolarz', 'bokser',
  'szachista', 'dziadek', 'wujek', 'sąsiad', 'kuzyn', 'bałwan', 'golem', 'bard', 'filozof',
  'alchemik', 'astronom', 'botanik', 'geolog', 'mechanik', 'hydraulik', 'elektryk', 'stolarz',
  'murarz', 'szeryf', 'kowboj', 'samuraj', 'wiking', 'gladiator', 'faraon', 'cesarz', 'sułtan',
  'admirał', 'generał', 'harcerz', 'lokaj', 'kamerdyner', 'dyrygent', 'organista', 'perkusista',
  'gitarzysta', 'trębacz', 'skrzypek', 'akrobata', 'linoskoczek', 'iluzjonista', 'kaskader',
  'nurek', 'grzybiarz', 'pszczelarz', 'leśniczy', 'gajowy', 'mleczarz', 'kominiarz', 'zdun',
  'garncarz', 'bednarz', 'młynarz', 'flisak', 'dudziarz', 'baca', 'juhas', 'gawędziarz',
  'wynalazca', 'odkrywca', 'kartograf', 'archeolog', 'paleontolog', 'meteorolog', 'chemik', 'fizyk',
  'matematyk', 'programista', 'bloger', 'reporter', 'fotograf', 'operator', 'reżyser',
  'scenarzysta', 'hodowca', 'treser', 'weterynarz', 'szop', 'tapir', 'pancernik', 'leniwiec',
  'mrówkojad', 'kangur', 'koala', 'kolibr', 'flaming', 'pelikan', 'albatros', 'mors', 'bizon',
  'jak', 'muflon', 'kozioł', 'baran', 'byk', 'wół',
];

/** Adverbs and short adverbial phrases (81) */
export const ADVERBS: readonly string[] = [
  'cicho', 'głośno', 'szybko', 'powoli', 'wesoło', 'smutno', 'dumnie', 'chytrze', 'sprytnie',
  'nieśmiało', 'odważnie', 'leniwie', 'starannie', 'niechlujnie', 'elegancko', 'zgrabnie',
  'niezdarnie', 'ostrożnie', 'ukradkiem', 'potajemnie', 'codziennie', 'wieczorem', 'nocą', 'rano',
  'wcześnie', 'późno', 'nagle', 'znowu', 'zawsze', 'czasem', 'rzadko', 'często', 'chętnie',
  'niechętnie', 'łapczywie', 'delikatnie', 'mocno', 'dokładnie', 'uroczyście', 'radośnie', 'ponuro',
  'tajemniczo', 'zawzięcie', 'spokojnie', 'nerwowo', 'pośpiesznie', 'dostojnie', 'figlarnie',
  'beztrosko', 'troskliwie', 'czule', 'gorliwie', 'sennie', 'dziarsko', 'żwawo', 'opieszale',
  'ochoczo', 'zuchwale', 'grzecznie', 'uprzejmie', 'bezszelestnie', 'z uśmiechem', 'w skupieniu',
  'po cichu', 'na ślepo', 'od niechcenia', 'z gracją', 'bez pośpiechu', 'w pośpiechu', 'dwa razy',
  'trzy razy', 'co wtorek', 'w sobotę', 'po obiedzie', 'przed snem', 'bez słowa', 'z namaszczeniem',
  'z zapałem', 'na raty', 'po kryjomu', 'w tajemnicy',
];

/** Transitive verbs in the 3rd person singular that take an accusative object (131) */
export const VERBS: readonly string[] = [
  'je', 'gryzie', 'liże', 'wącha', 'kupuje', 'sprzedaje', 'pożycza', 'gubi', 'znajduje', 'chowa',
  'ukrywa', 'niesie', 'ciągnie', 'pcha', 'toczy', 'rzuca', 'łapie', 'kopie', 'podnosi', 'trzyma',
  'ściska', 'głaszcze', 'myje', 'pierze', 'suszy', 'prasuje', 'czyści', 'poleruje', 'maluje',
  'rysuje', 'szkicuje', 'fotografuje', 'mierzy', 'waży', 'liczy', 'ogląda', 'podziwia', 'bada',
  'testuje', 'naprawia', 'buduje', 'konstruuje', 'rozkręca', 'składa', 'klei', 'szyje', 'pakuje',
  'rozpakowuje', 'wiezie', 'wozi', 'dźwiga', 'holuje', 'kradnie', 'przemyca', 'sadzi', 'podlewa',
  'zbiera', 'kroi', 'piecze', 'smaży', 'gotuje', 'grilluje', 'wędzi', 'soli', 'słodzi',
  'przyprawia', 'zamraża', 'rozmraża', 'ogrzewa', 'chłodzi', 'zapala', 'gasi', 'nakręca', 'stroi',
  'owija', 'zawija', 'rozwija', 'przytula', 'kołysze', 'huśta', 'zakopuje', 'odkopuje', 'śledzi',
  'tropi', 'obserwuje', 'wymyśla', 'projektuje', 'programuje', 'drukuje', 'skanuje', 'kopiuje',
  'ozdabia', 'dekoruje', 'przestawia', 'ustawia', 'wiesza', 'zdejmuje', 'wkłada', 'wyjmuje',
  'otwiera', 'zamyka', 'odkręca', 'zakręca', 'łata', 'ceruje', 'ostrzy', 'hartuje', 'kuje',
  'struga', 'hebluje', 'wierci', 'piłuje', 'szlifuje', 'lakieruje', 'spawa', 'lutuje', 'wynajmuje',
  'wypożycza', 'rekrutuje', 'szkoli', 'tresuje', 'hoduje', 'karmi', 'ratuje', 'porywa',
  'teleportuje', 'klonuje', 'zaczarowuje', 'odczarowuje', 'hipnotyzuje', 'kolekcjonuje',
];

/** Masculine inanimate nouns: accusative equals nominative, so "Kot je ser" stays grammatical (275) */
export const OBJECTS: readonly string[] = [
  'rower', 'ser', 'kapelusz', 'parasol', 'młotek', 'zegar', 'budzik', 'kubek', 'talerz', 'garnek',
  'czajnik', 'imbryk', 'dzbanek', 'widelec', 'nóż', 'kosz', 'koszyk', 'plecak', 'portfel',
  'długopis', 'ołówek', 'pędzel', 'zeszyt', 'notes', 'kalendarz', 'globus', 'kompas', 'teleskop',
  'mikroskop', 'magnes', 'klucz', 'zamek', 'łańcuch', 'sznurek', 'guzik', 'krawat', 'szalik',
  'sweter', 'płaszcz', 'kożuch', 'kalosz', 'pantofel', 'beret', 'cylinder', 'wachlarz', 'dywan',
  'fotel', 'stół', 'stołek', 'taboret', 'regał', 'kredens', 'materac', 'koc', 'ręcznik', 'obraz',
  'plakat', 'wazon', 'świecznik', 'żyrandol', 'kominek', 'piec', 'kaloryfer', 'wentylator',
  'odkurzacz', 'mikser', 'toster', 'telewizor', 'telefon', 'laptop', 'monitor', 'głośnik',
  'mikrofon', 'aparat', 'projektor', 'akordeon', 'bęben', 'flet', 'puzon', 'saksofon', 'klarnet',
  'fortepian', 'kontrabas', 'gong', 'dzwonek', 'tamburyn', 'ksylofon', 'gwizdek', 'latawiec',
  'balon', 'bumerang', 'klocek', 'bączek', 'miecz', 'sztylet', 'topór', 'łuk', 'kołczan', 'hełm',
  'pancerz', 'sztandar', 'proporzec', 'herb', 'kufer', 'sejf', 'diament', 'rubin', 'szafir',
  'szmaragd', 'bursztyn', 'kryształ', 'kamień', 'głaz', 'piasek', 'żwir', 'śnieg', 'lód', 'tort',
  'placek', 'sernik', 'piernik', 'makowiec', 'chleb', 'kisiel', 'budyń', 'dżem', 'miód', 'cukier',
  'pieprz', 'cynamon', 'imbir', 'czosnek', 'szczypiorek', 'koperek', 'groszek', 'kalafior',
  'kawior', 'rosół', 'barszcz', 'żurek', 'bigos', 'gulasz', 'omlet', 'sok', 'kompot', 'koktajl',
  'syrop', 'jogurt', 'kefir', 'twaróg', 'ryż', 'makaron', 'traktor', 'autobus', 'tramwaj', 'statek',
  'jacht', 'ponton', 'sterowiec', 'helikopter', 'skuter', 'motocykl', 'wózek', 'wagon', 'czołg',
  'spadochron', 'namiot', 'śpiwór', 'termos', 'cyrkiel', 'kalkulator', 'dysk', 'kabel',
  'przełącznik', 'akumulator', 'silnik', 'generator', 'wiatrak', 'młyn', 'kombajn', 'pług', 'sierp',
  'kilof', 'śrubokręt', 'pilnik', 'hebel', 'wałek', 'kubeł', 'lejek', 'durszlak', 'korkociąg',
  'otwieracz', 'tłuczek', 'moździerz', 'fartuch', 'rondel', 'półmisek', 'słoik', 'karton',
  'pakunek', 'list', 'liścik', 'bilet', 'paragon', 'rachunek', 'dokument', 'raport', 'wiersz',
  'sonet', 'scenariusz', 'komiks', 'album', 'słownik', 'atlas', 'katalog', 'zegarek', 'pierścień',
  'naszyjnik', 'wisior', 'medalion', 'order', 'puchar', 'medal', 'dyplom', 'pomnik', 'posąg',
  'obelisk', 'pałac', 'most', 'tunel', 'wieżowiec', 'ogród', 'park', 'labirynt', 'staw', 'kanał',
  'kaktus', 'storczyk', 'bukiet', 'wieniec', 'żołądź', 'kasztan', 'orzech', 'grzyb', 'kłos', 'snop',
  'stóg', 'kurnik', 'ul', 'płot', 'mur', 'komin', 'dach', 'balkon', 'taras', 'strych', 'korytarz',
  'hamak', 'leżak', 'pled', 'abażur', 'kandelabr', 'kałamarz', 'stempel', 'segregator', 'zszywacz',
  'dziurkacz', 'spinacz', 'tablet', 'joystick', 'pilot', 'router', 'serwer', 'procesor', 'chip',
];

/** Prepositional phrases describing where the action happens (98) */
export const PLACES: readonly string[] = [
  'na dachu', 'w lesie', 'pod mostem', 'nad rzeką', 'w piwnicy', 'na strychu', 'w kuchni',
  'w ogrodzie', 'na łące', 'w jaskini', 'na wieży', 'pod stołem', 'za szafą', 'w kosmosie',
  'na Księżycu', 'na Marsie', 'w operze', 'w teatrze', 'w kinie', 'w muzeum', 'w bibliotece',
  'na targu', 'w piekarni', 'w kuźni', 'w warsztacie', 'w garażu', 'na balkonie', 'w windzie',
  'na schodach', 'w tramwaju', 'w metrze', 'na dworcu', 'w porcie', 'na statku', 'w łodzi',
  'pod wodą', 'na dnie morza', 'w chmurach', 'na tęczy', 'w zamku', 'w lochu', 'w labiryncie',
  'w szklarni', 'w stodole', 'na farmie', 'w sadzie', 'w parku', 'na boisku', 'na lodowisku',
  'w saunie', 'pod prysznicem', 'w wannie', 'w łóżku', 'pod kocem', 'w szufladzie', 'w kieszeni',
  'na pustyni', 'w dżungli', 'na biegunie', 'w igloo', 'na wulkanie', 'w kraterze', 'na szczycie',
  'w dolinie', 'nad jeziorem', 'przy kominku', 'przy ognisku', 'o północy', 'o świcie',
  'o zmierzchu', 'we mgle', 'w śnieżycy', 'na karuzeli', 'w cyrku', 'na scenie', 'za kulisami',
  'w laboratorium', 'w obserwatorium', 'w latarni', 'na molo', 'w ulu', 'na drzewie', 'pod grzybem',
  'w akwarium', 'na trampolinie', 'w kosmodromie', 'w rakiecie', 'na kanapie', 'w spiżarni',
  'na poddaszu', 'w altanie', 'na rynku', 'w tunelu', 'pod kołdrą', 'na parapecie', 'w skrzyni',
  'w młynie', 'na moście',
];

/** Feminine and neuter nouns. Used only by the passphrase ("words") mode (259) */
export const EXTRA_NOUNS: readonly string[] = [
  'chmura', 'gwiazda', 'kometa', 'planeta', 'rakieta', 'lampa', 'latarnia', 'kawa', 'herbata',
  'cytryna', 'malina', 'truskawka', 'gruszka', 'śliwka', 'wiśnia', 'morela', 'brzoskwinia',
  'pomarańcza', 'oliwka', 'papryka', 'cebula', 'marchewka', 'rzodkiewka', 'dynia', 'cukinia',
  'fasola', 'kukurydza', 'pszenica', 'sowa', 'mewa', 'kaczka', 'gęś', 'kura', 'wiewiórka', 'sarna',
  'żyrafa', 'zebra', 'panda', 'foka', 'mrówka', 'pszczoła', 'biedronka', 'żaba', 'ryba', 'meduza',
  'ośmiornica', 'gitara', 'trąbka', 'harfa', 'perkusja', 'piosenka', 'melodia', 'opera', 'bajka',
  'legenda', 'zagadka', 'mapa', 'książka', 'gazeta', 'poczta', 'koperta', 'pieczątka', 'kreda',
  'tablica', 'ławka', 'szafa', 'szuflada', 'półka', 'sofa', 'kanapa', 'poduszka', 'kołdra',
  'firanka', 'zasłona', 'ściana', 'podłoga', 'brama', 'furtka', 'wieża', 'kopuła', 'kolumna',
  'piramida', 'latarka', 'świeca', 'zapałka', 'iskra', 'burza', 'tęcza', 'mgła', 'rosa', 'fala',
  'rzeka', 'wyspa', 'góra', 'dolina', 'polana', 'łąka', 'puszcza', 'jaskinia', 'skała', 'muszla',
  'perła', 'korona', 'tarcza', 'zbroja', 'flaga', 'kotwica', 'łódka', 'żaglówka', 'lokomotywa',
  'hulajnoga', 'deskorolka', 'piłka', 'rakietka', 'kula', 'kostka', 'szachownica', 'układanka',
  'lalka', 'maska', 'peleryna', 'czapka', 'rękawica', 'skarpeta', 'sukienka', 'spódnica', 'koszula',
  'kamizelka', 'torba', 'parasolka', 'lupa', 'waga', 'igła', 'nitka', 'szpulka', 'łyżka',
  'łyżeczka', 'miska', 'filiżanka', 'patelnia', 'butelka', 'puszka', 'beczka', 'skrzynia',
  'szkatułka', 'klatka', 'budka', 'chatka', 'jabłko', 'drzewo', 'krzesło', 'okno', 'lustro',
  'pióro', 'wiadro', 'siodło', 'koło', 'wiosło', 'kowadło', 'ognisko', 'jezioro', 'morze', 'niebo',
  'mleko', 'masło', 'ciasto', 'jajko', 'ziarno', 'nasiono', 'zboże', 'siano', 'sito', 'radio',
  'pianino', 'banjo', 'echo', 'kino', 'metro', 'igloo', 'mango', 'kakao', 'tango', 'lasso',
  'kimono', 'sombrero', 'bistro', 'studio', 'kasztanowiec', 'paproć', 'sosna', 'brzoza', 'wierzba',
  'topola', 'lipa', 'jodła', 'róża', 'tulipan', 'stokrotka', 'konwalia', 'pokrzywa', 'koniczyna',
  'wydma', 'laguna', 'zatoka', 'przystań', 'kaplica', 'katedra', 'twierdza', 'baszta', 'fontanna',
  'karuzela', 'huśtawka', 'zjeżdżalnia', 'trampolina', 'orkiestra', 'kapela', 'fanfara', 'ballada',
  'rapsodia', 'sonata', 'symfonia', 'kantata', 'polka', 'mazurka', 'kujawiak', 'lawina', 'zamieć',
  'ulewa', 'mżawka', 'rosomak', 'wydra', 'kuna', 'łasica', 'tchórzofretka', 'jaszczurka',
  'salamandra', 'traszka', 'ropucha', 'kijanka', 'krewetka', 'langusta', 'ostryga', 'rozgwiazda',
  'płaszczka', 'murena', 'barakuda', 'sardynka', 'makrela', 'flądra', 'wrona', 'sroka', 'sikorka',
  'zięba', 'jaskółka', 'czapla', 'kania', 'pustułka', 'sówka', 'kukułka',
];
