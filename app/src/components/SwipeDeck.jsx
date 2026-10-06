import { useState } from "react";
import { ProfileCard } from "./ProfileCard.jsx";

export function SwipeDeck({ people, onPass, onLike, onSuper }) {
  const [dx, setDx] = useState(0);
  const [start, setStart] = useState(null);
  const person = people[0];
  if (!person) return <p className="hint">Ninguém neste raio e nesta faixa. Isso é filtro, não falta de pace.</p>;
  return (
    <div className="deck"
      onPointerDown={e => setStart(e.clientX)}
      onPointerMove={e => start != null && setDx(e.clientX - start)}
      onPointerUp={() => {
        if (dx > 90) onLike(person);
        else if (dx < -90) onPass(person);
        setDx(0); setStart(null);
      }}>
      <div style={{ transform: `translateX(${dx}px) rotate(${dx / 18}deg)`, height: "100%" }}>
        <ProfileCard person={person} onPass={() => onPass(person)} onLike={() => onLike(person)} />
      </div>
      <div className="actions">
        <button className="round" onClick={() => onPass(person)}>✕</button>
        <button className="round" onClick={() => onSuper(person)}>★</button>
        <button className="round like" onClick={() => onLike(person)}>♥</button>
      </div>
    </div>
  );
}
