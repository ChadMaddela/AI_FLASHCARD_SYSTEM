import React, { useState } from "react";
import axios from "axios";

const TeacherUpload = ({ token }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const formData = new FormData();
      if (title) formData.append("title", title);
      if (content) formData.append("content", content);
      if (file) formData.append("file", file);

      const res = await axios.post(
        "http://127.0.0.1:8000/api/teacher/upload/",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`, // JWT or session token
          },
        }
      );

      setResponse(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed");
    }
  };

  return (
    <div className="teacher-upload">
      <h2>Teacher Upload Material</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Title:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter material title"
          />
        </div>

        <div>
          <label>Content (optional text):</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste lecture notes here"
          />
        </div>

        <div>
          <label>File (PDF, DOCX, PPTX, Image):</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>

        <button type="submit">Upload</button>
      </form>

      {response && (
        <div className="upload-result">
          <h3>Upload Successful</h3>
          <p>{response.message}</p>
          <p>Material ID: {response.material_id}</p>
          <p>Flashcards Created: {response.flashcards_count}</p>
        </div>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default TeacherUpload;
