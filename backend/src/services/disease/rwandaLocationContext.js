const PROVINCE_PROFILES = {
  north: {
    province: "Northern",
    agroEcologicalZone: "highland",
    climatePattern: "cooler temperatures with frequent moisture and fog in some districts",
    diseasePressure: "higher foliar fungal pressure during wet periods due to humidity and canopy moisture",
    advisoryFocus: [
      "airflow and spacing",
      "leaf wetness reduction",
      "timely scouting during rainy periods",
    ],
  },
  south: {
    province: "Southern",
    agroEcologicalZone: "mixed highland and mid-altitude zones",
    climatePattern: "variable rainfall with some humid areas and erosion-prone slopes",
    diseasePressure: "moderate to high foliar disease pressure during rainy seasons",
    advisoryFocus: [
      "drainage and slope management",
      "canopy sanitation",
      "regular scouting",
    ],
  },
  east: {
    province: "Eastern",
    agroEcologicalZone: "warmer lowland and plateau zones",
    climatePattern: "hotter and often drier conditions with localized rainfall and irrigation reliance",
    diseasePressure: "lower continuous leaf wetness but disease outbreaks may follow irrigation or rainfall events",
    advisoryFocus: [
      "water management",
      "post-rain scouting",
      "heat and stress reduction",
    ],
  },
  west: {
    province: "Western",
    agroEcologicalZone: "humid highland and lakeside zones",
    climatePattern: "high rainfall and humidity in many districts",
    diseasePressure: "high fungal disease pressure due to persistent moisture",
    advisoryFocus: [
      "fungal prevention timing",
      "air circulation",
      "sanitation and residue management",
    ],
  },
  kigali: {
    province: "Kigali City",
    agroEcologicalZone: "urban/peri-urban mid-altitude",
    climatePattern: "moderate urban microclimate with peri-urban variability",
    diseasePressure: "variable disease pressure depending on local moisture and field density",
    advisoryFocus: [
      "localized scouting",
      "sanitation",
      "small-plot management",
    ],
  },
};

const DISTRICTS = {
  burera: { district: "Burera", provinceKey: "north", altitudeProfile: "highland", rainfallBias: "high" },
  gakenke: { district: "Gakenke", provinceKey: "north", altitudeProfile: "highland", rainfallBias: "moderate-high" },
  gicumbi: { district: "Gicumbi", provinceKey: "north", altitudeProfile: "highland", rainfallBias: "high" },
  musanze: { district: "Musanze", provinceKey: "north", altitudeProfile: "high-altitude volcanic highland", rainfallBias: "high" },
  rulindo: { district: "Rulindo", provinceKey: "north", altitudeProfile: "mid-highland", rainfallBias: "moderate-high" },

  gisagara: { district: "Gisagara", provinceKey: "south", altitudeProfile: "mid-altitude", rainfallBias: "moderate" },
  huye: { district: "Huye", provinceKey: "south", altitudeProfile: "mid-altitude", rainfallBias: "moderate" },
  kamonyi: { district: "Kamonyi", provinceKey: "south", altitudeProfile: "mid-altitude", rainfallBias: "moderate" },
  muhanga: { district: "Muhanga", provinceKey: "south", altitudeProfile: "mid-highland", rainfallBias: "moderate" },
  nyamagabe: { district: "Nyamagabe", provinceKey: "south", altitudeProfile: "highland", rainfallBias: "high" },
  nyanza: { district: "Nyanza", provinceKey: "south", altitudeProfile: "mid-altitude", rainfallBias: "moderate" },
  nyaruguru: { district: "Nyaruguru", provinceKey: "south", altitudeProfile: "highland", rainfallBias: "high" },
  ruhango: { district: "Ruhango", provinceKey: "south", altitudeProfile: "mid-altitude", rainfallBias: "moderate" },

  bugesera: { district: "Bugesera", provinceKey: "east", altitudeProfile: "lowland", rainfallBias: "low-moderate" },
  gatsibo: { district: "Gatsibo", provinceKey: "east", altitudeProfile: "plateau", rainfallBias: "low-moderate" },
  kayonza: { district: "Kayonza", provinceKey: "east", altitudeProfile: "plateau/lowland", rainfallBias: "low-moderate" },
  kirehe: { district: "Kirehe", provinceKey: "east", altitudeProfile: "lowland", rainfallBias: "low" },
  ngoma: { district: "Ngoma", provinceKey: "east", altitudeProfile: "plateau", rainfallBias: "moderate" },
  nyagatare: { district: "Nyagatare", provinceKey: "east", altitudeProfile: "lowland/plateau", rainfallBias: "low" },
  rwamagana: { district: "Rwamagana", provinceKey: "east", altitudeProfile: "plateau", rainfallBias: "moderate" },

  karongi: { district: "Karongi", provinceKey: "west", altitudeProfile: "humid highland/lakeside", rainfallBias: "high" },
  ngororero: { district: "Ngororero", provinceKey: "west", altitudeProfile: "highland", rainfallBias: "high" },
  nyabihu: { district: "Nyabihu", provinceKey: "west", altitudeProfile: "high-altitude highland", rainfallBias: "high" },
  nyamasheke: { district: "Nyamasheke", provinceKey: "west", altitudeProfile: "humid lakeside highland", rainfallBias: "high" },
  rubavu: { district: "Rubavu", provinceKey: "west", altitudeProfile: "lakeside and volcanic highland", rainfallBias: "high" },
  rusizi: { district: "Rusizi", provinceKey: "west", altitudeProfile: "lowland/lakeside", rainfallBias: "moderate-high" },
  rutsiro: { district: "Rutsiro", provinceKey: "west", altitudeProfile: "humid highland", rainfallBias: "high" },

  gasabo: { district: "Gasabo", provinceKey: "kigali", altitudeProfile: "mid-altitude urban/peri-urban", rainfallBias: "moderate" },
  kicukiro: { district: "Kicukiro", provinceKey: "kigali", altitudeProfile: "mid-altitude urban/peri-urban", rainfallBias: "moderate" },
  nyarugenge: { district: "Nyarugenge", provinceKey: "kigali", altitudeProfile: "urban/peri-urban", rainfallBias: "moderate" },
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z\s-]/g, "");

const districtKey = (value) => normalizeKey(value).replace(/\s+/g, "");

const provinceKeyFromValue = (value) => {
  const normalized = normalizeKey(value);
  if (normalized.includes("north")) return "north";
  if (normalized.includes("south")) return "south";
  if (normalized.includes("east")) return "east";
  if (normalized.includes("west")) return "west";
  if (normalized.includes("kigali")) return "kigali";
  return null;
};

const districtEntryFromValue = (value) => {
  const key = districtKey(value);
  return DISTRICTS[key] || null;
};

const parseLocationString = (value) => {
  const parts = String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // Accept patterns like "Musanze, Northern, Rwanda" or "Eastern Province, Rwanda".
  let district = null;
  let province = null;

  parts.forEach((part) => {
    const districtMatch = districtEntryFromValue(part);
    if (districtMatch && !district) {
      district = districtMatch.district;
    }
    const provinceMatch = provinceKeyFromValue(part);
    if (provinceMatch && !province) {
      province = PROVINCE_PROFILES[provinceMatch].province;
    }
  });

  return { district, province };
};

const resolveRwandaLocationContext = ({ location, locationContext }) => {
  const incoming = locationContext && typeof locationContext === "object" ? locationContext : {};
  const parsedFromString = location ? parseLocationString(location) : { district: null, province: null };

  const districtValue = incoming.district || parsedFromString.district || null;
  const provinceValue = incoming.province || parsedFromString.province || "Rwanda";
  const countryValue = incoming.country || "Rwanda";
  const sectorValue = incoming.sector || null;
  const notesValue = incoming.notes || null;

  const districtEntry = districtValue ? districtEntryFromValue(districtValue) : null;
  const provinceKey = districtEntry?.provinceKey || provinceKeyFromValue(provinceValue) || null;
  const provinceProfile = provinceKey ? PROVINCE_PROFILES[provinceKey] : null;

  const normalizedProvince = districtEntry
    ? PROVINCE_PROFILES[districtEntry.provinceKey].province
    : provinceProfile?.province || "Rwanda";

  const normalizedDistrict = districtEntry?.district || districtValue || null;

  const descriptorParts = [
    normalizedDistrict,
    sectorValue,
    normalizedProvince && normalizedProvince !== "Rwanda" ? normalizedProvince : null,
    countryValue || "Rwanda",
  ].filter(Boolean);

  return {
    country: countryValue || "Rwanda",
    province: normalizedProvince,
    district: normalizedDistrict,
    sector: sectorValue,
    notes: notesValue,
    displayLocation: descriptorParts.join(", "),
    agroEcologicalZone: districtEntry?.altitudeProfile || provinceProfile?.agroEcologicalZone || "unknown",
    climatePattern: provinceProfile?.climatePattern || "local climate pattern not specified",
    diseasePressure: provinceProfile?.diseasePressure || "disease pressure varies by local field conditions",
    advisoryFocus: provinceProfile?.advisoryFocus || ["scouting frequency", "field sanitation"],
    rainfallBias: districtEntry?.rainfallBias || "variable",
    districtRecognized: Boolean(districtEntry),
    provinceRecognized: Boolean(provinceProfile),
  };
};

module.exports = {
  resolveRwandaLocationContext,
};
