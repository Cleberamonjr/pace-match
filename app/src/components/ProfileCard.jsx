export function ProfileCard({ person, onPass, onLike }) {
  return (
    <article className="card">
      <img src={person.photo} alt="" />
      <div className="veil" />
      <div className="meta">
        <h2>{person.name}, {person.age}</h2>
        <p>{person.km.toString().replace(".", ",")} km · {person.area}</p>
        <p>{person.bio}</p>
        <span className="badge">{person.score}% compatível</span>
        {person.sport ? <span className="badge">{person.sport}</span> : null}
        {person.hobbies?.[0] ? <span className="badge">{person.hobbies[0]}</span> : null}
      </div>
      <div className="actions" style={{ position: "absolute", bottom: -64, left: 0, right: 0 }}>
        <button className="round" onClick={onPass}>✕</button>
        <button className="round like" onClick={onLike}>♥</button>
      </div>
    </article>
  );
}
