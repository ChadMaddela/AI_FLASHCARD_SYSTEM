import React, { useEffect, useState } from "react";
import axios from "axios";

const MaterialList = ({ token }) => {
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    axios.get("http://127.0.0.1:8000/api/materials/", {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => setMaterials(res.data.materials))
    .catch(err => console.error(err));
  }, [token]);

  return (
    <div>
      <h2>Uploaded Materials</h2>
      <ul>
        {materials.map(m => (
          <li key={m.id}>
            <strong>{m.title}</strong> — {m.description}
            <br /> Uploaded by: {m.uploaded_by}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MaterialList;
