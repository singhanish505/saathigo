// Seed data: 6 cities, ~600 drivers spread across them.
// Used for both MOCK_MODE and as a quick demo dataset.

const cities = [
  { code: 'BLR', name: 'Bangalore',   center: [12.9716, 77.5946], tier: 'metro' },
  { code: 'MUM', name: 'Mumbai',      center: [19.0760, 72.8777], tier: 'metro' },
  { code: 'DEL', name: 'Delhi',       center: [28.6139, 77.2090], tier: 'metro' },
  { code: 'PUN', name: 'Pune',        center: [18.5204, 73.8567], tier: 'metro' },
  { code: 'HYD', name: 'Hyderabad',   center: [17.3850, 78.4867], tier: 'metro' },
  { code: 'PAT', name: 'Patna',       center: [25.5941, 85.1376], tier: 'tier2' },
];

function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const firstNames = ['Ramesh','Suresh','Priya','Lakshmi','Anil','Sushma','Rahul','Vikram','Pooja','Anita','Manoj','Deepika','Ravi','Sunita','Karan','Meera','Arjun','Kavita','Nitin','Asha'];
const lastNames  = ['Kumar','Singh','Sharma','Reddy','Iyer','Patel','Mehta','Rao','Desai','Gupta','Nair','Khan','Pillai','Yadav','Mishra','Verma'];
const evModels   = ['Tata Tigor EV','Tata Nexon EV','Mahindra eVerito','BYD e6','MG ZS EV','Hyundai Kona Electric'];

function generateDrivers(memMap) {
  let id = 1;
  for (const city of cities) {
    const count = city.tier === 'metro' ? 120 : 60;
    for (let i = 0; i < count; i++) {
      const driverId = `drv_${city.code.toLowerCase()}_${String(id++).padStart(5, '0')}`;
      const isWoman = Math.random() < 0.18;
      const isEv = Math.random() < 0.55;
      const lat = city.center[0] + rand(-0.05, 0.05);
      const lng = city.center[1] + rand(-0.06, 0.06);
      const driver = {
        id: driverId,
        name: pick(firstNames) + ' ' + pick(lastNames),
        gender: isWoman ? 'F' : 'M',
        rating: Math.round((4.4 + Math.random() * 0.6) * 100) / 100,
        trips: Math.floor(rand(120, 4500)),
        sakhiVerified: isWoman && Math.random() < 0.85,
        ev: isEv,
        coopMember: Math.random() < 0.7,
        equityPoints: Math.floor(rand(0, 12000)),
        vehicle: {
          plate: `${city.code === 'BLR' ? 'KA' : city.code === 'MUM' ? 'MH' : city.code === 'DEL' ? 'DL' : city.code === 'PUN' ? 'MH' : city.code === 'HYD' ? 'TS' : 'BR'} ${String(Math.floor(rand(1,99))).padStart(2,'0')} ${isEv?'EV':'AB'} ${String(Math.floor(rand(1000,9999)))}`,
          model: isEv ? pick(evModels) : pick(['Maruti Dzire','Hyundai Aura','Toyota Etios','Honda Amaze']),
          color: pick(['White','Silver','Black','Grey']),
        },
        city: city.code,
        online: Math.random() < 0.85,
        lastSeen: Date.now() - Math.floor(rand(0, 30000)),
      };
      memMap.drivers.set(driverId, driver);

      if (driver.online) {
        if (!memMap.geo.has(city.code)) memMap.geo.set(city.code, new Map());
        memMap.geo.get(city.code).set(driverId, { lat, lng, t: Date.now() });
      }
    }
  }
}

function seed(mem) {
  if (mem.drivers.size > 0) return; // already seeded
  generateDrivers(mem);
}

module.exports = { seed, cities };
