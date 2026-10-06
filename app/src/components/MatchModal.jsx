import { connectionHint } from "../domain/score.js";

export function MatchModal({ me, person, onChat, onClose }) {
  if (!person) return null;
  return (
    <div className="match">
      <div className="pair">
        <img src={person.photo} alt="" />
        <img src={me.photos?.[0] || person.photo} alt="" />
      </div>
      <h2>É um Match</h2>
      <p>Vocês têm {person.score}% de compatibilidade. Esporte não decidiu isso sozinho.</p>
      <p>{connectionHint(me, person)}</p>
      <button className="primary" onClick={onChat}>Enviar mensagem</button>
      <button className="secondary" onClick={onClose}>Continuar descobrindo</button>
    </div>
  );
}
