import { createClient } from "./supabaseClient.js";
import { demoProfiles } from "./demoProfiles.js";
import { passesHardFilters, toPublicProfile } from "../domain/filters.js";
import { paceScore } from "../domain/score.js";

export function createRepository() {
  const supabase = createClient();
  if (supabase) return supabaseRepository(supabase);
  return localRepository();
}

function localRepository() {
  const load = () => JSON.parse(localStorage.getItem("pace.session") || "null");
  const save = (state) => localStorage.setItem("pace.session", JSON.stringify(state));
  return {
    mode: "local",
    async deck(me) {
      return demoProfiles
        .filter(p => passesHardFilters(me, p, me.blocked || []))
        .map(p => ({ ...toPublicProfile(p), score: paceScore(me, p), likesYou: p.likesYou }))
        .sort((a, b) => b.score - a.score);
    },
    async like(me, other, kind) {
      const state = load() || { sent: [], matches: [], chats: {}, blocked: [] };
      state.sent.push({ id: other.id, kind });
      if (other.likesYou && !state.matches.find(m => m.id === other.id)) {
        state.matches.push({ id: other.id, score: other.score });
        state.chats[other.id] = state.chats[other.id] || [];
      }
      save(state);
      return { matched: Boolean(other.likesYou) };
    },
    async chat(id) {
      return (load()?.chats?.[id]) || [];
    },
    async send(id, text) {
      const state = load() || { chats: {} };
      state.chats[id] = state.chats[id] || [];
      state.chats[id].push({ from: "me", text });
      save(state);
    },
    async block(id) {
      const state = load() || { blocked: [] };
      state.blocked = [...new Set([...(state.blocked || []), id])];
      save(state);
    },
    async report(id, reason) {
      const state = load() || { reports: [] };
      state.reports = [...(state.reports || []), { id, reason, at: new Date().toISOString() }];
      save(state);
    }
  };
}

function supabaseRepository(supabase) {
  return {
    mode: "supabase",
    async deck() {
      const { data, error } = await supabase.from("profiles").select("id,name,birth_date,gender,bio,hobbies,area_label");
      if (error) throw error;
      return data;
    },
    async like() { throw new Error("Likes reais entram na fase 8, depois do Auth."); },
    async chat() { return []; },
    async send() { throw new Error("Chat realtime entra na fase 10."); },
    async block() { throw new Error("Bloqueio real entra na fase 11."); },
    async report() { throw new Error("Denúncia real entra na fase 11."); }
  };
}
