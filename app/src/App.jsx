import { useEffect, useMemo, useState } from "react";
import { createRepository } from "./data/repository.js";
import { SwipeDeck } from "./components/SwipeDeck.jsx";
import { MatchModal } from "./components/MatchModal.jsx";
import { ChatWindow } from "./components/ChatWindow.jsx";
import { track } from "./lib/analytics.js";

const empty = {
  name: "", age: "", gender: "", seeking: "todos", ageMin: 24, ageMax: 40, radiusKm: 15,
  intention: "", sport: "", frequency: "", sportMatters: false, bio: "", hobbies: "",
  photos: [], area: "", gps: false, blocked: []
};

export default function App() {
  const repo = useMemo(() => createRepository(), []);
  const [step, setStep] = useState(0);
  const [me, setMe] = useState(empty);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("deck");
  const [people, setPeople] = useState([]);
  const [match, setMatch] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => { (async () => { try { const session = await repo.session(); if (session?.me) { setMe({ ...empty, ...session.me }); setMatches(session.matches || []); setReady(true); } else track("signup_started"); } catch (e) { setError(e.message); } })(); }, [repo]);
  useEffect(() => { if (ready) refresh(me); }, [ready, me.radiusKm, me.ageMin, me.ageMax, me.seeking, me.blocked, matches]);

  async function refresh(next = me) {
    const deck = await repo.deck({ ...next, hobbies: next.hobbies.split(",").map(s => s.trim()).filter(Boolean) });
    setPeople(deck.filter(p => !next.blocked.includes(p.id) && !matches.find(m => m.id === p.id)));
  }

  function set(key, value) { setMe(m => ({ ...m, [key]: value })); }

  async function finish() {
    if (!me.gps) { setError("GPS é obrigatório. A tela só mostra a distância, nunca a coordenada."); return; }
    if (me.photos.length < 3) { setError("São necessárias 3 fotos."); return; }
    await repo.saveProfile(me);
    setReady(true);
    track("signup_completed");
    track("location_enabled");
    await refresh(me);
  }

  async function act(person, kind) {
    track(kind === "pass" ? "pass_sent" : kind === "super" ? "superlike_sent" : "like_sent");
    setPeople(list => list.slice(1));
    if (kind === "pass") { await repo.pass(person.id); return; }
    const result = await repo.like(me, person, kind);
    if (result.matched) {
      track("match_created");
      const nextMatches = [...matches, person];
      setMatches(nextMatches);
      await repo.saveMatches(nextMatches);
      setMatch(person);
    }
  }

  async function openChat(person) {
    setChatId(person.id);
    setMatch(null);
    setMessages(await repo.chat(person.id));
    track("chat_started");
  }

  const current = matches.find(p => p.id === chatId);
  return (
    <div className="stage">
      <div className="banner">{repo.mode === "local" ? "Modo local. Match real depende do Supabase." : "Supabase conectado."}</div>
      {repo.mode === "unconfigured" ? null : !ready ? <Onboarding step={step} me={me} set={set} error={error} onBack={() => setStep(s => Math.max(0, s - 1))} onNext={async () => {
        setError("");
        if (step === 0 && (!me.name || +me.age < 18 || !me.gender || me.photos.length < 3)) return setError("Nome, idade 18+, gênero e 3 fotos.");
        if (step === 1 && (!me.seeking || !me.ageMin || !me.ageMax)) return setError("Defina quem você procura, faixa e distância.");
        if (step < 4) return setStep(s => s + 1);
        await finish();
      }} /> : chatId && current ? <ChatWindow person={current} messages={messages} onClose={() => setChatId(null)} onSend={async text => { await repo.send(current.id, text); track("message_sent"); setMessages(await repo.chat(current.id)); }} onBlock={async () => { await repo.block(current.id); setMe(m => ({ ...m, blocked: [...m.blocked, current.id] })); setChatId(null); }} onReport={async () => { await repo.report(current.id, "denúncia"); }} /> : (
        <>
          <header className="top"><strong className="word">PA<span>CE</span></strong><span>{me.radiusKm} km</span></header>
          {tab === "deck" && <SwipeDeck people={people} onPass={p => act(p, "pass")} onLike={p => act(p, "like")} onSuper={p => act(p, "super")} />}
          {tab === "matches" && <div className="pad">{matches.map(p => <button key={p.id} className="person" onClick={() => openChat(p)}><img src={p.photo} alt="" /><span><b>{p.name}</b><small>{p.score}% · {p.area}</small></span></button>)}</div>}
          {tab === "me" && <Profile me={me} />}
          <nav className="nav">
            <button className={tab === "deck" ? "on" : ""} onClick={() => setTab("deck")}>Descobrir</button>
            <button className={tab === "matches" ? "on" : ""} onClick={() => setTab("matches")}>Matches</button>
            <button className={tab === "me" ? "on" : ""} onClick={() => setTab("me")}>Perfil</button>
          </nav>
          <MatchModal me={me} person={match} onChat={() => openChat(match)} onClose={() => setMatch(null)} />
        </>
      )}
    </div>
  );
}

function Onboarding({ step, me, set, error, onBack, onNext }) {
  return (
    <section className="pad">
      <p className="word">PA<span>CE</span></p>
      {step === 0 && <Identity me={me} set={set} />}
      {step === 1 && <Seeking me={me} set={set} />}
      {step === 2 && <Intention me={me} set={set} />}
      {step === 3 && <Sport me={me} set={set} />}
      {step === 4 && <About me={me} set={set} />}
      <p className="err">{error}</p>
      <div className="dock"><button className="secondary" onClick={onBack}>Voltar</button><button className="primary" onClick={onNext}>{step === 4 ? "Entrar" : "Continuar"}</button></div>
    </section>
  );
}

function Identity({ me, set }) {
  return <><h1>Quem é você</h1><label>Nome</label><input value={me.name} onChange={e => set("name", e.target.value)} /><label>Idade</label><input type="number" value={me.age} onChange={e => set("age", e.target.value)} /><label>Gênero</label><Chips value={me.gender} options={["mulher", "homem", "não-binário"]} onPick={v => set("gender", v)} /><label>3 fotos</label><input type="file" accept="image/*" multiple onChange={async e => set("photos", await files(e.target.files))} /><div className="photos">{me.photos.map((src, i) => <div className="slot" key={i}><img src={src.dataUrl || src.public_url || src.url || src} alt="" /></div>)}</div></>;
}
function Seeking({ me, set }) {
  return <><h1>Quem você procura</h1><Chips value={me.seeking} options={["mulher", "homem", "todos"]} onPick={v => set("seeking", v)} /><label>Idade mínima</label><input type="number" value={me.ageMin} onChange={e => set("ageMin", +e.target.value)} /><label>Idade máxima</label><input type="number" value={me.ageMax} onChange={e => set("ageMax", +e.target.value)} /><label>Distância máxima · {me.radiusKm} km</label><input type="range" min="0" max="50" value={me.radiusKm} onChange={e => set("radiusKm", +e.target.value)} /><Gps onPlace={place => { set("area", place); set("gps", true); }} /></>;
}
function Intention({ me, set }) {
  return <><h1>Intenção</h1><p className="lede">Relacionamento. Não é busca de treino.</p><Chips value={me.intention} options={["namoro", "conhecer", "relação séria"]} onPick={v => set("intention", v)} /></>;
}
function Sport({ me, set }) {
  return <><h1>Esporte, se quiser</h1><p className="lede">Opcional. Não praticar não tira ninguém do deck.</p><Chips value={me.sport} options={["corrida", "academia", "trilha", "não pratico"]} onPick={v => set("sport", v)} /><label>Frequência</label><input value={me.frequency} onChange={e => set("frequency", e.target.value)} /><Chips value={me.sportMatters ? "importa" : "não importa"} options={["importa", "não importa"]} onPick={v => set("sportMatters", v === "importa")} /></>;
}
function About({ me, set }) {
  return <><h1>Sobre você</h1><label>Bio</label><textarea value={me.bio} onChange={e => set("bio", e.target.value)} /><label>Hobbies, separados por vírgula</label><input value={me.hobbies} onChange={e => set("hobbies", e.target.value)} /></>;
}
function Profile({ me }) {
  return <section className="pad"><h1>{me.name}, {me.age}</h1><p>{me.area || "perto de você"} · {me.radiusKm} km</p><p>{me.bio}</p><p className="hint">{me.sport || "sem esporte"} · {me.intention}</p></section>;
}
function Chips({ value, options, onPick }) {
  return <div className="chips">{options.map(o => <button key={o} className={value === o ? "chip on" : "chip"} onClick={() => onPick(o)}>{o}</button>)}</div>;
}
function Gps({ onPlace }) {
  return <button className="secondary" onClick={() => navigator.geolocation.getCurrentPosition(() => onPlace("perto de você"), () => onPlace(""))}>Permitir GPS</button>;
}
function files(list) {
  return Promise.all([...list].slice(0, 6).map(file => new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(file); })));
}
