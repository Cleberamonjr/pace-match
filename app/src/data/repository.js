import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, query, runTransaction,
  serverTimestamp, setDoc, where
} from "firebase/firestore";
import {
  EmailAuthProvider, isSignInWithEmailLink, linkWithCredential,
  onAuthStateChanged, sendSignInLinkToEmail, signInWithEmailLink, signOut
} from "firebase/auth";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebase, hasFirebaseConfig } from "../lib/firebaseClient.js";

const AUTH_EMAIL_KEY = "pace.auth.email";
const DEFAULT_AGE_MIN = 24;
const DEFAULT_AGE_MAX = 40;

export function createRepository() {
  const services = getFirebase();
  if (!services) return unconfiguredRepository();
  return firebaseRepository(services);
}

function unconfiguredRepository() {
  const error = () => new Error("PACE ainda não está conectado ao Firebase. Configure o projeto Firebase e as variáveis VITE_FIREBASE_*.");
  return {
    mode: "unconfigured",
    async session() { return null; },
    onAuthChange() { return () => {}; },
    async signIn() { throw error(); },
    async completeEmailLink() { throw error(); },
    async signOut() { throw error(); },
    async saveProfile() { throw error(); },
    async deck() { throw error(); },
    async like() { throw error(); },
    async pass() { throw error(); },
    async matches() { throw error(); },
    async chat() { throw error(); },
    subscribeChat() { return () => {}; },
    async send() { throw error(); },
    async block() { throw error(); },
    async report() { throw error(); }
  };
}

function ageFromBirthDate(value) {
  const birth = new Date(value);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return age;
}

function birthDateFromAge(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - Number(age));
  return d.toISOString().slice(0, 10);
}

function roundCoordinate(value) {
  return Math.round(Number(value) * 100) / 100;
}

function distanceKm(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const toRad = n => n * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function normalizeProfile(data, id, photos = []) {
  return {
    ...data,
    id,
    discoverableGenders: data.discoverableGenders || [],
    age: ageFromBirthDate(data.birthDate),
    hobbies: Array.isArray(data.hobbies) ? data.hobbies.join(", ") : "",
    photo: data.photoUrls?.[0] || photos[0]?.url || "",
    photos,
    area: data.areaLabel || "perto de você",
    score: null,
    likesYou: false
  };
}

function firebaseRepository({ auth, db, storage }) {
  const current = () => auth.currentUser;

  async function loadMe(user) {
    if (!user) return null;
    const profileSnap = await getDoc(doc(db, "profiles", user.uid));
    if (!profileSnap.exists()) return { auth: user, me: null, matches: [] };

    const [prefsSnap, sportSnap, photosSnap] = await Promise.all([
      getDoc(doc(db, "preferences", user.uid)),
      getDoc(doc(db, "sportProfiles", user.uid)),
      getDocs(query(collection(db, "photos"), where("userId", "==", user.uid)))
    ]);

    const profile = profileSnap.data();
    const prefs = prefsSnap.exists() ? prefsSnap.data() : {};
    const sport = sportSnap.exists() ? sportSnap.data() : {};
    const photos = photosSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    return {
      auth: user,
      me: {
        ...normalizeProfile(profile, user.uid, photos),
        name: profile.name || "",
        gender: profile.gender || "",
        ageMin: prefs.ageMin ?? DEFAULT_AGE_MIN,
        ageMax: prefs.ageMax ?? DEFAULT_AGE_MAX,
        radiusKm: prefs.radiusKm ?? 15,
        seeking: prefs.seeking?.length === 1 ? prefs.seeking[0] : "todos",
        intention: prefs.intention || "",
        sportMatters: Boolean(prefs.sportMatters),
        sport: sport.sport || "",
        frequency: sport.frequency || "",
        bio: profile.bio || "",
        area: profile.areaLabel || "",
        gps: Boolean(profile.geo),
        coords: profile.geo ? { latitude: profile.geo.lat, longitude: profile.geo.lng } : null,
        blocked: []
      },
      matches: await listMatches(user.uid)
    };
  }

  async function listMatches(uid) {
    const snap = await getDocs(query(collection(db, "matches"), where("userIds", "array-contains", uid), limit(100)));
    const result = [];
    for (const matchDoc of snap.docs) {
      const data = matchDoc.data();
      const otherId = (data.userIds || []).find(id => id !== uid);
      if (!otherId) continue;
      const otherSnap = await getDoc(doc(db, "profiles", otherId));
      if (!otherSnap.exists()) continue;
      const photosSnap = await getDocs(query(collection(db, "photos"), where("userId", "==", otherId)));
      const photos = photosSnap.docs.map(d => d.data()).sort((a, b) => (a.position || 0) - (b.position || 0));
      result.push({ ...normalizeProfile(otherSnap.data(), otherId, photos), matchId: matchDoc.id });
    }
    return result;
  }

  async function uploadPhotos(userId, photos) {
    const previous = await getDocs(query(collection(db, "photos"), where("userId", "==", userId)));
    for (const item of previous.docs) {
      const path = item.data().storagePath;
      if (path) {
        try { await deleteObject(ref(storage, path)); } catch {}
      }
    }

    const urls = [];
    for (let i = 0; i < photos.length; i++) {
      const item = photos[i];
      if (!item?.dataUrl) continue;
      const blob = await (await fetch(item.dataUrl)).blob();
      const path = "profile-photos/" + userId + "/" + crypto.randomUUID() + ".jpg";
      await uploadBytes(ref(storage, path), blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(ref(storage, path));
      urls.push(url);
      await setDoc(doc(collection(db, "photos")), {
        userId, storagePath: path, url, position: i, createdAt: serverTimestamp()
      });
    }
    return urls;
  }

  return {
    mode: "firebase",
    onAuthChange(callback) {
      return onAuthStateChanged(auth, callback);
    },
    async session() {
      return loadMe(current());
    },
    async signIn(email) {
      const clean = email.trim().toLowerCase();
      if (!clean) throw new Error("Informe seu e-mail.");
      const actionCodeSettings = {
        url: window.location.origin + window.location.pathname,
        handleCodeInApp: true
      };
      await sendSignInLinkToEmail(auth, clean, actionCodeSettings);
      window.localStorage.setItem(AUTH_EMAIL_KEY, clean);
    },
    async completeEmailLink() {
      if (!isSignInWithEmailLink(auth, window.location.href)) return null;
      let email = window.localStorage.getItem(AUTH_EMAIL_KEY);
      if (!email) email = window.prompt("Confirme seu e-mail para concluir o acesso ao PACE:");
      if (!email) return null;
      const result = await signInWithEmailLink(auth, email.trim().toLowerCase(), window.location.href);
      window.localStorage.removeItem(AUTH_EMAIL_KEY);
      return result.user;
    },
    async signOut() {
      await signOut(auth);
    },
    async saveProfile(me) {
      const user = current();
      if (!user) throw new Error("Sessão expirada. Entre novamente.");
      const id = user.uid;
      const geo = me.coords ? {
        lat: roundCoordinate(me.coords.latitude),
        lng: roundCoordinate(me.coords.longitude)
      } : null;

      const profile = {
        name: me.name.trim(),
        birthDate: birthDateFromAge(me.age),
        gender: me.gender,
        bio: me.bio?.trim() || "",
        hobbies: (me.hobbies || "").split(",").map(s => s.trim()).filter(Boolean),
        areaLabel: me.area || "perto de você",
        geo,
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "profiles", id), {
        ...profile,
        createdAt: (await getDoc(doc(db, "profiles", id))).data()?.createdAt || serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, "preferences", id), {
        seeking: me.seeking === "todos" ? ["mulher", "homem", "não-binário"] : [me.seeking],
        ageMin: Number(me.ageMin),
        ageMax: Number(me.ageMax),
        radiusKm: Number(me.radiusKm),
        discoverableGenders: me.seeking === "todos" ? ["mulher", "homem", "não-binário"] : [me.seeking],
        intention: me.intention || "",
        sportMatters: Boolean(me.sportMatters)
      }, { merge: true });

      await setDoc(doc(db, "sportProfiles", id), {
        plays: Boolean(me.sport && me.sport !== "não pratico"),
        sport: me.sport || "",
        frequency: me.frequency || ""
      }, { merge: true });

      await uploadPhotos(id, me.photos || []);
      return true;
    },
    async deck(next) {
      const user = current();
      if (!user) throw new Error("Sessão expirada. Entre novamente.");
      const mePrefs = {
        seeking: next.seeking,
        ageMin: Number(next.ageMin),
        ageMax: Number(next.ageMax),
        radiusKm: Number(next.radiusKm)
      };
      const [profilesSnap, blocksSnap, passesSnap, likesSnap, matchesSnap] = await Promise.all([
        getDocs(query(collection(db, "profiles"), limit(200))),
        getDocs(query(collection(db, "blocks"), where("blockerId", "==", user.uid))),
        getDocs(query(collection(db, "passes"), where("fromUser", "==", user.uid), limit(200))),
        getDocs(query(collection(db, "likes"), where("fromUser", "==", user.uid), limit(200))),
        getDocs(query(collection(db, "matches"), where("userIds", "array-contains", user.uid), limit(100)))
      ]);

      const excluded = new Set([
        user.uid,
        ...blocksSnap.docs.map(d => d.data().blockedId),
        ...passesSnap.docs.map(d => d.data().toUser),
        ...likesSnap.docs.map(d => d.data().toUser),
        ...matchesSnap.docs.flatMap(d => d.data().userIds || [])
      ]);

      const seeking = new Set(mePrefs.seeking === "todos" ? ["mulher", "homem", "não-binário"] : [mePrefs.seeking]);
      const myGeo = next.coords ? { lat: Number(next.coords.latitude), lng: Number(next.coords.longitude) } : null;

      return profilesSnap.docs.map(d => normalizeProfile(d.data(), d.id))
        .filter(p => !excluded.has(p.id))
        .filter(p => seeking.has(p.gender))
        .filter(p => p.discoverableGenders.length === 0 || p.discoverableGenders.includes(next.gender))
        .filter(p => p.age >= mePrefs.ageMin && p.age <= mePrefs.ageMax)
        .filter(p => {
          const d = distanceKm(myGeo, p.geo);
          return Number.isFinite(d) && d <= mePrefs.radiusKm;
        })
        .map(p => ({ ...p, distanceKm: Math.round(distanceKm(myGeo, p.geo) * 10) / 10 }));
    },
    async like(_me, other, kind) {
      const user = current();
      if (!user) throw new Error("Sessão expirada.");
      const otherId = other.id;
      const ids = [user.uid, otherId].sort();
      const matchId = ids.join("_");
      const likeId = user.uid + "_" + otherId;
      const reverseLikeId = otherId + "_" + user.uid;
      let matched = false;

      await runTransaction(db, async transaction => {
        const reverse = await transaction.get(doc(db, "likes", reverseLikeId));
        transaction.set(doc(db, "likes", likeId), {
          fromUser: user.uid, toUser: otherId, kind, createdAt: serverTimestamp()
        }, { merge: true });

        if (reverse.exists()) {
          matched = true;
          transaction.set(doc(db, "matches", matchId), {
            userIds: ids,
            createdAt: serverTimestamp()
          }, { merge: true });
        }
      });

      return { matched, matchId: matched ? matchId : null };
    },
    async pass(id) {
      const user = current();
      if (!user) throw new Error("Sessão expirada.");
      await setDoc(doc(db, "passes", user.uid + "_" + id), {
        fromUser: user.uid, toUser: id, createdAt: serverTimestamp()
      });
    },
    async matches() {
      const user = current();
      return user ? listMatches(user.uid) : [];
    },
    async chat(matchId) {
      const snap = await getDocs(query(
        collection(db, "matches", matchId, "messages"),
        limit(100)
      ));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    },
    subscribeChat(matchId, callback) {
      return onSnapshot(
        query(collection(db, "matches", matchId, "messages"), limit(100)),
        snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))),
        error => console.error("PACE chat realtime", error)
      );
    },
    async send(matchId, text) {
      const user = current();
      if (!user) throw new Error("Sessão expirada.");
      const body = text.trim();
      if (!body) return;
      await setDoc(doc(collection(db, "matches", matchId, "messages")), {
        senderId: user.uid,
        body,
        createdAt: serverTimestamp()
      });
    },
    async block(id) {
      const user = current();
      if (!user) throw new Error("Sessão expirada.");
      await setDoc(doc(db, "blocks", user.uid + "_" + id), {
        blockerId: user.uid, blockedId: id, createdAt: serverTimestamp()
      });
    },
    async report(id, reason) {
      const user = current();
      if (!user) throw new Error("Sessão expirada.");
      await setDoc(doc(collection(db, "reports")), {
        reporterId: user.uid, reportedId: id, reason, createdAt: serverTimestamp()
      });
    }
  };
}
