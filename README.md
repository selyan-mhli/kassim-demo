# Kassim — démonstration achats

Prototype d’aide à la décision à 90 jours. Fournisseurs, contrats, prix de base et scénarios fictifs ; aucun gain client ni cours futur démontré.

## Parcours

- **Scénarios** : trois courbes, lecture par mois, coûts mensuels/cumulés, cuivre et change ; carte de sensibilité des trois plans figés.
- **Documents** : jusqu’à 30 fichiers, classement entre fournisseurs par glisser-déposer ou menu, propositions à corriger et valider, historique séparé par référence/devise/unité, export JSON local.
- **Veille** : actualités publiques GDELT sur demande ou ajout manuel d’un lien public ; association d’un signal puis hypothèse numérique choisie par l’acheteur.
- Présentation, dossier de décision, fournisseurs, schéma et questions terrain.

## Documents : portée réelle

Lecture dans l’onglet, sans envoi des documents à un serveur ni appel à une IA. PDF **texte**, Excel **XLSX** (valeurs enregistrées), Word **DOCX**, emails **EML** (corps sans pièces jointes), CSV, JSON, TXT et MD. DOC, XLS et MSG nécessitent un export. Les scans nécessitent un OCR, absent de cette version.

Les tableaux reconnus peuvent proposer plusieurs lignes. Le texte libre propose quelques champs par repérage lexical : ce n’est pas une compréhension universelle des devis ou contrats. Chaque proposition doit être confirmée. Un prix total n’est jamais injecté automatiquement dans la part transformation du simulateur.

Limites : 30 documents dans l’espace, 12 Mo par fichier et 100 Mo par lot ; 60 pages PDF, 20 feuilles XLSX, 500 propositions par document. Les troncatures sont signalées. Les données restent **en mémoire dans l’onglet**, perdues au rechargement ou à la fermeture. L’export conserve les lignes validées et leurs références, pas les fichiers originaux. Aucun archivage ni réimport d’archive n’est fourni.

Le bouton « Essayer 30 exemples fictifs » lit six PDF, six XLSX, six DOCX, six EML et six CSV synthétiques via le même lecteur. Ce lot simple ne prouve pas une fiabilité sur des documents clients hétérogènes.

## Veille : portée réelle

Seule une requête thématique publique fixe est envoyée à GDELT, jamais le contenu ni les noms des documents/fournisseurs. La recherche porte sur sept jours de presse anglophone et des termes prix/offre. Le service peut être indisponible ou bruité ; les erreurs sont affichées. La date de repérage est distincte des dates de publication et d’événement, à confirmer dans la source. Aucun choc de prix n’est déduit automatiquement d’un titre. L’ajout manuel ne consulte pas l’URL.

## Exécution

Site statique, `index.html` à la racine, `.nojekyll` inclus. Aucun build ni installation : servir ce dossier en HTTP local ou l’héberger. La lecture PDF et les exemples nécessitent HTTP(S). Sources et démo de ce dépôt **publiques** ; le dossier de stratégie et de recherche est conservé séparément dans un dépôt privé.

Polices locales Inter et Space Grotesk avec licences OFL. Lecteurs locaux dans `assets/vendor/` : PDF.js 5.6.205 (Apache-2.0), JSZip 3.10.1 (utilisé sous MIT), licences incluses. Aucun CDN.
