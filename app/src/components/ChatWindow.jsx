import { useState } from "react";

export function ChatWindow({ person, messages, onSend, onBlock, onReport, onClose }) {
  const [text, setText] = useState("");
  return (
    <section className="pad">
      <button className="secondary" onClick={onClose}>Voltar</button>
      <h1>{person.name}</h1>
      <p className="hint">{person.km.toString().replace(".", ",")} km · {person.area}. Sem coordenada.</p>
      {messages.map((m, i) => <p key={i} className="bubble">{m.text}</p>)}
      <div className="dock">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Mensagem" />
        <button className="primary" onClick={() => { if (text.trim()) { onSend(text.trim()); setText(""); } }}>Enviar</button>
      </div>
      <button className="secondary" onClick={onBlock}>Desfazer conexão</button>
      <button className="secondary" onClick={onReport}>Denunciar</button>
    </section>
  );
}
