require("dotenv").config();
const mongoose = require("mongoose");
const Ward = require("../models/Ward");
const User = require("../models/User");

// All 32 wards of Kathmandu Metropolitan City. Coordinates are approximate
// locality centroids (good enough for nearest-ward snapping + map display
// at this MVP scale, not surveyed ward-boundary centroids). Population
// figures are rough estimates; damageSeverity is demo/placeholder data
// spread across a lower range since this is core Kathmandu, not a 2015
// epicenter district.
const WARDS = [
  { name: "Ward 1", district: "Kathmandu", locality: "Naxal", location: { type: "Point", coordinates: [85.3270, 27.7172] } },
  { name: "Ward 2", district: "Kathmandu", locality: "Lazimpat", location: { type: "Point", coordinates: [85.3210, 27.7193] } },
  { name: "Ward 3", district: "Kathmandu", locality: "Maharajgunj", location: { type: "Point", coordinates: [85.3340, 27.7360] } },
  { name: "Ward 4", district: "Kathmandu", locality: "Baluwatar", location: { type: "Point", coordinates: [85.3280, 27.7280] } },
  { name: "Ward 5", district: "Kathmandu", locality: "Hadigaun", location: { type: "Point", coordinates: [85.3350, 27.7205] } },
  { name: "Ward 6", district: "Kathmandu", locality: "Boudha", location: { type: "Point", coordinates: [85.3618, 27.7215] } },
  { name: "Ward 7", district: "Kathmandu", locality: "Mitra Park", location: { type: "Point", coordinates: [85.3540, 27.7175] } },
  { name: "Ward 8", district: "Kathmandu", locality: "Jaya Bageshwori", location: { type: "Point", coordinates: [85.3480, 27.7150] } },
  { name: "Ward 9", district: "Kathmandu", locality: "Gausala", location: { type: "Point", coordinates: [85.3465, 27.7085] } },
  { name: "Ward 10", district: "Kathmandu", locality: "Baneshwor", location: { type: "Point", coordinates: [85.3425, 27.6950] } },
  { name: "Ward 11", district: "Kathmandu", locality: "Bhag Durbar", location: { type: "Point", coordinates: [85.3180, 27.7090] } },
  { name: "Ward 12", district: "Kathmandu", locality: "Teku", location: { type: "Point", coordinates: [85.3070, 27.6950] } },
  { name: "Ward 13", district: "Kathmandu", locality: "Kalimati", location: { type: "Point", coordinates: [85.2990, 27.6960] } },
  { name: "Ward 14", district: "Kathmandu", locality: "Kalanki", location: { type: "Point", coordinates: [85.2800, 27.6935] } },
  { name: "Ward 15", district: "Kathmandu", locality: "Dallu", location: { type: "Point", coordinates: [85.2940, 27.7005] } },
  { name: "Ward 16", district: "Kathmandu", locality: "Balaju", location: { type: "Point", coordinates: [85.3030, 27.7280] } },
  { name: "Ward 17", district: "Kathmandu", locality: "Chhetrapati, Dhobichaur", location: { type: "Point", coordinates: [85.3090, 27.7080] } },
  { name: "Ward 18", district: "Kathmandu", locality: "Naradevi", location: { type: "Point", coordinates: [85.3075, 27.7045] } },
  { name: "Ward 19", district: "Kathmandu", locality: "Damaitol", location: { type: "Point", coordinates: [85.3095, 27.7050] } },
  { name: "Ward 20", district: "Kathmandu", locality: "Bhimsensthan", location: { type: "Point", coordinates: [85.3090, 27.7030] } },
  { name: "Ward 21", district: "Kathmandu", locality: "Jyawahal", location: { type: "Point", coordinates: [85.3070, 27.7040] } },
  { name: "Ward 22", district: "Kathmandu", locality: "Tewahal", location: { type: "Point", coordinates: [85.3085, 27.7035] } },
  { name: "Ward 23", district: "Kathmandu", locality: "Ombahal", location: { type: "Point", coordinates: [85.3080, 27.7055] } },
  { name: "Ward 24", district: "Kathmandu", locality: "Makhan", location: { type: "Point", coordinates: [85.3070, 27.7045] } },
  { name: "Ward 25", district: "Kathmandu", locality: "Masangalli", location: { type: "Point", coordinates: [85.3085, 27.7025] } },
  { name: "Ward 26", district: "Kathmandu", locality: "Lainchaur", location: { type: "Point", coordinates: [85.3175, 27.7165] } },
  { name: "Ward 27", district: "Kathmandu", locality: "Mahaboudha", location: { type: "Point", coordinates: [85.3110, 27.7005] } },
  { name: "Ward 28", district: "Kathmandu", locality: "Old Buspark", location: { type: "Point", coordinates: [85.3130, 27.7090] } },
  { name: "Ward 29", district: "Kathmandu", locality: "Anamnagar", location: { type: "Point", coordinates: [85.3260, 27.6965] } },
  { name: "Ward 30", district: "Kathmandu", locality: "Gyaneshwor", location: { type: "Point", coordinates: [85.3270, 27.7155] } },
  { name: "Ward 31", district: "Kathmandu", locality: "Shantinagar", location: { type: "Point", coordinates: [85.3350, 27.6990] } },
  { name: "Ward 32", district: "Kathmandu", locality: "Koteshwor", location: { type: "Point", coordinates: [85.3480, 27.6780] } },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected for seeding...");

  await Ward.deleteMany({});
  const wards = await Ward.insertMany(WARDS);
  console.log(`Seeded ${wards.length} wards`);

  await User.deleteMany({ email: { $in: ["demo-responder@saajharahat.test", "demo-coord@saajharahat.test"] } });

  const responder = new User({
    role: "responder",
    organizationName: "Himal Relief Nepal",
    loginMethod: "email",
    email: "demo-responder@saajharahat.test",
    verified: true,
  });
  await responder.setPassword("Password123!");
  await responder.save();
  console.log("Seeded demo responder: demo-responder@saajharahat.test / Password123!");

  const coordUser = new User({
    role: "ward_committee",
    fullName: "Ward Coordinator Demo",
    email: "demo-coord@saajharahat.test",
    verified: true,
  });
  await coordUser.setPassword("Password123!");
  await coordUser.save();
  console.log("Seeded demo coordination user: demo-coord@saajharahat.test / Password123!");

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});