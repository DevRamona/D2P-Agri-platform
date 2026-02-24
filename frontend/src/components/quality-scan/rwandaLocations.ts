export type RwandaProvinceOption = {
  key: string;
  label: string;
  districts: string[];
};

export const RWANDA_PROVINCES: RwandaProvinceOption[] = [
  {
    key: "Northern",
    label: "Northern Province",
    districts: ["Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo"],
  },
  {
    key: "Southern",
    label: "Southern Province",
    districts: ["Gisagara", "Huye", "Kamonyi", "Muhanga", "Nyamagabe", "Nyanza", "Nyaruguru", "Ruhango"],
  },
  {
    key: "Eastern",
    label: "Eastern Province",
    districts: ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"],
  },
  {
    key: "Western",
    label: "Western Province",
    districts: ["Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro"],
  },
  {
    key: "Kigali City",
    label: "Kigali City",
    districts: ["Gasabo", "Kicukiro", "Nyarugenge"],
  },
];

export const DEFAULT_RWANDA_PROVINCE = "Northern";
export const DEFAULT_RWANDA_DISTRICT = "Musanze";
