import React, { useEffect, useState } from "react";
import axios from "axios";

const FlashcardQueue = ({ token, materialId }) => {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    axios.get(`http://127.0.0.1:8000/api/materials/${materialId}/queue/`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => setQueue(res.data.queue))
    .catch(err => console.error(err));
  }, [token, materialId]);

  return (
    <div>
      <h2>Flashcard Queue</h2>
      {queue.map(card => (
        <div key={card.id}>
          <p><strong>{card.question}</strong></p>
          <ul>
            {Object.entries(card.choices).map(([k,v]) => (
              <li key={k}>{k}: {v}</li>
            ))}
          </ul>
          <p>Mastery Level: {card.current_mastery_level}</p>
        </div>
      ))}
    </div>
  );
};

export default FlashcardQueue;
