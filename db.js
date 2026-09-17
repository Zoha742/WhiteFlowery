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
   4. সব HTML ফাইল + এই db.js একসাথে একই ফোল্ডারে হোস্ট করুন
      (GitHub Pages / Netlify — দুটোই ফ্রি)।

   এই অ্যাপ এখন সম্পূর্ণ ফ্রি/খোলা — কোনো Telegram user id বসাতে
   হবে না, যে কেউ প্রোডাক্ট অ্যাড ও অর্ডার ম্যানেজ করতে পারবে।

   ⚠️ Test mode ৩০ দিন পর বন্ধ হয়ে যায়। তার আগে Rules ট্যাবে গিয়ে
      নিচের মতো দিন (সবাই পড়তে পারবে, লিখতে পারবে — পরে বট দিয়ে
      সিকিউর করা যাবে):
      {
        "rules": { ".read": true, ".write": true }
      }
   ============================================================ */

const DB_URL = "https://shop-6f00f-default-rtdb.firebaseio.com";

/* আপনার Telegram user id (ঐচ্ছিক)।
   এই অ্যাপ এখন সবার জন্য ফ্রি/খোলা রাখা হয়েছে, তাই ADMIN_IDS
   খালি রাখা আছে এবং requireAdmin() কিছুই আটকায় না।
   ভবিষ্যতে যদি dressadd/ordermanage শুধু নিজের জন্য লক করতে চান,
   এখানে নিজের আইডি বসিয়ে নিচের requireAdmin() ফাংশনের
   ভেতরের "return;" লাইনটা মুছে দিলেই লক আবার চালু হয়ে যাবে। */
const ADMIN_IDS = [];

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

/* ---------------- Reviews ----------------
   প্রতিটা রিভিউ একটা নির্দিষ্ট অর্ডার-আইটেমের (প্রোডাক্টের) সাথে জোড়া।
   productId হিসেবে সবসময় dress._key (Firebase key) পাঠানো ভালো —
   সেটা না থাকলে productName দিয়ে fallback matching হয় (shop.html দেখুন)। */

/* সব রিভিউ, নতুন আগে — moderation-এর জন্য (ordermanage.html) */
async function getAllReviews() {
  const list = await dbGetList("reviews");
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/* একটা নির্দিষ্ট প্রোডাক্টের রিভিউ (shop.html-এ ব্যবহার করুন) */
async function getReviewsForProduct(productId) {
  const all = await getAllReviews();
  return all.filter(r => r.productId === productId);
}

async function saveReview(review) {
  review.createdAt = review.createdAt || Date.now();
  review.userId = review.userId || currentUserId();
  review.userName = review.userName || currentUserName();
  return await dbPush("reviews", review);
}

async function deleteReview(key) { return dbDelete("reviews", key); }

/* ---------------- Site Config (landing page cover banner) ---------------- */

async function getSiteConfig() {
  const cfg = await dbGetRaw("siteConfig");
  return cfg || {};
}

async function saveSiteConfig(patch) {
  const current = await getSiteConfig();
  const merged = { ...current, ...patch };
  return dbSet("siteConfig", merged);
}

/* ---------------- Notifications (broadcast) ---------------- */

async function getNotifications() {
  const list = await dbGetList("notifications");
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function saveNotification(notif) {
  notif.createdAt = Date.now();
  return await dbPush("notifications", notif);
}

/* ---------------- Support tickets ---------------- */

async function getSupportTickets() {
  const list = await dbGetList("supportTickets");
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function saveSupportTicket(ticket) {
  ticket.createdAt = Date.now();
  ticket.userId = currentUserId();
  ticket.userName = currentUserName();
  ticket.status = ticket.status || "Open";
  return await dbPush("supportTickets", ticket);
}

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
   এই অ্যাপ এখন সবার জন্য ফ্রি/খোলা — requireAdmin() কল হলেও
   কিছু আটকায় না। পরে লক করতে চাইলে নিচের "return;" লাইনটা মুছে দিন
   এবং ADMIN_IDS এ নিজের Telegram id বসান।                        */

function requireAdmin() {
  return; // ডেমো/ফ্রি মোড — কোনো লক নেই
  // eslint-disable-next-line no-unreachable
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
