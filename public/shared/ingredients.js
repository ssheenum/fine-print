// Ingredient knowledge base used by the scoring engine. Shared by the server (require) and the browser (window.FP_KB).
// match: regex tested against a normalized INCI name (lowercase).
// role: 'active' (does a main job), 'support' (helpful, not the headline), 'filter' (sunscreen),
//       'flag' (worth knowing), 'base'.
// helps: profile concerns it is good for. good: completes a sentence after the name.
// tags: fragrance, allergen, essential_oil, alcohol, sulfate, silicone, paraben, coconut, retinoid, acid, drying
// reg: a restriction in another region (plain words, factual).
// Keep every statement conservative and factual.

(function (root, make) { if (typeof module === 'object' && module.exports) module.exports = make(); else root.FP_KB = make(); })(typeof self !== 'undefined' ? self : this, function () {
  return [
  // --- skin actives ---
  { match: /^niacinamide$/, name: 'Niacinamide', role: 'active', what: 'Calms redness and evens out tone over a few weeks.', helps: ['Redness', 'Dark spots', 'Acne', 'Dullness', 'Sensitivity'], good: 'calms redness and evens out tone over a few weeks.' },
  { match: /^ceramide/, name: 'Ceramides', role: 'active', what: 'Rebuild the skin barrier so it holds on to moisture.', helps: ['Dryness', 'Sensitivity', 'Body dryness', 'Redness'], good: "rebuild your skin's barrier so it holds on to moisture." },
  { match: /^(sodium )?hyaluron(ic acid|ate)|^hydrolyzed hyaluronic acid|^sodium acetylated hyaluronate/, name: 'Hyaluronic acid', role: 'active', what: 'Pulls water into skin so it looks plumper.', helps: ['Dryness', 'Fine lines', 'Body dryness'], good: 'pulls water into skin so it looks plumper and less tight.' },
  { match: /^panthenol$|^d-panthenol$/, name: 'Panthenol', role: 'support', what: 'Vitamin B5. Soothes and softens.', helps: ['Sensitivity', 'Dryness', 'Frizz'], good: 'is vitamin B5. It soothes and softens.' },
  { match: /^allantoin$/, name: 'Allantoin', role: 'support', what: 'Calms and smooths skin.', helps: ['Sensitivity', 'Texture'], good: 'calms and smooths skin.' },
  { match: /^avena sativa.*(kernel flour|kernel extract)|^colloidal oatmeal/, name: 'Colloidal oatmeal', role: 'active', what: 'Soothes dry, itchy skin. An FDA-recognized skin protectant.', helps: ['Body dryness', 'Dryness', 'Sensitivity', 'Redness'], good: 'soothes dry, itchy skin. The FDA recognizes it as a skin protectant.' },
  { match: /^petrolatum$|^petroleum jelly$/, name: 'Petrolatum', role: 'active', what: 'Seals moisture in.', helps: ['Dryness', 'Body dryness', 'Sensitivity'], good: "seals moisture in. It's one of the best-proven moisturizers there is." },
  { match: /^centella asiatica|^madecassoside$|^asiaticoside$/, name: 'Centella asiatica', role: 'active', what: 'Calms irritated skin.', helps: ['Redness', 'Sensitivity'], good: 'calms irritated, red skin.' },
  { match: /^salicylic acid$/, name: 'Salicylic acid', role: 'active', tags: ['acid'], what: 'Unclogs pores and loosens flakes.', helps: ['Acne', 'Texture', 'Dandruff'], good: 'unclogs pores and helps clear breakouts.' },
  { match: /^glycolic acid$/, name: 'Glycolic acid', role: 'active', tags: ['acid'], what: 'Exfoliates for smoother, brighter skin. Can sting sensitive skin.', helps: ['Texture', 'Dullness', 'Dark spots'], good: 'exfoliates for smoother, brighter skin.' },
  { match: /^lactic acid$/, name: 'Lactic acid', role: 'active', tags: ['acid'], what: 'Gentle exfoliant that also hydrates.', helps: ['Texture', 'Dullness', 'Dryness', 'Body dryness'], good: 'gently exfoliates and hydrates at the same time.' },
  { match: /^mandelic acid$/, name: 'Mandelic acid', role: 'active', tags: ['acid'], what: 'A gentler exfoliating acid.', helps: ['Texture', 'Acne', 'Dark spots'], good: 'is a gentler exfoliating acid for breakouts and texture.' },
  { match: /^azelaic acid$/, name: 'Azelaic acid', role: 'active', what: 'Calms redness and fades marks.', helps: ['Acne', 'Redness', 'Dark spots'], good: 'calms redness and fades dark marks.' },
  { match: /^benzoyl peroxide$/, name: 'Benzoyl peroxide', role: 'active', tags: ['drying'], what: 'Kills acne bacteria. Can dry skin and bleach fabric.', helps: ['Acne'], good: 'kills the bacteria behind breakouts.' },
  { match: /^retinol$|^retinal$|^retinaldehyde$|^retinyl (palmitate|acetate|propionate)$|^hydroxypinacolone retinoate$/, name: 'Retinoid', role: 'active', tags: ['retinoid'], what: 'Speeds up skin renewal for smoother skin. Can irritate at first.', helps: ['Fine lines', 'Texture', 'Acne', 'Dark spots'], good: 'speeds up skin renewal for smoother skin over time.', reg: 'The EU limits retinol to 0.3% in face products and 0.05% in body lotions, phased in from 2025. Avoid during pregnancy unless a doctor says otherwise.' },
  { match: /^adapalene$/, name: 'Adapalene', role: 'active', tags: ['retinoid'], what: 'A retinoid for acne, sold over the counter in the US.', helps: ['Acne', 'Texture'], good: 'is a proven retinoid for acne.' },
  { match: /^bakuchiol$/, name: 'Bakuchiol', role: 'active', what: 'A plant-based, gentler alternative to retinol.', helps: ['Fine lines', 'Texture'], good: 'is a gentler, plant-based alternative to retinol.' },
  { match: /^ascorbic acid$|^sodium ascorbyl phosphate$|^magnesium ascorbyl phosphate$|^ascorbyl glucoside$|^3-o-ethyl ascorbic acid$|^ethyl ascorbic acid$|^tetrahexyldecyl ascorbate$/, name: 'Vitamin C', role: 'active', what: 'Brightens and helps fade dark spots.', helps: ['Dark spots', 'Dullness', 'Fine lines'], good: 'brightens skin and helps fade dark spots.' },
  { match: /^tranexamic acid$/, name: 'Tranexamic acid', role: 'active', what: 'Helps fade stubborn dark patches.', helps: ['Dark spots'], good: 'helps fade stubborn dark patches.' },
  { match: /^alpha-arbutin$|^arbutin$/, name: 'Arbutin', role: 'active', what: 'Fades dark spots.', helps: ['Dark spots'], good: 'helps fade dark spots.', reg: 'The EU limits alpha-arbutin to 2% in face creams and 0.5% in body lotions.' },
  { match: /^kojic acid$/, name: 'Kojic acid', role: 'active', what: 'Fades dark spots. Can irritate some skin.', helps: ['Dark spots'], good: 'helps fade dark spots.', reg: 'The EU limits kojic acid to 1% in face and hand products.' },
  { match: /^glycyrrhiza glabra|^dipotassium glycyrrhizate$/, name: 'Licorice extract', role: 'support', what: 'Soothes and brightens.', helps: ['Redness', 'Dark spots'], good: 'soothes redness and gently brightens.' },
  { match: /^squalane$/, name: 'Squalane', role: 'support', what: 'Light oil that softens without feeling greasy.', helps: ['Dryness', 'Frizz'], good: "is a light oil that softens without feeling greasy." },
  { match: /^butyrospermum parkii|^shea butter/, name: 'Shea butter', role: 'support', what: 'Rich fat that softens rough, dry patches.', helps: ['Body dryness', 'Dryness', 'Frizz'], good: 'softens rough, dry patches.' },
  { match: /^urea$/, name: 'Urea', role: 'active', what: 'Hydrates and smooths rough, flaky skin.', helps: ['Body dryness', 'Dryness', 'Texture'], good: 'hydrates and smooths rough, flaky skin.' },
  { match: /^(palmitoyl|acetyl|copper) .*(peptide|tripeptide|tetrapeptide|pentapeptide|hexapeptide)|^copper tripeptide-1$/, name: 'Peptides', role: 'support', what: 'May support firmer skin. Evidence is still limited.', helps: ['Fine lines'], good: 'may support firmer-looking skin, though the evidence is still limited.' },
  { match: /^zinc oxide$/, name: 'Zinc oxide', role: 'filter', what: 'Mineral sunscreen filter. Gentle on sensitive skin.', helps: ['Sensitivity', 'Redness', 'Dark spots'], good: 'is a gentle mineral sunscreen filter.' },
  { match: /^titanium dioxide$/, name: 'Titanium dioxide', role: 'filter', what: 'Mineral sunscreen filter.', helps: ['Dark spots'], good: 'is a mineral sunscreen filter.' },
  { match: /^butyl methoxydibenzoylmethane$|^avobenzone$/, name: 'Avobenzone', role: 'filter', what: 'UVA sunscreen filter.', helps: ['Dark spots', 'Fine lines'], good: 'protects against UVA, the rays behind ageing and dark spots.' },
  { match: /^benzophenone-3$|^oxybenzone$/, name: 'Oxybenzone', role: 'filter', what: 'Chemical sunscreen filter.', reg: 'The EU limits oxybenzone to 6% in face products and 2.2% in body products, and Hawaii bans sunscreens that contain it.' },
  { match: /^homosalate$/, name: 'Homosalate', role: 'filter', what: 'Chemical sunscreen filter.', reg: 'The EU allows homosalate up to 7.34% and only in face products.' },
  { match: /^argania spinosa|^argan oil/, name: 'Argan oil', role: 'support', what: 'Smooths and softens hair and skin.', helps: ['Frizz', 'Dryness'], good: 'smooths frizz and softens.' },

  // --- hair ---
  { match: /^piroctone olamine$/, name: 'Piroctone olamine', role: 'active', what: 'Anti-dandruff active.', helps: ['Dandruff'], good: 'is the anti-dandruff active. It calms flakes by slowing the yeast that causes them.' },
  { match: /^ketoconazole$/, name: 'Ketoconazole', role: 'active', what: 'Antifungal that treats dandruff.', helps: ['Dandruff'], good: 'is an antifungal that treats dandruff.' },
  { match: /^selenium sulfide$/, name: 'Selenium sulfide', role: 'active', what: 'Treats dandruff and flaking.', helps: ['Dandruff'], good: 'treats dandruff and flaking.' },
  { match: /^zinc pyrithione$/, name: 'Zinc pyrithione', role: 'active', what: 'Anti-dandruff active.', helps: ['Dandruff'], good: 'is an anti-dandruff active.', reg: 'Banned in EU cosmetics since March 2022, including anti-dandruff shampoo. Still allowed in the US.' },
  { match: /^(hydrolyzed )?keratin$/, name: 'Keratin', role: 'support', what: 'Helps smooth and strengthen hair.', helps: ['Frizz', 'Hair fall'], good: 'helps smooth and strengthen hair.' },
  { match: /^(behentrimonium|cetrimonium|stearalkonium) (chloride|methosulfate)$|^guar hydroxypropyltrimonium chloride$|^polyquaternium-(7|10|11)$|^amodimethicone$/, name: 'Conditioning agent', role: 'support', what: 'Detangles and smooths hair.', helps: ['Frizz'], good: 'detangles and smooths hair.' },
  { match: /^caffeine$/, name: 'Caffeine', role: 'support', what: 'Often added for hair growth. Evidence is limited.', helps: ['Hair fall'], good: 'is often added for hair growth, though the evidence is limited.' },
  { match: /^minoxidil$/, name: 'Minoxidil', role: 'active', what: 'FDA-approved treatment for hair thinning.', helps: ['Hair fall'], good: 'is an FDA-approved treatment for thinning hair.' },

  // --- worth knowing ---
  { match: /^parfum$|^fragrance$|^aroma$|^perfume$/, name: 'Fragrance', role: 'flag', tags: ['fragrance'], what: 'Added scent. A common cause of irritation.' },
  { match: /^(linalool|limonene|citronellol|geraniol|citral|eugenol|isoeugenol|coumarin|hexyl cinnamal|benzyl salicylate|benzyl benzoate|benzyl cinnamate|cinnamal|cinnamyl alcohol|hydroxycitronellal|amyl cinnamal|amylcinnamyl alcohol|farnesol|anise alcohol|alpha-isomethyl ionone)$/, name: 'Fragrance allergen', role: 'flag', tags: ['fragrance', 'allergen'], what: 'A fragrance ingredient the EU makes brands list by name because it can cause allergies.' },
  { match: /^benzyl alcohol$/, name: 'Benzyl alcohol', role: 'base', what: 'A preservative. Rarely irritating at normal levels.' },
  { match: /^butylphenyl methylpropional$|^lilial$/, name: 'Butylphenyl methylpropional (Lilial)', role: 'flag', tags: ['fragrance', 'allergen'], what: 'A fragrance ingredient.', reg: 'Banned in EU cosmetics since March 2022.' },
  { match: /^hydroxyisohexyl 3-cyclohexene carboxaldehyde$/, name: 'Lyral', role: 'flag', tags: ['fragrance', 'allergen'], what: 'A fragrance ingredient and strong allergen.', reg: 'Banned in EU cosmetics.' },
  { match: /oil$/, test: (n) => /^(lavandula|citrus|mentha|eucalyptus|rosmarinus|melaleuca|cymbopogon|pelargonium|cananga|salvia|origanum|cinnamomum|eugenia|juniperus|cedrus|santalum)\b/.test(n), name: 'Essential oil', role: 'flag', tags: ['essential_oil', 'fragrance'], what: 'A plant essential oil. Smells nice, can irritate sensitive skin.' },
  { match: /^alcohol denat\.?$|^sd alcohol|^denatured alcohol$|^alcohol$|^ethanol$/, name: 'Alcohol denat.', role: 'flag', tags: ['alcohol', 'drying'], what: 'Drying alcohol. Feels light, but can dry out skin when it is high on the list.' },
  { match: /^sodium (lauryl|laureth|coco) sulfate$|^ammonium (lauryl|laureth) sulfate$|^sodium myreth sulfate$/, name: 'Sulfate cleanser', role: 'flag', tags: ['sulfate', 'drying'], what: 'Strong foaming cleanser. Can leave skin or scalp feeling tight.' },
  { match: /^cyclopentasiloxane$|^cyclotetrasiloxane$|^cyclohexasiloxane$/, name: 'Cyclic silicone', role: 'flag', tags: ['silicone'], what: 'A silicone for a silky feel.', reg: 'The EU limits it to 0.1% in rinse-off products since 2020 and in leave-on products from June 2027, for environmental reasons. Not a known skin risk.' },
  { match: /(cone|conol|siloxane)$|^dimethicone/, name: 'Silicone', role: 'base', tags: ['silicone'], what: 'Silicone for a smooth, silky feel.' },
  { match: /^(methyl|ethyl|propyl|butyl)paraben$/, name: 'Paraben', role: 'flag', tags: ['paraben'], what: 'A preservative. Safe at allowed levels, though some people choose to avoid parabens.', regFn: (n) => n === 'propylparaben' || n === 'butylparaben' ? 'The EU limits propyl- and butylparaben to 0.14% combined and bans them in leave-on products for the nappy area.' : n === 'methylparaben' ? 'The EU allows methylparaben up to 0.4%.' : null },
  { match: /^isobutylparaben$|^isopropylparaben$|^benzylparaben$|^pentylparaben$/, name: 'Restricted paraben', role: 'flag', tags: ['paraben'], what: 'A preservative.', reg: 'Banned in EU cosmetics since 2014.' },
  { match: /^methylisothiazolinone$|^methylchloroisothiazolinone$/, name: 'Isothiazolinone preservative', role: 'flag', tags: ['allergen'], what: 'A preservative and common cause of skin allergies.', reg: 'The EU bans methylisothiazolinone in leave-on products and allows the MCI/MI mix only in rinse-off products at very low levels.' },
  { match: /^dmdm hydantoin$|^imidazolidinyl urea$|^diazolidinyl urea$|^2-bromo-2-nitropropane-1,3-diol$|^bronopol$/, name: 'Formaldehyde releaser', role: 'flag', tags: ['allergen'], what: 'A preservative that slowly releases formaldehyde.', reg: 'The EU requires a "releases formaldehyde" warning above a set threshold.' },
  { match: /^quaternium-15$/, name: 'Quaternium-15', role: 'flag', tags: ['allergen'], what: 'A preservative that releases formaldehyde.', reg: 'Banned in EU cosmetics.' },
  { match: /^triclosan$/, name: 'Triclosan', role: 'flag', what: 'An antibacterial.', reg: 'Banned in US consumer antiseptic washes since 2016, and restricted to low levels in specific EU products.' },
  { match: /^hydroquinone$/, name: 'Hydroquinone', role: 'flag', what: 'A strong skin lightener.', reg: 'Banned in EU cosmetics. In the US it has needed a prescription since 2020.' },
  { match: /^phenoxyethanol$/, name: 'Phenoxyethanol', role: 'base', what: 'A common preservative.', reg: 'The EU and Japan allow it up to 1%. Not a concern at that level for most skin.' },
  { match: /^cocos nucifera|^coconut oil$/, name: 'Coconut oil', role: 'base', tags: ['coconut'], what: 'A rich oil. Can clog pores for some people.' },
  { match: /^menthol$|^camphor$/, name: 'Menthol', role: 'flag', tags: ['drying'], what: 'Gives a cooling tingle. Can irritate sensitive skin.' },
  { match: /^talc$/, name: 'Talc', role: 'base', what: 'A powder that absorbs oil.', reg: 'Cosmetic talc must be free of asbestos. The US FDA proposed asbestos-testing rules in 2024.' },
];
});
