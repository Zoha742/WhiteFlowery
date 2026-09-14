/* ============================================================
   WhiteFlowery — Shared Cloud Database (Firebase Realtime DB)
   ------------------------------------------------------------
   এই ফাইলটা প্রতিটা পেজে অন্য স্ক্রিপ্টের আগে যোগ করা আছে:
       <script src="db.js"></script>

   SETUP (৫ মিনিট, সম্পূর্ণ ফ্রি, কার্ড লাগে না):
   1. console.firebase.google.com  ->  Add project  (নাম: whiteflowery)
   2. Build -> Realtime Database -> Create Database
        -> location: any  -> "Start in test mode" -> Enable
   3. উপরে যে URL দেখাবে সেটা কপি করে নিচের DB_URL এ বসান।
        উদাহরণ: https://whiteflowery-1234-default-rtdb.firebaseio.com
        (শেষে / বা .json দেবেন না)
   4. নিচের ADMIN_IDS এ আপনার নিজের Telegram user id বসান।
        আপনার id জানতে টেলিগ্রামে @userinfobot এ /start দিন।
   5. চারটা HTML + এই db.js একসাথে একই ফোল্ডারে হোস্ট করুন
      (GitHub Pages / Netlify — দুটোই ফ্রি)।

   ⚠️ Test mode ৩০ দিন পর বন্ধ হয়ে যায়। তার আগে Rules ট্যাবে গিয়ে
      নিচের মতো দিন (সবাই পড়তে পারবে, লিখতে পারবে — পরে বট দিয়ে
      সিকিউর করা যাবে):
      {
        "rules": { ".read": true, ".write": true }
      }
   ============================================================ */

const DB_URL = "https://YOUR-PROJECT-default-rtdb.firebaseio.com";

/* আপনার Telegram user id (একাধিক অ্যাডমিন হলে কমা দিয়ে লিখুন) */
const ADMIN_IDS = [123456789];

const DEFAULT_CATEGORIES = ['Winter', 'Summer', 'All-Time', 'Party Wear', 'Casual Sets'];

/* ---------------- Low level helpers ---------------- */

function dbReady() {
  return DB_URL && DB_URL.indexOf("YOUR-PROJECT") === -1;
}

async function dbGetRaw(path) {
  if (!dbReady()) { console.warn("DB_URL not set in db.js"); return null; }
  try {
    const r = await fetch(`${DB_URL}/${path}.json`);
    return await r.json();
  } catch (e) {
    console.error("dbGetRaw failed:", path, e);
    return null;
  }
}

/* Firebase object -> array, প্রতিটা আইটেমে _key যোগ করা হয় */
async function dbGetList(path) {
  const data = await dbGetRaw(path);
  if (!data || typeof data !== 'object') return [];
  return Object.keys(data).map(k => ({ ...data[k], _key: k }));
}

async function dbPush(path, obj) {
  const r = await fetch(`${DB_URL}/${path}.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  });
  const res = await r.json();
  return res && res.name;
}

async function dbSet(path, value) {
  await fetch(`${DB_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value)
  });
}

async function dbUpdate(path, key, patch) {
  await fetch(`${DB_URL}/${path}/${key}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
}

async function dbDelete(path, key) {
  await fetch(`${DB_URL}/${path}/${key}.json`, { method: "DELETE" });
}

/* ---------------- Products ---------------- */

/* সব প্রোডাক্ট, নতুনগুলো আগে */
async function getDresses() {
  const list = await dbGetList("dresses");
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function saveDress(dress) {
  dress.createdAt = Date.now();
  return await dbPush("dresses", dress);
}

async function updateDress(key, patch) { return dbUpdate("dresses", key, patch); }
async function deleteDress(key)        { return dbDelete("dresses", key); }

/* ---------------- Categories ---------------- */

async function getCategories() {
  const cats = await dbGetRaw("categories");
  if (Array.isArray(cats) && cats.length) return cats;
  return DEFAULT_CATEGORIES;
}

async function saveCategories(list) {
  return dbSet("categories", list);
}

/* ---------------- Orders ---------------- */

/* সব অ্যাকাউন্টের সব অর্ডার (admin) */
async function getAllOrders() {
  const list = await dbGetList("orders");
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/* একজন বায়ারের নিজের অর্ডার (orders.html এ ব্যবহার করুন) */
async function getMyOrders(userId) {
  const uid = String(userId || currentUserId());
  const all = await getAllOrders();
  return all.filter(o => String(o.userId) === uid);
}

/* চেকআউটের সময় (cart.html / checkout.html এ ব্যবহার করুন) */
async function placeOrder(order) {
  order.createdAt   = order.createdAt || Date.now();
  order.orderId     = order.orderId || 'WF' + Date.now().toString().slice(-6);
  order.userId      = currentUserId();
  order.userName    = currentUserName();
  order.status      = order.status || 'Pending';
  return await dbPush("orders", order);
}

async function updateOrder(key, patch) { return dbUpdate("orders", key, patch); }
async function deleteOrder(key)        { return dbDelete("orders", key); }

/* ---------------- Telegram user ---------------- */

function currentUserId() {
  const u = window.Telegram && window.Telegram.WebApp &&
            window.Telegram.WebApp.initDataUnsafe &&
            window.Telegram.WebApp.initDataUnsafe.user;
  return u ? u.id : 'guest';
}

function currentUserName() {
  const u = window.Telegram && window.Telegram.WebApp &&
            window.Telegram.WebApp.initDataUnsafe &&
            window.Telegram.WebApp.initDataUnsafe.user;
  if (!u) return 'Guest';
  return [u.first_name, u.last_name].filter(Boolean).join(' ') ||
         (u.username ? '@' + u.username : 'Guest');
}

/* ---------------- Admin guard ----------------
   dressadd.html ও ordermanage.html এর শুরুতে কল করা আছে।
   ADMIN_IDS এ নিজের id না বসানো পর্যন্ত পেজ খুলবে না।             */

function requireAdmin() {
  if (!ADMIN_IDS.map(String).includes(String(currentUserId()))) {
    document.body.innerHTML =
      '<div style="padding:60px 20px;text-align:center;font-family:sans-serif;color:#111">' +
      '<div style="font-size:40px">⛔</div>' +
      '<h3>Admin Only</h3>' +
      '<p style="font-size:13px;color:#666">এই পেজটি শুধু শপ অ্যাডমিনের জন্য।</p>' +
      '</div>';
    throw new Error("not admin");
  }
}
