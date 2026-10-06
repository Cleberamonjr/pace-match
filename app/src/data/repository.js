import { createClient } from "../lib/supabaseClient.js";

export function createRepository() {
  const supabase = createClient();
  if (!supabase) return unconfiguredRepository();
  return supabaseRepository(supabase);
}

function unconfiguredRepository() {
  const error = () => new Error("PACE ainda não está conectado ao Supabase. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  return {
    mode: "unconfigured",
    async session() { return null; },
    async signIn(email) { throw error(); },
    async signOut() {},
    async saveProfile() { throw error(); },
    async deck() { throw error(); },
    async like() { throw error(); },
    async pass() { throw error(); },
    async matches() { throw error(); },
    async chat() { throw error(); },
    async send() { throw error(); },
    async block() { throw error(); },
    async report() { throw error(); }
  };
}

function birthDateFromAge(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - Number(age));
  return d.toISOString().slice(0, 10);
}

async function supabaseRepository(supabase) {
  const current = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  };

  return {
    mode: "supabase",
    async session() {
      const session = await current();
      if (!session) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (error) throw error;
      if (!data) return { auth: session, me: null, matches: [] };
      const [{ data: prefs }, { data: sport }, { data: photos }] = await Promise.all([
        supabase.from("preferences").select("*").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("sport_profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("photos").select("*").eq("user_id", session.user.id).order("position")
      ]);
      return {
        auth: session,
        me: {
          ...data,
          age: new Date().getFullYear() - new Date(data.birth_date).getFullYear(),
          hobbies: (data.hobbies || []).join(", "),
          seeking: prefs?.seeking_genders?.length === 1 ? prefs.seeking_genders[0] : "todos",
          ageMin: prefs?.age_min ?? 24,
          ageMax: prefs?.age_max ?? 40,
          radiusKm: prefs?.radius_km ?? 15,
          intention: prefs?.intention ?? "",
          sportMatters: prefs?.sport_matters ?? false,
          sport: sport?.sport ?? "",
          frequency: sport?.frequency ?? "",
          gps: true,
          photos: photos || []
        },
        matches: []
      };
    },
    async signIn(email) {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo }
      });
      if (error) throw error;
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    async saveProfile(me) {
      const session = await current();
      if (!session) throw new Error("Sessão expirada. Entre novamente.");
      const id = session.user.id;
      const profile = {
        id,
        name: me.name.trim(),
        birth_date: birthDateFromAge(me.age),
        gender: me.gender,
        bio: me.bio?.trim() || null,
        hobbies: (me.hobbies || "").split(",").map(s => s.trim()).filter(Boolean),
        area_label: me.area || null
      };
      const { error: profileError } = await supabase.from("profiles").upsert(profile);
      if (profileError) throw profileError;
      const { error: prefError } = await supabase.from("preferences").upsert({
        user_id: id,
        seeking_genders: me.seeking === "todos" ? ["mulher", "homem", "não-binário"] : [me.seeking],
        age_min: Number(me.ageMin),
        age_max: Number(me.ageMax),
        radius_km: Number(me.radiusKm),
        intention: me.intention || null,
        sport_matters: Boolean(me.sportMatters)
      });
      if (prefError) throw prefError;
      const { error: sportError } = await supabase.from("sport_profiles").upsert({
        user_id: id,
        plays: Boolean(me.sport && me.sport !== "não pratico"),
        sport: me.sport || null,
        frequency: me.frequency || null
      });
      if (sportError) throw sportError;
      if (me.coords) {
        const { error } = await supabase.from("locations").upsert({
          user_id: id, latitude: me.coords.latitude, longitude: me.coords.longitude, updated_at: new Date().toISOString()
        });
        if (error) throw error;
      }
      return this.uploadPhotos(me.photos || []);
    },
    async uploadPhotos(photos) {
      const session = await current();
      if (!session) throw new Error("Sessão expirada.");
      const userId = session.user.id;
      await supabase.from("photos").delete().eq("user_id", userId);
      const rows = [];
      for (let i = 0; i < photos.length; i++) {
        if (!photos[i]?.dataUrl) continue;
        const blob = await (await fetch(photos[i].dataUrl)).blob();
        const path = userId + "/" + crypto.randomUUID() + ".jpg";
        const { error } = await supabase.storage.from("profile-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        rows.push({ user_id: userId, storage_path: path, position: i });
      }
      if (rows.length) {
        const { error } = await supabase.from("photos").insert(rows);
        if (error) throw error;
      }
    },
    async deck() {
      const { data, error } = await supabase.rpc("discover_profiles");
      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        photo: p.photo_url,
        area: p.area_label || "perto de você",
        score: null,
        likesYou: false
      }));
    },
    async like(_me, other, kind) {
      const { data, error } = await supabase.rpc("send_like_and_match", { p_to_user: other.id, p_kind: kind });
      if (error) throw error;
      return { matched: Boolean(data?.matched), matchId: data?.match_id || null };
    },
    async pass(_id) {
      return;
    },
    async matches() {
      const { data, error } = await supabase.from("matches").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async chat(matchId) {
      const { data, error } = await supabase.from("messages").select("*").eq("match_id", matchId).order("created_at");
      if (error) throw error;
      return data || [];
    },
    async send(matchId, text) {
      const session = await current();
      if (!session) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("messages").insert({ match_id: matchId, sender: session.user.id, body: text.trim() });
      if (error) throw error;
    },
    async block(id) {
      const session = await current();
      const { error } = await supabase.from("blocks").upsert({ blocker: session.user.id, blocked: id });
      if (error) throw error;
    },
    async report(id, reason) {
      const session = await current();
      const { error } = await supabase.from("reports").insert({ reporter: session.user.id, reported: id, reason });
      if (error) throw error;
    }
  };
}
