// ═══════════════════════════════════════════════════════════
//  VIA — Ancient World Explorer
//  data.js — Sites, Roads, ORBIS travel times
//
//  Quest tiers:
//    (none)            → Documented site
//    quest:"photo"     → Missing portrait photo in Pleiades
//    quest:"location"  → Unverified / approximate coordinates
//    quest:"text"      → Known only from ancient texts
//
//  rome_days → approximate civilian road travel time to Rome
//              in July (ORBIS model). Sea routes noted separately.
// ═══════════════════════════════════════════════════════════

const SITES_CURATED = [

  // ── ITALY ────────────────────────────────────────────────

  { id:"roma", name:"Roma", modern:"Rome, Italy", type:"capital", livius:"https://www.livius.org/articles/place/rome/", omnesviae:"https://omnesviae.org/#TPPlace1203",
    lat:41.8902, lng:12.4922, period:"753 BC – AD 476", pleiades:"423025", rome_days:0,
    desc:"The Eternal City. Capital of the Republic and then the Empire, Rome grew from a cluster of Latin villages on the Tiber to command the known world. At its height over a million people lived within its walls — the largest city in the western world for more than a millennium. The Forum, Colosseum, Pantheon, and miles of aqueducts remain." },

  { id:"ostia", name:"Ostia", modern:"Ostia Antica, Italy", type:"port", livius:"https://www.livius.org/articles/place/ostia/", omnesviae:"https://omnesviae.org/#TPPlace1428",
    lat:41.7565, lng:12.2947, period:"4th c. BC – 5th c. AD", pleiades:"422995", rome_days:1,
    desc:"Rome's harbor city at the mouth of the Tiber, handling the grain supply that fed the capital. At its peak it held 100,000 people. Remarkably preserved apartment blocks, warehouses, a theater, baths, and temples give the clearest picture of everyday Roman urban life outside Pompeii." },

  { id:"tibur", name:"Tibur", modern:"Tivoli, Italy", type:"city", omnesviae:"https://omnesviae.org/#TPPlace1306",
    lat:41.9630, lng:12.7983, period:"7th c. BC – present", pleiades:"423081", rome_days:1,
    desc:"A hillside resort town beloved by the Roman aristocracy, Tibur is most famous for Hadrian's Villa — the largest and most opulent imperial residence ever built, covering 120 hectares with replicas of monuments from across the empire. The circular Temple of Vesta on its cliff above the waterfall is one of antiquity's most photographed images." },

  { id:"pompeii", name:"Pompeii", modern:"Pompeii, Italy", type:"city", livius:"https://www.livius.org/articles/place/pompeii/", omnesviae:"https://omnesviae.org/#TPPlace1476",
    lat:40.7506, lng:14.4868, period:"7th c. BC – AD 79", pleiades:"433032", rome_days:4,
    desc:"Frozen the instant Vesuvius erupted on 24 August AD 79, Pompeii is Rome's most complete time capsule. Streets, bakeries, thermopolia, baths, brothels, temples — even graffiti on the walls and food left on stovetops — survive under the ash. Over a third of the city remains unexcavated." },

  { id:"herculaneum", name:"Herculaneum", modern:"Ercolano, Italy", type:"city", omnesviae:"https://omnesviae.org/#TPPlace1474",
    lat:40.8061, lng:14.3478, period:"8th c. BC – AD 79", pleiades:"432873", rome_days:4,
    desc:"Buried by the same eruption as Pompeii but engulfed by pyroclastic surge, Herculaneum's organic materials — wooden furniture, food, papyrus scrolls — survived in extraordinary condition. A wealthy seaside resort whose excavated streets are among the most atmospheric Roman remains in existence." },

  { id:"baiae", name:"Baiae", modern:"Bacoli, Italy", type:"city", omnesviae:"https://omnesviae.org/#TPPlace1472",
    lat:40.8426, lng:14.0733, period:"2nd c. BC – 8th c. AD", pleiades:"432649", rome_days:5,
    quest:"photo",
    desc:"The most fashionable seaside resort in the Roman world, Baiae attracted emperors and aristocrats seeking pleasure, hot springs, and debauchery. Julius Caesar, Augustus, Nero, and Hadrian all kept villas here. Much of ancient Baiae has sunk beneath the Bay of Naples due to volcanic activity — its ruins are now explored by divers." },

  { id:"puteoli", name:"Puteoli", modern:"Pozzuoli, Italy", type:"port", omnesviae:"https://omnesviae.org/#TPPlace1473",
    lat:40.8264, lng:14.1204, period:"6th c. BC – present", pleiades:"432812", rome_days:5,
    desc:"Before Ostia was developed, Puteoli was Rome's primary port for eastern trade — grain from Egypt, spices from Arabia, goods from across the Mediterranean all passed through here. Paul the Apostle landed at Puteoli on his way to Rome. The amphitheater is among the best preserved in Italy." },

  { id:"cumae", name:"Cumae", modern:"Cuma, Italy", type:"city", livius:"https://www.livius.org/articles/place/cumae/", omnesviae:"https://omnesviae.org/#TPPlace1470",
    lat:40.8479, lng:14.0545, period:"8th c. BC – Byzantine", pleiades:"432808", rome_days:5,
    quest:"photo",
    desc:"The oldest Greek colony in the western Mediterranean (8th century BC), Cumae was home to the famous Cumaean Sibyl — the prophetess whose cave can still be entered today. Aeneas visited her here, according to Virgil. The cave's long vaulted tunnel cut through the volcanic rock is one of antiquity's most evocative spaces." },

  { id:"capua", name:"Capua", modern:"Santa Maria Capua Vetere, Italy", type:"city", livius:"https://www.livius.org/articles/place/capua/", omnesviae:"https://omnesviae.org/#TPPlace1456",
    lat:41.0854, lng:14.2126, period:"7th c. BC – present", pleiades:"432754", rome_days:3,
    desc:"Ancient Capua was Rome's second most important city — so wealthy that Hannibal wintered his army here. The gladiatorial school was where Spartacus launched his great slave revolt in 73 BC. The amphitheater, second in size only to the Colosseum, still dominates the modern town." },

  { id:"neapolis", name:"Neapolis", modern:"Naples, Italy", type:"city", livius:"https://www.livius.org/articles/place/naples/", omnesviae:"https://omnesviae.org/#TPPlace2042",
    lat:40.8518, lng:14.2681, period:"8th c. BC – present", pleiades:"433014", rome_days:4,
    desc:"Founded by Greek colonists, Neapolis retained its Greek language and culture throughout the Roman period. Augustus spent his last days here; Nero performed on its stage; Virgil was buried on its outskirts. The street grid of the ancient Greek city still underlies central Naples." },

  { id:"paestum", name:"Paestum", modern:"Paestum, Italy", type:"city", omnesviae:"https://omnesviae.org/#TPPlace1480",
    lat:40.4218, lng:15.0042, period:"7th c. BC – Medieval", pleiades:"442733", rome_days:6,
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/View%20of%20Paestum%20with%20dji.jpg", credit:"PaestumPaestum", license:"CC BY-SA 4.0" },
    desc:"Three Greek temples standing in near-perfect condition in a coastal plain south of Naples — among the best-preserved Greek temples anywhere in the world. The Temple of Neptune (actually Hera) is particularly magnificent. The site museum holds the unique Tomb of the Diver, with its extraordinary painted ceiling." },

  { id:"brundisium", name:"Brundisium", modern:"Brindisi, Italy", type:"port", omnesviae:"https://omnesviae.org/#TPPlace1375",
    lat:40.6326, lng:17.9399, period:"4th c. BC – present", pleiades:"442573", rome_days:8,
    desc:"The great terminus of the Via Appia and Rome's gateway to Greece and the East. Virgil died here in 19 BC returning ill from Greece. The column marking the end of the Via Appia — 580 Roman miles from Rome — still stands near the harbor." },

  { id:"tarentum", name:"Tarentum", modern:"Taranto, Italy", type:"city", livius:"https://www.livius.org/articles/place/tarentum/", omnesviae:"https://omnesviae.org/#TPPlace1380",
    lat:40.4764, lng:17.2394, period:"8th c. BC – present", pleiades:"442789", rome_days:7,
    desc:"One of the great cities of Magna Graecia, Tarentum was famous for its harbor, purple-dyed textiles, and philosophers. Archytas — mathematician, statesman, and friend of Plato — governed here. The city became a key Roman port and naval base in southern Italy." },

  { id:"aquileia", name:"Aquileia", modern:"Aquileia, Italy", type:"city", livius:"https://www.livius.org/articles/place/aquileia/", omnesviae:"https://omnesviae.org/#TPPlace978",
    lat:45.7713, lng:13.3672, period:"181 BC – 5th c. AD", pleiades:"187290", rome_days:6,
    desc:"Rome's northeastern gateway, Aquileia grew into one of the largest cities of the western empire. The early Christian basilica preserves the finest 4th-century mosaic floor in existence — over 760 square meters. Attila the Hun destroyed it in 452 AD; refugees founded Venice in the lagoons to the west." },

  { id:"mediolanum", name:"Mediolanum", modern:"Milan, Italy", type:"capital", livius:"https://www.livius.org/articles/place/mediolanum-milan/", omnesviae:"https://omnesviae.org/#OVPlace413",
    lat:45.4654, lng:9.1900, period:"400 BC – present", pleiades:"138220", rome_days:7,
    desc:"Western capital of the Roman Empire from 286 to 402 AD. Constantine issued the Edict of Milan here in 313 AD, ending the persecution of Christians. The columns of San Lorenzo survive from a 4th-century imperial bath complex beneath the modern city." },

  { id:"ravenna", name:"Ravenna", modern:"Ravenna, Italy", type:"capital", livius:"https://www.livius.org/articles/place/ravenna/", omnesviae:"https://omnesviae.org/#TPPlace1140",
    lat:44.4184, lng:12.1991, period:"2nd c. BC – 8th c. AD", pleiades:"393480", rome_days:4,
    desc:"The final capital of the Western Roman Empire, chosen for its impenetrable marshes. The mosaics of Ravenna — in the Mausoleum of Galla Placidia, the Baptisteries, and Sant'Apollinare Nuovo — are among the greatest works of late antique art in existence." },

  { id:"ariminium", name:"Ariminium", modern:"Rimini, Italy", type:"city", omnesviae:"https://omnesviae.org/#TPPlace1144",
    lat:44.0647, lng:12.3376, period:"268 BC – present", pleiades:"413213", rome_days:4,
    desc:"An important colony at the junction of the Via Flaminia and Via Aemilia. The Arch of Augustus (27 BC) and the Tiberius Bridge (AD 14–21) still stand and are among Italy's best-preserved Roman monuments." },

  { id:"syracusae", name:"Syracusae", modern:"Syracuse, Sicily, Italy", type:"city", livius:"https://www.livius.org/articles/place/syracuse/", omnesviae:"https://omnesviae.org/#TPPlace1511",
    lat:37.0682, lng:15.2866, period:"734 BC – present", pleiades:"462503", rome_days:12,
    desc:"Once the largest Greek city in the world, Syracuse fell to Rome in 212 BC after a two-year siege in which Archimedes deployed his war machines. The Greek theater carved from living rock is still used for performances. The vast limestone quarries where Athenian prisoners rotted after 413 BC are unforgettable." },

  { id:"agrigentum", name:"Agrigentum", modern:"Agrigento, Sicily, Italy", type:"city", livius:"https://www.livius.org/articles/place/acragas-agrigento/", omnesviae:"https://omnesviae.org/#TPPlace1507",
    lat:37.3083, lng:13.5899, period:"6th c. BC – present", pleiades:"462086", rome_days:14,
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Agrigento%204m1.jpg", credit:"jschoenhofer", license:"CC BY-SA 2.0" },
    desc:"The Valley of the Temples at Agrigentum contains seven Greek temples in various states of preservation, including the magnificent Temple of Concordia — one of the best-preserved Doric temples in the world. Pindar called Agrigentum 'the finest city of mortals'. The Roman novelist Pirandello was born here." },

  // ── GAUL & HISPANIA ──────────────────────────────────────

  { id:"lugdunum", name:"Lugdunum", modern:"Lyon, France", type:"capital", livius:"https://www.livius.org/articles/place/lugdunum-lyon/", omnesviae:"https://omnesviae.org/#TPPlace730",
    lat:45.7640, lng:4.8357, period:"43 BC – present", pleiades:"167717", rome_days:14,
    desc:"Founded in 43 BC, Lugdunum became the capital of the Three Gauls and one of the most important cities of the western empire. The Roman theater and odeon on the Fourvière hill are still used for concerts. Emperors Claudius and Caracalla were born here." },

  { id:"arelate", name:"Arelate", modern:"Arles, France", type:"city", livius:"https://www.livius.org/articles/place/arelate-arles/", omnesviae:"https://omnesviae.org/#TPPlace1516",
    lat:43.6767, lng:4.6278, period:"1st c. BC – present", pleiades:"148217", rome_days:16,
    desc:"Julius Caesar's favored port on the Rhône delta. The amphitheater — still used for bullfights — and theater are among the finest Roman monuments in France. Emperor Constantine held court here. Van Gogh painted his most celebrated works in these same ancient streets." },

  { id:"nemausus", name:"Nemausus", modern:"Nîmes, France", type:"city", livius:"https://www.livius.org/articles/place/nemausus-nimes/",
    lat:43.8367, lng:4.3601, period:"1st c. BC – present", pleiades:"148142", rome_days:17,
    desc:"The Maison Carrée — a complete Roman temple — stands virtually intact after 2,000 years. The amphitheater still hosts events. The nearby Pont du Gard, a three-tiered aqueduct bridge carrying water 50km to the city, is one of the great engineering achievements of antiquity." },

  { id:"massilia", name:"Massilia", modern:"Marseille, France", type:"port",
    lat:43.2965, lng:5.3698, period:"600 BC – present", pleiades:"148107", rome_days:16,
    desc:"Greece's greatest western colony, founded by Phocaean sailors around 600 BC. Massilia's explorers included Pytheas, who reached Britain and possibly Iceland. Julius Caesar besieged it in 49 BC for backing Pompey. Continuously inhabited for 2,600 years." },

  { id:"narbo", name:"Narbo Martius", modern:"Narbonne, France", type:"city", livius:"https://www.livius.org/articles/place/narbo-narbonne/", omnesviae:"https://omnesviae.org/#TPPlace766",
    lat:43.1833, lng:3.0000, period:"118 BC – present", pleiades:"246347", rome_days:19,
    desc:"Rome's first colony in Gaul (118 BC) and capital of Gallia Narbonensis. Augustus reportedly considered it as an alternative capital. The vast underground horreum — a Roman warehouse complex — is preserved beneath the city." },

  { id:"augustodunum", name:"Augustodunum", modern:"Autun, France", type:"city", omnesviae:"https://omnesviae.org/#TPPlace658",
    lat:46.9521, lng:4.2992, period:"15 BC – present", pleiades:"177460", rome_days:18,
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Autun%20theatre%202.jpg", credit:"Christophe.Finot", license:"CC BY-SA 1.0" },
    desc:"Founded by Augustus to replace the nearby Gallic capital of Bibracte, Augustodunum was planned as a showpiece of Roman urbanism in Gaul. Two Roman gates — the Porte d'Arroux and Porte Saint-André — still stand to nearly full height, among the best-preserved city gates in the Roman world." },

  { id:"burdigala", name:"Burdigala", modern:"Bordeaux, France", type:"city", omnesviae:"https://omnesviae.org/#TPPlace697",
    lat:44.8378, lng:-0.5800, period:"1st c. BC – present", pleiades:"138231", rome_days:22,
    desc:"A prosperous river port in Aquitania, Burdigala grew wealthy on wine and Atlantic trade. The Roman amphitheater (Palais Gallien) survives in the city center. The poet Ausonius, tutor to the Emperor Gratian and later his chief minister, was born and died here." },

  { id:"caesaraugusta", name:"Caesaraugusta", modern:"Zaragoza, Spain", type:"city", livius:"https://www.livius.org/articles/place/caesaraugusta/", omnesviae:"https://omnesviae.org/#OVPlace40",
    lat:41.6488, lng:-0.8773, period:"14 BC – present", pleiades:"246349", rome_days:25,
    desc:"Founded by Augustus and named after himself, Caesaraugusta on the Ebro was a major veteran colony and road hub. The Roman forum, port, baths, and theater have been extensively excavated; four Roman museums now display the city's ancient remains." },

  { id:"emerita", name:"Emerita Augusta", modern:"Mérida, Spain", type:"capital", livius:"https://www.livius.org/articles/place/augusta-emerita/", omnesviae:"https://omnesviae.org/#OVPlace124",
    lat:38.9167, lng:-6.3416, period:"25 BC – present", pleiades:"256155", rome_days:28,
    desc:"Capital of Lusitania, founded for veterans of the Cantabrian Wars. Mérida possesses the most impressive collection of Roman monuments in Spain: a theater still staging performances, an amphitheater, two aqueducts, a bridge over the Guadiana still in use, and a Roman dam." },

  { id:"hispalis", name:"Hispalis", modern:"Seville, Spain", type:"city", omnesviae:"https://omnesviae.org/#OVPlace209",
    lat:37.3891, lng:-5.9999, period:"8th c. BC – present", pleiades:"256210", rome_days:29,
    desc:"Major river port and trading hub of Baetica — Rome's most prosperous Iberian province. Olive oil, wine, and garum from Baetica traveled the world in amphorae. Emperor Trajan was born just 9km away at Italica, where spectacular mosaics survive." },

  { id:"gades", name:"Gades", modern:"Cádiz, Spain", type:"port", omnesviae:"https://omnesviae.org/#OVPlace202",
    lat:36.5297, lng:-6.2936, period:"1100 BC – present", pleiades:"256177", rome_days:31,
    desc:"One of the oldest cities in Western Europe, founded by Phoenicians around 1100 BC at the edge of the known world. Under Rome it became wealthy from Atlantic trade and tuna fishing. The Gaditanae dancing girls were famous throughout the empire for their sinuous performances at aristocratic dinner parties." },

  { id:"carthagonova", name:"Carthago Nova", modern:"Cartagena, Spain", type:"port", livius:"https://www.livius.org/articles/place/carthago-nova-cartagena/", omnesviae:"https://omnesviae.org/#OVPlace257",
    lat:37.6007, lng:-0.9862, period:"227 BC – present", pleiades:"265849", rome_days:27,
    desc:"Founded by Carthage and taken by Scipio Africanus in 209 BC, Carthago Nova became Rome's most important mining and naval center in Hispania. The silver mines produced enormous wealth. The Roman theater, recently excavated and restored, is stunning." },

  // ── BRITAIN ──────────────────────────────────────────────

  { id:"londinium", name:"Londinium", modern:"London, UK", type:"capital", livius:"https://www.livius.org/articles/place/londinium/", omnesviae:"https://omnesviae.org/#OVPlace427",
    lat:51.5074, lng:-0.0903, period:"AD 43 – present", pleiades:"79574", rome_days:28,
    desc:"Established after the Claudian invasion of 43 AD, Londinium quickly became Britain's capital. Boudica burned it to the ground in 60 AD — the charred layer is still found in excavations beneath the City. The Roman wall defines the boundaries of the modern financial district. The London Mithraeum can be visited today." },

  { id:"eboracum", name:"Eboracum", modern:"York, UK", type:"fortress", omnesviae:"https://omnesviae.org/#OVPlace396",
    lat:53.9591, lng:-1.0803, period:"AD 71 – present", pleiades:"89175", rome_days:33,
    desc:"Founded as a legionary fortress in 71 AD, Eboracum became the effective capital of northern Britain. Emperor Septimius Severus died here in 211 AD. Constantine the Great was proclaimed Emperor at Eboracum in 306 AD. The Multangular Tower survives from the Roman fortification." },

  { id:"aquaesulis", name:"Aquae Sulis", modern:"Bath, UK", type:"city", livius:"https://www.livius.org/articles/place/aquae-sulis/", omnesviae:"https://omnesviae.org/#OVPlace477",
    lat:51.3837, lng:-2.3591, period:"1st c. AD – present", pleiades:"79420", rome_days:31,
    desc:"Built around Britain's only naturally hot springs, Aquae Sulis was a sacred healing spa dedicated to the goddess Sulis Minerva. The Roman baths are the best-preserved bathing complex in northern Europe, still fed by the same thermal spring that pumps 1.3 million liters daily at 46°C." },

  { id:"camulodunum", name:"Camulodunum", modern:"Colchester, UK", type:"city", livius:"https://www.livius.org/articles/place/camulodunum/", omnesviae:"https://omnesviae.org/#TPPlace542",
    lat:51.8855, lng:0.8988, period:"1st c. BC – present", pleiades:"79350", rome_days:29,
    desc:"The first Roman capital of Britannia and site of Britain's first Roman temple — dedicated to the deified Claudius. Boudica destroyed Camulodunum in 60 AD, massacring its inhabitants; the burnt layer is visible in excavations. The circuit of Roman walls largely survives." },

  { id:"isca", name:"Isca Silurum", modern:"Caerleon, Wales, UK", type:"fortress", livius:"https://www.livius.org/articles/place/isca/", omnesviae:"https://omnesviae.org/#OVPlace463",
    lat:51.6086, lng:-2.9534, period:"AD 75 – 4th c. AD", pleiades:"79388", rome_days:32,
    quest:"photo",
    desc:"One of only three permanent legionary fortresses in Roman Britain (alongside Eboracum and Deva), Isca housed the Legio II Augusta for over 200 years. The amphitheater — the best-preserved Roman amphitheater in Britain — the baths, and the barracks are all visible. Tennyson set his Arthurian legends here." },

  { id:"housesteads", name:"Vercovicium", modern:"Housesteads, Northumberland, UK", type:"fortress", livius:"https://www.livius.org/articles/place/vercovicium/",
    lat:55.0091, lng:-2.3285, period:"AD 124 – 4th c. AD", pleiades:"89311", rome_days:35,
    desc:"The most complete Roman fort in Britain, garrisoning 800 soldiers on the crest of Hadrian's Wall. Troops recruited from Belgium, Frisia, and Spain stood watch against the unconquered north. The barrack blocks, granaries, hospital, and headquarters building are all visible. The view from the Wall is one of the most atmospheric in Roman Britain." },

  { id:"luguvallium", name:"Luguvallium", modern:"Carlisle, UK", type:"fortress", livius:"https://www.livius.org/articles/place/luguvallium/", omnesviae:"https://omnesviae.org/#OVPlace402",
    lat:54.8925, lng:-2.9389, period:"AD 72 – present", pleiades:"89234", rome_days:36,
    quest:"photo",
    desc:"A key supply depot and fort on the western end of Hadrian's Wall, Luguvallium controlled the western approach to the frontier. Recent excavations beneath Carlisle Cathedral have revealed extraordinary Roman remains, including a writing tablet that sheds new light on the garrison's daily life." },

  // ── DANUBE FRONTIER ──────────────────────────────────────

  { id:"vindobona", name:"Vindobona", modern:"Vienna, Austria", type:"fortress", livius:"https://www.livius.org/articles/place/vindobona-vienna/", omnesviae:"https://omnesviae.org/#TPPlace1542",
    lat:48.2082, lng:16.3738, period:"1st c. AD – present", pleiades:"128537", rome_days:14,
    desc:"A legionary fortress on the Danube frontier, home to the Legio X Gemina. Emperor Marcus Aurelius died here in March 180 AD, still campaigning against the Germanic Marcomanni — he had been writing his Meditations on this very frontier." },

  { id:"carnuntum", name:"Carnuntum", modern:"Bad Deutsch-Altenburg, Austria", type:"fortress", livius:"https://www.livius.org/articles/place/carnuntum-petronell/", omnesviae:"https://omnesviae.org/#TPPlace1545",
    lat:48.1152, lng:16.8647, period:"1st c. AD – 4th c. AD", pleiades:"128376", rome_days:15,
    desc:"One of the great Danubian fortresses, at its peak housing 50,000 soldiers and civilians. Marcus Aurelius commanded his campaigns from here. Septimius Severus was proclaimed emperor by his legions at Carnuntum in 193 AD. The reconstructed quarter gives a vivid impression of frontier life." },

  { id:"aquincum", name:"Aquincum", modern:"Budapest, Hungary", type:"fortress", livius:"https://www.livius.org/articles/place/aquincum/", omnesviae:"https://omnesviae.org/#TPPlace1554",
    lat:47.5741, lng:19.0402, period:"1st c. AD – 4th c. AD", pleiades:"197140", rome_days:17,
    desc:"Legionary fortress and capital of Pannonia Inferior in what is now Óbuda (Old Buda). Emperor Hadrian served here as governor before his accession. Budapest's famous thermal baths trace their origin to Roman bathing culture on this site." },

  { id:"sirmium", name:"Sirmium", modern:"Sremska Mitrovica, Serbia", type:"capital", livius:"https://www.livius.org/articles/place/sirmium-sremska-mitrovica/", omnesviae:"https://omnesviae.org/#TPPlace1657",
    lat:44.9667, lng:19.6167, period:"1st c. BC – 5th c. AD", pleiades:"207505", rome_days:14,
    quest:"photo",
    desc:"One of four co-capitals of the late Roman Empire, Sirmium was the most fought-over city of the 3rd and 4th centuries — nine emperors were born, lived, or died here. Called 'Mother of Cities' and 'Mistress of the World'. Extensive excavations continue beneath the modern town." },

  { id:"naissus", name:"Naissus", modern:"Niš, Serbia", type:"city", omnesviae:"https://omnesviae.org/#TPPlace1784",
    lat:43.3216, lng:21.8960, period:"1st c. BC – present", pleiades:"207306", rome_days:20,
    quest:"photo",
    desc:"Birthplace of Emperor Constantine the Great (c. 272 AD), who was proclaimed emperor at Eboracum but transformed the Roman world from his birthplace's province. Constantine's victory over Licinius at Naissus in 316 AD opened the path to sole rule. The city's Roman remains are surprisingly little-visited." },

  { id:"singidunum", name:"Singidunum", modern:"Belgrade, Serbia", type:"fortress", livius:"https://www.livius.org/articles/place/singidunum-belgrade/", omnesviae:"https://omnesviae.org/#TPPlace1648",
    lat:44.8176, lng:20.4633, period:"1st c. AD – present", pleiades:"207447", rome_days:16,
    quest:"location",
    desc:"A legionary fortress at the confluence of the Sava and Danube rivers — one of the most strategically important positions on the entire frontier. Emperor Jovian was born here. The Roman remains lie beneath modern Belgrade, with some visible in the Kalemegdan fortress." },

  // ── GREECE & BALKANS ─────────────────────────────────────

  { id:"athenae", name:"Athenae", modern:"Athens, Greece", type:"city", livius:"https://www.livius.org/articles/place/athens/", omnesviae:"https://omnesviae.org/#TPPlace2401",
    lat:37.9715, lng:23.7267, period:"3rd mill. BC – present", pleiades:"579885", rome_days:24,
    desc:"The intellectual capital of the ancient world, Athens retained immense cultural prestige under Roman rule. Emperor Hadrian was besotted with the city, constructing his own arch, a library, and completing the vast Temple of Olympian Zeus begun 700 years earlier. The Parthenon, Agora, and Theater of Dionysus are all accessible." },

  { id:"corinthus", name:"Corinthus", modern:"Corinth, Greece", type:"city", livius:"https://www.livius.org/articles/place/corinth/", omnesviae:"https://omnesviae.org/#TPPlace1893",
    lat:37.9084, lng:22.8825, period:"8th c. BC – present", pleiades:"570182", rome_days:23,
    desc:"Destroyed by Rome in 146 BC and rebuilt by Julius Caesar in 44 BC as a Roman colony, Corinthus became the wealthiest city in Greece under Roman rule. Paul the Apostle spent 18 months here and wrote two epistles to its contentious Christian community. The Temple of Apollo and the excavated Agora are well preserved." },

  { id:"delphi", name:"Delphi", modern:"Delphi, Greece", type:"city", livius:"https://www.livius.org/articles/place/delphi/",
    lat:38.4824, lng:22.5010, period:"8th c. BC – 4th c. AD", pleiades:"540726", rome_days:25,
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Delfi%20Apollons%20tempel.jpg", credit:"Helen Simonsson", license:"CC BY-SA 3.0" },
    desc:"The navel of the world according to Greek belief, Delphi was the most sacred oracle site in the ancient Mediterranean. Roman emperors consulted the oracle — and plundered its treasuries. The Sacred Way, the Temple of Apollo, the theater, and the stadium climb up the dramatic mountain slope above the Gulf of Corinth." },

  { id:"thessalonica", name:"Thessalonica", modern:"Thessaloniki, Greece", type:"city", livius:"https://www.livius.org/articles/place/thessaloniki/", omnesviae:"https://omnesviae.org/#TPPlace1836",
    lat:40.6401, lng:22.9444, period:"315 BC – present", pleiades:"491741", rome_days:22,
    desc:"Capital of Macedonia and the Via Egnatia's greatest city. The Arch of Galerius and the Rotunda — originally Galerius's mausoleum, now a UNESCO site — are magnificent monuments of the Tetrarchic period. Paul the Apostle wrote two letters to its Christian community." },

  { id:"byzantium", name:"Byzantium / Constantinople", modern:"Istanbul, Turkey", type:"capital", livius:"https://www.livius.org/articles/place/constantinople-istanbul/", omnesviae:"https://omnesviae.org/#TPPlace2082",
    lat:41.0082, lng:28.9784, period:"660 BC – present", pleiades:"520998", rome_days:28,
    desc:"Founded by Greek colonists at the crossroads of Europe and Asia. Constantine refounded it as his 'New Rome' in 330 AD. The Hagia Sophia, Hippodrome, and land walls of Theodosius define a city that served as capital of the Roman-Byzantine Empire for over a thousand years after Rome itself fell." },

  // ── ASIA MINOR ───────────────────────────────────────────

  { id:"nicaea", name:"Nicaea", modern:"İznik, Turkey", type:"city", livius:"https://www.livius.org/articles/place/nicaea-iznik/", omnesviae:"https://omnesviae.org/#TPPlace1849",
    lat:40.4333, lng:29.7167, period:"3rd c. BC – Byzantine", pleiades:"511366", rome_days:27,
    quest:"photo",
    desc:"Site of the First Council of Nicaea (325 AD), where Emperor Constantine convened 300 bishops to define Christian orthodoxy and produce the Nicene Creed — one of the most consequential meetings in world history. The beautifully preserved Roman walls and gates, the lakeshore setting, and the ruins of Hagia Sophia (an earlier one than Istanbul's) make Nicaea deeply atmospheric and remarkably undervisited." },

  { id:"ephesus", name:"Ephesus", modern:"Selçuk, Turkey", type:"city", livius:"https://www.livius.org/articles/place/ephesus/", omnesviae:"https://omnesviae.org/#TPPlace2187",
    lat:37.9364, lng:27.3418, period:"10th c. BC – 15th c. AD", pleiades:"599612", rome_days:24,
    desc:"One of the great cities of antiquity and capital of the Roman province of Asia, Ephesus had a population of 250,000. The Temple of Artemis was one of the Seven Wonders. The Library of Celsus, the Terrace Houses with their stunning mosaics, and the 25,000-seat theater make this the best-preserved Roman city in the eastern Mediterranean." },

  { id:"pergamon", name:"Pergamon", modern:"Bergama, Turkey", type:"city", livius:"https://www.livius.org/articles/place/pergamon/", omnesviae:"https://omnesviae.org/#TPPlace2204",
    lat:39.1333, lng:27.1833, period:"3rd c. BC – Byzantine", pleiades:"550812", rome_days:26,
    desc:"Capital of the Attalid kingdom, Pergamon was famous for its library (second only to Alexandria), its Altar of Zeus (now in Berlin), and the Asclepion — the ancient world's most celebrated healing center, where the physician Galen trained. The acropolis theatre, cut dramatically into the cliff, is breathtaking." },

  { id:"smyrna", name:"Smyrna", modern:"İzmir, Turkey", type:"city", livius:"https://www.livius.org/articles/place/smyrna-izmir/", omnesviae:"https://omnesviae.org/#TPPlace2190",
    lat:38.4189, lng:27.1403, period:"11th c. BC – present", pleiades:"550771", rome_days:25,
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Izmir016.jpg", credit:"Georges Jansoone JoJan", license:"Public domain" },
    desc:"One of the great cities of Roman Asia, Smyrna competed fiercely with Ephesus and Pergamon for the title of 'First City of Asia'. The bishop Polycarp was martyred here in 155 AD. Little of the ancient city survives beneath modern İzmir, but the Agora — recently re-excavated — is exceptional." },

  { id:"ancyra", name:"Ancyra", modern:"Ankara, Turkey", type:"capital", livius:"https://www.livius.org/articles/place/ancyra-ankara/", omnesviae:"https://omnesviae.org/#TPPlace2139",
    lat:39.9334, lng:32.8597, period:"3rd c. BC – present", pleiades:"619103", rome_days:30,
    desc:"Capital of the province of Galatia. The Temple of Augustus preserves the Res Gestae Divi Augusti — Augustus's own account of his reign, the most important Latin inscription in existence, inscribed on the temple walls in both Latin and Greek." },

  { id:"tarsus", name:"Tarsus", modern:"Tarsus, Turkey", type:"city", livius:"https://www.livius.org/articles/place/tarsus/", omnesviae:"https://omnesviae.org/#TPPlace2327",
    lat:36.9138, lng:34.8892, period:"3rd mill. BC – present", pleiades:"648789", rome_days:33,
    quest:"photo",
    desc:"Birthplace of Paul the Apostle and one of the most important cities of Cilicia. Mark Antony and Cleopatra first met at Tarsus in 41 BC — the scene Plutarch describes of her arrival on a golden barge, with silver oars and purple sails, to the sound of flutes. The so-called Gate of Cleopatra and a Roman road survive." },

  { id:"antioch", name:"Antiochia on the Orontes", modern:"Antakya, Turkey", type:"capital", livius:"https://www.livius.org/articles/place/antioch-antakya/", omnesviae:"https://omnesviae.org/#TPPlace2736",
    lat:36.2021, lng:36.1633, period:"300 BC – 13th c. AD", pleiades:"658381", rome_days:35,
    desc:"Third city of the Roman Empire after Rome and Alexandria, with a population near 500,000 — 'the Queen of the East'. It was here that followers of Jesus were first called 'Christians'. The Hatay Archaeological Museum holds the world's greatest collection of Roman mosaics, rescued from ancient Antioch." },

  // ── NEAR EAST ────────────────────────────────────────────

  { id:"palmyra", name:"Palmyra", modern:"Tadmur, Syria", type:"city", livius:"https://www.livius.org/articles/place/palmyra/", omnesviae:"https://omnesviae.org/#TPPlace527",
    lat:34.5500, lng:38.2667, period:"1st c. BC – 3rd c. AD", pleiades:"668331", rome_days:40,
    desc:"The 'Bride of the Desert' — a magnificent oasis city controlling the caravan trade between Rome and Parthia. Queen Zenobia conquered Egypt and much of the east in the 260s AD before Aurelian crushed her revolt. The ruins of colonnaded streets, temples, and a theater were damaged by ISIS in 2015 but remain extraordinary." },

  { id:"temple_allat", name:"Temple of Al-Lāt", modern:"Palmyra (Tadmur), Syria", type:"city",
    lat:34.5519, lng:38.2642, period:"1st c. BC – 3rd c. AD", pleiades:"215749623", rome_days:40,
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Palmira%20Tempio%20di%20Allat%20Atena%20-%20GAR%20-%207-01.jpg", credit:"Gianfranco Gazzetti", license:"CC BY-SA 4.0" },
    desc:"A temple dedicated to the pre-Islamic Arabian goddess Al-Lāt within the sanctuary of Palmyra, syncretized with Athena under Roman rule. A magnificent lion sculpture guarding the temple was destroyed by ISIS in 2015." },

  { id:"dura_europos", name:"Dura-Europos", modern:"Deir ez-Zor, Syria", type:"fortress", livius:"https://www.livius.org/articles/place/dura-europos/",
    lat:34.7492, lng:40.7278, period:"3rd c. BC – AD 256", pleiades:"893990", rome_days:42,
    quest:"location",
    desc:"A remarkable frontier garrison city on the Euphrates, Dura-Europos was captured and abandoned by the Sasanian Persians in 256 AD and never reoccupied, preserving it intact beneath the desert. The excavated synagogue murals and the earliest known Christian house-church were both found here. Access is extremely difficult due to the Syrian conflict." },

  { id:"gerasa", name:"Gerasa", modern:"Jerash, Jordan", type:"city", livius:"https://www.livius.org/articles/place/gerasa-jerash/",
    lat:32.2809, lng:35.8917, period:"3rd c. BC – Islamic conquest", pleiades:"678158", rome_days:38,
    desc:"One of the best-preserved Roman provincial cities in the world, Gerasa was a member of the Decapolis league. The colonnaded streets, two theaters, hippodrome, Temple of Artemis, and the extraordinary oval Forum are all largely intact. Walking Jerash on a quiet morning is as close as you can get to being in a living Roman city." },

  { id:"caesarea_m", name:"Caesarea Maritima", modern:"Caesarea, Israel", type:"port", livius:"https://www.livius.org/articles/place/caesarea-maritima/", omnesviae:"https://omnesviae.org/#TPPlace442",
    lat:32.5036, lng:34.9077, period:"1st c. BC – Crusader", pleiades:"678401", rome_days:36,
    desc:"Herod the Great's masterpiece — an artificial harbor created using concrete poured into the sea, surrounding a grand city named for his patron Augustus. Capital of Roman Judaea, where Pontius Pilate resided and Paul was imprisoned for two years. The theater, hippodrome, and harbor remains are extensive." },

  { id:"ierusalem", name:"Hierusalem / Aelia Capitolina", modern:"Jerusalem, Israel", type:"city", livius:"https://www.livius.org/articles/place/jerusalem/", omnesviae:"https://omnesviae.org/#TPPlace438",
    lat:31.7683, lng:35.2332, period:"3rd mill. BC – present", pleiades:"687928", rome_days:37,
    desc:"Conquered by Pompey in 63 BC, Jerusalem was the center of two catastrophic Jewish revolts. Titus destroyed the Temple in 70 AD; Hadrian demolished the entire city and rebuilt it as the colony Aelia Capitolina in 135 AD. The Cardo Maximus, the great colonnaded street, is still visible in the Jewish Quarter." },

  { id:"petra", name:"Petra", modern:"Petra, Jordan", type:"city", livius:"https://www.livius.org/articles/place/petra/", omnesviae:"https://omnesviae.org/#TPPlace2316",
    lat:30.3285, lng:35.4444, period:"4th c. BC – 7th c. AD", pleiades:"697725", rome_days:42,
    desc:"The rose-red rock-cut capital of the Nabataean kingdom, controlling the incense and spice routes from Arabia and India. Annexed by Rome in 106 AD as the province of Arabia Petraea. The Siq canyon, the Treasury (Khazneh), the Street of Facades, and hundreds of rock-cut tombs make Petra one of the most spectacular ancient sites on Earth." },

  { id:"damascus", name:"Damascus", modern:"Damascus, Syria", type:"city", livius:"https://www.livius.org/articles/place/damascus/", omnesviae:"https://omnesviae.org/#TPPlace485",
    lat:33.5138, lng:36.3059, period:"3rd mill. BC – present", pleiades:"678106", rome_days:36,
    desc:"One of the world's oldest continuously inhabited cities. The Via Recta (Straight Street) mentioned in Acts of the Apostles still runs through the old city. Paul the Apostle was converted on the road to Damascus and later escaped the city in a basket lowered over the wall." },

  // ── NORTH AFRICA ─────────────────────────────────────────

  { id:"alexandria", name:"Alexandria", modern:"Alexandria, Egypt", type:"capital", livius:"https://www.livius.org/articles/place/alexandria/", omnesviae:"https://omnesviae.org/#TPPlace2735",
    lat:31.2001, lng:29.9187, period:"331 BC – present", pleiades:"727070", rome_days:10,
    rome_mode:"sea",
    desc:"Founded by Alexander the Great in 331 BC and the intellectual capital of the ancient world. The Pharos lighthouse was one of the Seven Wonders. The Great Library held perhaps 700,000 scrolls. Cleopatra VII ruled from here; Caesar and Antony both succumbed to her spell. The Pompey's Pillar and the catacombs of Kom el Shoqafa survive." },

  { id:"carthago", name:"Carthago", modern:"Tunis, Tunisia", type:"city", livius:"https://www.livius.org/articles/place/carthage/", omnesviae:"https://omnesviae.org/#TPPlace60",
    lat:36.8534, lng:10.3233, period:"814 BC – AD 698", pleiades:"314921", rome_days:5,
    rome_mode:"sea",
    desc:"Rome's greatest rival, destroyed in 146 BC after three Punic Wars. Julius Caesar and Augustus rebuilt it as a Roman colony; it became the capital of Africa Proconsularis and third city of the empire. The Antonine Baths — the third largest Roman baths ever built — dominate the archaeological site above the sea." },

  { id:"thugga", name:"Thugga", modern:"Dougga, Tunisia", type:"city",
    lat:36.4220, lng:9.2194, period:"4th c. BC – Byzantine", pleiades:"315223", rome_days:8,
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Dougga%2C%20Beja.jpg", credit:"Emna Trabelsi", license:"CC BY-SA 3.0" },
    desc:"The best-preserved Roman small town in North Africa and a UNESCO World Heritage Site. Thugga's hilltop setting, its remarkably complete Capitol temple, theater, forum, baths, and Libyan-Punic mausoleum give a vivid picture of Roman provincial life. Less visited than it deserves — which makes it all the more atmospheric." },

  { id:"thysdrus", name:"Thysdrus", modern:"El Djem, Tunisia", type:"city", livius:"https://www.livius.org/articles/place/thysdrus/",
    lat:35.2963, lng:10.7074, period:"2nd c. BC – Byzantine", pleiades:"324835", rome_days:7,
    quest:"photo",
    desc:"Home to one of the largest Roman amphitheaters ever built — holding 35,000 spectators and rivaling the Colosseum in scale. Rising from the flat Tunisian plain like a mirage, El Djem's amphitheater is one of the most dramatic Roman monuments in existence. Emperor Gordian I was proclaimed here in 238 AD." },

  { id:"leptismagna", name:"Leptis Magna", modern:"Al Khums, Libya", type:"city", livius:"https://www.livius.org/articles/place/lepcis-magna/", omnesviae:"https://omnesviae.org/#TPPlace300",
    lat:32.6376, lng:14.2919, period:"7th c. BC – Arab conquest", pleiades:"344456", rome_days:9,
    rome_mode:"sea",
    desc:"Birthplace of Emperor Septimius Severus, who lavished the resources of the empire on his hometown. Arguably the most spectacular and best-preserved Roman city in existence — vast marble forums, basilicas, baths, a theater, a lighthouse harbor, and a triumphal arch. Remote and relatively unvisited: profoundly moving." },

  { id:"sabratha", name:"Sabratha", modern:"Sabratha, Libya", type:"city", livius:"https://www.livius.org/articles/place/sabratha/", omnesviae:"https://omnesviae.org/#TPPlace289",
    lat:32.8000, lng:12.4833, period:"4th c. BC – Arab conquest", pleiades:"344518", rome_days:8,
    rome_mode:"sea",
    desc:"A Phoenician trading post that grew into a prosperous Roman city. Its theater — three stories of marble columns facing the sea — is one of the most beautiful in the Roman world. Apuleius, author of The Golden Ass, stood trial here on charges of using magic to win a wealthy widow's hand." },

  { id:"timgad", name:"Thamugadi", modern:"Timgad, Algeria", type:"city", livius:"https://www.livius.org/articles/place/thamugadi-timgad/", omnesviae:"https://omnesviae.org/#TPPlace171",
    lat:35.4856, lng:6.4681, period:"AD 100 – 7th c. AD", pleiades:"334636", rome_days:24,
    desc:"Founded by Trajan in 100 AD as a veteran colony, Timgad is the textbook example of Roman urban planning: a perfect grid, forum, library, 14 baths, a theater, triumphal arch — all laid out by military surveyors in a single campaign. Dubbed the 'Pompeii of Africa', abandoned and preserved under sand for centuries." },

  { id:"caesarea_maur", name:"Caesarea Mauretaniae", modern:"Cherchell, Algeria", type:"capital", livius:"https://www.livius.org/articles/place/iol-caesarea/", omnesviae:"https://omnesviae.org/#OVPlace506",
    lat:36.5908, lng:2.2086, period:"3rd c. BC – Arab conquest", pleiades:"295276", rome_days:12,
    rome_mode:"sea",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Argel%203.jpg", credit:"LBM1948", license:"CC BY-SA 4.0" },
    desc:"Capital of Mauretania Caesariensis, named for Augustus Caesar by King Juba II — a Numidian prince educated in Rome who married Cleopatra Selene, daughter of Antony and Cleopatra. Juba transformed the city into a showcase of Hellenistic art. The local museum holds exceptional Roman sculptures and mosaics, including a stunning portrait of Cleopatra Selene herself." },

  { id:"volubilis", name:"Volubilis", modern:"Volubilis, Morocco", type:"city", livius:"https://www.livius.org/articles/place/volubilis/", omnesviae:"https://omnesviae.org/#OVPlace500",
    lat:34.0726, lng:-5.5553, period:"3rd c. BC – 11th c. AD", pleiades:"275740", rome_days:35,
    desc:"The westernmost major Roman city — the effective end of the empire in Africa. Capital of Mauretania Tingitana, known for its extraordinary mosaic floors and the Triumphal Arch of Caracalla. Beyond its walls the Roman world stopped and the unconquered Berber lands began." },

  { id:"cyrene", name:"Cyrene", modern:"Shahhat, Libya", type:"city", livius:"https://www.livius.org/articles/place/cyrene/", omnesviae:"https://omnesviae.org/#TPPlace347",
    lat:32.8236, lng:21.8569, period:"631 BC – Arab conquest", pleiades:"373778", rome_days:15,
    rome_mode:"sea",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/CireneTermeTraiano.jpg", credit:"MM", license:"Public domain" },
    desc:"A great Greek colony and intellectual center — birthplace of Eratosthenes (who calculated the Earth's circumference) and Callimachus. Capital of Cyrenaica under Rome. The sanctuary of Apollo, agora, and vast necropolis spread across a dramatic highland landscape. Severely damaged in the Jewish revolt of 115–117 AD and never fully recovered." },

  // ── AQUEDUCT-BACKLOG PROMOTIONS ──────────────────────────
  // Surfaced by cross-referencing Wikipedia's "List of aqueducts in the Roman
  // Empire" against the coverage-tier long tail (js/sites-coverage.js):
  // coordinate-verified matches that already had a thin Pleiades stub in VIA
  // plus a real, freely-licensed Commons photo, promoted here to full curated
  // sites. Photos sourced via Wikidata P18 (site.photo — see js/app.js
  // setHeroPhoto/commonsSized), same visual treatment as the vici.org hero.

  { id:"saldae", name:"Saldae", modern:"Béjaïa, Algeria", type:"port",
    lat:36.7409, lng:5.058, period:"1st c. AD – present", pleiades:"305142",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Ruines%20romaines%20Thihnayin.jpg", credit:"Hakim1065", license:"CC BY-SA 4.0" },
    desc:"A Roman colonia on the Numidian coast, Saldae anchored grain and olive-oil exports from the fertile Kabylie hinterland. Its aqueduct, fed from springs in the hills above the modern city, still threads through the landscape in ruined arcades. The city later gave its name to medieval Bugia — Europe's main source of beeswax candles, and where a young Leonardo Fibonacci first learned Arabic numerals." },

  { id:"philippopolis", name:"Philippopolis", modern:"Plovdiv, Bulgaria", type:"city", livius:"https://www.livius.org/articles/place/philippopolis-plovdiv/", omnesviae:"https://omnesviae.org/#TPPlace2001",
    lat:42.1456, lng:24.7495, period:"4th c. BC – present", pleiades:"216927",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Wodo.jpg", credit:"Super mystere", license:"Public domain" },
    desc:"Refounded by Philip II of Macedon and later capital of the Roman province of Thracia, Philippopolis grew into one of the wealthiest cities of the Balkans. Its Roman theater — carved into the saddle between two hills — remains in active use for performances two thousand years on, alongside a stadium, forum, and a still-standing aqueduct that once carried water miles across the plain." },

  { id:"salona", name:"Salona", modern:"Solin, Croatia", type:"capital", omnesviae:"https://omnesviae.org/#TPPlace1681",
    lat:43.5396, lng:16.4834, period:"2nd c. BC – 7th c. AD", pleiades:"197488",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Split-Diokletian-Aqueduct-17.jpg", credit:"SchiDD", license:"CC BY-SA 4.0" },
    desc:"Capital of the Roman province of Dalmatia, Salona's amphitheater once seated 15,000. Emperor Diocletian, born nearby, built his vast retirement palace at neighboring Spalatum (Split) after abdicating in 305 AD — the only Roman emperor to willingly give up power. Salona's aqueduct, theater, and early Christian basilicas survive amid the ruins." },

  { id:"kition", name:"Kition", modern:"Larnaca, Cyprus", type:"port", livius:"https://www.livius.org/articles/place/kition/",
    lat:34.9212, lng:33.632, period:"13th c. BC – present", pleiades:"707534",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Larnaca%2001-2017%20img25%20Kamares%20Aqueduct.jpg", credit:"A.Savin", license:"FAL" },
    desc:"A Phoenician foundation on Cyprus's south coast, Kition was the birthplace of Zeno, founder of Stoic philosophy. Under Rome it remained a working port city; its Roman-era Kamares aqueduct still marches across the modern city on dozens of arches, built to carry water miles from mountain springs." },

  { id:"ledroi", name:"Ledroi", modern:"Nicosia, Cyprus", type:"city", livius:"https://www.livius.org/articles/place/ledra-and-leucusia/",
    lat:35.1572, lng:33.3473, period:"1st c. AD – Byzantine", pleiades:"707558",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Nicosia%2001-2017%20img04%20aqueduct.jpg", credit:"A.Savin", license:"FAL" },
    desc:"A modest Roman-period town on the site of modern Nicosia, known to ancient sources as Ledroi. Little survives of the classical town beneath the modern Cypriot capital, but fragments of the aqueduct that once supplied it can still be traced across the plain." },

  { id:"barbegal", name:"Barbegal", modern:"Fontvieille, France", type:"city",
    lat:43.704, lng:4.7214, period:"2nd c. AD – 3rd c. AD", pleiades:"148012",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Barbegal%20aqueduct%2001.jpg", credit:"maarjaara", license:"CC BY 2.0" },
    desc:"A short walk from Arelate, Barbegal was home to one of the most extraordinary industrial complexes of the Roman world: sixteen water-wheels arranged in two parallel rows down a hillside, powered by a dedicated aqueduct and capable of grinding enough flour to feed the entire city of Arles. It may be the largest concentration of mechanical power built anywhere before the Industrial Revolution." },

  { id:"gier", name:"Aqueduct of the Gier", modern:"near Lyon, France", type:"city",
    lat:45.7218, lng:4.7604, period:"2nd c. AD – 3rd c. AD", pleiades:"812127749",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Aqueducchapo01.JPG", license:"CC BY-SA 3.0" },
    desc:"One of four aqueducts feeding Lugdunum, the 85km Aqueduct of the Gier is best known for its inverted siphon at Beaunant — a valley crossing using dozens of parallel lead pipes to carry water under enormous pressure, one of the most sophisticated hydraulic engineering feats of the Roman world." },

  { id:"luynes", name:"Aqueduct of Luynes", modern:"Luynes, France", type:"city",
    lat:47.3903, lng:0.5879, period:"1st c. AD – 3rd c. AD", pleiades:"140446",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Luynes%20(France)%20Roman%20Aqueduct.jpg", credit:"Claip", license:"CC BY-SA 3.0" },
    desc:"A striking double-tiered arcade of the Roman aqueduct that once supplied Caesarodunum (modern Tours), the surviving arches at Luynes march across the Loire valley in a rare and beautifully preserved stretch of Gallo-Roman engineering." },

  { id:"pontdugard", name:"Pont du Gard", modern:"Vers-Pont-du-Gard, France", type:"city", livius:"https://www.livius.org/articles/place/pont-du-gard/",
    lat:43.9473, lng:4.5353, period:"1st c. AD – 6th c. AD", pleiades:"149496",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Pont%20du%20Gard%20BLS.jpg", credit:"Benh LIEU SONG", license:"CC BY-SA 3.0" },
    desc:"The most famous aqueduct bridge to survive from antiquity, the Pont du Gard carried water 50km to Nemausus (Nîmes) across the Gardon valley on three tiers of arches rising 49 meters — the tallest bridge the Romans ever built. Its precision stonework, laid without mortar, remains breathtakingly intact after two thousand years." },

  { id:"eifel_aqueduct", name:"Görresburg", modern:"Nettersheim, Germany", type:"city", livius:"https://www.livius.org/articles/place/colonia-claudia-ara-agrippinensium-koln/",
    lat:50.4875, lng:6.6255, period:"1st c. AD – 3rd c. AD", pleiades:"109013",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Eifelwasserleitung05.jpg", credit:"Putput", license:"CC BY-SA 3.0" },
    desc:"Görresburg marks one of the spring sources of the Eifel Aqueduct, the longest continuous Roman aqueduct ever built — nearly 95km of channel carrying water to Colonia Claudia Ara Agrippinensium (Cologne). Its conduit, lined with a distinctive mineral-rich limescale prized as a decorative stone (\"Eifel marble\"), can still be traced through the forests of the Eifel hills." },

  { id:"sumelocenna", name:"Sumelocenna", modern:"Rottenburg am Neckar, Germany", type:"city",
    lat:48.4776, lng:8.9371, period:"1st c. AD – 3rd c. AD", pleiades:"118950",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/2015-10-24%20sumelocenna%20aquaeductus.jpg", credit:"Phg-0x2a", license:"CC BY-SA 4.0" },
    desc:"A Roman vicus on the Neckar frontier, Sumelocenna grew up around a river crossing and market. Its aqueduct and the remains of baths and a forum have been excavated beneath modern Rottenburg, giving a rare window into everyday provincial life along Rome's German frontier." },

  { id:"neapolis_macedonia", name:"Neapolis", modern:"Kavala, Greece", type:"port",
    lat:40.9343, lng:24.414, period:"7th c. BC – present", pleiades:"501523",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Kavala-Aqueduct.jpg", credit:"Edal Anton Lefterov", license:"CC BY-SA 4.0" },
    desc:"Not to be confused with its Italian namesake, this Neapolis was the port of Philippi and, according to Acts of the Apostles, the first place in Europe where Paul the Apostle set foot. A station on the Via Egnatia, it prospered as the gateway between Asia Minor and Macedonia; an aqueduct — rebuilt in Ottoman times on Roman foundations — still strides across modern Kavala's skyline." },

  { id:"solomonspools", name:"Solomon's Pools", modern:"Al Khader, West Bank", type:"city",
    lat:31.6887, lng:35.1702, period:"1st c. BC – Ottoman period", pleiades:"212723843",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Gush%20Etzion%20Well's%20Aqueduct.jpg", credit:"Djampa", license:"CC BY-SA 4.0" },
    desc:"Despite the name, these three vast stepped reservoirs date to the Herodian and Roman periods, not to Solomon — built to gather spring water and feed it north to Jerusalem via a low-level aqueduct nearly 40km long, one of the most ambitious water projects in the Roman Near East." },

  { id:"qumran", name:"Qumran", modern:"Qumran, West Bank", type:"city", livius:"https://www.livius.org/articles/place/qumran/",
    lat:31.7418, lng:35.4594, period:"2nd c. BC – AD 68", pleiades:"688011",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Qumran,%20Dead%20Sea,%20Palestine%2049.jpg", credit:"Hoshvilim", license:"CC BY-SA 4.0" },
    desc:"Overlooking the Dead Sea, Qumran is world-famous as the site where the Dead Sea Scrolls were discovered in nearby caves in 1947 — the oldest surviving manuscripts of the Hebrew Bible. The settlement's elaborate system of cisterns and channels, fed by a stone aqueduct that captured seasonal flash floods from the cliffs above, sustained the community many scholars identify as the Essenes." },

  { id:"thermae_himeraeae", name:"Thermae Himeraeae", modern:"Termini Imerese, Sicily, Italy", type:"port",
    lat:37.9852, lng:13.6963, period:"4th c. BC – present", pleiades:"462513",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Termini%20Imerese%20aquaduct.jpg", credit:"Rjdeadly", license:"CC BY-SA 3.0" },
    desc:"Founded by Carthage after the destruction of nearby Himera in 409 BC, Thermae Himeraeae took its name from the therapeutic hot springs still used today. Under Rome it became a modest but prosperous spa town on Sicily's north coast, its aqueduct carrying water down from the hills to feed the baths that gave the city its name." },

  { id:"segovia", name:"Segovia", modern:"Segovia, Spain", type:"city", livius:"https://www.livius.org/articles/place/segovia/", omnesviae:"https://omnesviae.org/#OVPlace336",
    lat:40.9492, lng:-4.1193, period:"1st c. AD – present", pleiades:"236658",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/AcueductoSegovia%20edit1.jpg", credit:"Manuel González Olaechea y Franco", license:"CC BY-SA 3.0" },
    desc:"Segovia's granite aqueduct is one of the best-preserved in the Roman world — 28km of channel culminating in a double tier of arches through the town center, standing an astonishing 28 meters high at its tallest, built entirely without mortar. It carried water into the 20th century, nearly two thousand years after it was built." },

  { id:"aspendos", name:"Aspendos", modern:"Belkıs, Antalya, Turkey", type:"city", livius:"https://www.livius.org/articles/place/aspendus/",
    lat:36.9404, lng:31.1697, period:"5th c. BC – present", pleiades:"638776",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Aqueduct%20of%20Aspendos%2001.jpg", credit:"Bernard Gagnon", license:"CC BY-SA 3.0" },
    desc:"One of the great cities of Pamphylia, Aspendos boasts the best-preserved Roman theater anywhere in the world, still used for performances today. Its aqueduct is equally remarkable: two towering stone siphon structures at either end of the valley, built to force water uphill using pressure alone — a rare surviving example of Roman inverted-siphon engineering at full scale." },

  { id:"phaselis", name:"Phaselis", modern:"Tekirova, Antalya, Turkey", type:"port", livius:"https://www.livius.org/articles/place/phaselis/", omnesviae:"https://omnesviae.org/#TPPlace2394",
    lat:36.5235, lng:30.5522, period:"7th c. BC – Byzantine", pleiades:"639051",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Phaselis%20axb02.jpg", credit:"Alexander Buschorn", license:"CC BY-SA 3.0" },
    desc:"A Rhodian colony with three natural harbors on the Lycian coast, Phaselis was a key stop on Alexander the Great's march through Anatolia, who wintered here in 333 BC. Under Rome it thrived as a trading port; its aqueduct, baths, and monumental street between the harbors survive amid pine forest running down to the sea." },

  { id:"side", name:"Side", modern:"Side, Antalya, Turkey", type:"port", livius:"https://www.livius.org/articles/place/side/", omnesviae:"https://omnesviae.org/#TPPlace2353",
    lat:36.7684, lng:31.3922, period:"7th c. BC – Byzantine", pleiades:"639105",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Side.Great%20Gate(02).jpg", license:"CC BY-SA 3.0" },
    desc:"A major port of Pamphylia founded by Greek colonists who, according to ancient tradition, spoke a language unlike any other in the region, Side grew into one of the wealthiest maritime cities under Rome. Its theater is among the largest in Asia Minor, and the columns of a harborside Temple of Apollo — dramatically lit at night — form one of the most photographed ruins on Turkey's coast." },

  { id:"perge", name:"Perge", modern:"Aksu, Antalya, Turkey", type:"city", livius:"https://www.livius.org/articles/place/perge/", omnesviae:"https://omnesviae.org/#TPPlace2357",
    lat:36.9645, lng:30.8533, period:"2nd mill. BC – Byzantine", pleiades:"639048",
    photo:{ url:"https://commons.wikimedia.org/wiki/Special:FilePath/Perge%20city%20overview.jpg", credit:"Saffron Blaze", license:"CC BY-SA 3.0" },
    desc:"Birthplace of the mathematician Apollonius of Perga, who codified the study of conic sections, Perge was one of the leading cities of Roman Pamphylia. Its colonnaded main street channels water down its center from a monumental nymphaeum at the city's northern gate, past a stadium, baths, and one of the best-preserved city gates of the ancient world." },

];


// ═══════════════════════════════════════════════════════════
//  ROADS
// ═══════════════════════════════════════════════════════════

// `search` is the optional alias bundle for 3c road search (see app.js
// searchRoads). en = common English name; from/to = endpoint pair, tokenized
// individually so "Rome to Brundisium" / "Rome-Brundisium" / "Rome Brundisium"
// all match; alt = extra aliases (modern names, epithets). Itiner-e segment
// names are CONSCIOUSLY DEFERRED — not indexed here; only these 14 curated roads
// are searchable for now (a named-Itiner-e pass is a possible later step).
const ROADS = [
  { name:"Via Appia",         built:"312 BC", desc:"The Queen of Roads — Rome to Brundisium",
    search:{ en:"Appian Way", from:"Rome", to:"Brundisium", alt:["Regina Viarum","Queen of Roads","Brindisi"] },
    coords:[[12.49,41.89],[13.1,41.6],[13.5,41.57],[14.21,41.09],[14.78,41.13],[15.8,40.85],[17.24,40.47],[17.94,40.63]] },
  { name:"Via Flaminia",      built:"220 BC", desc:"Rome to the Adriatic at Ariminium",
    search:{ en:"Flaminian Way", from:"Rome", to:"Ariminium", alt:["Rimini","Adriatic"] },
    coords:[[12.49,41.89],[12.52,42.1],[12.52,42.52],[12.6,42.73],[13.05,43.07],[13.72,43.84],[12.34,44.06]] },
  { name:"Via Aurelia",       built:"241 BC", desc:"Rome along the Tyrrhenian coast to Gaul",
    search:{ en:"Aurelian Way", from:"Rome", to:"Gaul", alt:["Tyrrhenian coast"] },
    coords:[[12.49,41.89],[12.0,42.0],[11.5,42.4],[10.4,43.72],[8.94,44.41],[7.27,43.70],[6.74,43.25],[5.37,43.30]] },
  { name:"Via Aemilia",       built:"187 BC", desc:"Ariminium to Placentia across the Po plain",
    search:{ en:"Aemilian Way", from:"Ariminium", to:"Placentia", alt:["Rimini","Piacenza","Emilia"] },
    coords:[[12.34,44.06],[11.34,44.49],[10.33,44.80],[9.19,45.05]] },
  { name:"Via Postumia",      built:"148 BC", desc:"Genua to Aquileia across northern Italy",
    search:{ en:"Postumian Way", from:"Genua", to:"Aquileia", alt:["Genoa"] },
    coords:[[8.94,44.41],[9.19,45.46],[10.99,45.44],[11.88,45.41],[12.48,45.67],[13.37,45.77]] },
  { name:"Via Domitia",       built:"118 BC", desc:"First Roman road in Gaul — Italy to Hispania",
    search:{ en:"Domitian Way", from:"Italy", to:"Hispania", alt:["Spain","Gaul"] },
    coords:[[5.37,43.30],[4.36,43.84],[3.0,43.18],[1.44,43.6],[-0.58,44.84],[-0.88,41.65],[-3.7,40.42],[-6.34,38.92]] },
  { name:"Via Egnatia",       built:"146 BC", desc:"Dyrrachium to Byzantium — Rome's road to the East",
    search:{ en:"Egnatian Way", from:"Dyrrachium", to:"Byzantium", alt:["Durres","Constantinople","Istanbul"] },
    coords:[[19.48,41.32],[20.5,41.4],[21.3,40.85],[22.94,40.64],[24.29,41.01],[26.57,41.67],[28.98,41.01]] },
  { name:"Eastern Road",      built:"2nd c. AD", desc:"Asia Minor and Syria",
    search:{ from:"Asia Minor", to:"Syria", alt:["Anatolia"] },
    coords:[[28.98,41.01],[30.5,40.0],[27.34,37.94],[27.18,39.13],[32.86,39.93],[36.16,36.20]] },
  { name:"Via Maris",         built:"Roman period", desc:"The coastal road from Syria to Egypt",
    search:{ en:"Way of the Sea", from:"Syria", to:"Egypt" },
    coords:[[36.16,36.20],[36.31,33.51],[35.23,31.78],[34.91,32.50],[29.92,31.20]] },
  { name:"North African Road",built:"Roman period", desc:"Coastal road from Alexandria to Mauretania",
    search:{ from:"Alexandria", to:"Mauretania", alt:["Carthage","Africa"] },
    coords:[[29.92,31.20],[21.86,32.82],[14.29,32.64],[12.48,32.80],[10.32,36.85],[2.21,36.59],[-5.55,34.07]] },
  { name:"Danube Limes Road", built:"1st c. AD",   desc:"The Danubian frontier highway",
    search:{ from:"Danube", to:"frontier", alt:["Danubian frontier","limes"] },
    coords:[[28.98,41.01],[22.0,44.8],[19.62,44.97],[19.04,47.57],[16.86,48.12],[16.37,48.21],[13.0,48.5],[10.9,48.4]] },
  { name:"Via Belgica",       built:"1st c. AD",   desc:"Lugdunum to the Channel ports",
    search:{ en:"Belgican Way", from:"Lugdunum", to:"Channel", alt:["Lyon","Belgica"] },
    coords:[[4.84,45.75],[2.35,48.86],[2.35,50.9],[1.62,50.95]] },
  { name:"Rhine Limes Road",  built:"1st c. AD",   desc:"The Rhine frontier",
    search:{ from:"Rhine", to:"frontier", alt:["Rhine frontier","limes"] },
    coords:[[6.74,43.25],[6.64,49.75],[6.96,50.94],[7.1,51.5],[7.2,52.0],[8.0,53.5]] },
  { name:"Desert Road",       built:"Roman period", desc:"Palmyra to the Euphrates frontier",
    search:{ from:"Palmyra", to:"Euphrates", alt:["Syria"] },
    coords:[[36.16,36.20],[37.5,35.5],[38.27,34.55],[40.73,34.75]] },
];

// ── MERGED SITES ─────────────────────────────────────────
// Curated first (rich, hand-written), then non-duplicate Pleiades imports, then
// the vici.org elevation layer (sites-vici.js) — all deduped by pleiades id, so
// a place already curated or in the Pleiades set is never double-added by vici.

const SITES = (() => {
  const out  = [...SITES_CURATED];
  const seen = new Set(SITES_CURATED.map(s => s.pleiades).filter(Boolean));
  const addAll = arr => {
    if (typeof arr === 'undefined') return;
    for (const s of arr) {
      if (s.pleiades && seen.has(s.pleiades)) continue;
      if (s.pleiades) seen.add(s.pleiades);
      out.push(s);
    }
  };
  addAll(typeof SITES_PLEIADES !== 'undefined' ? SITES_PLEIADES : undefined);
  addAll(typeof SITES_VICI     !== 'undefined' ? SITES_VICI     : undefined);

  // vici overlay: vici-photo sites already in the curated/Pleiades sets (so deduped
  // out of SITES_VICI) get the vici hero + button. Candidates (no P18) also get
  // elevation:true → the "help elevate" banner; documented ones just get the photo.
  if (typeof VICI_OVERLAY !== 'undefined') {
    for (const s of out) {
      const v = s.pleiades && VICI_OVERLAY[s.pleiades];
      if (!v || s.vici) continue;
      s.vici = { url: v.url, name: v.name, image: v.image, creator: v.creator, license: v.license };
      if (v.elevation) { s.elevation = true; if (!s.quest) s.quest = 'photo'; }
    }
  }
  return out;
})();
