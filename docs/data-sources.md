[← Back to the README](../README.md)

# 🥕 Food data sources

The generic foods in the search come from open national food-composition tables, used under their licences and credited here and in the app (You → Food library → Where food data comes from). Each was reduced to energy, protein, carbohydrate, fat and fibre per 100 g, with carbohydrate shown **excluding fibre** — subtracted where a table publishes it included. Full credits and every change made are in [`backend/app/data/reference/NOTICE.md`](../backend/app/data/reference/NOTICE.md). None of these organisations endorses this app.

| Table | Publisher | Licence |
|---|---|---|
| [FoodData Central](https://fdc.nal.usda.gov/) (Foundation, SR Legacy, FNDDS) | U.S. Department of Agriculture, Agricultural Research Service | Public domain (CC0 1.0) |
| [CoFID 2021](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid) — McCance and Widdowson's The Composition of Foods Integrated Dataset | Public Health England. Contains public sector information licensed under the Open Government Licence v3.0 | [OGL v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) |
| [Ciqual 2025](https://ciqual.anses.fr/) — Anses. 2025. Table de composition nutritionnelle des aliments Ciqual | ANSES | [Licence Ouverte](https://www.etalab.gouv.fr/licence-ouverte-open-licence/) |
| [AFCD Release 3](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd) — Australian Food Composition Database | Food Standards Australia New Zealand (2025) | [CC BY 2.5 AU](https://creativecommons.org/licenses/by/2.5/au/) |
| [Canadian Nutrient File 2015](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data.html) | Health Canada | [OGL – Canada](https://open.canada.ca/en/open-government-licence-canada) |
| [Open Food Facts](https://world.openfoodfacts.org/) (packaged products, searched live) | Open Food Facts contributors | [ODbL](https://opendatacommons.org/licenses/odbl/1-0/) |

## Demo sample meals

The demo's sample meals are plates from Nutrition5k: overhead photos of cafeteria dishes, each weighed ingredient by ingredient. The photos were converted from PNG to JPEG. The AI estimates beside them are this app's own, saved from one run each, so the demo never calls the model. Details are in [`backend/app/data/demo_samples.json`](../backend/app/data/demo_samples.json).

| Dataset | By | Licence |
|---|---|---|
| [Nutrition5k](https://github.com/google-research-datasets/Nutrition5k) — Thames et al., Nutrition5k: Towards Automatic Nutritional Understanding of Generic Food, CVPR 2021 | Google Research | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

## Fonts and icons

| Font or icon set | By | Licence |
|---|---|---|
| [Mona Sans](https://github.com/github/mona-sans) (the app's typeface, self-hosted) | The Mona Sans Project Authors | [SIL Open Font License 1.1](https://openfontlicense.org/) |
| [Libre Franklin](https://github.com/googlefonts/Libre-Franklin) (the wordmark and the Label style) | The Libre Franklin Project Authors | [SIL Open Font License 1.1](https://openfontlicense.org/) |
| [Phosphor Icons](https://phosphoricons.com/) | Phosphor Icons | MIT |
