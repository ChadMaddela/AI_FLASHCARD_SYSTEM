import React, { useState } from "react";
import axios from "axios";

const AnswerForm = ({ token, flashcardId }) => {
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        "http://127.0.0.1:8000/api/flashcards/submit/",
        { flashcard_id: flashcardId, selected_choice: selected },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResult(res.data);
    } catch (err) {
      alert("Submit failed");
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Enter choice (A-D)"
               value={selected}
               onChange={(e) => setSelected(e.target.value)} />
        <button type="submit">Submit Answer</button>
      </form>
      {result && (
        <div>
          <p>{result.is_correct ? "Correct!" : "Wrong!"}</p>
          <p>Correct Answer: {result.correct_answer}</p>
          <p>Mastery Level: {result.analytics.updated_mastery_level}</p>
        </div>
      )}
    </div>
  );
};

export default AnswerForm;
