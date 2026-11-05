// Which USDA FoodData Central SR Legacy records become "cooked vegetables" rows, and which Indian vegetables get a DERIVED estimate.
// [fdcId, id suffix, display name, alias words, exact USDA description, optional piece: [label noun, USDA food_portion modifier] (grams per piece come from the file) (default: "<description>, cooked, boiled, drained, without salt" is NOT assumed: it is listed in full)]
// not imported: towelgourd 168415 (boiled 56 kcal / 84% water vs raw 20 kcal / 94% water: not the same material, 4x the IFCT raw ridge gourd), so turai is a derived estimate;
// amaranth leaves (169202) and yardlong bean (169223) have no fibre value in SR Legacy, so carbs minus fibre cannot be computed.
const B = ', cooked, boiled, drained, without salt';
export const USDA = [
  [168463, 'spinach', 'Spinach, boiled (palak)', 'palak', 'Spinach' + B],
  [170397, 'cauliflower', 'Cauliflower, boiled (gobi)', 'gobi phool', 'Cauliflower' + B],
  [169261, 'okra', 'Okra, boiled (bhindi)', 'bhindi ladies finger', 'Okra' + B, ['bhindi', 'pods (3" long)']],
  [169229, 'eggplant', 'Eggplant, boiled (brinjal, baingan)', 'baingan brinjal aubergine', 'Eggplant' + B],
  [170394, 'carrot', 'Carrot, boiled (gajar)', 'gajar', 'Carrots' + B, ['carrot', 'carrot']],
  [168449, 'pumpkin', 'Pumpkin, boiled (kaddu)', 'kaddu', 'Pumpkin' + B],
  [170420, 'green_peas', 'Green peas, boiled (matar)', 'matar', 'Peas, green' + B],
  [169976, 'cabbage', 'Cabbage, boiled (patta gobi)', 'patta gobi', 'Cabbage' + B],
  [170001, 'onion', 'Onion, boiled (pyaz)', 'pyaz', 'Onions' + B, ['medium onion', 'medium']],
  [169141, 'french_beans', 'French beans, boiled (green beans)', 'beans', 'Beans, snap, green' + B],
  [169967, 'broccoli', 'Broccoli, boiled', '', 'Broccoli' + B],
  [168394, 'karela', 'Bitter gourd, boiled (karela)', 'karela', 'Balsam-pear (bitter gourd), pods' + B],
  [170484, 'drumstick', 'Drumstick pods, boiled (sahjan)', 'sahjan moringa', 'Drumstick pods' + B],
  [168417, 'drumstick_leaves', 'Drumstick leaves, boiled', 'moringa', 'Drumstick leaves' + B],
  [169233, 'lauki', 'Bottle gourd, boiled (lauki, dudhi)', 'lauki dudhi ghiya calabash', 'Gourd, white-flowered (calabash)' + B],
  [170475, 'ash_gourd', 'Ash gourd, boiled (petha)', 'petha safed kaddu', 'Waxgourd, (chinese preserving melon)' + B],
  [169252, 'mushroom', 'Mushroom, boiled', '', 'Mushrooms, white' + B, ['mushroom', 'mushroom']],
  [170428, 'capsicum', 'Capsicum, boiled (green pepper)', 'shimla mirch', 'Peppers, sweet, green' + B],
  [169257, 'mustard_greens', 'Mustard greens, boiled (sarson)', 'sarson', 'Mustard greens' + B],
  [170376, 'beet_greens', 'Beet greens, boiled', '', 'Beet greens' + B],
  [168452, 'radish', 'Radish, boiled (mooli)', 'mooli', 'Radishes, oriental' + B],
  [168425, 'knol_khol', 'Knol khol, boiled (kohlrabi)', 'ganth gobi', 'Kohlrabi' + B],
  [168430, 'lotus_root', 'Lotus root, boiled (kamal kakdi)', 'kamal kakdi', 'Lotus root' + B],
  [169292, 'zucchini', 'Zucchini, boiled', '', 'Squash, summer, zucchini, includes skin' + B],
  [170403, 'chayote', 'Chayote, boiled (chow chow)', 'chow chow', 'Chayote, fruit' + B],
  // the records below carry a slightly different USDA description (no "drained" / "without salt" in the same words); each is listed exactly
  [170438, 'potato', 'Potato, boiled (aloo, in skin)', 'aloo', 'Potatoes, boiled, cooked in skin, flesh, without salt', ['medium potato', 'potato (2-1/2" dia, sphere)']],
  [168484, 'sweet_potato', 'Sweet potato, boiled (shakarkandi)', 'shakarkandi', 'Sweet potato, cooked, boiled, without skin', ['medium sweet potato', 'medium']],
  [169146, 'beetroot', 'Beetroot, boiled (chukandar)', 'chukandar', 'Beets, cooked, boiled, drained', ['beetroot', 'beets (2" dia, sphere)']],
  [168486, 'taro', 'Colocasia, boiled (arvi)', 'arvi', 'Taro, cooked, without salt'],
  [170072, 'yam', 'Yam, boiled (suran)', 'suran jimikand', 'Yam, cooked, boiled, drained, or baked, without salt'],
  [168216, 'raw_plantain', 'Raw banana, boiled (plantain, kela)', 'kachcha kela', 'Plantains, green, boiled'],
];
// Derived estimates (question Q5): no USDA boiled record exists. cooked per 100 g = IFCT raw per 100 g x k, where k = the mean cooked/raw ENERGY ratio of
// the USDA SR Legacy pairs of the same class (water gained or lost and a little leaching in boiling). Never shown as sourced.
export const CLASSES = {
  gourd: { label: 'gourd and fruit vegetable', pairs: [[169232, 169233], [170069, 170475], [168393, 168394], [169291, 169292], [169289, 169290]], like: 'u_lauki_boiled' },
  beans: { label: 'bean pod', pairs: [[169961, 169141], [169222, 169223], [169234, 169235], [168405, 169221]], like: 'u_french_beans_boiled' },
  leafy: { label: 'leafy vegetable', pairs: [[168462, 168463], [168385, 169202], [169256, 169257], [170375, 170376], [168421, 169238]], like: 'u_spinach_boiled' },
};
// [id suffix, display name, IFCT raw food id, class, alias words]
export const DERIVED = [
  ['tinda', 'Tinda, boiled - estimate (apple gourd)', 'i_tinda_tender', 'gourd', 'tinda'],
  ['parwar', 'Parwal, boiled - estimate (pointed gourd)', 'i_parwar', 'gourd', 'parwal parval'],
  ['kovai', 'Kundru, boiled - estimate (ivy gourd)', 'i_kovai_big', 'gourd', 'kundru tindora'],
  ['ridge_gourd', 'Ridge gourd, boiled - estimate (turai)', 'i_ridge_gourd', 'gourd', 'turai torai'],
  ['snake_gourd', 'Snake gourd, boiled - estimate (chichinda)', 'i_snake_gourd_long_pale_green', 'gourd', 'chichinda padwal'],
  ['cluster_beans', 'Cluster beans, boiled - estimate (gavar)', 'i_cluster_beans', 'beans', 'gavar guar'],
  ['fenugreek_leaves', 'Fenugreek leaves, boiled - estimate (methi)', 'i_fenugreek_leaves', 'leafy', 'methi'],
  ['bathua', 'Bathua leaves, boiled - estimate', 'i_bathua_leaves', 'leafy', 'bathua'],
];
