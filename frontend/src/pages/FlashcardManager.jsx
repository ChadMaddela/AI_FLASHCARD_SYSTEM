import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

function FlashcardManager() {
  const { token } = useContext(AuthContext);
  const [flashcards, setFlashcards] = useState([]);

  // Fetch all flashcards
  useEffect(() => {
    const fetchFlashcards = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/flashcards/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setFlashcards(data.flashcards || []);
      } catch (err) {
        console.error("Failed to fetch flashcards", err);
      }
    };
    fetchFlashcards();
  }, [token]);

  // Edit flashcard
  const handleEdit = async (id, updated) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/flashcards/${id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updated),
      });
      setFlashcards(flashcards.map(fc => fc.id === id ? { ...fc, ...updated } : fc));
    } catch (err) {
      console.error("Failed to update flashcard", err);
    }
  };

  // Delete flashcard
  const handleDelete = async (id) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/flashcards/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setFlashcards(flashcards.filter(fc => fc.id !== id));
    } catch (err) {
      console.error("Failed to delete flashcard", err);
    }
  };

  return (
    <div className="flashcard-manager">
      <h2>Manage Flashcards</h2>
      {flashcards.length === 0 ? (
        <p>No flashcards available.</p>
      ) : (
        flashcards.map(fc => (
          <div key={fc.id} className="flashcard-item">
            <input
              type="text"
              value={fc.question}
              onChange={e => handleEdit(fc.id, { question: e.target.value })}
            />
            <div>
              <label>A:</label>
              <input
                type="text"
                value={fc.choice_a}
                onChange={e => handleEdit(fc.id, { choice_a: e.target.value })}
              />
            </div>
            <div>
              <label>B:</label>
              <input
                type="text"
                value={fc.choice_b}
                onChange={e => handleEdit(fc.id, { choice_b: e.target.value })}
              />
            </div>
            <div>
              <label>C:</label>
              <input
                type="text"
                value={fc.choice_c}
                onChange={e => handleEdit(fc.id, { choice_c: e.target.value })}
              />
            </div>
            <div>
              <label>D:</label>
              <input
                type="text"
                value={fc.choice_d}
                onChange={e => handleEdit(fc.id, { choice_d: e.target.value })}
              />
            </div>
            <button onClick={() => handleDelete(fc.id)}>Delete</button>
          </div>
        ))
      )}
    </div>
  );
}

export default FlashcardManager;
