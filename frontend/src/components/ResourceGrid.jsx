// Top-level categories. Shape ([{value, label, icon}]) is kept identical to
// before so every other screen that builds an icon lookup off this array
// (MyDistributions, PublicTransparency, Landing, ResponderHome,
// CoordinationDashboard, DuplicationAlerts) keeps working with zero changes.
const RESOURCES = [
  { value: "food", label: "Food", icon: "restaurant" },
  { value: "water", label: "Water", icon: "water_drop" },
  { value: "shelter", label: "Shelter", icon: "cabin" },
  { value: "medical", label: "Medical", icon: "medical_services" },
  { value: "electrical", label: "Electrical & Lighting", icon: "bolt" },
  { value: "clothing", label: "Clothing", icon: "checkroom" },
];

// Second-level "what specifically" options per category.
const SUBCATEGORIES = {
  food: [
    { value: "staple_grains", label: "Staple Grains (Rice, Wheat, Maize)" },
    { value: "protein_legumes", label: "Protein (Lentils, Beans, Dried Fish)" },
    { value: "cooking_essentials", label: "Cooking Essentials (Oil, Salt, Sugar)" },
    { value: "infant_nutrition", label: "Infant & Child Nutrition (Formula, Fortified Blends)" },
    { value: "high_energy_biscuits", label: "High-Energy Biscuits / Ready-to-Eat Meals" },
    { value: "maternal_nutrition", label: "Maternal & Prenatal Nutrition Supplements" },
  ],
  water: [
    { value: "drinking_water", label: "Packaged Drinking Water / Jerry Cans" },
    { value: "purification_tablets", label: "Purification Tablets / Filters" },
    { value: "storage_containers", label: "Water Storage Containers" },
  ],
  shelter: [
    { value: "tents", label: "Tents" },
    { value: "tarpaulins", label: "Tarpaulins" },
    { value: "blankets", label: "Blankets & Sleeping Mats" },
    { value: "shelter_kits", label: "Temporary Shelter Repair Kits" },
  ],
  medical: [
    { value: "first_aid", label: "First Aid Supplies" },
    { value: "wound_trauma_care", label: "Wound & Trauma Care" },
    { value: "otc_medication", label: "Over-the-Counter Medication" },
    { value: "chronic_medication", label: "Chronic Disease Medication" },
    { value: "maternal_newborn_care", label: "Maternal & Newborn Care" },
    { value: "hygiene_sanitation", label: "Hygiene & Sanitation Kits" },
  ],
  electrical: [
    { value: "torches_flashlights", label: "Torches / Flashlights" },
    { value: "batteries", label: "Batteries" },
    { value: "solar_chargers", label: "Solar Chargers / Panels" },
    { value: "power_banks", label: "Power Banks" },
    { value: "radios", label: "Radios / Communication Devices" },
  ],
  clothing: [
    { value: "adult_clothing", label: "Adult Clothing" },
    { value: "childrens_clothing", label: "Children's Clothing" },
    { value: "winter_wear", label: "Winter Wear" },
    { value: "footwear", label: "Footwear" },
    { value: "hygiene_wear", label: "Undergarments & Hygiene Wear" },
  ],
};

export default function ResourceGrid({
  value,
  onChange,
  subCategory,
  onSubCategoryChange,
  accent = "secondary",
}) {
  const selectedClasses =
    accent === "secondary"
      ? "border-secondary bg-secondary/5 text-secondary"
      : "border-primary bg-primary/5 text-primary";

  const subOptions = value ? SUBCATEGORIES[value] || [] : [];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm">
        {RESOURCES.map((r) => {
          const selected = value === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                onChange(r.value);
                if (r.value !== value) onSubCategoryChange?.("");
              }}
              className={`flex flex-col items-center justify-center gap-2 p-space-md rounded-xl border transition-colors ${selected
                  ? selectedClasses
                  : "border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
                }`}
            >
              <span className="material-symbols-outlined text-[26px]">{r.icon}</span>
              <span className="font-label-md text-label-md text-center">{r.label}</span>
            </button>
          );
        })}
      </div>

      {subOptions.length > 0 && (
        <div className="mt-space-sm">
          <p className="font-caption text-caption text-on-surface-variant mb-space-xs">
            What specifically? (optional, helps responders prioritize)
          </p>
          <div className="flex flex-wrap gap-space-xs">
            {subOptions.map((s) => {
              const selected = subCategory === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onSubCategoryChange?.(selected ? "" : s.value)}
                  className={`px-3 py-1.5 rounded-full border font-label-sm text-label-sm transition-colors ${selected
                      ? accent === "secondary"
                        ? "border-secondary bg-secondary text-on-secondary"
                        : "border-primary bg-primary text-on-primary"
                      : "border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
                    }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { RESOURCES, SUBCATEGORIES };